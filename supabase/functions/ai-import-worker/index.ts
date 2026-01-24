import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Max concurrent files to process per batch
const MAX_CONCURRENT = 2;

// Error codes
const ErrorCodes = {
  DOCX_TEXT_EMPTY: 'DOCX_TEXT_EMPTY',
  PDF_TEXT_EMPTY: 'PDF_TEXT_EMPTY',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  AI_TIMEOUT: 'AI_TIMEOUT',
  AI_RATE_LIMIT: 'AI_RATE_LIMIT',
  AI_BAD_RESPONSE: 'AI_BAD_RESPONSE',
  PARSE_ERROR: 'PARSE_ERROR',
} as const;

type FileType = 'CV_RESUME' | 'BUSINESS_CARD' | 'ORG_CHART' | 'NOTES_DOCUMENT' | 'UNKNOWN';

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

// ============= TEXT EXTRACTION =============

async function extractTextFromDocx(bytes: Uint8Array): Promise<{ text: string; success: boolean; error?: string }> {
  try {
    const zip = await JSZip.loadAsync(bytes);
    const documentXml = await zip.file('word/document.xml')?.async('string');
    
    if (!documentXml) {
      return { text: '', success: false, error: 'No document.xml found in DOCX' };
    }
    
    const paragraphTexts: string[] = [];
    const paragraphs = documentXml.split(/<\/w:p>/);
    
    for (const para of paragraphs) {
      const paraText: string[] = [];
      const textMatches = para.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g);
      for (const m of textMatches) {
        if (m[1]) {
          paraText.push(m[1]);
        }
      }
      if (paraText.length > 0) {
        paragraphTexts.push(paraText.join(''));
      }
    }
    
    const finalText = paragraphTexts.join('\n').trim();
    
    if (finalText.length === 0) {
      return { text: '', success: false, error: 'No text content found in DOCX' };
    }
    
    return { text: finalText, success: true };
  } catch (error) {
    return { text: '', success: false, error: `DOCX parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

function extractTextFromPdf(bytes: Uint8Array): { text: string; isScanned: boolean } {
  try {
    const textDecoder = new TextDecoder('utf-8', { fatal: false });
    const rawContent = textDecoder.decode(bytes);
    
    const textParts: string[] = [];
    
    // Text in parentheses after Tj operator
    const tjMatches = rawContent.matchAll(/\(([^)]+)\)\s*Tj/g);
    for (const m of tjMatches) {
      const decoded = m[1]
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')');
      textParts.push(decoded);
    }
    
    // Text arrays with TJ operator
    const tjArrayMatches = rawContent.matchAll(/\[((?:[^[\]]+|\[[^\]]*\])*)\]\s*TJ/gi);
    for (const m of tjArrayMatches) {
      const stringMatches = m[1].matchAll(/\(([^)]*)\)/g);
      for (const sm of stringMatches) {
        textParts.push(sm[1]);
      }
    }
    
    const extractedText = textParts.join(' ')
      .replace(/\s+/g, ' ')
      .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
      .trim();
    
    return { text: extractedText, isScanned: extractedText.length < 200 };
  } catch {
    return { text: '', isScanned: true };
  }
}

interface ExtractionResult {
  text: string;
  needsOcr: boolean;
  method: string;
  errorCode?: string;
  errorMessage?: string;
}

async function extractTextFromFile(
  bytes: Uint8Array,
  mimeType: string,
  fileName: string,
  requestId: string
): Promise<ExtractionResult> {
  const lowerFileName = fileName.toLowerCase();
  
  try {
    // DOCX
    if (lowerFileName.endsWith('.docx') || mimeType.includes('wordprocessingml')) {
      log(requestId, 'info', `Using DOCX text extractor for ${fileName}`);
      const result = await extractTextFromDocx(bytes);
      
      if (result.success && result.text.length > 0) {
        return { text: result.text, needsOcr: false, method: 'docx_text' };
      }
      
      return {
        text: '',
        needsOcr: false,
        method: 'docx_text',
        errorCode: ErrorCodes.DOCX_TEXT_EMPTY,
        errorMessage: result.error || 'Could not read text from DOCX'
      };
    }
    
    // PDF
    if (lowerFileName.endsWith('.pdf') || mimeType === 'application/pdf') {
      log(requestId, 'info', `Trying PDF text extraction for ${fileName}`);
      const pdfResult = extractTextFromPdf(bytes);
      
      if (!pdfResult.isScanned && pdfResult.text.length >= 200) {
        return { text: pdfResult.text, needsOcr: false, method: 'pdf_text' };
      }
      
      // Scanned PDF - need OCR via AI vision
      return { text: pdfResult.text, needsOcr: true, method: 'pdf_ocr' };
    }
    
    // Images - OCR via AI vision
    if (mimeType.startsWith('image/')) {
      return { text: '', needsOcr: true, method: 'ai_vision' };
    }
    
    // Old DOC format
    if (lowerFileName.endsWith('.doc')) {
      return {
        text: '',
        needsOcr: false,
        method: 'unsupported',
        errorCode: ErrorCodes.UNSUPPORTED_FORMAT,
        errorMessage: 'Old .doc format not supported. Please convert to .docx or PDF.'
      };
    }
    
    // Plain text
    if (mimeType.startsWith('text/') || lowerFileName.endsWith('.txt')) {
      const textDecoder = new TextDecoder('utf-8', { fatal: false });
      return { text: textDecoder.decode(bytes), needsOcr: false, method: 'text' };
    }
    
    // Unknown - try as text
    const textDecoder = new TextDecoder('utf-8', { fatal: false });
    const rawText = textDecoder.decode(bytes);
    const printableRatio = (rawText.match(/[\x20-\x7E\n\r\t]/g) || []).length / rawText.length;
    
    if (printableRatio > 0.8 && rawText.length > 50) {
      return { text: rawText, needsOcr: false, method: 'text' };
    }
    
    return { text: '', needsOcr: true, method: 'ai_vision' };
    
  } catch (error) {
    log(requestId, 'error', `Text extraction error for ${fileName}`, { error: String(error) });
    return { text: '', needsOcr: true, method: 'ocr_fallback' };
  }
}

// ============= AI CALLS =============

async function callAI(
  apiKey: string,
  messages: any[],
  requestId: string,
  maxRetries: number = 2
): Promise<{ ok: boolean; content?: string; errorCode?: string; errorMessage?: string }> {
  const timeout = 60000;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
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
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status === 429 && attempt < maxRetries) {
          await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
          continue;
        }
        return { ok: false, errorCode: ErrorCodes.AI_BAD_RESPONSE, errorMessage: `AI service error: ${response.status}` };
      }
      
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (!content) {
        return { ok: false, errorCode: ErrorCodes.AI_BAD_RESPONSE, errorMessage: 'Empty AI response' };
      }
      
      return { ok: true, content };
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        if (attempt < maxRetries) continue;
        return { ok: false, errorCode: ErrorCodes.AI_TIMEOUT, errorMessage: 'AI request timed out' };
      }
      
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      
      return { ok: false, errorCode: ErrorCodes.AI_BAD_RESPONSE, errorMessage: error instanceof Error ? error.message : 'AI call failed' };
    }
  }
  
  return { ok: false, errorCode: ErrorCodes.AI_BAD_RESPONSE, errorMessage: 'Max retries exceeded' };
}

// Heuristic file classification
function classifyFileHeuristic(text: string): { type: FileType; confidence: number } {
  const lowerText = text.toLowerCase();
  
  const cvIndicators = [
    'experience', 'education', 'skills', 'work history', 'employment',
    'objective', 'summary', 'qualifications', 'certifications',
    'professional experience', 'career', 'curriculum vitae', 'resume',
    'bachelor', 'master', 'degree', 'university'
  ];
  
  const cardIndicators = ['tel:', 'phone:', 'email:', 'fax:', 'mobile:'];
  const orgIndicators = ['org chart', 'organization chart', 'reporting to', 'direct reports'];
  const notesIndicators = ['meeting notes', 'action items', 'attendees', 'agenda', 'minutes'];

  let cvScore = cvIndicators.filter(i => lowerText.includes(i)).length;
  const cardScore = cardIndicators.filter(i => lowerText.includes(i)).length;
  const orgScore = orgIndicators.filter(i => lowerText.includes(i)).length;
  const notesScore = notesIndicators.filter(i => lowerText.includes(i)).length;
  
  const hasYearRanges = /\b(19|20)\d{2}\s*[-–]\s*(19|20)?\d{2,4}\b/.test(text);
  if (hasYearRanges) cvScore += 2;

  const maxScore = Math.max(cvScore, cardScore, orgScore, notesScore);
  
  if (maxScore === 0) return { type: 'UNKNOWN', confidence: 0.3 };
  
  if (cvScore === maxScore && cvScore >= 3) {
    return { type: 'CV_RESUME', confidence: Math.min(0.9, 0.5 + (cvScore * 0.08)) };
  }
  if (cardScore === maxScore && text.length < 500) {
    return { type: 'BUSINESS_CARD', confidence: Math.min(0.85, 0.5 + (cardScore * 0.15)) };
  }
  if (orgScore === maxScore && orgScore >= 2) {
    return { type: 'ORG_CHART', confidence: Math.min(0.85, 0.5 + (orgScore * 0.15)) };
  }
  if (notesScore === maxScore && notesScore >= 2) {
    return { type: 'NOTES_DOCUMENT', confidence: Math.min(0.85, 0.5 + (notesScore * 0.15)) };
  }
  if (cvScore >= 2 || hasYearRanges) {
    return { type: 'CV_RESUME', confidence: 0.6 };
  }
  
  return { type: 'UNKNOWN', confidence: 0.4 };
}

// Parse CV/Resume with AI
async function parseCVResume(
  apiKey: string,
  text: string,
  requestId: string
): Promise<{ ok: boolean; data?: any; confidence?: number; missing?: string[]; errorMessage?: string }> {
  
  const systemPrompt = `You are an expert CV/resume parser. Extract candidate information and return ONLY valid JSON:
{
  "personal": { "full_name": "string", "email": "string or null", "phone": "string or null", "location": "string or null" },
  "headline": { "current_title": "string", "seniority_level": "executive|director|manager|senior|mid|junior" },
  "skills": { "primary_skills": ["skill1", "skill2"], "secondary_skills": ["skill3"] },
  "experience": [{ "company": "string", "title": "string", "start_date": "YYYY-MM", "end_date": "YYYY-MM or Present" }],
  "education": [{ "institution": "string", "degree": "string", "field": "string" }],
  "certifications": ["cert1"],
  "current_employer": "string or null",
  "recent_employers": ["company1", "company2"],
  "overall_confidence": 0.0-1.0
}`;

  // Chunk text if too long (max 8k chars to AI)
  const truncatedText = text.slice(0, 8000);
  
  const result = await callAI(apiKey, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Parse this CV:\n\n${truncatedText}` }
  ], requestId);
  
  if (!result.ok || !result.content) {
    return { ok: false, errorMessage: result.errorMessage || 'AI parsing failed' };
  }
  
  try {
    const parsed = JSON.parse(result.content.replace(/```json\n?|\n?```/g, '').trim());
    const missing: string[] = [];
    if (!parsed.personal?.full_name) missing.push('name');
    if (!parsed.personal?.email) missing.push('email');
    
    return { ok: true, data: parsed, confidence: parsed.overall_confidence || 0.7, missing };
  } catch {
    return { ok: false, errorMessage: 'Failed to parse AI response' };
  }
}

