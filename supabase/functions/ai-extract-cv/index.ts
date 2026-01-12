import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW = 60 * 1000;

// Max payload size: 10MB for images/documents
const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024;
const MAX_TEXT_LENGTH = 100000; // 100K chars for text CVs
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];

interface ExtractedExperience {
  company: string;
  title: string;
  startDate: string;
  endDate?: string;
  current?: boolean;
  description?: string;
}

interface ExtractedEducation {
  institution: string;
  degree: string;
  field?: string;
  startDate?: string;
  endDate?: string;
  grade?: string;
}

interface ExtractedTalent {
  name: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedIn?: string;
  roleType: string;
  seniority: 'executive' | 'director' | 'manager' | 'senior' | 'mid' | 'junior';
  skills: string[];
  aiOverview: string;
  experience: ExtractedExperience[];
  education: ExtractedEducation[];
  confidence: 'high' | 'medium' | 'low';
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

function validatePayload(payload: unknown): { valid: boolean; error?: string } {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Invalid payload format' };
  }

  const p = payload as Record<string, unknown>;
  
  // Need either image or text
  if (!p.imageBase64 && !p.textContent) {
    return { valid: false, error: 'Missing CV data (imageBase64 or textContent required)' };
  }

  // Validate image if provided
  if (p.imageBase64) {
    if (typeof p.imageBase64 !== 'string') {
      return { valid: false, error: 'Invalid imageBase64 format' };
    }
    const estimatedSize = (p.imageBase64.length * 3) / 4;
    if (estimatedSize > MAX_PAYLOAD_SIZE) {
      return { valid: false, error: 'Image too large (max 10MB)' };
    }

    if (p.mimeType && typeof p.mimeType === 'string') {
      if (!ALLOWED_MIME_TYPES.includes(p.mimeType.toLowerCase())) {
        return { valid: false, error: `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}` };
      }
    }
  }

  // Validate text if provided
  if (p.textContent) {
    if (typeof p.textContent !== 'string') {
      return { valid: false, error: 'Invalid textContent format' };
    }
    if (p.textContent.length > MAX_TEXT_LENGTH) {
      return { valid: false, error: `Text too long (max ${MAX_TEXT_LENGTH} chars)` };
    }
  }

  return { valid: true };
}

// Check if user is in demo mode - demo users can only access demo data
async function checkDemoIsolation(supabase: any, userId: string): Promise<{ isDemo: boolean }> {
  const { data, error } = await supabase.rpc('is_demo_user', { _user_id: userId });
  
  if (error) {
    console.error('Failed to check demo status:', error);
    return { isDemo: false };
  }
  
  return { isDemo: !!data };
}

