import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
const PROCESSING_CHUNK_SIZE = 2;
const INTERNAL_BATCH_TOKEN_HEADER = 'x-internal-batch-token';

// Retry configuration
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;

// Canonical candidate profile schema
interface CandidateProfileParse {
  personal: {
    full_name: string;
    email?: string;
    phone?: string;
    home_address?: string;
    location?: string;
    linkedin_url?: string;
  };
  headline: {
    current_title?: string;
    current_company?: string;
    seniority_level?: 'executive' | 'director' | 'manager' | 'senior' | 'mid' | 'junior';
  };
  summary?: string;
  skills: {
    primary_skills: string[];
    secondary_skills: string[];
    keywords: string[];
  };
  experience: {
    roles: Array<{
      company: string;
      title: string;
      start_date?: string;
      end_date?: string;
      summary?: string;
      achievements?: string[];
    }>;
  };
  education: {
    items: Array<{
      institution: string;
      degree?: string;
      field?: string;
      start_date?: string;
      end_date?: string;
    }>;
  };
  certifications: string[];
  industries: string[];
  clearance_work_auth?: string;
  notes?: {
    gaps?: string[];
    inconsistencies?: string[];
  };
  overall_confidence: number;
  field_confidence: Record<string, number>;
}

interface BatchCreateRequest {
  totalFiles: number;
  source?: 'ui_upload' | 'background_import';
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

// Generate search tags from extracted data
function generateSearchTags(data: CandidateProfileParse): string[] {
  const tags = new Set<string>();
  
  // Add skills as tags
  data.skills?.primary_skills?.forEach(s => tags.add(s.toLowerCase().trim()));
  data.skills?.secondary_skills?.forEach(s => tags.add(s.toLowerCase().trim()));
  data.skills?.keywords?.forEach(k => tags.add(k.toLowerCase().trim()));
  
  // Add industries
  data.industries?.forEach(i => tags.add(i.toLowerCase().trim()));
  
  // Add current title words
  if (data.headline?.current_title) {
    data.headline.current_title.split(/\s+/).forEach(word => {
      if (word.length > 2) tags.add(word.toLowerCase().trim());
    });
  }
  
  // Add seniority level
  if (data.headline?.seniority_level) {
    tags.add(data.headline.seniority_level);
  }
  
  // Add company names from experience
  data.experience?.roles?.forEach(role => {
    if (role.company) {
      tags.add(role.company.toLowerCase().trim());
    }
  });
  
  // Add certifications
  data.certifications?.forEach(c => tags.add(c.toLowerCase().trim()));
  
  return Array.from(tags).filter(t => t.length > 1);
}

// Sleep utility for retry delays
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Exponential backoff delay calculation
function getRetryDelay(attempt: number): number {
  return BASE_RETRY_DELAY_MS * Math.pow(2, attempt) + Math.random() * 500;
}

function isTerminalBatchStatus(status: string | null | undefined): boolean {
  return status === 'completed' || status === 'failed' || status === 'partial';
}

function toBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    let chunkBinary = '';

    for (let j = 0; j < chunk.length; j++) {
      chunkBinary += String.fromCharCode(chunk[j]);
    }

    binary += chunkBinary;
  }

  return btoa(binary);
}

async function scheduleBatchContinuation(batchId: string, supabaseUrl: string, serviceKey: string) {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/cv-batch-import/internal/continue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [INTERNAL_BATCH_TOKEN_HEADER]: serviceKey,
      },
      body: JSON.stringify({ batchId }),
    });

    if (!response.ok) {
      console.error(`Failed to schedule continuation for batch ${batchId}: ${response.status}`);
    }
  } catch (error) {
    console.error(`Failed to schedule continuation for batch ${batchId}:`, error);
  }
}

async function claimQueuedItems(supabase: any, batchId: string, limit: number) {
  const { data: queuedItems, error } = await supabase
    .from('cv_import_items')
    .select('*')
    .eq('batch_id', batchId)
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error || !queuedItems?.length) {
    if (error) console.error(`Failed to fetch queued items for batch ${batchId}:`, error);
    return [];
  }

  const claimedAt = new Date().toISOString();
  const queuedIds: string[] = queuedItems.map((item: any) => item.id as string);
  const { data: claimedItems, error: claimError } = await supabase
    .from('cv_import_items')
    .update({
      status: 'processing',
      started_at: claimedAt,
      updated_at: claimedAt,
    })
    .in('id', queuedIds)
    .eq('status', 'queued')
    .select('*');

  if (claimError) {
    console.error(`Failed to claim queued items for batch ${batchId}:`, claimError);
    return [];
  }

  const claimedLookup = new Map((claimedItems || []).map((item: any) => [item.id, item]));
  return queuedIds
    .filter((id: string) => claimedLookup.has(id))
    .map((id: string) => claimedLookup.get(id));
}

