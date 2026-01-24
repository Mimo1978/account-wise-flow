import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW = 60 * 1000;

// Max payload size: 15MB
const MAX_PAYLOAD_SIZE = 15 * 1024 * 1024;

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

interface ProcessingResult {
  file_name: string;
  file_type: string;
  classification: FileClassification;
  extracted_text_length: number;
  ocr_used: boolean;
  entities: ExtractedEntity[];
  parse_success: boolean;
  error_message?: string;
  debug_info: {
    emails_found: number;
    phones_found: number;
    names_found: number;
    processing_time_ms: number;
  };
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
  const lowerFileName = fileName.toLowerCase();
  
  // CV/Resume indicators
  const cvIndicators = [
    'experience', 'education', 'skills', 'work history', 'employment',
    'objective', 'summary', 'qualifications', 'certifications',
    'professional experience', 'career', 'curriculum vitae', 'resume',
    'references available', 'bachelor', 'master', 'degree', 'university'
  ];
  
  // Business card indicators
  const cardIndicators = [
    'tel:', 'phone:', 'email:', 'fax:', 'mobile:',
  ];
  
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
  const cvScore = cvIndicators.filter(i => lowerText.includes(i)).length;
  const cardScore = cardIndicators.filter(i => lowerText.includes(i)).length;
  const orgScore = orgIndicators.filter(i => lowerText.includes(i)).length;
  const notesScore = notesIndicators.filter(i => lowerText.includes(i)).length;
  
  // Check text structure
  const hasYearRanges = /\b(19|20)\d{2}\s*[-–]\s*(19|20)?\d{2,4}\b/.test(text);
  const hasRoleProgression = /\b(senior|junior|lead|manager|director|vp|vice president)\b/i.test(text);
  const isShortText = text.length < 500;
  const hasMultipleEmails = (text.match(/[\w.-]+@[\w.-]+\.\w+/g) || []).length > 2;
  const hasMultiplePhones = (text.match(/[\+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}/g) || []).length > 2;
  
  // Boost CV score for common patterns
  if (hasYearRanges) cvScore * 1.5;
  if (hasRoleProgression) cvScore * 1.3;
  
  // Short text with contact info = business card
  if (isShortText && (text.match(/[\w.-]+@[\w.-]+\.\w+/g) || []).length <= 2) {
    cardScore * 2;
  }
  
  // Multiple people = org chart
  if (hasMultipleEmails || hasMultiplePhones) {
    orgScore * 1.5;
  }

  const scores = { cvScore, cardScore, orgScore, notesScore };
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
    confidence = Math.min(0.9, 0.5 + (cvScore * 0.1));
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
): Promise<{ text: string; needsOcr: boolean; imageBase64?: string }> {
  
  try {
    const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    // For images, we'll need OCR/AI vision
    if (mimeType.startsWith('image/')) {
      return { text: '', needsOcr: true, imageBase64: base64Data };
    }
    
    // For PDF - try text extraction, fallback to vision
    if (mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
      // PDFs should be sent to AI vision for best results
      return { text: '', needsOcr: true, imageBase64: base64Data };
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
          return { text: extractedText, needsOcr: false };
        }
      }
      
      // Fallback to vision for complex DOCX
      return { text: '', needsOcr: true, imageBase64: base64Data };
    }
    
    // For DOC (older format) - send to vision
    if (fileName.toLowerCase().endsWith('.doc')) {
      return { text: '', needsOcr: true, imageBase64: base64Data };
    }
    
    // For plain text
    if (mimeType.startsWith('text/') || fileName.endsWith('.txt')) {
      const textDecoder = new TextDecoder('utf-8', { fatal: false });
      return { text: textDecoder.decode(bytes), needsOcr: false };
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
          return { text: extractedText, needsOcr: false };
        }
      }
      
      return { text: '', needsOcr: true, imageBase64: base64Data };
    }
    
    // Unknown format - try as text
    const textDecoder = new TextDecoder('utf-8', { fatal: false });
    const rawText = textDecoder.decode(bytes);
    
    // Check if it looks like readable text
    const printableRatio = (rawText.match(/[\x20-\x7E\n\r\t]/g) || []).length / rawText.length;
    if (printableRatio > 0.8 && rawText.length > 50) {
      return { text: rawText, needsOcr: false };
    }
    
    return { text: '', needsOcr: true, imageBase64: base64Data };
    
  } catch (error) {
    console.error('Text extraction error:', error);
    return { text: '', needsOcr: true, imageBase64: base64Data };
  }
}

// AI-based classification when heuristics are uncertain
async function classifyWithAI(
  apiKey: string,
  content: { text?: string; imageBase64?: string; mimeType?: string }
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

  try {
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
      throw new Error(`AI classification failed: ${response.status}`);
    }

    const data = await response.json();
    const content_response = data.choices?.[0]?.message?.content;
    
    let parsed = JSON.parse(content_response.replace(/```json\n?|\n?```/g, '').trim());
    
    return {
      detectedType: parsed.detectedType || 'UNKNOWN',
      confidence: parsed.confidence || 0.5,
      reasoning: parsed.reasoning || 'AI classification',
    };
  } catch (error) {
    console.error('AI classification error:', error);
    return { detectedType: 'UNKNOWN', confidence: 0.3, reasoning: 'Classification failed' };
  }
}

