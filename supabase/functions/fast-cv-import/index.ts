import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const apiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!apiKey) {
      return new Response(
        JSON.stringify({ ok: false, error: 'AI service not configured', requestId }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Unauthorized', requestId }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Invalid token', requestId }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub as string;

    const { base64, fileName, mimeType, tenantId } = await req.json();

    if (!base64 || !fileName || !tenantId) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Missing required fields: base64, fileName, tenantId', requestId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[fast-cv-import][${requestId}] Processing ${fileName} for tenant ${tenantId.slice(0, 8)}...`);

    // Parse CV with Gemini Vision
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType || 'application/pdf'};base64,${base64}`
              }
            },
            {
              type: 'text',
              text: `Extract this CV/resume data and return ONLY valid JSON with no markdown formatting:
{
  "name": "full name",
  "email": "email or null",
  "phone": "phone or null",
  "location": "city, country or null",
  "current_title": "current job title or null",
  "current_company": "current company or null",
  "linkedin_url": "linkedin url or null",
  "skills": ["skill1", "skill2"],
  "summary": "2 sentence professional summary"
}`
            }
          ]
        }]
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error(`[fast-cv-import][${requestId}] AI error:`, aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ ok: false, error: 'Rate limit exceeded, please try again shortly', requestId }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ ok: false, error: 'AI credits exhausted. Add credits in Settings → Workspace → Usage.', requestId }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ ok: false, error: 'AI parsing failed', requestId }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    let parsed: any;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      parsed = null;
    }

    if (!parsed?.name) {
      console.log(`[fast-cv-import][${requestId}] Could not extract name. Raw: ${content.slice(0, 200)}`);
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Could not extract name from CV',
          raw: content.slice(0, 200),
          requestId,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[fast-cv-import][${requestId}] Parsed: ${parsed.name}`);

    // Create candidate directly using service client
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: candidate, error: insertError } = await serviceClient
      .from('candidates')
      .insert({
        tenant_id: tenantId,
        name: parsed.name,
        email: parsed.email || null,
        phone: parsed.phone || null,
        location: parsed.location || null,
        current_title: parsed.current_title || null,
        current_company: parsed.current_company || null,
        linkedin_url: parsed.linkedin_url || null,
        skills: parsed.skills?.length ? { primary_skills: parsed.skills } : null,
        ai_overview: parsed.summary || null,
        source: 'cv_import',
        status: 'active',
        owner_id: userId,
      })
      .select('id, name')
      .single();

    if (insertError) {
      console.error(`[fast-cv-import][${requestId}] Insert error:`, insertError);
      return new Response(
        JSON.stringify({ ok: false, error: insertError.message, requestId }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store CV file in storage
    const ext = fileName.split('.').pop()?.toLowerCase() || 'pdf';
    const storagePath = `${tenantId}/${candidate.id}/cv.${ext}`;

    // Chunk-safe base64 decode
    const binaryStr = atob(base64);
    const fileBytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      fileBytes[i] = binaryStr.charCodeAt(i);
    }

    const { error: uploadError } = await serviceClient.storage
      .from('cv-uploads')
      .upload(storagePath, fileBytes, {
        contentType: mimeType || 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.warn(`[fast-cv-import][${requestId}] Storage upload warning:`, uploadError.message);
      // Non-fatal — candidate is already created
    }

    // Create talent_document record
    await serviceClient.from('talent_documents').insert({
      talent_id: candidate.id,
      workspace_id: tenantId,
      file_name: fileName,
      file_path: storagePath,
      file_type: mimeType || ext,
      file_size: fileBytes.length,
      doc_kind: 'cv',
      parse_status: content ? 'parsed' : 'pending',
      parsed_text: content,
      pdf_storage_path: ext === 'pdf' ? storagePath : null,
      pdf_conversion_status: ext === 'pdf' ? 'not_needed' : 'pending',
      uploaded_by: userId,
    }).then(({ error }) => {
      if (error) console.warn(`[fast-cv-import][${requestId}] talent_documents insert warning:`, error.message);
    });

    // Also update candidate cv_storage_path
    await serviceClient.from('candidates').update({
      cv_storage_path: storagePath,
      raw_cv_text: parsed.summary || null,
    }).eq('id', candidate.id);

    console.log(`[fast-cv-import][${requestId}] ✓ Created candidate ${candidate.id} — ${candidate.name}`);

    return new Response(
      JSON.stringify({
        ok: true,
        candidate_id: candidate.id,
        candidate_name: candidate.name,
        requestId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[fast-cv-import][${requestId}] Error:`, error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
