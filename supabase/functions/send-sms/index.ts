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

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Rate limiting: 50 per user per hour
    const rateCheck = await checkRateLimit(supabase, user.id, "send-sms", 50);
    if (!rateCheck.allowed) {
      return new Response(JSON.stringify({ error: "Rate limit reached. Please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { to_number, message, contact_id, company_id, candidate_id, entity_type } = await req.json();

    const keys = await getUserKeys(supabase, user.id, "twilio");
    if (!keys.TWILIO_ACCOUNT_SID || !keys.TWILIO_AUTH_TOKEN || !keys.TWILIO_PHONE_NUMBER) {
      return new Response(JSON.stringify({
        error: "integration_not_configured",
        service: "twilio",
        message: "SMS is not set up. Go to Settings > Integrations to add your Twilio keys.",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Send via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${keys.TWILIO_ACCOUNT_SID}/Messages.json`;
    const body = new URLSearchParams({
      From: keys.TWILIO_PHONE_NUMBER,
      To: to_number,
      Body: message,
    });

    const twilioRes = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa(`${keys.TWILIO_ACCOUNT_SID}:${keys.TWILIO_AUTH_TOKEN}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!twilioRes.ok) {
      const errBody = await twilioRes.text();
      throw new Error(`Twilio error: ${errBody}`);
    }

    const twilioData = await twilioRes.json();

    // Initiator + workspace for traceable audit trail
    const { data: initiatorProfile } = await supabase
      .from("profiles").select("first_name, last_name").eq("id", user.id).maybeSingle();
    const initiatorName = `${initiatorProfile?.first_name || ""} ${initiatorProfile?.last_name || ""}`.trim() || user.email || user.id;
    const { data: roleRow } = await supabase
      .from("user_roles").select("team_id").eq("user_id", user.id).limit(1).maybeSingle();
    const workspaceId = roleRow?.team_id || null;

    // Log activity (CRM timeline)
    await supabase.from("crm_activities").insert({
      type: "sms",
      direction: "outbound",
      body: message,
      contact_id: contact_id || null,
      candidate_id: candidate_id || null,
      company_id: company_id || null,
      status: "completed",
      completed_at: new Date().toISOString(),
      created_by: user.id,
    });

    // ─────────────────────────────────────────────────
    // Persist a Note on the recipient's record so every
    // outbound SMS is traceable in the contact / talent
    // file.
    // ─────────────────────────────────────────────────
    try {
      const noteContent = [
        `💬 SMS sent`,
        `Sent by: ${initiatorName}`,
        `To: ${to_number}`,
        `Time: ${new Date().toISOString()}`,
        `Provider: twilio · SID: ${twilioData.sid}`,
        "",
        "--- Message ---",
        message,
      ].join("\n");

      if (entity_type === "candidate" && candidate_id && workspaceId) {
        await supabase.from("candidate_notes").insert({
          candidate_id,
          title: `💬 SMS sent`,
          body: noteContent.slice(0, 8000),
          visibility: "team",
          owner_id: user.id,
          team_id: workspaceId,
          tags: ["sms", "outbound"],
        });
      } else if (contact_id && workspaceId) {
        await supabase.from("notes").insert({
          entity_type: "contact",
          entity_id: contact_id,
          content: noteContent.slice(0, 8000),
          visibility: "team",
          source: "sms",
          owner_id: user.id,
          team_id: workspaceId,
        });
      }
    } catch (noteErr) {
      console.error("send-sms: note insert failed:", noteErr);
    }

    return new Response(JSON.stringify({ success: true, twilio_message_sid: twilioData.sid }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-sms error:", err);
    return new Response(JSON.stringify({ error: "server_error", message: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
