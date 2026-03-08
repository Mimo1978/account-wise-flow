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
    const { job_id, applicant_name, applicant_email, applicant_phone } = await req.json();

    if (!job_id || !applicant_name) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get job details
    const { data: job, error: jobError } = await supabaseAdmin
      .from("jobs")
      .select("title, created_by, workspace_id")
      .eq("id", job_id)
      .single();

    if (jobError || !job) {
      console.error("Job not found:", jobError);
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get recruiter email from auth.users
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(job.created_by);
    if (userError || !userData?.user?.email) {
      console.error("Could not find recruiter email:", userError);
      return new Response(JSON.stringify({ error: "Recruiter email not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const recruiterEmail = userData.user.email;

    // Get workspace Resend API key from integration_settings
    const { data: settings } = await supabaseAdmin
      .from("integration_settings")
      .select("resend_api_key")
      .eq("workspace_id", job.workspace_id)
      .single();

    const resendKey = settings?.resend_api_key;
    if (!resendKey) {
      console.log("No Resend API key configured for workspace, skipping email notification");
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "no_resend_key" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build the email
    const appUrl = Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", "").replace("https://", "") || "";
    const jobLink = `https://${appUrl}.lovable.app/jobs/${job_id}`;

    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a2e; margin-bottom: 16px;">New Application Received</h2>
        <p style="color: #555; line-height: 1.6;">
          <strong>${applicant_name}</strong> has applied for <strong>${job.title}</strong>.
        </p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px 0; color: #888; width: 100px;">Name</td><td style="padding: 8px 0; color: #333;">${applicant_name}</td></tr>
          <tr><td style="padding: 8px 0; color: #888;">Email</td><td style="padding: 8px 0; color: #333;">${applicant_email || '—'}</td></tr>
          <tr><td style="padding: 8px 0; color: #888;">Phone</td><td style="padding: 8px 0; color: #333;">${applicant_phone || '—'}</td></tr>
        </table>
        <a href="${jobLink}" style="display: inline-block; background: #2563eb; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; margin-top: 8px;">
          View Applications
        </a>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">Sent by Client Mapper</p>
      </div>
    `;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Client Mapper <notifications@resend.dev>",
        to: [recruiterEmail],
        subject: `New application: ${applicant_name} for ${job.title}`,
        html: emailHtml,
      }),
    });

    if (!resendResponse.ok) {
      const errText = await resendResponse.text();
      console.error("Resend API error:", errText);
      return new Response(JSON.stringify({ success: false, error: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Email notification sent to ${recruiterEmail} for application on ${job.title}`);
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-new-application error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
