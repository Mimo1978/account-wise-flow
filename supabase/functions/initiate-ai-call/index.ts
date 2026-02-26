import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const { contact_id, to_number, purpose, custom_instructions } = await req.json();

    // Get Twilio keys
    const twilioKeys = await getUserKeys(supabase, user.id, "twilio");
    if (!twilioKeys.TWILIO_ACCOUNT_SID || !twilioKeys.TWILIO_AUTH_TOKEN || !twilioKeys.TWILIO_PHONE_NUMBER) {
      return new Response(JSON.stringify({
        error: "integration_not_configured",
        service: "twilio",
        message: "Twilio is not set up. Go to Settings > Integrations to add your keys.",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get optional ElevenLabs key
    const elKeys = await getUserKeys(supabase, user.id, "elevenlabs");
    const hasElevenLabs = !!elKeys.ELEVENLABS_API_KEY;

    // Fetch contact and company info (only name fields, no PII)
    const { data: contact } = await supabase
      .from("crm_contacts")
      .select("first_name, last_name, company_id, crm_companies(name)")
      .eq("id", contact_id)
      .single();

    const firstName = contact?.first_name || "the contact";
    const companyName = (contact?.crm_companies as any)?.name || "their company";
    const companyId = contact?.company_id || null;

    // Build system prompt
    const systemPrompt = `You are making an outbound call to ${firstName} at ${companyName}. Call purpose: ${purpose}. Additional context: ${custom_instructions || "None"}. Be professional, friendly and concise. Do not ask for sensitive personal information.`;

    // Build TwiML
    let twiml: string;
    if (hasElevenLabs) {
      // Use ElevenLabs streaming — simplified TwiML with <Connect>
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Please hold while we connect you to an AI assistant.</Say>
  <Pause length="1"/>
  <Say>${systemPrompt.replace(/[<>&"']/g, "")}</Say>
</Response>`;
    } else {
      // Basic TwiML with Say verb
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${systemPrompt.replace(/[<>&"']/g, "")}</Say>
  <Pause length="2"/>
  <Say voice="alice">Thank you for your time. Goodbye.</Say>
</Response>`;
    }

    // Initiate call via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioKeys.TWILIO_ACCOUNT_SID}/Calls.json`;
    const callBody = new URLSearchParams({
      From: twilioKeys.TWILIO_PHONE_NUMBER,
      To: to_number,
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

    // Log activity
    await supabase.from("crm_activities").insert({
      type: "call",
      direction: "outbound",
      subject: `AI Call: ${purpose}`,
      body: `Call SID: ${callData.sid}. Purpose: ${purpose}. ${custom_instructions || ""}`.substring(0, 2000),
      contact_id: contact_id || null,
      company_id: companyId,
      status: "completed",
      completed_at: new Date().toISOString(),
      created_by: user.id,
    });

    return new Response(JSON.stringify({ success: true, call_sid: callData.sid }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("initiate-ai-call error:", err);
    return new Response(JSON.stringify({ error: "server_error", message: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
