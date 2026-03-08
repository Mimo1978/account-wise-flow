import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const { job_id, automation_level, from_name, from_email, campaign_name } = await req.json();
    if (!job_id) {
      return new Response(JSON.stringify({ error: "job_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get job details
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

    // Get approved shortlist entries with candidate details
    const { data: shortlist } = await supabaseAdmin
      .from("job_shortlist")
      .select("id, candidate_id, match_score, match_reasons, candidates(name, email, current_title, headline, skills, location, availability_status)")
      .eq("job_id", job_id)
      .eq("status", "approved")
      .order("priority", { ascending: true });

    if (!shortlist || shortlist.length === 0) {
      return new Response(JSON.stringify({ error: "No approved candidates on the shortlist" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isConfidential = job.is_confidential ?? false;
    const companyName = (job as any).companies?.name || "our client";
    const companyIndustry = (job as any).companies?.industry || "";

    // Parse spec for details
    let specDetails: any = {};
    if (job.full_spec) {
      try {
        specDetails = typeof job.full_spec === "string" ? JSON.parse(job.full_spec) : job.full_spec;
      } catch {}
    }

    const jobContext = {
      title: job.title,
      company: isConfidential ? `a leading ${companyIndustry || "industry"} business` : companyName,
      confidential: isConfidential,
      job_type: job.job_type || specDetails.job_type || "",
      location: job.location || specDetails.location || "",
      salary_min: job.salary_min,
      salary_max: job.salary_max,
      salary_currency: job.salary_currency || "GBP",
      start_date: job.start_date || specDetails.start_date || "",
      role_summary: specDetails.role_summary || "",
      key_responsibilities: (specDetails.key_responsibilities || []).slice(0, 4),
    };

    const drafts: any[] = [];

    // Process in batches of 5
    const batchSize = 5;
    for (let i = 0; i < shortlist.length; i += batchSize) {
      const batch = shortlist.slice(i, i + batchSize);

      const promises = batch.map(async (entry: any) => {
        const candidate = entry.candidates;
        if (!candidate?.name || !candidate?.email) {
          console.log(`Skipping candidate ${entry.candidate_id} — missing name or email`);
          return null;
        }

        const candidateContext = {
          name: candidate.name,
          title: candidate.current_title || "",
          skills_summary: candidate.headline || "",
          location: candidate.location || "",
        };

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
                content: `You are a professional recruiter writing to a candidate about a new role.
Write a concise, warm, professional email. NEVER reveal the end client company name if confidential=true — use 'one of our clients' or 'a leading ${companyIndustry || "industry"} business'.
Include: job title, job type, location, salary/rate range, start date, short role description.
Do NOT include: company name (if confidential), internal job ID, or match score.
End with: a question asking if they are available and interested, and a request to confirm their current availability dates.
Keep under 200 words. Warm but professional tone.
Return JSON with exactly: { "subject": "...", "body": "..." }
The body should be plain text with \\n for line breaks. Do NOT use HTML.
Return ONLY valid JSON, no markdown fences.`,
              },
              {
                role: "user",
                content: JSON.stringify({
                  candidate: candidateContext,
                  job: jobContext,
                  from_name: from_name || "Your Recruiter",
                }),
              },
            ],
            tools: [{
              type: "function",
              function: {
                name: "return_email",
                description: "Return the generated email",
                parameters: {
                  type: "object",
                  properties: {
                    subject: { type: "string" },
                    body: { type: "string" },
                  },
                  required: ["subject", "body"],
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "return_email" } },
          }),
        });

        if (!aiRes.ok) {
          console.error(`AI error for ${candidate.name}:`, aiRes.status);
          return null;
        }

        const aiData = await aiRes.json();
        let email = { subject: "", body: "" };
        const toolCalls = aiData.choices?.[0]?.message?.tool_calls;
        if (toolCalls && toolCalls.length > 0) {
          try {
            email = JSON.parse(toolCalls[0].function.arguments);
          } catch {
            const content = aiData.choices?.[0]?.message?.content || "";
            try { email = JSON.parse(content); } catch {}
          }
        }

        if (!email.subject || !email.body) {
          console.error(`Empty email for ${candidate.name}`);
          return null;
        }

        // Convert plain text body to simple HTML
        const bodyHtml = email.body.replace(/\n/g, "<br>");

        return {
          job_id,
          workspace_id: job.workspace_id,
          shortlist_id: entry.id,
          candidate_id: entry.candidate_id,
          candidate_name: candidate.name,
          candidate_email: candidate.email,
          subject: email.subject,
          body: email.body,
          body_html: bodyHtml,
          from_name: from_name || null,
          from_email: from_email || null,
          automation_level: automation_level || "draft",
          campaign_name: campaign_name || `${job.title} Outreach`,
          channel: "email",
          status: "draft",
          created_by: userId,
        };
      });

      const results = await Promise.all(promises);
      drafts.push(...results.filter(Boolean));
    }

    // Insert all drafts
    if (drafts.length > 0) {
      const { error: insertErr } = await supabaseAdmin
        .from("outreach_messages")
        .insert(drafts);
      if (insertErr) {
        console.error("Insert error:", insertErr);
        return new Response(JSON.stringify({ error: insertErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(
      JSON.stringify({
        drafted: drafts.length,
        total_approved: shortlist.length,
        skipped: shortlist.length - drafts.length,
        job_title: job.title,
        campaign_name: campaign_name || `${job.title} Outreach`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("draft-outreach error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
