import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-id',
};

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW = 60 * 1000;

// Max payload size: 15MB
const MAX_PAYLOAD_SIZE = 15 * 1024 * 1024;

// Error codes for structured responses
const ErrorCodes = {
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  NO_FILES_PROVIDED: 'NO_FILES_PROVIDED',
  AI_CONFIG_ERROR: 'AI_CONFIG_ERROR',
  AI_TIMEOUT: 'AI_TIMEOUT',
  AI_RATE_LIMIT: 'AI_RATE_LIMIT',
  AI_BAD_RESPONSE: 'AI_BAD_RESPONSE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  FILE_EXTRACTION_FAILED: 'FILE_EXTRACTION_FAILED',
  PARSE_ERROR: 'PARSE_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// File type classification
type FileType = 'CV_RESUME' | 'BUSINESS_CARD' | 'ORG_CHART' | 'NOTES_DOCUMENT' | 'UNKNOWN';

interface FileClassification {
  detectedType: FileType;
  confidence: number;
  reasoning: string;
}

// Extraction result schemas
interface CandidateExtraction {
  personal: {
    full_name: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin_url?: string;
  };
  headline: {
    current_title?: string;
    seniority_level?: 'executive' | 'director' | 'manager' | 'senior' | 'mid' | 'junior';
  };
  skills: {
    primary_skills: string[];
    secondary_skills: string[];
  };
  experience: Array<{
    company: string;
    title: string;
    start_date?: string;
    end_date?: string;
    summary?: string;
  }>;
  education: Array<{
    institution: string;
    degree?: string;
    field?: string;
  }>;
  certifications: string[];
  current_employer?: string;
  recent_employers: string[];
}

interface ContactExtraction {
  name: string;
  title?: string;
  company?: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  linkedin?: string;
  department?: string;
  confidence: 'high' | 'medium' | 'low';
}

interface OrgNodeExtraction {
  name: string;
  title?: string;
  department?: string;
  reports_to?: string;
  direct_reports?: string[];
}

interface OrgChartExtraction {
  company_name?: string;
  nodes: OrgNodeExtraction[];
  relationships: Array<{ manager: string; report: string }>;
  missing_roles?: string[];
}

interface NotesExtraction {
  participants: string[];
  company_referenced?: string;
  decisions: string[];
  action_items: Array<{ task: string; owner?: string; due_date?: string }>;
  risks: string[];
  opportunities: string[];
  topics: string[];
  summary?: string;
}

interface ExtractedEntity {
  type: 'candidate' | 'contact' | 'org_node' | 'notes';
  data: CandidateExtraction | ContactExtraction | OrgChartExtraction | NotesExtraction;
  confidence: number;
  missing_fields: string[];
}

interface FileResult {
  file_name: string;
  file_type: string;
  file_size_bytes: number;
  ok: boolean;
  classification: FileClassification;
  extracted_text_length: number;
  extraction_method: 'text' | 'xml_parse' | 'ai_vision' | 'ocr_fallback';
  ocr_used: boolean;
  entities: ExtractedEntity[];
  error_code?: ErrorCode;
  error_message?: string;
  debug_info: {
    emails_found: number;
    phones_found: number;
    names_found: number;
    processing_time_ms: number;
  };
}

interface ProcessingResponse {
  ok: boolean;
  request_id: string;
  error_code?: ErrorCode;
  message?: string;
  details?: string;
  data?: {
    results: FileResult[];
    summary: {
      files_processed: number;
      files_succeeded: number;
      files_failed: number;
      total_entities_extracted: number;
    };
  };
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
  const body: ProcessingResponse = {
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

// Heuristic file classification based on text content
function classifyFileHeuristic(text: string, fileName: string): FileClassification {
  const lowerText = text.toLowerCase();
  
  // CV/Resume indicators
  const cvIndicators = [
    'experience', 'education', 'skills', 'work history', 'employment',
    'objective', 'summary', 'qualifications', 'certifications',
    'professional experience', 'career', 'curriculum vitae', 'resume',
    'references available', 'bachelor', 'master', 'degree', 'university'
  ];
  
  // Business card indicators
  const cardIndicators = ['tel:', 'phone:', 'email:', 'fax:', 'mobile:'];
  
  // Org chart indicators
  const orgIndicators = [
    'org chart', 'organization chart', 'reporting to', 'direct reports',
    'team structure', 'hierarchy', 'ceo', 'vp ', 'director of'
  ];
  
  // Notes/meeting indicators
  const notesIndicators = [
    'meeting notes', 'action items', 'attendees', 'agenda',
    'minutes', 'decisions', 'follow up', 'next steps', 'discussed'
  ];

  // Count matches
  let cvScore = cvIndicators.filter(i => lowerText.includes(i)).length;
  let cardScore = cardIndicators.filter(i => lowerText.includes(i)).length;
  let orgScore = orgIndicators.filter(i => lowerText.includes(i)).length;
  let notesScore = notesIndicators.filter(i => lowerText.includes(i)).length;
  
  // Check text structure
  const hasYearRanges = /\b(19|20)\d{2}\s*[-–]\s*(19|20)?\d{2,4}\b/.test(text);
  const hasRoleProgression = /\b(senior|junior|lead|manager|director|vp|vice president)\b/i.test(text);
  const isShortText = text.length < 500;
  
  // Boost CV score for common patterns
  if (hasYearRanges) cvScore += 2;
  if (hasRoleProgression) cvScore += 1;
  
  // Short text with contact info = business card
  if (isShortText && (text.match(/[\w.-]+@[\w.-]+\.\w+/g) || []).length <= 2) {
    cardScore += 2;
  }

  const maxScore = Math.max(cvScore, cardScore, orgScore, notesScore);
  
  if (maxScore === 0) {
    return { 
      detectedType: 'UNKNOWN', 
      confidence: 0.3, 
      reasoning: 'No clear indicators found' 
    };
  }

  let detectedType: FileType;
  let confidence: number;
  let reasoning: string;

  if (cvScore === maxScore && cvScore >= 3) {
    detectedType = 'CV_RESUME';
    confidence = Math.min(0.9, 0.5 + (cvScore * 0.08));
    reasoning = `Found ${cvScore} CV indicators: experience sections, education, skills`;
  } else if (cardScore === maxScore && isShortText) {
    detectedType = 'BUSINESS_CARD';
    confidence = Math.min(0.85, 0.5 + (cardScore * 0.15));
    reasoning = `Short text with contact info format`;
  } else if (orgScore === maxScore && orgScore >= 2) {
    detectedType = 'ORG_CHART';
    confidence = Math.min(0.85, 0.5 + (orgScore * 0.15));
    reasoning = `Found ${orgScore} org chart indicators`;
  } else if (notesScore === maxScore && notesScore >= 2) {
    detectedType = 'NOTES_DOCUMENT';
    confidence = Math.min(0.85, 0.5 + (notesScore * 0.15));
    reasoning = `Found ${notesScore} meeting notes indicators`;
  } else if (cvScore >= 2 || hasYearRanges) {
    detectedType = 'CV_RESUME';
    confidence = 0.6;
    reasoning = `Moderate CV indicators with date ranges`;
  } else {
    detectedType = 'UNKNOWN';
    confidence = 0.4;
    reasoning = `Mixed indicators, manual classification recommended`;
  }

  return { detectedType, confidence, reasoning };
}

// Extract text from various file types
async function extractTextFromFile(
  base64Data: string,
  mimeType: string,
  fileName: string
): Promise<{ text: string; needsOcr: boolean; imageBase64?: string; method: string }> {
  
  try {
    const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    // For images, we'll need OCR/AI vision
    if (mimeType.startsWith('image/')) {
      return { text: '', needsOcr: true, imageBase64: base64Data, method: 'ai_vision' };
    }
    
    // For PDF - send to AI vision for best results
    if (mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
      return { text: '', needsOcr: true, imageBase64: base64Data, method: 'ai_vision' };
    }
    
    // For DOCX - try to extract text from XML
    if (fileName.toLowerCase().endsWith('.docx') || mimeType.includes('word')) {
      const textDecoder = new TextDecoder('utf-8', { fatal: false });
      const rawText = textDecoder.decode(bytes);
      
      // Extract text from XML tags
      const textMatches = rawText.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
      if (textMatches) {
        const extractedText = textMatches
          .map(match => match.replace(/<[^>]+>/g, ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (extractedText.length > 100) {
          return { text: extractedText, needsOcr: false, method: 'xml_parse' };
        }
      }
      
      // Fallback to vision for complex DOCX
      return { text: '', needsOcr: true, imageBase64: base64Data, method: 'ai_vision' };
    }
    
    // For DOC (older format) - send to vision
    if (fileName.toLowerCase().endsWith('.doc')) {
      return { text: '', needsOcr: true, imageBase64: base64Data, method: 'ai_vision' };
    }
    
    // For plain text
    if (mimeType.startsWith('text/') || fileName.endsWith('.txt')) {
      const textDecoder = new TextDecoder('utf-8', { fatal: false });
      return { text: textDecoder.decode(bytes), needsOcr: false, method: 'text' };
    }
    
    // For PPTX - extract slide text
    if (fileName.toLowerCase().endsWith('.pptx')) {
      const textDecoder = new TextDecoder('utf-8', { fatal: false });
      const rawText = textDecoder.decode(bytes);
      
      const textMatches = rawText.match(/<a:t>([^<]*)<\/a:t>/g);
      if (textMatches) {
        const extractedText = textMatches
          .map(match => match.replace(/<[^>]+>/g, ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (extractedText.length > 50) {
          return { text: extractedText, needsOcr: false, method: 'xml_parse' };
        }
      }
      
      return { text: '', needsOcr: true, imageBase64: base64Data, method: 'ai_vision' };
    }
    
    // Unknown format - try as text
    const textDecoder = new TextDecoder('utf-8', { fatal: false });
    const rawText = textDecoder.decode(bytes);
    
    // Check if it looks like readable text
    const printableRatio = (rawText.match(/[\x20-\x7E\n\r\t]/g) || []).length / rawText.length;
    if (printableRatio > 0.8 && rawText.length > 50) {
      return { text: rawText, needsOcr: false, method: 'text' };
    }
    
    return { text: '', needsOcr: true, imageBase64: base64Data, method: 'ai_vision' };
    
  } catch (error) {
    console.error('Text extraction error:', error);
    return { text: '', needsOcr: true, imageBase64: base64Data, method: 'ocr_fallback' };
  }
}

// AI call with retry and timeout
async function callAI(
  apiKey: string,
  messages: any[],
  requestId: string,
  maxRetries: number = 2
): Promise<{ ok: boolean; content?: string; errorCode?: ErrorCode; errorMessage?: string }> {
  
  const timeout = 60000; // 60 second timeout
  
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
        if (response.status === 429) {
          if (attempt < maxRetries) {
            log(requestId, 'warn', `AI rate limited, retrying in ${(attempt + 1) * 2}s...`);
            await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
            continue;
          }
          return { ok: false, errorCode: ErrorCodes.AI_RATE_LIMIT, errorMessage: 'AI service rate limited' };
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
        if (attempt < maxRetries) {
          log(requestId, 'warn', `AI call timed out, retrying...`);
          continue;
        }
        return { ok: false, errorCode: ErrorCodes.AI_TIMEOUT, errorMessage: 'AI request timed out' };
      }
      
      if (attempt < maxRetries) {
        log(requestId, 'warn', `AI call failed: ${error}, retrying...`);
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      
      return { ok: false, errorCode: ErrorCodes.AI_BAD_RESPONSE, errorMessage: error instanceof Error ? error.message : 'AI call failed' };
    }
  }
  
  return { ok: false, errorCode: ErrorCodes.AI_BAD_RESPONSE, errorMessage: 'Max retries exceeded' };
}

// AI-based classification
async function classifyWithAI(
  apiKey: string,
  content: { text?: string; imageBase64?: string; mimeType?: string },
  requestId: string
): Promise<FileClassification> {
  
  const systemPrompt = `You are a document classifier. Analyze the content and classify it into exactly ONE of these categories:
- CV_RESUME: A person's resume, CV, or professional profile
- BUSINESS_CARD: A business card or contact card (usually short, 1-2 people)
- ORG_CHART: An organizational chart showing company hierarchy
- NOTES_DOCUMENT: Meeting notes, call notes, or general notes

Return ONLY valid JSON:
{
  "detectedType": "CV_RESUME" | "BUSINESS_CARD" | "ORG_CHART" | "NOTES_DOCUMENT",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

  let messages;
  if (content.imageBase64) {
    messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Classify this document:' },
          { 
            type: 'image_url', 
            image_url: { url: `data:${content.mimeType || 'application/octet-stream'};base64,${content.imageBase64}` }
          }
        ]
      }
    ];
  } else {
    messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Classify this document:\n\n${content.text?.slice(0, 3000)}` }
    ];
  }

  const result = await callAI(apiKey, messages, requestId);
  
  if (!result.ok || !result.content) {
    return { detectedType: 'UNKNOWN', confidence: 0.3, reasoning: 'Classification failed' };
  }
  
  try {
    const parsed = JSON.parse(result.content.replace(/```json\n?|\n?```/g, '').trim());
    return {
      detectedType: parsed.detectedType || 'UNKNOWN',
      confidence: parsed.confidence || 0.5,
      reasoning: parsed.reasoning || 'AI classification',
    };
  } catch {
    return { detectedType: 'UNKNOWN', confidence: 0.3, reasoning: 'Failed to parse classification' };
  }
}

// Parse CV/Resume
async function parseCVResume(
  apiKey: string,
  content: { text?: string; imageBase64?: string; mimeType?: string },
  requestId: string
): Promise<{ ok: boolean; data?: CandidateExtraction; confidence?: number; missing?: string[]; errorCode?: ErrorCode; errorMessage?: string }> {
  
  const systemPrompt = `You are an expert CV/resume parser. Extract candidate information and return ONLY valid JSON:

{
  "personal": {
    "full_name": "string (REQUIRED - extract even if partial)",
    "email": "string or null",
    "phone": "string or null",
    "location": "string or null",
    "linkedin_url": "string or null"
  },
  "headline": {
    "current_title": "most recent or current job title",
    "seniority_level": "executive|director|manager|senior|mid|junior"
  },
  "skills": {
    "primary_skills": ["core technical/professional skills"],
    "secondary_skills": ["supporting skills"]
  },
  "experience": [
    {
      "company": "company name",
      "title": "job title",
      "start_date": "YYYY-MM or YYYY",
      "end_date": "YYYY-MM or YYYY or 'Present'",
      "summary": "brief description"
    }
  ],
  "education": [
    {
      "institution": "school/university name",
      "degree": "degree type",
      "field": "field of study"
    }
  ],
  "certifications": ["list of certifications"],
  "current_employer": "current company if identifiable",
  "recent_employers": ["last 3 employers"],
  "overall_confidence": 0.0-1.0
}

IMPORTANT: 
- Always extract the name even if other fields are missing
- If no email/phone found, return null but STILL return the profile
- Include confidence score based on data quality`;

  let messages;
  if (content.imageBase64) {
    messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract candidate information from this CV/resume:' },
          { 
            type: 'image_url', 
            image_url: { url: `data:${content.mimeType || 'application/octet-stream'};base64,${content.imageBase64}` }
          }
        ]
      }
    ];
  } else {
    messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Extract candidate information from this CV/resume:\n\n${content.text}` }
    ];
  }

  const result = await callAI(apiKey, messages, requestId);
  
  if (!result.ok) {
    return { ok: false, errorCode: result.errorCode, errorMessage: result.errorMessage };
  }
  
  try {
    const parsed = JSON.parse(result.content!.replace(/```json\n?|\n?```/g, '').trim());
    
    const missing: string[] = [];
    if (!parsed.personal?.email) missing.push('email');
    if (!parsed.personal?.phone) missing.push('phone');
    if (!parsed.personal?.linkedin_url) missing.push('linkedin');
    if (!parsed.experience?.length) missing.push('experience');
    if (!parsed.education?.length) missing.push('education');
    
    return {
      ok: true,
      data: parsed,
      confidence: parsed.overall_confidence || 0.7,
      missing,
    };
  } catch (e) {
    return { ok: false, errorCode: ErrorCodes.PARSE_ERROR, errorMessage: 'Failed to parse CV extraction result' };
  }
}

// Parse Business Card
async function parseBusinessCard(
  apiKey: string,
  content: { text?: string; imageBase64?: string; mimeType?: string },
  requestId: string
): Promise<{ ok: boolean; data?: ContactExtraction[]; confidence?: number; errorCode?: ErrorCode; errorMessage?: string }> {
  
  const systemPrompt = `You are an expert at extracting contact information from business cards. Extract ALL contacts and return ONLY valid JSON:

{
  "contacts": [
    {
      "name": "full name (REQUIRED)",
      "title": "job title",
      "company": "company name",
      "email": "email address",
      "phone": "phone number",
      "address": "physical address",
      "website": "website URL",
      "linkedin": "LinkedIn URL",
      "department": "department name",
      "confidence": "high|medium|low"
    }
  ],
  "overall_confidence": 0.0-1.0
}`;

  let messages;
  if (content.imageBase64) {
    messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract contact information from this business card:' },
          { 
            type: 'image_url', 
            image_url: { url: `data:${content.mimeType || 'application/octet-stream'};base64,${content.imageBase64}` }
          }
        ]
      }
    ];
  } else {
    messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Extract contact information:\n\n${content.text}` }
    ];
  }

  const result = await callAI(apiKey, messages, requestId);
  
  if (!result.ok) {
    return { ok: false, errorCode: result.errorCode, errorMessage: result.errorMessage };
  }
  
  try {
    const parsed = JSON.parse(result.content!.replace(/```json\n?|\n?```/g, '').trim());
    return {
      ok: true,
      data: parsed.contacts || [],
      confidence: parsed.overall_confidence || 0.7,
    };
  } catch {
    return { ok: false, errorCode: ErrorCodes.PARSE_ERROR, errorMessage: 'Failed to parse card extraction result' };
  }
}

