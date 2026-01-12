import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's auth token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has insert permission (contributor or above)
    const { data: roleData } = await supabase.rpc('get_user_role', { _user_id: user.id });
    const role = roleData as string | null;
    
    if (!role || role === 'viewer') {
      return new Response(
        JSON.stringify({ success: false, error: 'Forbidden - Insufficient permissions to import talent' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { imageBase64, mimeType, textContent } = await req.json();

    if (!imageBase64 && !textContent) {
      return new Response(
        JSON.stringify({ success: false, error: 'No CV data provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Parse the JSON response (handle markdown code blocks)
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

    console.log(`Extracted talent: ${extractedData.talent?.name || 'Unknown'}`);

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
