import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting per tenant
const tenantRateLimits = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_BATCHES_PER_HOUR = 10;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

// Concurrency limits
const MAX_CONCURRENT_ITEMS_PER_TENANT = 5;
const MAX_FILES_PER_BATCH = 20000;
const MIN_FILES_PER_BATCH = 1;

interface BatchCreateRequest {
  totalFiles: number;
  source?: 'ui_upload' | 'background_import';
}

interface UploadCompleteRequest {
  batchId: string;
}

function checkTenantRateLimit(tenantId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const limit = tenantRateLimits.get(tenantId);

  if (!limit || now > limit.resetTime) {
    tenantRateLimits.set(tenantId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true };
  }

  if (limit.count >= RATE_LIMIT_BATCHES_PER_HOUR) {
    const retryAfter = Math.ceil((limit.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }

  limit.count++;
  return { allowed: true };
}

async function logAudit(
  supabase: any,
  userId: string,
  action: string,
  entityId: string,
  context: Record<string, unknown>
) {
  try {
    await supabase.from('audit_log').insert({
      entity_type: 'cv_batch',
      entity_id: entityId,
      action,
      changed_by: userId,
      diff: {},
      context: {
        ...context,
        function: 'cv-batch-import',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error('Failed to log audit:', e);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    // 1. Require authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Service client for background operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Validate JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub as string;

    // 3. Check user role and get team
    const { data: roleData } = await supabase.rpc('get_user_role', { _user_id: userId });
    const role = roleData as string | null;
    
    if (!role || role === 'viewer') {
      return new Response(
        JSON.stringify({ success: false, error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: teamData } = await supabase.rpc('get_user_team_id', { _user_id: userId });
    const tenantId = teamData as string | null;

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: 'No team found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const method = req.method;

    // Route: POST /cv-batch-import - Create new batch
    if (method === 'POST' && pathParts.length === 1) {
      const rateCheck = checkTenantRateLimit(tenantId);
      if (!rateCheck.allowed) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rateCheck.retryAfter) } }
        );
      }

      const body: BatchCreateRequest = await req.json();
      
      if (!body.totalFiles || body.totalFiles < MIN_FILES_PER_BATCH || body.totalFiles > MAX_FILES_PER_BATCH) {
        return new Response(
          JSON.stringify({ success: false, error: `Total files must be between ${MIN_FILES_PER_BATCH} and ${MAX_FILES_PER_BATCH}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create the batch
      const { data: batch, error: batchError } = await supabase
        .from('cv_import_batches')
        .insert({
          tenant_id: tenantId,
          created_by_user_id: userId,
          source: body.source || 'ui_upload',
          status: 'queued',
          total_files: body.totalFiles,
        })
        .select()
        .single();

      if (batchError) {
        console.error('Failed to create batch:', batchError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to create batch' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await logAudit(supabase, userId, 'batch_created', batch.id, {
        totalFiles: body.totalFiles,
        source: body.source || 'ui_upload',
      });

      // Generate upload path pattern
      const uploadPath = `${tenantId}/${batch.id}`;

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            batch,
            uploadPath,
            maxConcurrentUploads: MAX_CONCURRENT_ITEMS_PER_TENANT,
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: GET /cv-batch-import/:batchId - Get batch details
    if (method === 'GET' && pathParts.length === 2) {
      const batchId = pathParts[1];

      const { data: batch, error } = await supabase
        .from('cv_import_batches')
        .select('*')
        .eq('id', batchId)
        .single();

      if (error || !batch) {
        return new Response(
          JSON.stringify({ success: false, error: 'Batch not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: batch }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: GET /cv-batch-import/:batchId/items - Get batch items (paginated)
    if (method === 'GET' && pathParts.length === 3 && pathParts[2] === 'items') {
      const batchId = pathParts[1];
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
      const statusFilter = url.searchParams.get('status');
      const offset = (page - 1) * limit;

      let query = supabase
        .from('cv_import_items')
        .select('*', { count: 'exact' })
        .eq('batch_id', batchId)
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1);

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data: items, count, error } = await query;

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to fetch items' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            items,
            pagination: {
              page,
              limit,
              total: count,
              totalPages: Math.ceil((count || 0) / limit),
            }
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: POST /cv-batch-import/:batchId/complete-upload - Signal upload complete
    if (method === 'POST' && pathParts.length === 3 && pathParts[2] === 'complete-upload') {
      const batchId = pathParts[1];

      // Update batch status to processing
      const { data: batch, error: updateError } = await supabase
        .from('cv_import_batches')
        .update({
          status: 'processing',
          started_at: new Date().toISOString(),
        })
        .eq('id', batchId)
        .eq('status', 'queued')
        .select()
        .single();

      if (updateError || !batch) {
        return new Response(
          JSON.stringify({ success: false, error: 'Batch not found or already processing' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await logAudit(supabase, userId, 'batch_processing_started', batchId, {});

      // Trigger background processing (fire and forget)
      // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
      (globalThis as any).EdgeRuntime?.waitUntil?.(processQueuedItems(supabaseAdmin, batchId, tenantId)) 
        || processQueuedItems(supabaseAdmin, batchId, tenantId);

      return new Response(
        JSON.stringify({ success: true, data: batch }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: POST /cv-batch-import/items/:itemId/retry - Retry failed item
    if (method === 'POST' && pathParts.length === 3 && pathParts[1] === 'items' && pathParts[2] !== 'resolve-dedupe') {
      const itemId = pathParts[2].replace('/retry', '');

      const { data: item, error: fetchError } = await supabase
        .from('cv_import_items')
        .select('*, batch:cv_import_batches(*)')
        .eq('id', itemId)
        .single();

      if (fetchError || !item) {
        return new Response(
          JSON.stringify({ success: false, error: 'Item not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (item.status !== 'failed') {
        return new Response(
          JSON.stringify({ success: false, error: 'Only failed items can be retried' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Reset item status
      const { error: updateError } = await supabase
        .from('cv_import_items')
        .update({
          status: 'queued',
          error_message: null,
          started_at: null,
          completed_at: null,
        })
        .eq('id', itemId);

      if (updateError) {
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to retry item' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await logAudit(supabase, userId, 'item_retry', itemId, { batchId: item.batch_id });

      // Trigger processing
      // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
      (globalThis as any).EdgeRuntime?.waitUntil?.(processQueuedItems(supabaseAdmin, item.batch_id, tenantId))
        || processQueuedItems(supabaseAdmin, item.batch_id, tenantId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: POST /cv-batch-import/items/:itemId/resolve-dedupe
    if (method === 'POST' && pathParts.length === 4 && pathParts[1] === 'items' && pathParts[3] === 'resolve-dedupe') {
      const itemId = pathParts[2];
      const body = await req.json();
      const { action, candidateId } = body as { action: 'create_new' | 'merge_into' | 'link_existing'; candidateId?: string };

      const { data: item, error: fetchError } = await supabase
        .from('cv_import_items')
        .select('*')
        .eq('id', itemId)
        .single();

      if (fetchError || !item) {
        return new Response(
          JSON.stringify({ success: false, error: 'Item not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (item.status !== 'dedupe_review') {
        return new Response(
          JSON.stringify({ success: false, error: 'Item is not in dedupe review status' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let newStatus: string = 'merged';
      let linkedCandidateId: string | null = null;

      if (action === 'create_new') {
        // Create new talent record from extracted data
        // For now, just mark as parsed - talent creation would happen in real implementation
        newStatus = 'parsed';
      } else if (action === 'merge_into' || action === 'link_existing') {
        if (!candidateId) {
          return new Response(
            JSON.stringify({ success: false, error: 'candidateId required for merge/link' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        linkedCandidateId = candidateId;
        newStatus = 'merged';
      }

      const { error: updateError } = await supabase
        .from('cv_import_items')
        .update({
          status: newStatus,
          candidate_id: linkedCandidateId,
          completed_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      if (updateError) {
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to resolve dedupe' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await logAudit(supabase, userId, 'dedupe_resolved', itemId, { action, candidateId });

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in cv-batch-import:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Background processing function
async function processQueuedItems(supabase: any, batchId: string, tenantId: string) {
  console.log(`Starting background processing for batch ${batchId}`);
  
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.error('LOVABLE_API_KEY not configured');
    return;
  }

  // Process items in batches with concurrency limit
  const CONCURRENT_LIMIT = MAX_CONCURRENT_ITEMS_PER_TENANT;
  
  while (true) {
    // Fetch next batch of queued items
    const { data: items, error } = await supabase
      .from('cv_import_items')
      .select('*')
      .eq('batch_id', batchId)
      .eq('status', 'queued')
      .limit(CONCURRENT_LIMIT);

    if (error || !items || items.length === 0) {
      console.log(`No more queued items for batch ${batchId}`);
      break;
    }

    // Process items concurrently
    await Promise.all(items.map((item: any) => processItem(supabase, item, LOVABLE_API_KEY!)));
  }

  console.log(`Completed processing for batch ${batchId}`);
}

async function processItem(supabase: any, item: any, apiKey: string) {
  console.log(`Processing item ${item.id}: ${item.file_name}`);
  
  try {
    // Mark as processing
    await supabase
      .from('cv_import_items')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
      })
      .eq('id', item.id);

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from('cv-uploads')
      .download(item.storage_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message || 'Unknown error'}`);
    }

    // Convert to base64 or text based on file type
    let extractionPayload: any;
    
    if (item.file_type === 'application/pdf') {
      // For PDFs, we need to convert to base64
      const arrayBuffer = await fileData.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      extractionPayload = {
        imageBase64: base64,
        mimeType: 'application/pdf',
      };
    } else {
      // For text-based formats (DOC/DOCX would need additional processing in production)
      const text = await fileData.text();
      extractionPayload = { textContent: text };
    }

    // Call AI extraction
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an expert CV parser. Extract structured talent information and return as JSON with fields: name, email, phone, location, roleType, seniority (executive/director/manager/senior/mid/junior), skills (array), aiOverview (2-3 sentence summary), experience (array with company, title, startDate, endDate, description), education (array with institution, degree, field), confidence (high/medium/low).`
          },
          {
            role: 'user',
            content: extractionPayload.imageBase64 
              ? [
                  { type: 'text', text: 'Extract talent info from this CV:' },
                  { type: 'image_url', image_url: { url: `data:${extractionPayload.mimeType};base64,${extractionPayload.imageBase64}` } }
                ]
              : `Extract talent info from this CV text:\n\n${extractionPayload.textContent}`
          }
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`AI extraction failed: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    // Parse JSON from response
    let extractedData;
    try {
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
      if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
      if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
      extractedData = JSON.parse(jsonStr.trim());
    } catch {
      throw new Error('Failed to parse AI response as JSON');
    }

    const confidence = extractedData.talent?.confidence || extractedData.confidence || 'medium';
    const confidenceScore = confidence === 'high' ? 0.9 : confidence === 'medium' ? 0.7 : 0.5;

    // TODO: Implement dedupe check against existing talents
    // For now, mark as parsed
    const finalStatus = 'parsed';

    await supabase
      .from('cv_import_items')
      .update({
        status: finalStatus,
        parse_confidence: confidenceScore,
        extracted_data: extractedData,
        completed_at: new Date().toISOString(),
      })
      .eq('id', item.id);

    console.log(`Successfully processed item ${item.id}`);

  } catch (error) {
    console.error(`Failed to process item ${item.id}:`, error);
    
    await supabase
      .from('cv_import_items')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString(),
      })
      .eq('id', item.id);
  }
}