// Parse Org Chart
async function parseOrgChart(
  apiKey: string,
  content: { text?: string; imageBase64?: string; mimeType?: string },
  requestId: string
): Promise<{ ok: boolean; data?: OrgChartExtraction; confidence?: number; errorCode?: ErrorCode; errorMessage?: string }> {
  
  const systemPrompt = `You are an expert at extracting organizational chart information. Extract all people and their relationships, returning ONLY valid JSON:

{
  "company_name": "company name if visible",
  "nodes": [
    {
      "name": "person name",
      "title": "job title",
      "department": "department",
      "reports_to": "manager name",
      "direct_reports": ["names of direct reports"]
    }
  ],
  "relationships": [
    { "manager": "manager name", "report": "direct report name" }
  ],
  "missing_roles": ["roles that appear vacant or TBD"],
  "overall_confidence": 0.0-1.0
}`;

  let messages;
  if (content.imageBase64) {
    messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract org chart information:' },
          { 
            type: 'image_url', 
            image_url: { url: `data:${content.mimeType || 'application/octet-stream'};base64,${content.imageBase64}` }
          }
        ]
      }
    ];
  } else {
    messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Extract org chart information:\n\n${content.text}` }
    ];
  }

  const result = await callAI(apiKey, messages, requestId);
  
  if (!result.ok) {
    return { ok: false, errorCode: result.errorCode, errorMessage: result.errorMessage };
  }
  
  try {
    const parsed = JSON.parse(result.content!.replace(/```json\n?|\n?```/g, '').trim());
    return {
      ok: true,
      data: parsed,
      confidence: parsed.overall_confidence || 0.7,
    };
  } catch {
    return { ok: false, errorCode: ErrorCodes.PARSE_ERROR, errorMessage: 'Failed to parse org chart result' };
  }
}

// Parse Notes/Meeting Document
async function parseNotes(
  apiKey: string,
  content: { text?: string; imageBase64?: string; mimeType?: string },
  requestId: string
): Promise<{ ok: boolean; data?: NotesExtraction; confidence?: number; errorCode?: ErrorCode; errorMessage?: string }> {
  
  const systemPrompt = `You are an expert at extracting meeting intelligence from notes. Extract structured information and return ONLY valid JSON:

{
  "participants": ["list of attendee names/emails"],
  "company_referenced": "main company/client discussed",
  "decisions": ["key decisions made"],
  "action_items": [
    { "task": "task description", "owner": "person responsible", "due_date": "date if mentioned" }
  ],
  "risks": ["risks or concerns identified"],
  "opportunities": ["opportunities identified"],
  "topics": ["main topics discussed"],
  "summary": "brief 2-3 sentence summary",
  "overall_confidence": 0.0-1.0
}`;

  let messages;
  if (content.imageBase64) {
    messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract meeting notes information:' },
          { 
            type: 'image_url', 
            image_url: { url: `data:${content.mimeType || 'application/octet-stream'};base64,${content.imageBase64}` }
          }
        ]
      }
    ];
  } else {
    messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Extract meeting notes information:\n\n${content.text}` }
    ];
  }

  const result = await callAI(apiKey, messages, requestId);
  
  if (!result.ok) {
    return { ok: false, errorCode: result.errorCode, errorMessage: result.errorMessage };
  }
  
  try {
    const parsed = JSON.parse(result.content!.replace(/```json\n?|\n?```/g, '').trim());
    return {
      ok: true,
      data: parsed,
      confidence: parsed.overall_confidence || 0.7,
    };
  } catch {
    return { ok: false, errorCode: ErrorCodes.PARSE_ERROR, errorMessage: 'Failed to parse notes result' };
  }
}

