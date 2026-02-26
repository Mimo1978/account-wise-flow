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

    const { service } = await req.json();

    if (service === "resend") {
      const keys = await getUserKeys(supabase, user.id, "resend");
      if (!keys.RESEND_API_KEY || !keys.FROM_EMAIL_ADDRESS) {
        return new Response(JSON.stringify({ success: false, error: "Missing Resend API key or From email" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Send test email to user's own email
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${keys.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: keys.FROM_EMAIL_ADDRESS,
          to: [user.email],
          subject: "CRM Integration Test",
          html: "<p>Your Resend integration is working correctly.</p>",
        }),
      });

      if (!resendRes.ok) {
        const errBody = await resendRes.text();
        return new Response(JSON.stringify({ success: false, error: `Resend: ${errBody}` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (service === "twilio") {
      const keys = await getUserKeys(supabase, user.id, "twilio");
      if (!keys.TWILIO_ACCOUNT_SID || !keys.TWILIO_AUTH_TOKEN || !keys.TWILIO_PHONE_NUMBER) {
        return new Response(JSON.stringify({ success: false, error: "Missing Twilio credentials" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Send test SMS to user's email (as a fallback — in production this would go to their mobile)
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${keys.TWILIO_ACCOUNT_SID}/Messages.json`;
      const body = new URLSearchParams({
        From: keys.TWILIO_PHONE_NUMBER,
        To: keys.TWILIO_PHONE_NUMBER, // Send to self as test
        Body: "CRM SMS integration test from your CRM system.",
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
        return new Response(JSON.stringify({ success: false, error: `Twilio: ${errBody}` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: false, error: `Unknown service: ${service}` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("test-integration error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
