import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { message_ids } = await req.json();
    if (!message_ids || !Array.isArray(message_ids) || message_ids.length === 0) {
      return new Response(JSON.stringify({ error: "message_ids array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Twilio keys
    const twilioKeys = await getUserKeys(supabaseAdmin, user.id, "twilio");
    if (!twilioKeys.TWILIO_ACCOUNT_SID || !twilioKeys.TWILIO_AUTH_TOKEN || !twilioKeys.TWILIO_PHONE_NUMBER) {
      return new Response(JSON.stringify({
        error: "integration_not_configured",
        service: "twilio",
        message: "Twilio is not configured. Go to Settings > Integrations to add your Twilio keys.",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch messages
    const { data: messages, error: msgErr } = await supabaseAdmin
      .from("outreach_messages")
      .select("*")
      .in("id", message_ids)
      .eq("channel", "sms")
      .eq("status", "draft");

    if (msgErr || !messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: "No draft SMS messages found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const msg of messages) {
      if (!msg.candidate_phone || !msg.sms_body) {
        results.push({ id: msg.id, success: false, error: "Missing phone or SMS body" });
        await supabaseAdmin.from("outreach_messages").update({
          status: "failed",
          error_message: "Missing phone number or SMS body",
        }).eq("id", msg.id);
        continue;
      }

      try {
        // Send via Twilio
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioKeys.TWILIO_ACCOUNT_SID}/Messages.json`;
        const body = new URLSearchParams({
          From: twilioKeys.TWILIO_PHONE_NUMBER,
          To: msg.candidate_phone,
          Body: msg.sms_body,
        });

        const twilioRes = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            "Authorization": "Basic " + btoa(`${twilioKeys.TWILIO_ACCOUNT_SID}:${twilioKeys.TWILIO_AUTH_TOKEN}`),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });

        if (!twilioRes.ok) {
          const errBody = await twilioRes.text();
          throw new Error(`Twilio error: ${errBody}`);
        }

        const twilioData = await twilioRes.json();

        // Update message status
        await supabaseAdmin.from("outreach_messages").update({
          status: "sent",
          sent_at: new Date().toISOString(),
          twilio_sid: twilioData.sid,
        }).eq("id", msg.id);

        // Update shortlist
        if (msg.shortlist_id) {
          await supabaseAdmin.from("job_shortlist").update({
            outreach_sent_at: new Date().toISOString(),
            status: "contacted",
          }).eq("id", msg.shortlist_id);
        }

        results.push({ id: msg.id, success: true, twilio_sid: twilioData.sid });

        // Small delay between sends
        await new Promise(r => setTimeout(r, 200));
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Unknown error";
        results.push({ id: msg.id, success: false, error: errMsg });
        await supabaseAdmin.from("outreach_messages").update({
          status: "failed",
          error_message: errMsg,
        }).eq("id", msg.id);
      }
    }

    const sent = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return new Response(JSON.stringify({ sent, failed, total: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-outreach-sms error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
