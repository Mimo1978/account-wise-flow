import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { application_id } = await req.json();
    if (!application_id) {
      return new Response(JSON.stringify({ error: "application_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch application
    const { data: app, error: appErr } = await supabaseAdmin
      .from("job_applications")
      .select("*")
      .eq("id", application_id)
      .single();

    if (appErr || !app) {
      return new Response(JSON.stringify({ error: "Application not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch job spec
    const { data: job } = await supabaseAdmin
      .from("jobs")
      .select("title, raw_brief, full_spec, location, job_type, salary_min, salary_max, salary_currency, created_by, workspace_id, companies(name)")
      .eq("id", app.job_id)
      .single();

    if (!job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Send acknowledgement email to candidate
    const { data: settings } = await supabaseAdmin
      .from("integration_settings")
      .select("resend_api_key")
      .eq("workspace_id", job.workspace_id)
      .single();

    const { data: wsSettings } = await supabaseAdmin
      .from("workspace_settings")
      .select("company_name")
      .eq("workspace_id", job.workspace_id)
      .single();

    const agencyName = wsSettings?.company_name || "Our team";
    const resendKey = settings?.resend_api_key;

    if (resendKey && app.applicant_email) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${agencyName} <notifications@resend.dev>`,
          to: [app.applicant_email],
          subject: `Application received — ${job.title}`,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
            <h2 style="color:#1a1a2e;">Thank you for applying</h2>
            <p style="color:#555;line-height:1.6;">
              Hi ${app.applicant_name || "there"},<br><br>
              Thank you for applying for <strong>${job.title}</strong>. We'll review your application and be in touch shortly.
            </p>
            <p style="color:#555;line-height:1.6;">Best regards,<br>The ${agencyName} team</p>
          </div>`,
        }),
      }).catch((e) => console.error("Ack email failed:", e));
    }

    // Step 2: Extract CV text if available
    let cvText = "";
    if (app.cv_url) {
      try {
        // Try to fetch the CV content and send to AI for extraction
        const cvResponse = await fetch(app.cv_url);
        if (cvResponse.ok) {
          const contentType = cvResponse.headers.get("content-type") || "";
          if (contentType.includes("pdf")) {
            // Convert to base64 for AI vision extraction
            const buffer = await cvResponse.arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
            
            const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
            if (LOVABLE_API_KEY) {
              const extractRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${LOVABLE_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "google/gemini-2.5-flash",
                  messages: [
                    { role: "system", content: "Extract all text content from this PDF document. Return only the raw text, preserving structure." },
                    {
                      role: "user",
                      content: [
                        { type: "text", text: "Extract all text from this CV/resume PDF:" },
                        { type: "image_url", image_url: { url: `data:application/pdf;base64,${base64}` } },
                      ],
                    },
                  ],
                }),
              });
              if (extractRes.ok) {
                const extractData = await extractRes.json();
                cvText = extractData.choices?.[0]?.message?.content || "";
              }
            }
          } else {
            // Plain text or other formats
            cvText = await cvResponse.text();
          }
        }
      } catch (e) {
        console.error("CV extraction failed:", e);
      }
    }

    // Step 3: AI scoring
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      // No AI key, just mark processed
      await supabaseAdmin
        .from("job_applications")
        .update({ processed_at: new Date().toISOString() })
        .eq("id", application_id);
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "no_ai_key" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jobSpec = JSON.stringify({
      title: job.title,
      company: (job as any).companies?.name,
      type: job.job_type,
      location: job.location,
      brief: job.raw_brief,
      full_spec: job.full_spec,
      salary_min: job.salary_min,
      salary_max: job.salary_max,
    });

    const scoringRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a recruitment AI scoring a job application. Analyse the candidate's CV and cover letter against the job specification. Return JSON only with this exact structure:
{ "score": <0-100 integer>, "summary": "<2-3 sentence assessment>", "strengths": ["<strength1>", "<strength2>"], "gaps": ["<gap1>", "<gap2>"], "recommended_action": "shortlist|review|reject" }
Score meaning: 80+ excellent match, 60-79 good potential, 40-59 partial match, <40 poor match.`,
          },
          {
            role: "user",
            content: `JOB SPECIFICATION:\n${jobSpec}\n\nCANDIDATE CV TEXT:\n${cvText || "(No CV provided)"}\n\nCOVER LETTER:\n${app.cover_letter || "(No cover letter)"}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "score_application",
              description: "Return the structured scoring result",
              parameters: {
                type: "object",
                properties: {
                  score: { type: "number", minimum: 0, maximum: 100 },
                  summary: { type: "string" },
                  strengths: { type: "array", items: { type: "string" } },
                  gaps: { type: "array", items: { type: "string" } },
                  recommended_action: { type: "string", enum: ["shortlist", "review", "reject"] },
                },
                required: ["score", "summary", "strengths", "gaps", "recommended_action"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "score_application" } },
      }),
    });

    if (!scoringRes.ok) {
      const errText = await scoringRes.text();
      console.error("AI scoring failed:", scoringRes.status, errText);
      await supabaseAdmin
        .from("job_applications")
        .update({ processed_at: new Date().toISOString() })
        .eq("id", application_id);
      return new Response(JSON.stringify({ success: true, scoring_failed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const scoringData = await scoringRes.json();
    let result: { score: number; summary: string; strengths: string[]; gaps: string[]; recommended_action: string };

    try {
      const toolCall = scoringData.choices?.[0]?.message?.tool_calls?.[0];
      result = JSON.parse(toolCall?.function?.arguments || "{}");
    } catch {
      console.error("Failed to parse AI scoring result");
      await supabaseAdmin
        .from("job_applications")
        .update({ processed_at: new Date().toISOString() })
        .eq("id", application_id);
      return new Response(JSON.stringify({ success: true, scoring_failed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 3: Update application row
    const newStatus = result.score >= 70 ? "reviewing" : "new";
    await supabaseAdmin
      .from("job_applications")
      .update({
        ai_match_score: result.score,
        ai_summary: result.summary,
        ai_strengths: result.strengths,
        ai_gaps: result.gaps,
        ai_recommended_action: result.recommended_action,
        status: newStatus,
        processed_at: new Date().toISOString(),
      })
      .eq("id", application_id);

    // Step 4: Auto-shortlist high scorers
    let candidateId = app.candidate_id;
    if (result.score >= 80 && result.recommended_action === "shortlist") {
      // Check if candidate exists by email
      if (app.applicant_email) {
        const { data: existing } = await supabaseAdmin
          .from("candidates")
          .select("id")
          .eq("email", app.applicant_email)
          .eq("tenant_id", app.workspace_id)
          .limit(1)
          .single();

        if (existing) {
          candidateId = existing.id;
        } else {
          // Create new candidate
          const { data: newCandidate } = await supabaseAdmin
            .from("candidates")
            .insert({
              name: app.applicant_name || "Unknown",
              email: app.applicant_email,
              phone: app.applicant_phone,
              linkedin_url: app.linkedin_url,
              tenant_id: app.workspace_id,
              source: "application",
              raw_cv_text: cvText || null,
            })
            .select("id")
            .single();
          candidateId = newCandidate?.id || null;
        }

        if (candidateId) {
          // Update application with candidate link
          await supabaseAdmin
            .from("job_applications")
            .update({ candidate_id: candidateId, status: "shortlisted" })
            .eq("id", application_id);

          // Insert into job_shortlist
          await supabaseAdmin.from("job_shortlist").insert({
            job_id: app.job_id,
            workspace_id: app.workspace_id,
            candidate_id: candidateId,
            match_score: result.score,
            match_reasons: result.strengths,
            concerns: result.gaps,
            status: "pending",
            priority: 1,
          });
        }
      }
    }

    // Step 5: Notify recruiter
    if (resendKey && job.created_by) {
      const { data: recruiterData } = await supabaseAdmin.auth.admin.getUserById(job.created_by);
      const recruiterEmail = recruiterData?.user?.email;

      if (recruiterEmail) {
        const actionLabel =
          result.recommended_action === "shortlist" ? "🟢 Shortlist"
          : result.recommended_action === "review" ? "🟡 Review"
          : "🔴 Reject";

        const scoreBg =
          result.score >= 80 ? "#22c55e"
          : result.score >= 60 ? "#f59e0b"
          : "#9ca3af";

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${agencyName} <notifications@resend.dev>`,
            to: [recruiterEmail],
            subject: `New application: ${app.applicant_name} — AI Score: ${result.score}/100`,
            html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
              <h2 style="color:#1a1a2e;">New Application for ${job.title}</h2>
              <p><strong>${app.applicant_name}</strong> applied via ${app.source || "direct"}.</p>
              <div style="display:inline-block;background:${scoreBg};color:white;padding:4px 12px;border-radius:12px;font-weight:bold;font-size:18px;margin:8px 0;">
                ${result.score}/100
              </div>
              <p style="color:#555;">${result.summary}</p>
              <p><strong>Recommended action:</strong> ${actionLabel}</p>
              ${result.strengths.length ? `<p><strong>Strengths:</strong> ${result.strengths.join(", ")}</p>` : ""}
              ${result.gaps.length ? `<p><strong>Gaps:</strong> ${result.gaps.join(", ")}</p>` : ""}
              <p style="color:#999;font-size:12px;margin-top:24px;">Sent by ${agencyName}</p>
            </div>`,
          }),
        }).catch((e) => console.error("Recruiter notification failed:", e));
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        score: result.score,
        recommended_action: result.recommended_action,
        candidate_id: candidateId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("process-application error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