async function logAudit(
  supabase: any,
  userId: string,
  action: string,
  entityId: string | null,
  context: Record<string, unknown>
) {
  try {
    await supabase.from('audit_log').insert({
      entity_type: 'ai_function',
      entity_id: entityId || 'system',
      action,
      changed_by: userId,
      diff: {},
      context: {
        ...context,
        function: 'ai-extract-cv',
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

  try {
    // 1. Check content length
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_PAYLOAD_SIZE) {
      return new Response(
        JSON.stringify({ success: false, error: 'Payload too large (max 10MB)' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Require authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // 3. Validate JWT using getClaims
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub as string;
    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - No user ID in token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Check user role (contributor or above)
    const { data: roleData } = await supabase.rpc('get_user_role', { _user_id: userId });
    const role = roleData as string | null;
    
    if (!role || role === 'viewer') {
      await logAudit(supabase, userId, 'access_denied', null, { reason: 'Insufficient role' });
      return new Response(
        JSON.stringify({ success: false, error: 'Forbidden - Insufficient permissions to import talent' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Rate limiting
    const rateCheck = checkRateLimit(userId);
    if (!rateCheck.allowed) {
      await logAudit(supabase, userId, 'rate_limited', null, { retryAfter: rateCheck.retryAfter });
      return new Response(
        JSON.stringify({ success: false, error: 'Rate limit exceeded. Try again later.' }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': String(rateCheck.retryAfter || 60)
          } 
        }
      );
    }

    // 6. Parse and validate payload
    let payload: unknown;
    try {
      const text = await req.text();
      if (text.length > MAX_PAYLOAD_SIZE) {
        return new Response(
          JSON.stringify({ success: false, error: 'Payload too large' }),
          { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      payload = JSON.parse(text);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validation = validatePayload(payload);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ success: false, error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { imageBase64, mimeType, textContent } = payload as { 
      imageBase64?: string; 
      mimeType?: string; 
      textContent?: string;
    };

    // 7. Check demo isolation and log the request
    const demoStatus = await checkDemoIsolation(supabase, userId);
    
    await logAudit(supabase, userId, 'extract_cv_request', null, {
      inputType: imageBase64 ? 'image' : 'text',
      mimeType: mimeType || 'text',
      sizekB: imageBase64 ? Math.round(imageBase64.length / 1024) : Math.round((textContent?.length || 0) / 1024),
      isDemoUser: demoStatus.isDemo,
    });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing CV for talent extraction...');

    const systemPrompt = `You are an expert CV/resume parser. Extract structured talent information from the provided CV or resume.

Extract the following information:
- name: Full name of the candidate (required)
- email: Email address
- phone: Phone number
- location: City, State/Country
- linkedIn: LinkedIn URL if present
- roleType: Primary professional role/title (e.g., "Data Engineer", "Product Manager", "UX Designer")
- seniority: Based on years of experience and titles - one of: "executive", "director", "manager", "senior", "mid", "junior"
- skills: Array of technical and professional skills (extract all mentioned skills, technologies, tools)
- aiOverview: A 2-3 sentence professional summary describing the candidate's key strengths, experience, and what makes them stand out. This should be compelling and written in third person.
- experience: Array of work history entries, each with:
  - company: Company name
  - title: Job title at that company
  - startDate: Start date (format: "YYYY-MM" if possible, or "YYYY")
  - endDate: End date (format: "YYYY-MM", or null if current)
  - current: Boolean - true if this is their current position
  - description: Brief description of role/achievements (1-2 sentences)
- education: Array of education entries, each with:
  - institution: School/university name
  - degree: Degree type (e.g., "Bachelor's", "Master's", "PhD", "MBA")
  - field: Field of study (e.g., "Computer Science", "Business Administration")
  - startDate: Start date (format: "YYYY" or "YYYY-MM")
  - endDate: End/graduation date (format: "YYYY" or "YYYY-MM")
  - grade: GPA or classification if mentioned
- confidence: Your confidence in the extraction accuracy (high/medium/low)

Return ONLY a valid JSON object with this exact structure:
{
  "talent": {
    "name": "Alex Chen",
    "email": "alex@email.com",
    "phone": "+1 555-123-4567",
    "location": "San Francisco, CA",
    "linkedIn": "https://linkedin.com/in/alexchen",
    "roleType": "Senior Data Engineer",
    "seniority": "senior",
    "skills": ["Python", "Spark", "AWS", "SQL", "Airflow"],
    "aiOverview": "Alex is an experienced data engineer with 6+ years building scalable data pipelines for financial services. He brings strong expertise in cloud infrastructure and real-time data processing, with a proven track record of leading platform modernization initiatives.",
    "experience": [
      {
        "company": "DataCorp Inc",
        "title": "Senior Data Engineer",
        "startDate": "2021-03",
        "endDate": null,
        "current": true,
        "description": "Leading data platform modernization initiative."
      }
    ],
    "education": [
      {
        "institution": "MIT",
        "degree": "Master's",
        "field": "Computer Science",
        "startDate": "2014",
        "endDate": "2016",
        "grade": "3.8 GPA"
      }
    ],
    "confidence": "high"
  },
  "notes": "Any observations about CV quality or missing information"
}

Extract ALL skills mentioned. For seniority, use these guidelines:
- junior: 0-2 years, entry-level titles
- mid: 2-5 years, no "senior" in title
- senior: 5-10 years, "Senior" titles
- manager: People management responsibility
- director: Department/division leadership
- executive: VP, C-suite, or equivalent

Be thorough and accurate. If information is unclear, still include it with lower confidence.`;

    let messages;
    if (imageBase64) {
      messages = [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: [
            {
              type: 'text',
              text: 'Extract all talent information from this CV/resume image. Return the results as JSON.'
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType || 'image/png'};base64,${imageBase64}`
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
          content: `Extract all talent information from this CV/resume text:\n\n${textContent}\n\nReturn the results as JSON.`
        }
      ];
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI credits exhausted. Please add funds to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: 'AI processing failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('No content in AI response');
      return new Response(
        JSON.stringify({ success: false, error: 'No extraction results from AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('AI response received, parsing...');

    let extractedData;
    try {
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();
      
      extractedData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', content);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to parse extraction results',
          rawContent: content 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const talentName = extractedData.talent?.name || 'Unknown';
    console.log(`Extracted talent: ${talentName}`);

    // Log successful completion
    await logAudit(supabase, userId, 'extract_cv_complete', null, {
      talentName,
      skillsCount: extractedData.talent?.skills?.length || 0,
      experienceCount: extractedData.talent?.experience?.length || 0,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: extractedData 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-extract-cv:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