// ============= PROCESS SINGLE ITEM =============

async function processItem(
  adminClient: any,
  item: any,
  apiKey: string,
  requestId: string
): Promise<void> {
  const startTime = Date.now();
  
  log(requestId, 'info', `Processing item ${item.id}: ${item.file_name}`);
  
  // Mark as processing
  await adminClient
    .from('cv_import_items')
    .update({ status: 'processing', started_at: new Date().toISOString() })
    .eq('id', item.id);

  try {
    // Download file from storage
    if (!item.storage_path) {
      throw new Error('No storage path for item');
    }
    
    const { data: fileData, error: downloadError } = await adminClient.storage
      .from('cv-uploads')
      .download(item.storage_path);
    
    if (downloadError || !fileData) {
      throw new Error(`Storage download failed: ${downloadError?.message || 'No data'}`);
    }
    
    const bytes = new Uint8Array(await fileData.arrayBuffer());
    log(requestId, 'info', `Downloaded ${item.file_name}: ${bytes.length} bytes`);
    
    // Extract text
    const extraction = await extractTextFromFile(bytes, item.file_type, item.file_name, requestId);
    
    if (extraction.errorCode) {
      // Extraction failed with specific error
      await adminClient
        .from('cv_import_items')
        .update({
          status: 'failed',
          error_message: extraction.errorMessage,
          completed_at: new Date().toISOString(),
          extracted_data: { 
            extraction_method: extraction.method,
            error_code: extraction.errorCode,
          },
        })
        .eq('id', item.id);
      return;
    }
    
    let textContent = extraction.text;
    
    // If needs OCR, use AI vision
    if (extraction.needsOcr) {
      log(requestId, 'info', `Using AI vision for OCR on ${item.file_name}`);
      const base64 = btoa(String.fromCharCode(...bytes));
      
      const ocrResult = await callAI(apiKey, [
        { role: 'system', content: 'Extract all visible text from this document image. Return only the extracted text.' },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract text from this document:' },
            { type: 'image_url', image_url: { url: `data:${item.file_type};base64,${base64}` } }
          ]
        }
      ], requestId);
      
      if (ocrResult.ok && ocrResult.content) {
        textContent = ocrResult.content;
      }
    }
    
    if (!textContent || textContent.length < 50) {
      await adminClient
        .from('cv_import_items')
        .update({
          status: 'failed',
          error_message: 'Could not extract readable text from file',
          completed_at: new Date().toISOString(),
          extracted_data: { 
            extraction_method: extraction.method,
            text_length: textContent?.length || 0,
          },
        })
        .eq('id', item.id);
      return;
    }
    
    // Classify document
    const classification = classifyFileHeuristic(textContent);
    log(requestId, 'info', `Classified ${item.file_name} as ${classification.type} (${(classification.confidence * 100).toFixed(0)}%)`);
    
    // Check for user override
    const userOverride = item.extracted_data?.user_override_type;
    const docType = userOverride || classification.type;
    
    // Parse based on type (currently focusing on CV/Resume)
    let parsedData: any = null;
    let parseConfidence = classification.confidence;
    let missingFields: string[] = [];
    
    if (docType === 'CV_RESUME') {
      const parsed = await parseCVResume(apiKey, textContent, requestId);
      if (parsed.ok && parsed.data) {
        parsedData = parsed.data;
        parseConfidence = parsed.confidence || 0.7;
        missingFields = parsed.missing || [];
      }
    }
    
    // Save results
    const processingTime = Date.now() - startTime;
    
    await adminClient
      .from('cv_import_items')
      .update({
        status: parsedData ? 'parsed' : 'failed',
        parse_confidence: parseConfidence,
        error_message: parsedData ? null : 'Could not parse document content',
        completed_at: new Date().toISOString(),
        extracted_data: {
          classification: classification,
          extraction_method: extraction.method,
          text_length: textContent.length,
          parsed_data: parsedData,
          missing_fields: missingFields,
          processing_time_ms: processingTime,
        },
        search_tags: parsedData?.skills?.primary_skills || [],
      })
      .eq('id', item.id);
    
    log(requestId, 'info', `Completed ${item.file_name} in ${processingTime}ms: ${parsedData ? 'SUCCESS' : 'FAILED'}`);
    
  } catch (error) {
    log(requestId, 'error', `Error processing ${item.file_name}`, { error: String(error) });
    
    await adminClient
      .from('cv_import_items')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown processing error',
        completed_at: new Date().toISOString(),
      })
      .eq('id', item.id);
  }
}