// Main processing function for a single file
async function processFile(
  apiKey: string,
  file: { base64: string; mimeType: string; fileName: string; userOverrideType?: FileType },
  requestId: string
): Promise<FileResult> {
  
  const startTime = Date.now();
  const fileSize = Math.round((file.base64.length * 3) / 4); // Approximate decoded size
  
  const result: FileResult = {
    file_name: file.fileName,
    file_type: file.mimeType,
    file_size_bytes: fileSize,
    ok: false,
    classification: { detectedType: 'UNKNOWN', confidence: 0, reasoning: '' },
    extracted_text_length: 0,
    extraction_method: 'text',
    ocr_used: false,
    entities: [],
    debug_info: {
      emails_found: 0,
      phones_found: 0,
      names_found: 0,
      processing_time_ms: 0,
    }
  };

  // Check file size (10MB limit per file)
  if (fileSize > 10 * 1024 * 1024) {
    result.error_code = ErrorCodes.FILE_TOO_LARGE;
    result.error_message = `File exceeds 10MB limit (${(fileSize / 1024 / 1024).toFixed(1)}MB)`;
    result.debug_info.processing_time_ms = Date.now() - startTime;
    return result;
  }

  try {
    // Step 1: Extract text
    log(requestId, 'info', `Extracting text from ${file.fileName}`, { mimeType: file.mimeType, size: fileSize });
    const extraction = await extractTextFromFile(file.base64, file.mimeType, file.fileName);
    result.extracted_text_length = extraction.text.length;
    result.ocr_used = extraction.needsOcr;
    result.extraction_method = extraction.method as any;

    // Step 2: Classify file
    let classification: FileClassification;
    
    if (file.userOverrideType) {
      classification = {
        detectedType: file.userOverrideType,
        confidence: 1.0,
        reasoning: 'User-specified type',
      };
    } else if (extraction.text.length > 100) {
      classification = classifyFileHeuristic(extraction.text, file.fileName);
      
      // Use AI if heuristic confidence is low
      if (classification.confidence < 0.6) {
        log(requestId, 'info', `Low confidence (${classification.confidence}), using AI classification`);
        const aiClassification = await classifyWithAI(apiKey, extraction, requestId);
        if (aiClassification.confidence > classification.confidence) {
          classification = aiClassification;
        }
      }
    } else {
      // Need AI for image/OCR content
      log(requestId, 'info', `Using AI classification for image/OCR content`);
      classification = await classifyWithAI(apiKey, { 
        imageBase64: extraction.imageBase64, 
        mimeType: file.mimeType 
      }, requestId);
    }

    result.classification = classification;
    log(requestId, 'info', `Classified as ${classification.detectedType}`, { confidence: classification.confidence });

    // Step 3: Parse based on type
    const content = extraction.needsOcr 
      ? { imageBase64: extraction.imageBase64, mimeType: file.mimeType }
      : { text: extraction.text };

    switch (classification.detectedType) {
      case 'CV_RESUME': {
        const parsed = await parseCVResume(apiKey, content, requestId);
        if (parsed.ok && parsed.data) {
          result.entities.push({
            type: 'candidate',
            data: parsed.data,
            confidence: parsed.confidence || 0.7,
            missing_fields: parsed.missing || [],
          });
          result.debug_info.emails_found = parsed.data.personal?.email ? 1 : 0;
          result.debug_info.phones_found = parsed.data.personal?.phone ? 1 : 0;
          result.debug_info.names_found = parsed.data.personal?.full_name ? 1 : 0;
          result.ok = !!parsed.data.personal?.full_name;
        } else {
          result.error_code = parsed.errorCode;
          result.error_message = parsed.errorMessage;
        }
        break;
      }
      
      case 'BUSINESS_CARD': {
        const parsed = await parseBusinessCard(apiKey, content, requestId);
        if (parsed.ok && parsed.data) {
          parsed.data.forEach(contact => {
            result.entities.push({
              type: 'contact',
              data: contact,
              confidence: contact.confidence === 'high' ? 0.9 : contact.confidence === 'medium' ? 0.7 : 0.5,
              missing_fields: [],
            });
          });
          result.debug_info.emails_found = parsed.data.filter(c => c.email).length;
          result.debug_info.phones_found = parsed.data.filter(c => c.phone).length;
          result.debug_info.names_found = parsed.data.filter(c => c.name).length;
          result.ok = parsed.data.length > 0;
        } else {
          result.error_code = parsed.errorCode;
          result.error_message = parsed.errorMessage;
        }
        break;
      }
      
      case 'ORG_CHART': {
        const parsed = await parseOrgChart(apiKey, content, requestId);
        if (parsed.ok && parsed.data) {
          result.entities.push({
            type: 'org_node',
            data: parsed.data,
            confidence: parsed.confidence || 0.7,
            missing_fields: [],
          });
          result.debug_info.names_found = parsed.data.nodes?.length || 0;
          result.ok = (parsed.data.nodes?.length || 0) > 0;
        } else {
          result.error_code = parsed.errorCode;
          result.error_message = parsed.errorMessage;
        }
        break;
      }
      
      case 'NOTES_DOCUMENT': {
        const parsed = await parseNotes(apiKey, content, requestId);
        if (parsed.ok && parsed.data) {
          result.entities.push({
            type: 'notes',
            data: parsed.data,
            confidence: parsed.confidence || 0.7,
            missing_fields: [],
          });
          result.debug_info.names_found = parsed.data.participants?.length || 0;
          result.ok = true;
        } else {
          result.error_code = parsed.errorCode;
          result.error_message = parsed.errorMessage;
        }
        break;
      }
      
      default: {
        // Try CV parsing as fallback for unknown
        log(requestId, 'info', `Unknown type, trying CV parsing as fallback`);
        try {
          const parsed = await parseCVResume(apiKey, content, requestId);
          if (parsed.ok && parsed.data?.personal?.full_name) {
            result.entities.push({
              type: 'candidate',
              data: parsed.data,
              confidence: (parsed.confidence || 0.7) * 0.8,
              missing_fields: parsed.missing || [],
            });
            result.ok = true;
          }
        } catch {
          // Try contact parsing
          const parsed = await parseBusinessCard(apiKey, content, requestId);
          if (parsed.ok && parsed.data && parsed.data.length > 0) {
            parsed.data.forEach(contact => {
              result.entities.push({
                type: 'contact',
                data: contact,
                confidence: 0.5,
                missing_fields: [],
              });
            });
            result.ok = true;
          }
        }
      }
    }

    // If no entities extracted and no error set, set a generic message
    if (result.entities.length === 0 && !result.error_code) {
      result.error_code = ErrorCodes.PARSE_ERROR;
      result.error_message = 'Could not extract any structured data from file';
    }

  } catch (error) {
    log(requestId, 'error', `Processing error for ${file.fileName}`, { error: String(error) });
    result.error_code = ErrorCodes.UNKNOWN_ERROR;
    result.error_message = error instanceof Error ? error.message : 'Unknown processing error';
  }

  result.debug_info.processing_time_ms = Date.now() - startTime;
  return result;
}

