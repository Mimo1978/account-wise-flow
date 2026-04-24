import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getUserKeys(supabase: any, userId: string, service: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("integration_settings")
    .select("key_name, key_value")
    .eq("user_id", userId)
    .eq("service", service);
  if (error) throw error;
  const keys: Record<string, string> = {};
  for (const row of data || []) {
    if (row.key_value) keys[row.key_name] = row.key_value;
  }
  return keys;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Rate limiting: 100 per user per hour
    const rateCheck = await checkRateLimit(supabase, user.id, "send-email", 100);
    if (!rateCheck.allowed) {
      return new Response(JSON.stringify({ error: "Rate limit reached. Please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { to, subject, html_body, contact_id, company_id, opportunity_id, candidate_id, entity_type } = await req.json();

    // Get user's Resend keys
    const keys = await getUserKeys(supabase, user.id, "resend");
    if (!keys.RESEND_API_KEY || !keys.FROM_EMAIL_ADDRESS) {
      return new Response(JSON.stringify({
        error: "integration_not_configured",
        service: "resend",
        message: "Email is not set up. Go to Settings > Integrations to add your API keys.",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Send via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${keys.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: keys.FROM_EMAIL_ADDRESS,
        to: [to],
        subject,
        html: html_body,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      throw new Error(`Resend error: ${errBody}`);
    }

    // Strip HTML for plain text body
    const plainBody = html_body.replace(/<[^>]*>/g, "").substring(0, 2000);

    // Initiator name for traceable audit trail
    const { data: initiatorProfile } = await supabase
      .from("profiles").select("first_name, last_name").eq("id", user.id).maybeSingle();
    const initiatorName = `${initiatorProfile?.first_name || ""} ${initiatorProfile?.last_name || ""}`.trim() || user.email || user.id;

    // Resolve workspace
    const { data: roleRow } = await supabase
      .from("user_roles").select("team_id").eq("user_id", user.id).limit(1).maybeSingle();
    const workspaceId = roleRow?.team_id || null;

    // Log activity
    const { data: activity, error: actError } = await supabase.from("crm_activities").insert({
      type: "email",
      direction: "outbound",
      subject,
      body: plainBody,
      contact_id: contact_id || null,
      company_id: company_id || null,
      opportunity_id: opportunity_id || null,
      status: "completed",
      completed_at: new Date().toISOString(),
      created_by: user.id,
    }).select("id").single();

    if (actError) console.error("Activity log error:", actError);

    // ─────────────────────────────────────────────────
    // Persist a Note on the recipient's record so every
    // outbound email is visible in the contact / talent
    // file for audit + reporting.
    // ─────────────────────────────────────────────────
    try {
      const noteContent = [
        `✉️ Email sent — ${subject}`,
        `Sent by: ${initiatorName}`,
        `To: ${to}`,
        `Time: ${new Date().toISOString()}`,
        "",
        "--- Body ---",
        plainBody,
      ].join("\n");

      if (entity_type === "candidate" && candidate_id && workspaceId) {
        await supabase.from("candidate_notes").insert({
          candidate_id,
          title: `✉️ Email · ${subject}`.slice(0, 200),
          body: noteContent.slice(0, 8000),
          visibility: "team",
          owner_id: user.id,
          team_id: workspaceId,
          tags: ["email", "outbound"],
        });
      } else if (contact_id && workspaceId) {
        await supabase.from("notes").insert({
          entity_type: "contact",
          entity_id: contact_id,
          content: noteContent.slice(0, 8000),
          visibility: "team",
          source: "email",
          owner_id: user.id,
          team_id: workspaceId,
        });
      }
    } catch (noteErr) {
      console.error("send-email: note insert failed:", noteErr);
    }

    return new Response(JSON.stringify({ success: true, activity_id: activity?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-email error:", err);
    return new Response(JSON.stringify({ error: "server_error", message: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
