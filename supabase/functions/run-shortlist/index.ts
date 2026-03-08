import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify user
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { job_id } = await req.json();
    if (!job_id) {
      return new Response(JSON.stringify({ error: "job_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch job with company
    const { data: job, error: jobErr } = await supabaseAdmin
      .from("jobs")
      .select("*, companies(name)")
      .eq("id", job_id)
      .single();
    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const workspaceId = job.workspace_id;

    // Parse spec to extract matching criteria
    let specData: any = {};
    if (job.full_spec) {
      try {
        specData = typeof job.full_spec === "string" ? JSON.parse(job.full_spec) : job.full_spec;
      } catch { specData = {}; }
    }

    const requiredSkills = specData.essential_skills || [];
    const niceToHave = specData.desirable_skills || [];
    const jobLocation = specData.location || job.location || "";
    const jobType = specData.job_type || job.job_type || "";
    const startDate = specData.start_date || job.start_date || "";

    // Fetch all candidates in workspace
    const { data: candidates, error: candErr } = await supabaseAdmin
      .from("candidates")
      .select("id, name, email, current_title, headline, location, skills, experience, availability_status, raw_cv_text, ai_overview")
      .eq("tenant_id", workspaceId)
      .limit(200);

    if (candErr) {
      console.error("[run-shortlist] Candidate fetch error:", candErr.message);
      return new Response(JSON.stringify({ error: "Failed to fetch candidates" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!candidates || candidates.length === 0) {
      return new Response(JSON.stringify({ error: "No candidates in your talent database", shortlisted: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build job summary for AI
    const jobSummary = {
      title: job.title,
      company: (job as any).companies?.name || "Unknown",
      type: jobType,
      location: jobLocation,
      salary_min: job.salary_min,
      salary_max: job.salary_max,
      start_date: startDate,
      required_skills: requiredSkills,
      nice_to_have: niceToHave,
      role_summary: specData.role_summary || "",
      key_responsibilities: specData.key_responsibilities || [],
    };

    // Batch candidates in groups of 10
    const BATCH_SIZE = 10;
    const allScores: Array<{
      candidate_id: string;
      score: number;
      match_reasons: string[];
      concerns: string[];
    }> = [];

    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE);
      const candidateProfiles = batch.map(c => ({
        candidate_id: c.id,
        name: c.name,
        current_title: c.current_title,
        headline: c.headline,
        location: c.location,
        skills: c.skills,
        experience: c.experience,
        availability: c.availability_status,
        summary: c.ai_overview?.substring(0, 500) || c.raw_cv_text?.substring(0, 500) || "",
      }));

      try {
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: `You are a recruitment AI. Score each candidate 0-100 against this job specification.
A score of 60+ means a solid match. Be honest and realistic. 80+ should be reserved for excellent matches.
Consider: skills alignment, experience relevance, seniority match, location compatibility.`,
              },
              {
                role: "user",
                content: `JOB SPECIFICATION:\n${JSON.stringify(jobSummary, null, 2)}\n\nCANDIDATES:\n${JSON.stringify(candidateProfiles, null, 2)}`,
              },
            ],
            tools: [{
              type: "function",
              function: {
                name: "return_scores",
                description: "Return match scores for each candidate",
                parameters: {
                  type: "object",
                  properties: {
                    scores: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          candidate_id: { type: "string" },
                          score: { type: "number", description: "0-100 match score" },
                          match_reasons: { type: "array", items: { type: "string" }, description: "2-4 reasons why they match" },
                          concerns: { type: "array", items: { type: "string" }, description: "0-3 concerns or risks" },
                        },
                        required: ["candidate_id", "score", "match_reasons", "concerns"],
                      },
                    },
                  },
                  required: ["scores"],
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "return_scores" } },
          }),
        });

        if (!aiRes.ok) {
          const errText = await aiRes.text();
          console.error(`[run-shortlist] AI error batch ${i}:`, aiRes.status, errText);
          if (aiRes.status === 429) {
            return new Response(JSON.stringify({ error: "Rate limit reached. Please try again in a minute." }), {
              status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          if (aiRes.status === 402) {
            return new Response(JSON.stringify({ error: "AI credits exhausted. Please top up in Settings." }), {
              status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          continue;
        }

        const aiData = await aiRes.json();
        const toolCalls = aiData.choices?.[0]?.message?.tool_calls;
        if (toolCalls && toolCalls.length > 0) {
          try {
            const parsed = JSON.parse(toolCalls[0].function.arguments);
            if (parsed.scores && Array.isArray(parsed.scores)) {
              allScores.push(...parsed.scores);
            }
          } catch (e) {
            console.error("[run-shortlist] Parse error:", e);
          }
        }
      } catch (e) {
        console.error(`[run-shortlist] Batch ${i} error:`, e);
      }
    }

    // Delete existing shortlist entries for this job (refresh)
    await supabaseAdmin.from("job_shortlist").delete().eq("job_id", job_id);

    // Insert candidates scoring >= 50
    const shortlisted = allScores
      .filter(s => s.score >= 50)
      .sort((a, b) => b.score - a.score);

    const belowThreshold = allScores.filter(s => s.score < 50);
    console.log(`[run-shortlist] ${shortlisted.length} shortlisted, ${belowThreshold.length} below threshold`);

    // Build availability warnings
    const candidateMap = new Map(candidates.map(c => [c.id, c]));

    for (const entry of shortlisted) {
      const candidate = candidateMap.get(entry.candidate_id);
      let availabilityWarning: string | null = null;

      if (candidate?.availability_status && startDate) {
        const status = candidate.availability_status.toLowerCase();
        if (status !== "available" && status !== "active") {
          availabilityWarning = `Availability: ${candidate.availability_status}`;
        }
      }

      await supabaseAdmin.from("job_shortlist").insert({
        job_id,
        workspace_id: workspaceId,
        candidate_id: entry.candidate_id,
        match_score: entry.score,
        match_reasons: entry.match_reasons,
        concerns: entry.concerns,
        availability_warning: availabilityWarning,
        status: "pending",
      });
    }

    // Build response summary
    const topCandidate = shortlisted[0];
    const topName = topCandidate ? candidateMap.get(topCandidate.candidate_id)?.name : null;

    return new Response(JSON.stringify({
      shortlisted: shortlisted.length,
      total_scored: allScores.length,
      below_threshold: belowThreshold.length,
      top_candidate: topName ? { name: topName, score: topCandidate.score } : null,
      job_title: job.title,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[run-shortlist] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
