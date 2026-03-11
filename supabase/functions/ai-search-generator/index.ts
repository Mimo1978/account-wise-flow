import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { spec_text, job_title, seniority, sectors, must_have_skills, work_type, work_location } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are an expert technical recruiter and Boolean search string specialist. Generate a professional Boolean search string for searching a candidate database. Output JSON only, no markdown, no code fences, with this exact structure:
{
  "primary_titles": ["exact job title matches"],
  "secondary_titles": ["related/synonym job titles"],
  "must_skills": ["required technical skills"],
  "nice_skills": ["desirable but not required skills"],
  "sector_terms": ["industry/sector keywords"],
  "seniority_terms": ["seniority level keywords"],
  "exclude_terms": ["terms to exclude like junior/intern if senior role"],
  "boolean_string": "the complete boolean search string ready to use",
  "search_rationale": "2 sentence explanation of search strategy"
}`;

    const userPrompt = `Job title: ${job_title || 'Not specified'}
Job spec (PRIMARY SOURCE — extract all terms from this document):
${spec_text || 'No spec provided'}

Additional recruiter context:
Seniority: ${seniority || 'Not specified'}
Sectors: ${(sectors || []).join(', ') || 'Not specified'}
Must-have skills: ${(must_have_skills || []).join(', ') || 'Not specified'}
Work type: ${work_type || 'Not specified'}
Work location: ${work_location || 'Not specified'}

IMPORTANT: The spec text above is the primary RAG source. Extract job titles, skills, and sector terms directly from the spec content — do NOT rely on the job title field alone (it may be a placeholder like "Untitled Job"). If a detailed spec is provided, use it as the definitive source for all search parameters.

Generate the best Boolean search string to find matching candidates in a talent database. Include synonyms, abbreviations, and related role titles. The boolean_string should be ready to use for full-text search. The search_rationale should explain in 2 sentences why you chose these terms.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      console.error("AI gateway error:", status, text);
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway returned ${status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from the response, handling potential markdown fences
    let parsed;
    try {
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", content);
      // Return fallback structure
      parsed = {
        primary_titles: [job_title || ""],
        secondary_titles: [],
        must_skills: must_have_skills || [],
        nice_skills: [],
        sector_terms: sectors || [],
        seniority_terms: seniority ? [seniority] : [],
        exclude_terms: [],
        boolean_string: `"${job_title}" AND (${(must_have_skills || []).join(' OR ')})`,
        search_rationale: "AI parsing failed — using raw job parameters as fallback.",
      };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-search-generator error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