serve(async (req) => {
  const requestId = req.headers.get('x-request-id') || generateRequestId();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    log(requestId, 'error', 'Missing Supabase configuration');
    return createErrorResponse(requestId, ErrorCodes.AI_CONFIG_ERROR, 'Server configuration error', 'Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  }

  try {
    // Check content length
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_PAYLOAD_SIZE) {
      return createErrorResponse(requestId, ErrorCodes.PAYLOAD_TOO_LARGE, 'Payload too large', 'Maximum upload size is 15MB');
    }

    // Check for authentication
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    let isDemo = false;
    
    if (authHeader?.startsWith('Bearer ')) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });

      // Get user from session
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        log(requestId, 'warn', 'Auth failed, checking demo mode', { error: userError?.message });
        // Check if this might be a demo workspace request
        isDemo = true;
      } else {
        userId = user.id;
        
        // Check role
        const { data: roleData } = await supabase.rpc('get_user_role', { _user_id: userId });
        if (roleData === 'viewer') {
          return createErrorResponse(requestId, ErrorCodes.INSUFFICIENT_PERMISSIONS, 'Insufficient permissions', 'Viewer role cannot use AI import');
        }
        
        // Check if demo user
        const { data: workspaceMode } = await supabase.rpc('get_workspace_mode', { _user_id: userId });
        isDemo = workspaceMode === 'demo' || workspaceMode === 'public_demo';
      }
    } else {
      // No auth header - allow for demo mode
      isDemo = true;
      log(requestId, 'info', 'No auth header, running in demo mode');
    }

    // Rate limiting (use IP for anonymous, userId for authenticated)
    const rateLimitKey = userId || req.headers.get('x-forwarded-for') || 'anonymous';
    const rateCheck = checkRateLimit(rateLimitKey);
    if (!rateCheck.allowed) {
      return createErrorResponse(requestId, ErrorCodes.RATE_LIMIT_EXCEEDED, 'Rate limit exceeded', `Try again in ${rateCheck.retryAfter} seconds`);
    }

    // Parse request
    const body = await req.json();
    const files: Array<{ base64: string; mimeType: string; fileName: string; userOverrideType?: FileType }> = body.files || [];

    if (!files.length) {
      return createErrorResponse(requestId, ErrorCodes.NO_FILES_PROVIDED, 'No files provided', 'Upload at least one file to process');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      log(requestId, 'error', 'Missing LOVABLE_API_KEY');
      return createErrorResponse(requestId, ErrorCodes.AI_CONFIG_ERROR, 'AI service not configured', 'Missing LOVABLE_API_KEY environment variable');
    }

    log(requestId, 'info', `Processing ${files.length} files`, { userId, isDemo });

    // Process all files (per-file, partial success allowed)
    const results: FileResult[] = [];
    for (const file of files) {
      const fileResult = await processFile(LOVABLE_API_KEY, file, requestId);
      results.push(fileResult);
      log(requestId, 'info', `File ${file.fileName}: ${fileResult.ok ? 'SUCCESS' : 'FAILED'}`, {
        entities: fileResult.entities.length,
        error: fileResult.error_message,
      });
    }

    // Audit log (use service role if available for reliability)
    if (supabaseServiceKey && userId) {
      try {
        const adminClient = createClient(supabaseUrl, supabaseServiceKey);
        await adminClient.from('audit_log').insert({
          entity_type: 'ai_function',
          entity_id: 'unified-import',
          action: 'unified_import_complete',
          changed_by: userId,
          diff: {},
          context: {
            function: 'ai-unified-import',
            request_id: requestId,
            files_processed: files.length,
            total_entities: results.reduce((sum, r) => sum + r.entities.length, 0),
            success_count: results.filter(r => r.ok).length,
            is_demo: isDemo,
          },
        });
      } catch (e) {
        log(requestId, 'warn', 'Audit log failed', { error: String(e) });
      }
    }

    const successCount = results.filter(r => r.ok).length;
    const failCount = results.filter(r => !r.ok).length;
    const totalEntities = results.reduce((sum, r) => sum + r.entities.length, 0);

    const response: ProcessingResponse = {
      ok: successCount > 0,
      request_id: requestId,
      data: {
        results,
        summary: {
          files_processed: files.length,
          files_succeeded: successCount,
          files_failed: failCount,
          total_entities_extracted: totalEntities,
        }
      }
    };

    // If all files failed, include a top-level error
    if (successCount === 0 && failCount > 0) {
      response.error_code = ErrorCodes.PARSE_ERROR;
      response.message = 'All files failed to process';
      response.details = results.map(r => `${r.file_name}: ${r.error_message}`).join('; ');
    }

    log(requestId, 'info', 'Processing complete', { successCount, failCount, totalEntities });

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    log(requestId, 'error', 'Unhandled error', { error: String(error), stack: error instanceof Error ? error.stack : undefined });
    return createErrorResponse(requestId, ErrorCodes.UNKNOWN_ERROR, 'An unexpected error occurred', error instanceof Error ? error.message : 'Unknown error', 200);
  }
});
