import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      candidateName,
      candidateTitle,
      candidateSkills,
      candidateExperience,
      candidateHeadline,
      jobSpecTitle,
      jobSpecSkills,
      jobSpecDescription,
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build experience summary from the candidate's experience
    const experienceSummary = candidateExperience?.slice(0, 5)?.map((exp: any) => 
      `${exp.title} at ${exp.company} (${exp.startDate}${exp.current ? ' - Present' : exp.endDate ? ` - ${exp.endDate}` : ''})`
    ).join('; ') || 'No experience data available';

    // Build skills string
    const skillsList = candidateSkills?.slice(0, 15)?.join(', ') || 'No skills listed';

    // Build system prompt
    const systemPrompt = `You are an expert CV writer for a recruitment agency. Your task is to write a compelling executive summary paragraph for a candidate's CV.

CRITICAL RULES:
1. ONLY use information explicitly provided - DO NOT fabricate or embellish
2. Keep the summary to exactly 1 paragraph (3-5 sentences, max 100 words)
3. Focus on demonstrable skills and experience
4. Use professional, third-person language
5. If aligning to a job spec, emphasize relevant skills but never claim skills not evidenced
6. Be truthful and accurate - this will be sent to clients`;

    // Build user prompt
    let userPrompt = `Write an executive summary for:

Candidate: ${candidateName}
Current/Last Role: ${candidateTitle || 'Not specified'}
Skills: ${skillsList}
Experience: ${experienceSummary}
${candidateHeadline ? `Overview: ${candidateHeadline}` : ''}`;

    if (jobSpecTitle) {
      userPrompt += `

TARGET JOB SPEC:
Title: ${jobSpecTitle}
${jobSpecSkills?.length ? `Required Skills: ${jobSpecSkills.join(', ')}` : ''}
${jobSpecDescription ? `Description: ${jobSpecDescription.slice(0, 500)}` : ''}

Align the summary to highlight relevant experience for this role, but only mention skills the candidate actually has.`;
    }

    console.log("Generating executive summary for:", candidateName);

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
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content?.trim() || "";

    console.log("Generated summary:", summary.slice(0, 100) + "...");

    return new Response(
      JSON.stringify({ summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("cv-summary-generate error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        summary: "" // Return empty summary as fallback
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
