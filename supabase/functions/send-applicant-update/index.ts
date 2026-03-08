import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Default professional email templates
const DEFAULT_TEMPLATES: Record<string, { subject: string; html: string }> = {
  reject: {
    subject: "Update on your application — {{job_title}}",
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#1a1a2e;">Application Update</h2>
      <p style="color:#555;line-height:1.6;">
        Dear {{applicant_name}},<br><br>
        Thank you for taking the time to apply for the <strong>{{job_title}}</strong> position.
        After careful consideration, we have decided not to proceed with your application at this stage.
      </p>
      <p style="color:#555;line-height:1.6;">
        This was a competitive process and this decision does not reflect on your abilities.
        We encourage you to apply for future positions that match your skills and experience.
      </p>
      <p style="color:#555;line-height:1.6;">We wish you every success in your career.</p>
      <p style="color:#555;line-height:1.6;">Best regards,<br>{{recruiter_name}}</p>
    </div>`,
  },
  shortlist: {
    subject: "Great news — your application for {{job_title}} is progressing",
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#1a1a2e;">Your Application is Progressing</h2>
      <p style="color:#555;line-height:1.6;">
        Dear {{applicant_name}},<br><br>
        We're pleased to let you know that your application for <strong>{{job_title}}</strong>
        has been shortlisted for further review. We were impressed by your background and experience.
      </p>
      <p style="color:#555;line-height:1.6;">
        We'll be in touch shortly with next steps. In the meantime, if you have any questions,
        please don't hesitate to reach out.
      </p>
      <p style="color:#555;line-height:1.6;">Best regards,<br>{{recruiter_name}}</p>
    </div>`,
  },
  interview: {
    subject: "Interview invitation — {{job_title}}",
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#1a1a2e;">Interview Invitation</h2>
      <p style="color:#555;line-height:1.6;">
        Dear {{applicant_name}},<br><br>
        We'd like to invite you to an interview for the <strong>{{job_title}}</strong> position.
        We were very impressed with your application and would love to discuss the role further.
      </p>
      <p style="color:#555;line-height:1.6;">
        We'll follow up shortly with available times and logistics. Please let us know if you have
        any scheduling constraints.
      </p>
      <p style="color:#555;line-height:1.6;">We look forward to speaking with you.</p>
      <p style="color:#555;line-height:1.6;">Best regards,<br>{{recruiter_name}}</p>
    </div>`,
  },
  offered: {
    subject: "Exciting news — offer for {{job_title}}",
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#1a1a2e;">Congratulations!</h2>
      <p style="color:#555;line-height:1.6;">
        Dear {{applicant_name}},<br><br>
        We are delighted to inform you that we would like to offer you the <strong>{{job_title}}</strong> position.
        We believe you'll be a fantastic addition to the team.
      </p>
      <p style="color:#555;line-height:1.6;">
        We'll be sending you the formal offer details shortly. In the meantime, please don't hesitate
        to reach out with any questions.
      </p>
      <p style="color:#555;line-height:1.6;">Congratulations once again!</p>
      <p style="color:#555;line-height:1.6;">Best regards,<br>{{recruiter_name}}</p>
    </div>`,
  },
  post_interview_reject: {
    subject: "Update following your interview — {{job_title}}",
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#1a1a2e;">Interview Outcome</h2>
      <p style="color:#555;line-height:1.6;">
        Dear {{applicant_name}},<br><br>
        Thank you for taking the time to interview for the <strong>{{job_title}}</strong> position.
        We enjoyed learning more about your experience and skills.
      </p>
      <p style="color:#555;line-height:1.6;">
        After careful deliberation, we have decided to move forward with another candidate whose
        background more closely aligns with our current requirements.
      </p>
      <p style="color:#555;line-height:1.6;">
        We genuinely appreciated your time and interest. We'll keep your details on file for future
        opportunities that may be a great fit.
      </p>
      <p style="color:#555;line-height:1.6;">Best regards,<br>{{recruiter_name}}</p>
    </div>`,
  },
};

// Status change → template mapping
const STATUS_TEMPLATE_MAP: Record<string, string | null> = {
  "reviewing": null, // No email
  "rejected": "reject",
  "shortlisted": "shortlist",
  "interviewing": "interview",
  "offered": "offered",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { application_id, new_status, old_status, custom_content } = await req.json();

    if (!application_id || !new_status) {
      return new Response(JSON.stringify({ error: "application_id and new_status required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine template key
    let templateKey = STATUS_TEMPLATE_MAP[new_status];
    // Special case: interview → reject = post_interview_reject
    if (new_status === "rejected" && old_status === "interviewing") {
      templateKey = "post_interview_reject";
    }

    // No email needed for this transition
    if (templateKey === null || templateKey === undefined) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "no_email_for_status" }), {
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
      .select("*, jobs!inner(title, created_by, workspace_id)")
      .eq("id", application_id)
      .single();

    if (appErr || !app) {
      return new Response(JSON.stringify({ error: "Application not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const job = (app as any).jobs;
    if (!app.applicant_email) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "no_email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get workspace Resend key
    const { data: settings } = await supabaseAdmin
      .from("integration_settings")
      .select("resend_api_key")
      .eq("workspace_id", job.workspace_id)
      .single();

    const resendKey = settings?.resend_api_key;
    if (!resendKey) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "no_resend_key" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get recruiter name
    const { data: recruiterData } = await supabaseAdmin.auth.admin.getUserById(job.created_by);
    const recruiterName = recruiterData?.user?.user_metadata?.first_name
      ? `${recruiterData.user.user_metadata.first_name} ${recruiterData.user.user_metadata.last_name || ""}`.trim()
      : "The Recruitment Team";

    // Get workspace name for from address
    const { data: wsSettings } = await supabaseAdmin
      .from("workspace_settings")
      .select("company_name")
      .eq("workspace_id", job.workspace_id)
      .single();

    const agencyName = wsSettings?.company_name || "Recruitment";

    // Check for custom workspace template override
    const { data: customTemplate } = await supabaseAdmin
      .from("email_templates")
      .select("subject, body_html")
      .eq("workspace_id", job.workspace_id)
      .eq("template_key", `applicant_${templateKey}`)
      .single();

    // Use custom or default
    const template = customTemplate
      ? { subject: customTemplate.subject, html: customTemplate.body_html }
      : DEFAULT_TEMPLATES[templateKey];

    if (!template) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "no_template" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Replace placeholders
    const replacePlaceholders = (text: string) =>
      text
        .replace(/\{\{applicant_name\}\}/g, app.applicant_name || "there")
        .replace(/\{\{job_title\}\}/g, job.title || "the position")
        .replace(/\{\{recruiter_name\}\}/g, recruiterName);

    let subject = replacePlaceholders(template.subject);
    let html = replacePlaceholders(custom_content || template.html);

    // Send via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${agencyName} <notifications@resend.dev>`,
        to: [app.applicant_email],
        subject,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error("Resend error:", errText);
      return new Response(JSON.stringify({ success: false, error: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Sent ${templateKey} email to ${app.applicant_email} for ${job.title}`);
    return new Response(
      JSON.stringify({ success: true, template_used: templateKey, sent_to: app.applicant_email }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-applicant-update error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
