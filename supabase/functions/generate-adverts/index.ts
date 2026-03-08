import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BOARD_RULES: Record<string, string> = {
  internal: "Full spec with no word limit. Include all details. Use professional formatting.",
  linkedin: "Maximum 2000 characters. Narrative style, no tables or bullet lists. Conversational but professional. Add 3-5 relevant hashtags at the end.",
  jobserve: "Maximum 500 words. Structured sections with clear headings. Formal, technical tone. Include key technical requirements prominently.",
  reed: "Between 250-400 words. Lead with benefits and what's in it for the candidate. Salary MUST be explicitly stated. Warm, engaging tone.",
  own_site: "Follow the template and notes provided. Professional tone.",
  indeed: "Maximum 700 words. Keyword-rich for search visibility. Use clear H2 section headings. Include salary range and location prominently.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { job_id, boards } = await req.json();
    if (!job_id || !boards || !Array.isArray(boards) || boards.length === 0) {
      return new Response(JSON.stringify({ error: "job_id and boards[] required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch job
    const { data: job, error: jobErr } = await supabaseAdmin
      .from("jobs")
      .select("*, companies(name, industry)")
      .eq("id", job_id)
      .single();
    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get workspace board formats
    const { data: formats } = await supabaseAdmin
      .from("job_board_formats")
      .select("*")
      .eq("workspace_id", job.workspace_id);
    const formatMap = Object.fromEntries((formats ?? []).map((f: any) => [f.board, f]));

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isConfidential = job.is_confidential || false;
    const companyName = job.companies?.name || "the client";
    const companyIndustry = job.companies?.industry || "their industry";
    const spec = job.full_spec || job.raw_brief || job.title;

    const results: any[] = [];

    for (const board of boards) {
      try {
        // Build board-specific rules
        let rules = BOARD_RULES[board] || "Professional job advert format.";
        const savedFormat = formatMap[board];
        if (savedFormat) {
          if (savedFormat.max_words) rules += ` Hard limit: ${savedFormat.max_words} words.`;
          if (savedFormat.max_characters) rules += ` Hard limit: ${savedFormat.max_characters} characters.`;
          if (savedFormat.required_sections?.length) rules += ` Must include sections: ${savedFormat.required_sections.join(", ")}.`;
          if (savedFormat.template) rules += ` Follow this template style: ${savedFormat.template}`;
          if (savedFormat.notes) rules += ` Additional notes: ${savedFormat.notes}`;
        }

        const confidentialityRule = isConfidential
          ? `IMPORTANT: Do NOT mention the end client company name "${companyName}" anywhere. Use "our client" or "a leading ${companyIndustry} business" instead.`
          : `The company name is "${companyName}" — include it naturally.`;

        const prompt = `Rewrite this job specification as an advert for ${board}.\n\nRules: ${rules}\n\n${confidentialityRule}\n\nReturn plain text only, no markdown formatting or code fences.\n\nJob Specification:\n${spec}`;

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: "You are an expert recruitment copywriter. Generate job adverts tailored to specific job boards. Write in plain text only. Never use markdown formatting.",
              },
              { role: "user", content: prompt },
            ],
          }),
        });

        if (!aiRes.ok) {
          console.error(`[generate-adverts] AI error for ${board}:`, aiRes.status);
          results.push({ board, error: `AI generation failed (${aiRes.status})` });
          continue;
        }

        const aiData = await aiRes.json();
        const content = aiData.choices?.[0]?.message?.content || "";
        const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
        const charCount = content.length;

        // Insert advert
        const { data: advert, error: insertErr } = await supabaseAdmin
          .from("job_adverts")
          .insert({
            job_id,
            workspace_id: job.workspace_id,
            board,
            content,
            word_count: wordCount,
            character_count: charCount,
            status: "draft",
          })
          .select("id, board, word_count, character_count, status")
          .single();

        if (insertErr) {
          console.error(`[generate-adverts] Insert error for ${board}:`, insertErr.message);
          results.push({ board, error: insertErr.message });
        } else {
          results.push({ board, advert });
        }
      } catch (e) {
        console.error(`[generate-adverts] Error for ${board}:`, e);
        results.push({ board, error: e instanceof Error ? e.message : "Unknown error" });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[generate-adverts] error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