// Parse CV/Resume
async function parseCVResume(
  apiKey: string,
  content: { text?: string; imageBase64?: string; mimeType?: string }
): Promise<{ data: CandidateExtraction; confidence: number; missing: string[] }> {
  
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
    throw new Error(`CV parsing failed: ${response.status}`);
  }

  const data = await response.json();
  const content_response = data.choices?.[0]?.message?.content;
  
  let parsed = JSON.parse(content_response.replace(/```json\n?|\n?```/g, '').trim());
  
  // Track missing fields
  const missing: string[] = [];
  if (!parsed.personal?.email) missing.push('email');
  if (!parsed.personal?.phone) missing.push('phone');
  if (!parsed.personal?.linkedin_url) missing.push('linkedin');
  if (!parsed.experience?.length) missing.push('experience');
  if (!parsed.education?.length) missing.push('education');
  
  return {
    data: parsed,
    confidence: parsed.overall_confidence || 0.7,
    missing,
  };
}

// Parse Business Card
async function parseBusinessCard(
  apiKey: string,
  content: { text?: string; imageBase64?: string; mimeType?: string }
): Promise<{ data: ContactExtraction[]; confidence: number }> {
  
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
    throw new Error(`Card parsing failed: ${response.status}`);
  }

  const data = await response.json();
  const content_response = data.choices?.[0]?.message?.content;
  
  let parsed = JSON.parse(content_response.replace(/```json\n?|\n?```/g, '').trim());
  
  return {
    data: parsed.contacts || [],
    confidence: parsed.overall_confidence || 0.7,
  };
}

// Parse Org Chart
async function parseOrgChart(
  apiKey: string,
  content: { text?: string; imageBase64?: string; mimeType?: string }
): Promise<{ data: OrgChartExtraction; confidence: number }> {
  
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
    throw new Error(`Org chart parsing failed: ${response.status}`);
  }

  const data = await response.json();
  const content_response = data.choices?.[0]?.message?.content;
  
  let parsed = JSON.parse(content_response.replace(/```json\n?|\n?```/g, '').trim());
  
  return {
    data: parsed,
    confidence: parsed.overall_confidence || 0.7,
  };
}

// Parse Notes/Meeting Document
async function parseNotes(
  apiKey: string,
  content: { text?: string; imageBase64?: string; mimeType?: string }
): Promise<{ data: NotesExtraction; confidence: number }> {
  
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
    throw new Error(`Notes parsing failed: ${response.status}`);
  }

  const data = await response.json();
  const content_response = data.choices?.[0]?.message?.content;
  
  let parsed = JSON.parse(content_response.replace(/```json\n?|\n?```/g, '').trim());
  
  return {
    data: parsed,
    confidence: parsed.overall_confidence || 0.7,
  };
}

