import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 10; // Lower limit for image processing
const RATE_LIMIT_WINDOW = 60 * 1000;

// Max payload size: 10MB for images
const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];

interface ExtractedContact {
  name: string;
  title?: string;
  department?: string;
  email?: string;
  phone?: string;
  reportsTo?: string;
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
  
  if (typeof p.imageBase64 !== 'string' || p.imageBase64.length === 0) {
    return { valid: false, error: 'Missing imageBase64' };
  }

  // Check base64 size (roughly 1.37x the binary size)
  const estimatedSize = (p.imageBase64.length * 3) / 4;
  if (estimatedSize > MAX_PAYLOAD_SIZE) {
    return { valid: false, error: 'Image too large (max 10MB)' };
  }

  // Validate mime type if provided
  if (p.mimeType && typeof p.mimeType === 'string') {
    if (!ALLOWED_MIME_TYPES.includes(p.mimeType.toLowerCase())) {
      return { valid: false, error: `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}` };
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
        function: 'ai-extract-contacts',
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
        JSON.stringify({ success: false, error: 'Forbidden - Insufficient permissions to import contacts' }),
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

    const { imageBase64, mimeType } = payload as { imageBase64: string; mimeType?: string };

    // 7. Check demo isolation and log the request
    const demoStatus = await checkDemoIsolation(supabase, userId);
    
    await logAudit(supabase, userId, 'extract_contacts_request', null, {
      mimeType: mimeType || 'image/png',
      imageSizeKB: Math.round(imageBase64.length / 1024),
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

    console.log('Processing image for contact extraction...');

    const systemPrompt = `You are an expert at extracting contact information from images of org charts, business cards, screenshots, and documents.

Extract all people/contacts you can identify. For each person, extract:
- name: Full name (required)
- title: Job title/position
- department: Department or team name
- email: Email address if visible
- phone: Phone number if visible
- reportsTo: Name of their manager if the reporting structure is visible
- confidence: Your confidence level (high/medium/low) based on how clearly the information was visible

Return ONLY a valid JSON object with this exact structure:
{
  "contacts": [
    {
      "name": "John Smith",
      "title": "VP of Engineering",
      "department": "Engineering",
      "email": "john.smith@company.com",
      "phone": "+1 555-123-4567",
      "reportsTo": "Jane Doe",
      "confidence": "high"
    }
  ],
  "sourceType": "org_chart" | "business_card" | "screenshot" | "document" | "unknown",
  "notes": "Any additional observations about the content"
}

Be thorough - extract ALL people visible. If information is unclear, still include the contact with lower confidence. Never make up information that isn't visible.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: [
              {
                type: 'text',
                text: 'Extract all contact information from this image. Return the results as JSON.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType || 'image/png'};base64,${imageBase64}`
                }
              }
            ]
          }
        ],
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

    const contactsExtracted = extractedData.contacts?.length || 0;
    console.log(`Extracted ${contactsExtracted} contacts`);

    // Log successful completion
    await logAudit(supabase, userId, 'extract_contacts_complete', null, {
      contactsExtracted,
      sourceType: extractedData.sourceType,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: extractedData 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-extract-contacts:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