async function getBatchWorkCounts(supabase: any, batchId: string) {
  const [queuedResult, processingResult] = await Promise.all([
    supabase
      .from('cv_import_items')
      .select('id', { count: 'exact', head: true })
      .eq('batch_id', batchId)
      .eq('status', 'queued'),
    supabase
      .from('cv_import_items')
      .select('id', { count: 'exact', head: true })
      .eq('batch_id', batchId)
      .eq('status', 'processing'),
  ]);

  return {
    queuedCount: queuedResult.count || 0,
    processingCount: processingResult.count || 0,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const method = req.method;
  const isInternalBatchRequest = req.headers.get(INTERNAL_BATCH_TOKEN_HEADER) === supabaseServiceKey;
  const isInternalContinueRequest =
    method === 'POST' &&
    pathParts.length === 3 &&
    pathParts[1] === 'internal' &&
    pathParts[2] === 'continue';

  try {
    // Service client for background operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    if (isInternalContinueRequest) {
      if (!isInternalBatchRequest) {
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const body = await req.json().catch(() => ({}));
      const batchId = body.batchId as string | undefined;

      if (!batchId) {
        return new Response(
          JSON.stringify({ success: false, error: 'batchId required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: batch, error: batchError } = await supabaseAdmin
        .from('cv_import_batches')
        .select('id, tenant_id, status, started_at')
        .eq('id', batchId)
        .single();

      if (batchError || !batch) {
        return new Response(
          JSON.stringify({ success: false, error: 'Batch not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (batch.status === 'paused' || isTerminalBatchStatus(batch.status)) {
        return new Response(
          JSON.stringify({ success: true, skipped: true, status: batch.status }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (batch.status === 'queued') {
        await supabaseAdmin
          .from('cv_import_batches')
          .update({
            status: 'processing',
            started_at: batch.started_at || new Date().toISOString(),
            completed_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', batchId);
      }

      await processQueuedItems(supabaseAdmin, batchId, batch.tenant_id, supabaseUrl, supabaseServiceKey);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Require authentication for user-facing routes
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
      const searchQuery = url.searchParams.get('q');
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
      
      // Full-text search support
      if (searchQuery) {
        query = query.textSearch('search_vector', searchQuery, { type: 'websearch' });
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
      const processingPromise = scheduleBatchContinuation(batchId, supabaseUrl, supabaseServiceKey);
      if (typeof (globalThis as any).EdgeRuntime?.waitUntil === 'function') {
        (globalThis as any).EdgeRuntime.waitUntil(processingPromise);
      } else {
        processingPromise.catch(e => console.error('Background processing error:', e));
      }

      return new Response(
        JSON.stringify({ success: true, data: batch }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: POST /cv-batch-import/:batchId/restart - Force restart stuck batch
    if (method === 'POST' && pathParts.length === 3 && pathParts[2] === 'restart') {
      const batchId = pathParts[1];

      // Reset all queued/failed items back to queued
      await supabaseAdmin
        .from('cv_import_items')
        .update({ status: 'queued', error_message: null })
        .eq('batch_id', batchId)
        .in('status', ['queued', 'failed', 'processing']);

      // Reset batch counters and force processing status
      const { data: batch, error: updateError } = await supabaseAdmin
        .from('cv_import_batches')
        .update({
          status: 'processing',
          started_at: new Date().toISOString(),
          processed_files: 0,
          success_count: 0,
          fail_count: 0,
        })
        .eq('id', batchId)
        .select()
        .single();

      if (updateError || !batch) {
        return new Response(
          JSON.stringify({ success: false, error: 'Batch not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tenantId = batch.tenant_id;

      // Trigger background processing
      const processingPromise = scheduleBatchContinuation(batchId, supabaseUrl, supabaseServiceKey);
      if (typeof (globalThis as any).EdgeRuntime?.waitUntil === 'function') {
        (globalThis as any).EdgeRuntime.waitUntil(processingPromise);
      } else {
        processingPromise.catch(e => console.error('Restart processing error:', e));
      }

      return new Response(
        JSON.stringify({ success: true, data: batch, message: 'Processing restarted' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: POST /cv-batch-import/:batchId/full-reset - Reset ALL items to start from scratch
    if (method === 'POST' && pathParts.length === 3 && pathParts[2] === 'full-reset') {
      const batchId = pathParts[1];

      // Admin only
      if (role !== 'admin') {
        return new Response(
          JSON.stringify({ success: false, error: 'Admin access required for full reset' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Delete any candidates that were created by this batch
      const { data: linkedItems } = await supabaseAdmin
        .from('cv_import_items')
        .select('candidate_id')
        .eq('batch_id', batchId)
        .not('candidate_id', 'is', null);

      if (linkedItems && linkedItems.length > 0) {
        const candidateIds = linkedItems.map((i: any) => i.candidate_id).filter(Boolean);
        if (candidateIds.length > 0) {
          // Delete linked talent_documents first
          await supabaseAdmin.from('talent_documents').delete().in('talent_id', candidateIds);
          // Delete candidates created by this batch
          await supabaseAdmin.from('candidates').delete().in('id', candidateIds);
        }
      }

      // Reset ALL items back to queued
      await supabaseAdmin
        .from('cv_import_items')
        .update({
          status: 'queued',
          error_message: null,
          candidate_id: null,
          extracted_data: null,
          field_confidence: null,
          parse_confidence: null,
          search_tags: null,
          started_at: null,
          completed_at: null,
        })
        .eq('batch_id', batchId);

      // Reset batch counters completely
      const { data: batch, error: updateError } = await supabaseAdmin
        .from('cv_import_batches')
        .update({
          status: 'queued',
          started_at: null,
          completed_at: null,
          processed_files: 0,
          success_count: 0,
          fail_count: 0,
          error_summary: null,
        })
        .eq('id', batchId)
        .select()
        .single();

      if (updateError || !batch) {
        return new Response(
          JSON.stringify({ success: false, error: 'Batch not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await logAudit(supabase, userId, 'batch_full_reset', batchId, { itemsReset: linkedItems?.length || 0 });

      return new Response(
        JSON.stringify({ success: true, data: batch, message: 'Batch fully reset — all items queued for reprocessing' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: POST /cv-batch-import/:batchId/pause - Stop/pause processing
    if (method === 'POST' && pathParts.length === 3 && pathParts[2] === 'pause') {
      const batchId = pathParts[1];

      // Set batch status to paused — the processing loop checks this before each iteration
      const { data: batch, error: updateError } = await supabaseAdmin
        .from('cv_import_batches')
        .update({
          status: 'paused',
          updated_at: new Date().toISOString(),
        })
        .eq('id', batchId)
        .in('status', ['processing', 'queued'])
        .select()
        .single();

      if (updateError || !batch) {
        return new Response(
          JSON.stringify({ success: false, error: 'Batch not found or not active' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Reset any items stuck in 'processing' back to 'queued' so they can be resumed later
      await supabaseAdmin
        .from('cv_import_items')
        .update({ status: 'queued', started_at: null })
        .eq('batch_id', batchId)
        .eq('status', 'processing');

      await logAudit(supabase, userId, 'batch_paused', batchId, {});

      return new Response(
        JSON.stringify({ success: true, data: batch, message: 'Processing paused' }),
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
      await supabaseAdmin
        .from('cv_import_batches')
        .update({
          status: 'processing',
          completed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.batch_id);

      const processingPromise = scheduleBatchContinuation(item.batch_id, supabaseUrl, supabaseServiceKey);
      if (typeof (globalThis as any).EdgeRuntime?.waitUntil === 'function') {
        (globalThis as any).EdgeRuntime.waitUntil(processingPromise);
      } else {
        processingPromise.catch(e => console.error('Background processing error:', e));
      }

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

// Background processing function — processes a SINGLE chunk then self-schedules continuation
// This avoids edge function CPU/wall-time limits that caused stalls after ~10-50 CVs.
async function processQueuedItems(
  supabase: any,
  batchId: string,
  tenantId: string,
  supabaseUrl: string,
  serviceKey: string,
) {
  console.log(`[batch ${batchId}] Processing chunk start`);

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.error('LOVABLE_API_KEY not configured');
    await updateBatchStatus(supabase, batchId, 'failed', 'AI service not configured');
    return;
  }

  await syncBatchProgress(supabase, batchId);

  // Re-check batch status before doing any work
  const { data: batchCheck } = await supabase
    .from('cv_import_batches')
    .select('status')
    .eq('id', batchId)
    .single();

  if (!batchCheck || batchCheck.status === 'paused' || isTerminalBatchStatus(batchCheck.status)) {
    console.log(`[batch ${batchId}] status=${batchCheck?.status} — stopping`);
    return;
  }

  // Atomically claim a small chunk of queued items
  const claimed = await claimQueuedItems(supabase, batchId, PROCESSING_CHUNK_SIZE);

  if (claimed.length === 0) {
    // No queued items left — check if any are still processing (other workers); else finalise
    const counts = await getBatchWorkCounts(supabase, batchId);
    if (counts.queuedCount === 0 && counts.processingCount === 0) {
      const progress = await syncBatchProgress(supabase, batchId);
      const finalStatus = progress.failCount === 0
        ? 'completed'
        : (progress.successCount === 0 ? 'failed' : 'partial');
      await updateBatchStatus(
        supabase,
        batchId,
        finalStatus,
        progress.failCount > 0 ? `${progress.failCount} items failed processing` : null,
      );
      console.log(`[batch ${batchId}] FINAL ${finalStatus}: ${progress.successCount} ok, ${progress.failCount} failed`);
    } else {
      console.log(`[batch ${batchId}] no queued; ${counts.processingCount} still processing — waiting`);
    }
    return;
  }

  // Process this chunk concurrently
  await Promise.allSettled(
    claimed.map(async (item: any) => {
      try {
        await processItemWithRetry(supabase, item, LOVABLE_API_KEY!);
      } catch (e) {
        console.error(`[batch ${batchId}] item ${item.id} failed:`, e);
      }
    }),
  );

  await syncBatchProgress(supabase, batchId);

  // Check if more work remains; if so self-schedule continuation
  const counts = await getBatchWorkCounts(supabase, batchId);
  console.log(`[batch ${batchId}] chunk done; remaining queued=${counts.queuedCount} processing=${counts.processingCount}`);

  if (counts.queuedCount > 0) {
    // Re-check pause before scheduling next chunk
    const { data: nextCheck } = await supabase
      .from('cv_import_batches')
      .select('status')
      .eq('id', batchId)
      .single();

    if (nextCheck?.status === 'paused' || isTerminalBatchStatus(nextCheck?.status)) {
      console.log(`[batch ${batchId}] paused/terminal — not scheduling next chunk`);
      return;
    }

    const continuation = scheduleBatchContinuation(batchId, supabaseUrl, serviceKey);
    if (typeof (globalThis as any).EdgeRuntime?.waitUntil === 'function') {
      (globalThis as any).EdgeRuntime.waitUntil(continuation);
    } else {
      continuation.catch((e) => console.error(`[batch ${batchId}] continuation error:`, e));
    }
  } else if (counts.processingCount === 0) {
    // Nothing left at all — finalise
    const progress = await syncBatchProgress(supabase, batchId);
    const finalStatus = progress.failCount === 0
      ? 'completed'
      : (progress.successCount === 0 ? 'failed' : 'partial');
    await updateBatchStatus(
      supabase,
      batchId,
      finalStatus,
      progress.failCount > 0 ? `${progress.failCount} items failed processing` : null,
    );
    console.log(`[batch ${batchId}] FINAL ${finalStatus}: ${progress.successCount} ok, ${progress.failCount} failed`);
  }
}

async function syncBatchProgress(supabase: any, batchId: string) {
  const { data: batch } = await supabase
    .from('cv_import_batches')
    .select('total_files')
    .eq('id', batchId)
    .single();

  const { data: items } = await supabase
    .from('cv_import_items')
    .select('status')
    .eq('batch_id', batchId);

  let processedCount = 0;
  let successCount = 0;
  let failCount = 0;

  for (const row of items || []) {
    if (row.status !== 'queued' && row.status !== 'processing') processedCount++;
    if (row.status === 'parsed' || row.status === 'merged') successCount++;
    if (row.status === 'failed') failCount++;
  }

  await supabase
    .from('cv_import_batches')
    .update({
      processed_files: processedCount,
      success_count: successCount,
      fail_count: failCount,
      status: processedCount < (batch?.total_files || 0) ? 'processing' : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', batchId);

  return { processedCount, successCount, failCount };
}

async function updateBatchStatus(supabase: any, batchId: string, status: string, errorSummary: string | null) {
  await supabase
    .from('cv_import_batches')
    .update({
      status,
      error_summary: errorSummary,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', batchId);
}

// Process item with exponential backoff retry
async function processItemWithRetry(supabase: any, item: any, apiKey: string): Promise<boolean> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await processItem(supabase, item, apiKey);
      return true;
    } catch (error) {
      const isLastAttempt = attempt === MAX_RETRIES;
      console.error(`Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed for item ${item.id}:`, error);
      
      if (isLastAttempt) {
        // Mark as failed after all retries exhausted
        await supabase
          .from('cv_import_items')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error after retries',
            completed_at: new Date().toISOString(),
          })
          .eq('id', item.id);
        return false;
      }
      
      // Wait before retry with exponential backoff
      await sleep(getRetryDelay(attempt));
    }
  }
  return false;
}

async function processItem(supabase: any, item: any, apiKey: string) {
  console.log(`Processing item ${item.id}: ${item.file_name}`);
  
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

  // Extract text and prepare for AI processing
  const extractionResult = await extractTextFromFile(fileData, item.file_type, item.file_name);
  
  if (!extractionResult.success) {
    throw new Error(`Text extraction failed: ${extractionResult.error}`);
  }

  // Call AI for structured parsing with canonical schema
  const parseResult = await parseWithAI(apiKey, extractionResult);
  
  if (!parseResult.success || !parseResult.data) {
    throw new Error(`AI parsing failed: ${parseResult.error}`);
  }

  const extractedData: CandidateProfileParse = parseResult.data;
  
  // Generate search tags from extracted data
  const searchTags = generateSearchTags(extractedData);

  // === AUTO-CREATE CANDIDATE RECORD ===
  const name = extractedData.personal?.full_name || null;
  let candidateId: string | null = null;

  // Derive current_company from headline or first experience role
  const currentCompany = extractedData.headline?.current_company
    || extractedData.experience?.roles?.[0]?.company
    || null;

  // Build ai_overview from summary or generate from extracted data
  const aiOverview = extractedData.summary
    || (extractedData.headline?.current_title && currentCompany
      ? `${extractedData.headline.current_title} at ${currentCompany}. Key skills: ${extractedData.skills?.primary_skills?.slice(0, 5).join(', ') || 'N/A'}.`
      : extractedData.headline?.current_title
        ? `${extractedData.headline.current_title}. Key skills: ${extractedData.skills?.primary_skills?.slice(0, 5).join(', ') || 'N/A'}.`
        : null);

  // Build raw_cv_text from all extracted data for full-text search
  const rawCvParts: string[] = [];
  if (name) rawCvParts.push(name);
  if (extractedData.headline?.current_title) rawCvParts.push(extractedData.headline.current_title);
  if (currentCompany) rawCvParts.push(currentCompany);
  if (extractedData.personal?.location) rawCvParts.push(extractedData.personal.location);
  if (extractedData.skills?.primary_skills?.length) rawCvParts.push(extractedData.skills.primary_skills.join(', '));
  if (extractedData.skills?.secondary_skills?.length) rawCvParts.push(extractedData.skills.secondary_skills.join(', '));
  for (const role of (extractedData.experience?.roles || [])) {
    rawCvParts.push(`${role.title} at ${role.company}`);
    if (role.summary) rawCvParts.push(role.summary);
  }
  for (const edu of (extractedData.education?.items || [])) {
    rawCvParts.push(`${edu.degree || ''} ${edu.field || ''} ${edu.institution}`.trim());
  }
  if (extractedData.certifications?.length) rawCvParts.push(extractedData.certifications.join(', '));
  const rawCvText = rawCvParts.join('. ').slice(0, 10000) || null;

  if (name) {
    const email = extractedData.personal?.email || null;
    let existingId: string | null = null;

    if (email) {
      const { data: existing } = await supabase
        .from('candidates')
        .select('id')
        .eq('tenant_id', item.tenant_id)
        .eq('email', email)
        .maybeSingle();

      if (existing?.id) existingId = existing.id;
    }

    if (existingId) {
      await supabase
        .from('candidates')
        .update({
          phone: extractedData.personal?.phone || undefined,
          location: extractedData.personal?.location || extractedData.personal?.home_address || undefined,
          linkedin_url: extractedData.personal?.linkedin_url || undefined,
          current_title: extractedData.headline?.current_title || undefined,
          current_company: currentCompany || undefined,
          headline: extractedData.headline?.current_title || undefined,
          skills: extractedData.skills || {},
          experience: extractedData.experience?.roles || [],
          education: extractedData.education?.items || [],
          ai_overview: aiOverview || undefined,
          raw_cv_text: rawCvText || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingId);

      candidateId = existingId;
    } else {
      const { data: newCandidate, error: insertError } = await supabase
        .from('candidates')
        .insert({
          tenant_id: item.tenant_id,
          name,
          email: extractedData.personal?.email || null,
          phone: extractedData.personal?.phone || null,
          location: extractedData.personal?.location || extractedData.personal?.home_address || null,
          linkedin_url: extractedData.personal?.linkedin_url || null,
          current_title: extractedData.headline?.current_title || null,
          current_company: currentCompany,
          headline: extractedData.headline?.current_title || null,
          skills: extractedData.skills || {},
          experience: extractedData.experience?.roles || [],
          education: extractedData.education?.items || [],
          ai_overview: aiOverview,
          raw_cv_text: rawCvText,
          source: 'cv_import',
          status: 'new',
        })
        .select('id')
        .single();

      if (!insertError && newCandidate) {
        candidateId = newCandidate.id;
      }
    }
  }

  // Link CV file to candidate record
  if (candidateId) {
    // Update cv_storage_path on candidate
    await supabase
      .from('candidates')
      .update({
        cv_storage_path: item.storage_path,
        updated_at: new Date().toISOString(),
      })
      .eq('id', candidateId);

    const ext = item.file_name?.split('.').pop()?.toLowerCase() || 'pdf';
    const documentPayload = {
      talent_id: candidateId,
      workspace_id: item.tenant_id,
      file_name: item.file_name,
      file_path: item.storage_path,
      file_type: item.file_type || ext,
      file_size: item.file_size_bytes || 0,
      doc_kind: 'cv',
      parse_status: rawCvText ? 'parsed' : 'pending',
      parsed_text: rawCvText || null,
      pdf_storage_path: ext === 'pdf' ? item.storage_path : null,
      pdf_conversion_status: ext === 'pdf' ? 'not_needed' : 'pending',
      updated_at: new Date().toISOString(),
    };

    const { data: existingDoc } = await supabase
      .from('talent_documents')
      .select('id')
      .eq('talent_id', candidateId)
      .eq('workspace_id', item.tenant_id)
      .eq('doc_kind', 'cv')
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error: talentDocError } = existingDoc?.id
      ? await supabase
          .from('talent_documents')
          .update(documentPayload)
          .eq('id', existingDoc.id)
      : await supabase
          .from('talent_documents')
          .insert(documentPayload);

    if (talentDocError) {
      console.warn(`talent_documents sync warning for ${item.id}:`, talentDocError.message);
    }
  }

  const completedAt = new Date().toISOString();

  // Mark item as parsed first so counters keep moving even if metadata enrichment fails
  const { error: parsedError } = await supabase
    .from('cv_import_items')
    .update({
      status: 'parsed',
      parse_confidence: extractedData.overall_confidence,
      candidate_id: candidateId,
      completed_at: completedAt,
    })
    .eq('id', item.id);

  if (parsedError) {
    throw new Error(`Failed to mark item as parsed: ${parsedError.message}`);
  }

  const { error: enrichmentError } = await supabase
    .from('cv_import_items')
    .update({
      field_confidence: extractedData.field_confidence,
      extracted_data: extractedData,
      search_tags: searchTags,
    })
    .eq('id', item.id);

  if (enrichmentError) {
    console.error(`Metadata enrichment failed for item ${item.id}:`, enrichmentError);
  }

  console.log(`Successfully processed item ${item.id} — candidate: ${candidateId || 'skipped (no name found)'}`);
}

// Text extraction function supporting PDF and DOC/DOCX
async function extractTextFromFile(
  fileData: Blob, 
  fileType: string, 
  fileName: string
): Promise<{ success: boolean; text?: string; imageBase64?: string; mimeType?: string; error?: string }> {
  
  try {
    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // For PDF files - send as image/document for AI vision processing
    if (fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
      const base64 = btoa(String.fromCharCode(...bytes));
      return {
        success: true,
        imageBase64: base64,
        mimeType: 'application/pdf',
      };
    }
    
    // For Word documents (DOC/DOCX) - extract as text
    // Note: In production, you'd use a proper library for DOCX parsing
    // For now, we attempt to extract any readable text
    if (fileType.includes('word') || 
        fileType.includes('document') ||
        fileName.toLowerCase().endsWith('.docx') ||
        fileName.toLowerCase().endsWith('.doc')) {
      
      // DOCX files are ZIP archives - try to extract document.xml content
      if (fileName.toLowerCase().endsWith('.docx')) {
        try {
          // Simple DOCX text extraction - looks for text between XML tags
          const textDecoder = new TextDecoder('utf-8', { fatal: false });
          const rawText = textDecoder.decode(bytes);
          
          // Extract text from XML content (basic approach)
          const textContent = extractTextFromDocx(rawText);
          
          if (textContent && textContent.length > 50) {
            return { success: true, text: textContent };
          }
        } catch {
          // Fall through to image-based processing
        }
      }
      
      // For .doc or failed .docx extraction, send to AI for vision processing
      const base64 = btoa(String.fromCharCode(...bytes));
      return {
        success: true,
        imageBase64: base64,
        mimeType: fileType || 'application/octet-stream',
      };
    }
    
    // For plain text or unknown types, try text extraction
    const textDecoder = new TextDecoder('utf-8', { fatal: false });
    const text = textDecoder.decode(bytes);
    
    if (text && text.length > 50) {
      return { success: true, text };
    }
    
    // Fallback to image processing
    const base64 = btoa(String.fromCharCode(...bytes));
    return {
      success: true,
      imageBase64: base64,
      mimeType: fileType || 'application/octet-stream',
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown extraction error',
    };
  }
}

// Basic DOCX text extraction (extracts text from XML structure)
function extractTextFromDocx(rawContent: string): string {
  // Look for document.xml content and extract text between <w:t> tags
  const textMatches = rawContent.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
  if (textMatches) {
    return textMatches
      .map(match => match.replace(/<[^>]+>/g, ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  // Fallback: extract any readable text
  return rawContent
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^\x20-\x7E\n\r\t]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// AI parsing with canonical schema
async function parseWithAI(
  apiKey: string, 
  extractionResult: { text?: string; imageBase64?: string; mimeType?: string }
): Promise<{ success: boolean; data?: CandidateProfileParse; error?: string }> {
  
  const systemPrompt = `You are an expert CV/resume parser. Extract structured candidate information and return it in the following exact JSON schema.

REQUIRED OUTPUT SCHEMA:
{
  "personal": {
    "full_name": "string (required)",
    "email": "string or null",
    "phone": "string or null — include ALL phone numbers found (home, mobile, work)",
    "home_address": "full home address if found, otherwise null",
    "location": "city/country string or null",
    "linkedin_url": "string or null"
  },
  "headline": {
    "current_title": "current or most recent job title or null",
    "current_company": "current or most recent employer name or null",
    "seniority_level": "executive|director|manager|senior|mid|junior or null"
  },
  "summary": "2-3 sentence professional summary capturing their expertise, key strengths, and career focus",
  "skills": {
    "primary_skills": ["array of core/main skills — up to 10"],
    "secondary_skills": ["array of supporting skills"],
    "keywords": ["array of other relevant keywords/technologies"]
  },
  "experience": {
    "roles": [
      {
        "company": "string",
        "title": "string",
        "start_date": "YYYY-MM or YYYY format",
        "end_date": "YYYY-MM or YYYY or null if current",
        "summary": "brief role description",
        "achievements": ["notable achievements"]
      }
    ]
  },
  "education": {
    "items": [
      {
        "institution": "string",
        "degree": "string or null",
        "field": "field of study or null",
        "start_date": "YYYY or null",
        "end_date": "YYYY or null"
      }
    ]
  },
  "certifications": ["array of certification names"],
  "industries": ["array of industry domains"],
  "clearance_work_auth": "string if explicitly mentioned, otherwise null",
  "notes": {
    "gaps": ["any employment gaps noted"],
    "inconsistencies": ["any data quality issues"]
  },
  "overall_confidence": 0.0-1.0,
  "field_confidence": {
    "personal": 0.0-1.0,
    "skills": 0.0-1.0,
    "experience": 0.0-1.0,
    "education": 0.0-1.0
  }
}

EXTRACTION PRIORITIES:
- Extract EVERY personal detail found: full name, all email addresses, all phone numbers (mobile, home, work), full home address, city/country
- current_company should be the MOST RECENT employer from experience section
- Generate a concise professional summary even if none exists in the CV
- Extract ALL skills mentioned anywhere in the document

CONFIDENCE SCORING GUIDELINES:
- 0.9-1.0: All information clearly visible and unambiguous
- 0.7-0.89: Most information present with minor inference
- 0.5-0.69: Some information missing or unclear
- 0.3-0.49: Significant information missing
- 0.0-0.29: Major parsing difficulties

SENIORITY LEVEL GUIDELINES:
- junior: 0-2 years experience, entry-level titles
- mid: 2-5 years, standard titles without "Senior"
- senior: 5-10 years, "Senior" in title or equivalent
- manager: People management responsibility
- director: Department/division leadership
- executive: VP, C-suite, or equivalent

Return ONLY valid JSON. Do not include markdown code blocks.`;

  let messages;
  if (extractionResult.imageBase64) {
    messages = [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: [
          {
            type: 'text',
            text: 'Extract candidate profile information from this CV document. Return structured JSON following the schema.'
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${extractionResult.mimeType};base64,${extractionResult.imageBase64}`
            }
          }
        ]
      }
    ];
  } else {
    messages = [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: `Extract candidate profile information from this CV text. Return structured JSON following the schema.\n\n${extractionResult.text}`
      }
    ];
  }

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI parsing error:', response.status, errorText);
    return { success: false, error: `AI service error: ${response.status}` };
  }

  const aiResponse = await response.json();
  const content = aiResponse.choices?.[0]?.message?.content;

  if (!content) {
    return { success: false, error: 'No content in AI response' };
  }

  // Parse and validate JSON response
  try {
    let jsonStr = content.trim();
    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
    if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
    jsonStr = jsonStr.trim();
    
    const parsed = JSON.parse(jsonStr);
    
    // Normalize the response to canonical schema
    const normalized = normalizeToCanonicalSchema(parsed);
    
    return { success: true, data: normalized };
  } catch (parseError) {
    console.error('Failed to parse AI response:', content);
    return { success: false, error: 'Failed to parse AI response as JSON' };
  }
}

// Normalize various response formats to canonical schema
function normalizeToCanonicalSchema(parsed: any): CandidateProfileParse {
  // Handle both flat and nested response formats
  const talent = parsed.talent || parsed;
  
  return {
    personal: {
      full_name: talent.personal?.full_name || talent.name || 'Unknown',
      email: talent.personal?.email || talent.email || null,
      phone: talent.personal?.phone || talent.phone || null,
      home_address: talent.personal?.home_address || talent.personal?.address || talent.address || null,
      location: talent.personal?.location || talent.location || null,
      linkedin_url: talent.personal?.linkedin_url || talent.linkedIn || talent.linkedin || null,
    },
    headline: {
      current_title: talent.headline?.current_title || talent.roleType || talent.current_title || null,
      current_company: talent.headline?.current_company || talent.current_company || null,
      seniority_level: normalizeSeniority(talent.headline?.seniority_level || talent.seniority),
    },
    summary: talent.summary || talent.professional_summary || null,
    skills: {
      primary_skills: talent.skills?.primary_skills || (Array.isArray(talent.skills) ? talent.skills.slice(0, 10) : []),
      secondary_skills: talent.skills?.secondary_skills || (Array.isArray(talent.skills) ? talent.skills.slice(10, 20) : []),
      keywords: talent.skills?.keywords || (Array.isArray(talent.skills) ? talent.skills.slice(20) : []),
    },
    experience: {
      roles: normalizeExperience(talent.experience?.roles || talent.experience || []),
    },
    education: {
      items: normalizeEducation(talent.education?.items || talent.education || []),
    },
    certifications: talent.certifications || [],
    industries: talent.industries || [],
    clearance_work_auth: talent.clearance_work_auth || talent.clearance || null,
    notes: talent.notes || {},
    overall_confidence: calculateOverallConfidence(talent),
    field_confidence: talent.field_confidence || calculateFieldConfidence(talent),
  };
}

function normalizeSeniority(seniority: string | undefined): 'executive' | 'director' | 'manager' | 'senior' | 'mid' | 'junior' | undefined {
  if (!seniority) return undefined;
  const normalized = seniority.toLowerCase();
  if (['executive', 'director', 'manager', 'senior', 'mid', 'junior'].includes(normalized)) {
    return normalized as any;
  }
  return undefined;
}

function normalizeExperience(experience: any[]): any[] {
  if (!Array.isArray(experience)) return [];
  return experience.map(exp => ({
    company: exp.company || 'Unknown',
    title: exp.title || 'Unknown',
    start_date: exp.start_date || exp.startDate || null,
    end_date: exp.end_date || exp.endDate || null,
    summary: exp.summary || exp.description || null,
    achievements: exp.achievements || [],
  }));
}

function normalizeEducation(education: any[]): any[] {
  if (!Array.isArray(education)) return [];
  return education.map(edu => ({
    institution: edu.institution || 'Unknown',
    degree: edu.degree || null,
    field: edu.field || null,
    start_date: edu.start_date || edu.startDate || null,
    end_date: edu.end_date || edu.endDate || null,
  }));
}

function calculateOverallConfidence(talent: any): number {
  if (typeof talent.overall_confidence === 'number') {
    return talent.overall_confidence;
  }
  
  // Calculate from string confidence
  const conf = talent.confidence?.toLowerCase() || 'medium';
  if (conf === 'high') return 0.9;
  if (conf === 'medium') return 0.7;
  if (conf === 'low') return 0.5;
  return 0.6;
}

function calculateFieldConfidence(talent: any): Record<string, number> {
  const base = calculateOverallConfidence(talent);
  return {
    personal: talent.personal?.full_name ? base : base * 0.5,
    skills: (talent.skills?.primary_skills?.length > 0 || (Array.isArray(talent.skills) && talent.skills.length > 0)) ? base : base * 0.6,
    experience: (talent.experience?.roles?.length > 0 || (Array.isArray(talent.experience) && talent.experience.length > 0)) ? base : base * 0.7,
    education: (talent.education?.items?.length > 0 || (Array.isArray(talent.education) && talent.education.length > 0)) ? base : base * 0.8,
  };
}