// Main processing function
async function processFile(
  apiKey: string,
  file: { base64: string; mimeType: string; fileName: string; userOverrideType?: FileType }
): Promise<ProcessingResult> {
  
  const startTime = Date.now();
  const result: ProcessingResult = {
    file_name: file.fileName,
    file_type: file.mimeType,
    classification: { detectedType: 'UNKNOWN', confidence: 0, reasoning: '' },
    extracted_text_length: 0,
    ocr_used: false,
    entities: [],
    parse_success: false,
    debug_info: {
      emails_found: 0,
      phones_found: 0,
      names_found: 0,
      processing_time_ms: 0,
    }
  };

  try {
    // Step 1: Extract text
    console.log(`[ai-unified-import] Extracting text from ${file.fileName}`);
    const extraction = await extractTextFromFile(file.base64, file.mimeType, file.fileName);
    result.extracted_text_length = extraction.text.length;
    result.ocr_used = extraction.needsOcr;

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
        console.log(`[ai-unified-import] Low confidence (${classification.confidence}), using AI classification`);
        const aiClassification = await classifyWithAI(apiKey, extraction);
        if (aiClassification.confidence > classification.confidence) {
          classification = aiClassification;
        }
      }
    } else {
      // Need AI for image/OCR content
      console.log(`[ai-unified-import] Using AI classification for image/OCR content`);
      classification = await classifyWithAI(apiKey, { 
        imageBase64: extraction.imageBase64, 
        mimeType: file.mimeType 
      });
    }

    result.classification = classification;
    console.log(`[ai-unified-import] Classified as ${classification.detectedType} (confidence: ${classification.confidence})`);

    // Step 3: Parse based on type
    const content = extraction.needsOcr 
      ? { imageBase64: extraction.imageBase64, mimeType: file.mimeType }
      : { text: extraction.text };

    switch (classification.detectedType) {
      case 'CV_RESUME': {
        const parsed = await parseCVResume(apiKey, content);
        result.entities.push({
          type: 'candidate',
          data: parsed.data,
          confidence: parsed.confidence,
          missing_fields: parsed.missing,
        });
        result.debug_info.emails_found = parsed.data.personal?.email ? 1 : 0;
        result.debug_info.phones_found = parsed.data.personal?.phone ? 1 : 0;
        result.debug_info.names_found = parsed.data.personal?.full_name ? 1 : 0;
        result.parse_success = !!parsed.data.personal?.full_name;
        break;
      }
      
      case 'BUSINESS_CARD': {
        const parsed = await parseBusinessCard(apiKey, content);
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
        result.parse_success = parsed.data.length > 0;
        break;
      }
      
      case 'ORG_CHART': {
        const parsed = await parseOrgChart(apiKey, content);
        result.entities.push({
          type: 'org_node',
          data: parsed.data,
          confidence: parsed.confidence,
          missing_fields: [],
        });
        result.debug_info.names_found = parsed.data.nodes?.length || 0;
        result.parse_success = (parsed.data.nodes?.length || 0) > 0;
        break;
      }
      
      case 'NOTES_DOCUMENT': {
        const parsed = await parseNotes(apiKey, content);
        result.entities.push({
          type: 'notes',
          data: parsed.data,
          confidence: parsed.confidence,
          missing_fields: [],
        });
        result.debug_info.names_found = parsed.data.participants?.length || 0;
        result.parse_success = true;
        break;
      }
      
      default: {
        // Try CV parsing as fallback for unknown
        console.log(`[ai-unified-import] Unknown type, trying CV parsing as fallback`);
        try {
          const parsed = await parseCVResume(apiKey, content);
          if (parsed.data.personal?.full_name) {
            result.entities.push({
              type: 'candidate',
              data: parsed.data,
              confidence: parsed.confidence * 0.8, // Lower confidence for fallback
              missing_fields: parsed.missing,
            });
            result.parse_success = true;
          }
        } catch {
          // Try contact parsing
          const parsed = await parseBusinessCard(apiKey, content);
          if (parsed.data.length > 0) {
            parsed.data.forEach(contact => {
              result.entities.push({
                type: 'contact',
                data: contact,
                confidence: 0.5,
                missing_fields: [],
              });
            });
            result.parse_success = true;
          }
        }
      }
    }

    // If no entities extracted, it's a parse failure
    if (result.entities.length === 0) {
      result.error_message = 'Could not extract any structured data from file';
      result.parse_success = false;
    }

  } catch (error) {
    console.error(`[ai-unified-import] Processing error for ${file.fileName}:`, error);
    result.error_message = error instanceof Error ? error.message : 'Unknown processing error';
    result.parse_success = false;
  }

  result.debug_info.processing_time_ms = Date.now() - startTime;
  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  try {
    // Check content length
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_PAYLOAD_SIZE) {
      return new Response(
        JSON.stringify({ success: false, error: 'Payload too large (max 15MB)' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Require authentication
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

    // Validate JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub as string;

    // Check role
    const { data: roleData } = await supabase.rpc('get_user_role', { _user_id: userId });
    if (!roleData || roleData === 'viewer') {
      return new Response(
        JSON.stringify({ success: false, error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting
    const rateCheck = checkRateLimit(userId);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ success: false, error: 'Rate limit exceeded' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rateCheck.retryAfter) } }
      );
    }

    // Parse request
    const body = await req.json();
    const files: Array<{ base64: string; mimeType: string; fileName: string; userOverrideType?: FileType }> = body.files || [];

    if (!files.length) {
      return new Response(
        JSON.stringify({ success: false, error: 'No files provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[ai-unified-import] Processing ${files.length} files for user ${userId}`);

    // Process all files
    const results: ProcessingResult[] = [];
    for (const file of files) {
      const result = await processFile(LOVABLE_API_KEY, file);
      results.push(result);
      console.log(`[ai-unified-import] File ${file.fileName}: ${result.parse_success ? 'SUCCESS' : 'FAILED'} - ${result.entities.length} entities`);
    }

    // Audit log
    try {
      await supabase.from('audit_log').insert({
        entity_type: 'ai_function',
        entity_id: 'unified-import',
        action: 'unified_import_complete',
        changed_by: userId,
        diff: {},
        context: {
          function: 'ai-unified-import',
          files_processed: files.length,
          total_entities: results.reduce((sum, r) => sum + r.entities.length, 0),
          success_count: results.filter(r => r.parse_success).length,
        },
      });
    } catch (e) {
      console.error('Audit log failed:', e);
    }

    const successCount = results.filter(r => r.parse_success).length;
    const totalEntities = results.reduce((sum, r) => sum + r.entities.length, 0);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          results,
          summary: {
            files_processed: files.length,
            files_succeeded: successCount,
            total_entities_extracted: totalEntities,
          }
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ai-unified-import] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
