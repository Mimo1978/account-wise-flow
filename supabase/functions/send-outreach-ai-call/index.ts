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
        message: "Twilio is not configured. Go to Settings > Integrations.",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get ElevenLabs keys (optional but recommended)
    const elKeys = await getUserKeys(supabaseAdmin, user.id, "elevenlabs");
    const hasElevenLabs = !!elKeys.ELEVENLABS_API_KEY;

    // Fetch messages
    const { data: messages, error: msgErr } = await supabaseAdmin
      .from("outreach_messages")
      .select("*")
      .in("id", message_ids)
      .eq("channel", "ai_call")
      .eq("status", "draft");

    if (msgErr || !messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: "No draft AI call messages found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const msg of messages) {
      if (!msg.candidate_phone || !msg.ai_call_script) {
        results.push({ id: msg.id, success: false, error: "Missing phone or call script" });
        await supabaseAdmin.from("outreach_messages").update({
          status: "failed",
          error_message: "Missing phone number or AI call script",
        }).eq("id", msg.id);
        continue;
      }

      try {
        // Build TwiML for the call
        // If ElevenLabs is configured, we could generate audio and use <Play>
        // For now, use Twilio's built-in TTS with the script
        const escapedScript = msg.ai_call_script.replace(/[<>&"']/g, (c: string) => {
          const entities: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' };
          return entities[c] || c;
        });

        let twiml: string;
        if (hasElevenLabs) {
          // Generate audio via ElevenLabs and use <Play> (advanced implementation)
          // For MVP, fall back to Twilio TTS with better voice
          twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Brian" language="en-GB">${escapedScript}</Say>
  <Pause length="2"/>
  <Say voice="Polly.Brian" language="en-GB">Thank you, and I hope to speak with you soon. Goodbye.</Say>
</Response>`;
        } else {
          twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Brian" language="en-GB">${escapedScript}</Say>
  <Pause length="2"/>
  <Say voice="Polly.Brian" language="en-GB">Thank you, and I hope to speak with you soon. Goodbye.</Say>
</Response>`;
        }

        // Initiate call via Twilio
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioKeys.TWILIO_ACCOUNT_SID}/Calls.json`;
        const callBody = new URLSearchParams({
          From: twilioKeys.TWILIO_PHONE_NUMBER,
          To: msg.candidate_phone,
          Twiml: twiml,
        });

        const twilioRes = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            "Authorization": "Basic " + btoa(`${twilioKeys.TWILIO_ACCOUNT_SID}:${twilioKeys.TWILIO_AUTH_TOKEN}`),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: callBody.toString(),
        });

        if (!twilioRes.ok) {
          const errBody = await twilioRes.text();
          throw new Error(`Twilio call error: ${errBody}`);
        }

        const callData = await twilioRes.json();

        // Update message status
        await supabaseAdmin.from("outreach_messages").update({
          status: "sent",
          sent_at: new Date().toISOString(),
          twilio_sid: callData.sid,
        }).eq("id", msg.id);

        // Update shortlist
        if (msg.shortlist_id) {
          await supabaseAdmin.from("job_shortlist").update({
            outreach_sent_at: new Date().toISOString(),
            status: "contacted",
          }).eq("id", msg.shortlist_id);
        }

        results.push({ id: msg.id, success: true, call_sid: callData.sid });

        // Small delay between calls
        await new Promise(r => setTimeout(r, 500));
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
    console.error("send-outreach-ai-call error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