// ============= MAIN HANDLER =============

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const apiKey = Deno.env.get('LOVABLE_API_KEY');

  if (!supabaseUrl || !supabaseServiceKey || !apiKey) {
    console.error('Missing environment variables');
    return new Response(JSON.stringify({ ok: false, error: 'Configuration error' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const batchId = body.batch_id;
    const requestId = body.request_id || `worker_${Date.now().toString(36)}`;
    
    log(requestId, 'info', 'Worker started', { batchId });

    if (!batchId) {
      // No specific batch - poll for queued items
      const { data: queuedItems, error } = await adminClient
        .from('cv_import_items')
        .select('*, cv_import_batches!inner(tenant_id)')
        .eq('status', 'queued')
        .limit(MAX_CONCURRENT);
      
      if (error || !queuedItems?.length) {
        log(requestId, 'info', 'No queued items to process');
        return new Response(JSON.stringify({ ok: true, processed: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Process items
      for (const item of queuedItems) {
        await processItem(adminClient, item, apiKey, requestId);
      }
      
      return new Response(JSON.stringify({ ok: true, processed: queuedItems.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Process specific batch
    const { data: items, error: itemsError } = await adminClient
      .from('cv_import_items')
      .select('*')
      .eq('batch_id', batchId)
      .eq('status', 'queued')
      .limit(MAX_CONCURRENT);

    if (itemsError) {
      log(requestId, 'error', 'Failed to fetch items', { error: itemsError.message });
      return new Response(JSON.stringify({ ok: false, error: itemsError.message }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!items || items.length === 0) {
      log(requestId, 'info', 'No queued items in batch');
      
      // Check if batch is complete
      const { data: batch } = await adminClient
        .from('cv_import_batches')
        .select('total_files, processed_files, success_count, fail_count')
        .eq('id', batchId)
        .single();
      
      if (batch && batch.processed_files >= batch.total_files) {
        // Update batch status
        const finalStatus = batch.fail_count === batch.total_files ? 'failed' 
          : batch.success_count === batch.total_files ? 'completed' 
          : 'partial';
        
        await adminClient
          .from('cv_import_batches')
          .update({ status: finalStatus, completed_at: new Date().toISOString() })
          .eq('id', batchId);
        
        log(requestId, 'info', `Batch ${batchId} completed with status: ${finalStatus}`);
      }
      
      return new Response(JSON.stringify({ ok: true, processed: 0, batch_complete: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Process items sequentially to avoid compute spikes
    for (const item of items) {
      await processItem(adminClient, item, apiKey, requestId);
    }

    // Check if more items to process
    const { count: remainingCount } = await adminClient
      .from('cv_import_items')
      .select('id', { count: 'exact', head: true })
      .eq('batch_id', batchId)
      .eq('status', 'queued');

    if (remainingCount && remainingCount > 0) {
      // Trigger self to continue processing (with delay to avoid rate limits)
      log(requestId, 'info', `${remainingCount} items remaining, scheduling continuation`);
      
      // Fire and forget - trigger next batch after short delay
      setTimeout(() => {
        fetch(`${supabaseUrl}/functions/v1/ai-import-worker`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ batch_id: batchId, request_id: requestId }),
        }).catch(() => {});
      }, 500);
    }

    log(requestId, 'info', `Processed ${items.length} items from batch ${batchId}`);

    return new Response(JSON.stringify({ 
      ok: true, 
      processed: items.length,
      remaining: remainingCount || 0,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Worker error:', error);
    return new Response(JSON.stringify({ 
      ok: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
