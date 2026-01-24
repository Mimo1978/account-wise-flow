import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-id',
};

// Error codes for structured responses
const ErrorCodes = {
  AUTH_MISSING: 'AUTH_MISSING',
  AUTH_INVALID: 'AUTH_INVALID',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  NO_FILES_PROVIDED: 'NO_FILES_PROVIDED',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  CONFIG_MISSING: 'CONFIG_MISSING',
  STORAGE_ERROR: 'STORAGE_ERROR',
  DB_ERROR: 'DB_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW = 60 * 1000;

// Max file size: 10MB per file
const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface EnqueueResponse {
  ok: boolean;
  request_id: string;
  batch_id?: string;
  queued?: number;
  error_code?: ErrorCode;
  message?: string;
  details?: string;
}

interface FilePayload {
  base64: string;
  mimeType: string;
  fileName: string;
  userOverrideType?: string;
}

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function log(requestId: string, level: 'info' | 'warn' | 'error', message: string, data?: any) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    request_id: requestId,
    level,
    message,
    ...(data && { data }),
  };
  console.log(JSON.stringify(logEntry));
}

function createErrorResponse(
  requestId: string,
  errorCode: ErrorCode,
  message: string,
  details?: string,
  httpStatus: number = 200
): Response {
  const body: EnqueueResponse = {
    ok: false,
    request_id: requestId,
    error_code: errorCode,
    message,
    details,
  };
  
  return new Response(JSON.stringify(body), {
    status: httpStatus,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function checkRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true };
  }

  if (userLimit.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((userLimit.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }

  userLimit.count++;
  return { allowed: true };
}

// Generate SHA256 checksum for deduplication
async function generateChecksum(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  const requestId = req.headers.get('x-request-id') || generateRequestId();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  log(requestId, 'info', 'AI Import Enqueue - Environment check', {
    hasSupabaseUrl: !!supabaseUrl,
    hasAnonKey: !!supabaseAnonKey,
    hasServiceKey: !!supabaseServiceKey,
  });

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    log(requestId, 'error', 'Missing Supabase configuration');
    return createErrorResponse(requestId, ErrorCodes.CONFIG_MISSING, 'Server configuration error', 'Missing Supabase environment variables');
  }

  try {
    // Check for authentication
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    let tenantId: string | null = null;
    let isDemo = false;
    
    log(requestId, 'info', 'Auth header check', { 
      hasAuthHeader: !!authHeader, 
    });
    
    // Create admin client for service operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    
    if (authHeader?.startsWith('Bearer ')) {
      // Create client with the user's token
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });

      // Validate the token and get user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        log(requestId, 'warn', 'JWT validation failed', { 
          error: userError.message,
          status: userError.status,
        });
        
        if (userError.message?.includes('expired') || userError.status === 401) {
          return createErrorResponse(
            requestId, 
            ErrorCodes.AUTH_INVALID, 
            'Session expired', 
            'Your session has expired. Please sign in again.'
          );
        }
        
        // Allow demo mode
        isDemo = true;
        log(requestId, 'info', 'Auth failed but allowing demo mode');
      } else if (!user) {
        log(requestId, 'warn', 'No user returned from token validation');
        isDemo = true;
      } else {
        userId = user.id;
        log(requestId, 'info', 'User authenticated', { userId, email: user.email });
        
        // Check role
        const { data: roleData, error: roleError } = await adminClient.rpc('get_user_role', { _user_id: userId });
        
        if (roleError) {
          log(requestId, 'warn', 'Role check failed', { error: roleError.message });
        } else if (roleData === 'viewer') {
          return createErrorResponse(requestId, ErrorCodes.INSUFFICIENT_PERMISSIONS, 'Insufficient permissions', 'Viewer role cannot use AI import');
        }
        
        // Get user's team ID (tenant)
        const { data: teamId, error: teamError } = await adminClient.rpc('get_user_team_id', { _user_id: userId });
        if (teamError) {
          log(requestId, 'warn', 'Team ID check failed', { error: teamError.message });
        } else {
          tenantId = teamId;
        }
        
        // Check if demo user
        const { data: workspaceMode } = await adminClient.rpc('get_workspace_mode', { _user_id: userId });
        isDemo = workspaceMode === 'demo' || workspaceMode === 'public_demo';
        log(requestId, 'info', 'Workspace context', { workspaceMode, isDemo, tenantId });
      }
    } else {
      isDemo = true;
      log(requestId, 'info', 'No auth header provided, running in demo mode');
    }

    // For demo mode without tenant, get/create demo workspace
    if (!tenantId && isDemo) {
      const { data: demoTeam, error: demoError } = await adminClient
        .from('teams')
        .select('id')
        .eq('workspace_mode', 'public_demo')
        .limit(1)
        .single();
      
      if (demoTeam) {
        tenantId = demoTeam.id;
        log(requestId, 'info', 'Using public demo workspace', { tenantId });
      } else {
        log(requestId, 'warn', 'No demo workspace found', { error: demoError?.message });
        return createErrorResponse(requestId, ErrorCodes.CONFIG_MISSING, 'Demo workspace not configured');
      }
    }

    if (!tenantId) {
      return createErrorResponse(requestId, ErrorCodes.UNAUTHORIZED, 'No workspace context', 'Please sign in to use AI Import');
    }

    // Rate limiting
    const rateLimitKey = userId || req.headers.get('x-forwarded-for') || 'anonymous';
    const rateCheck = checkRateLimit(rateLimitKey);
    if (!rateCheck.allowed) {
      return createErrorResponse(requestId, ErrorCodes.RATE_LIMIT_EXCEEDED, 'Rate limit exceeded', `Try again in ${rateCheck.retryAfter} seconds`);
    }

    // Parse request
    const body = await req.json();
    const files: FilePayload[] = body.files || [];

    if (!files.length) {
      return createErrorResponse(requestId, ErrorCodes.NO_FILES_PROVIDED, 'No files provided', 'Upload at least one file to process');
    }

    log(requestId, 'info', `Enqueuing ${files.length} files for processing`, { userId, tenantId, isDemo });

    // Validate file sizes
    const validFiles: FilePayload[] = [];
    const rejectedFiles: { fileName: string; reason: string }[] = [];
    
    for (const file of files) {
      const fileSizeBytes = Math.ceil((file.base64.length * 3) / 4); // Approximate decoded size
      
      if (fileSizeBytes > MAX_FILE_SIZE) {
        rejectedFiles.push({ 
          fileName: file.fileName, 
          reason: `File too large (${(fileSizeBytes / 1024 / 1024).toFixed(1)}MB > 10MB limit)` 
        });
        continue;
      }
      
      validFiles.push(file);
    }

    if (validFiles.length === 0) {
      return createErrorResponse(
        requestId, 
        ErrorCodes.FILE_TOO_LARGE, 
        'All files rejected', 
        rejectedFiles.map(f => `${f.fileName}: ${f.reason}`).join('; ')
      );
    }

    // Create batch record
    const { data: batch, error: batchError } = await adminClient
      .from('cv_import_batches')
      .insert({
        tenant_id: tenantId,
        created_by_user_id: userId || '00000000-0000-0000-0000-000000000000', // Anonymous UUID for demo
        source: 'ui_upload',
        status: 'queued',
        total_files: validFiles.length,
        processed_files: 0,
        success_count: 0,
        fail_count: 0,
      })
      .select('id')
      .single();

    if (batchError || !batch) {
      log(requestId, 'error', 'Failed to create batch', { error: batchError?.message });
      return createErrorResponse(requestId, ErrorCodes.DB_ERROR, 'Failed to create import batch', batchError?.message);
    }

    const batchId = batch.id;
    log(requestId, 'info', 'Created batch', { batchId, fileCount: validFiles.length });

    // Upload files to storage and create item records
    const itemsToInsert: any[] = [];
    
    for (const file of validFiles) {
      try {
        const checksum = await generateChecksum(file.base64);
        const fileSizeBytes = Math.ceil((file.base64.length * 3) / 4);
        
        // Upload to storage
        const storagePath = `${tenantId}/${batchId}/${crypto.randomUUID()}_${file.fileName}`;
        const fileBytes = Uint8Array.from(atob(file.base64), c => c.charCodeAt(0));
        
        const { error: uploadError } = await adminClient.storage
          .from('cv-uploads')
          .upload(storagePath, fileBytes, {
            contentType: file.mimeType,
            upsert: false,
          });

        if (uploadError) {
          log(requestId, 'warn', `Storage upload failed for ${file.fileName}`, { error: uploadError.message });
          // Still create item with error status
          itemsToInsert.push({
            tenant_id: tenantId,
            batch_id: batchId,
            file_name: file.fileName,
            file_type: file.mimeType,
            file_size_bytes: fileSizeBytes,
            storage_path: null,
            checksum_sha256: checksum,
            status: 'failed',
            error_message: `Storage upload failed: ${uploadError.message}`,
            extracted_data: file.userOverrideType ? { user_override_type: file.userOverrideType } : null,
          });
        } else {
          log(requestId, 'info', `Uploaded ${file.fileName} to storage`, { storagePath });
          itemsToInsert.push({
            tenant_id: tenantId,
            batch_id: batchId,
            file_name: file.fileName,
            file_type: file.mimeType,
            file_size_bytes: fileSizeBytes,
            storage_path: storagePath,
            checksum_sha256: checksum,
            status: 'queued',
            extracted_data: file.userOverrideType ? { user_override_type: file.userOverrideType } : null,
          });
        }
      } catch (error) {
        log(requestId, 'error', `Error processing file ${file.fileName}`, { error: String(error) });
        itemsToInsert.push({
          tenant_id: tenantId,
          batch_id: batchId,
          file_name: file.fileName,
          file_type: file.mimeType,
          file_size_bytes: 0,
          status: 'failed',
          error_message: `Enqueue error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }

    // Insert all items
    const { error: itemsError } = await adminClient
      .from('cv_import_items')
      .insert(itemsToInsert);

    if (itemsError) {
      log(requestId, 'error', 'Failed to create items', { error: itemsError.message });
      // Clean up batch
      await adminClient.from('cv_import_batches').delete().eq('id', batchId);
      return createErrorResponse(requestId, ErrorCodes.DB_ERROR, 'Failed to create import items', itemsError.message);
    }

    // Update batch to processing status to trigger worker
    await adminClient
      .from('cv_import_batches')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', batchId);

    // Trigger background processing by calling the worker function
    // Fire and forget - don't await
    fetch(`${supabaseUrl}/functions/v1/ai-import-worker`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ batch_id: batchId, request_id: requestId }),
    }).catch(err => {
      log(requestId, 'warn', 'Background worker trigger failed, items will be processed on next poll', { error: String(err) });
    });

    const queuedCount = itemsToInsert.filter(i => i.status === 'queued').length;
    const failedCount = itemsToInsert.filter(i => i.status === 'failed').length;

    log(requestId, 'info', 'Enqueue complete', { batchId, queued: queuedCount, failed: failedCount });

    const response: EnqueueResponse = {
      ok: true,
      request_id: requestId,
      batch_id: batchId,
      queued: queuedCount,
      message: failedCount > 0 
        ? `${queuedCount} files queued, ${failedCount} rejected` 
        : `${queuedCount} files queued for processing`,
      details: rejectedFiles.length > 0 
        ? `Rejected: ${rejectedFiles.map(f => f.fileName).join(', ')}` 
        : undefined,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    log(requestId, 'error', 'Unhandled error', { error: String(error), stack: error instanceof Error ? error.stack : undefined });
    return createErrorResponse(requestId, ErrorCodes.UNKNOWN_ERROR, 'An unexpected error occurred', error instanceof Error ? error.message : 'Unknown error', 200);
  }
});
