import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

    const { message_ids } = await req.json();
    if (!message_ids || !Array.isArray(message_ids) || message_ids.length === 0) {
      return new Response(JSON.stringify({ error: "message_ids array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get messages to send
    const { data: messages, error: fetchErr } = await supabaseAdmin
      .from("outreach_messages")
      .select("*")
      .in("id", message_ids)
      .in("status", ["draft", "approved"]);

    if (fetchErr || !messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: "No sendable messages found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Resend API key from integration_settings
    const { data: keys } = await supabaseAdmin
      .from("integration_settings")
      .select("key_name, key_value")
      .eq("user_id", userId)
      .eq("service", "resend");
    const keyMap = Object.fromEntries((keys ?? []).map((k: any) => [k.key_name, k.key_value]));

    if (!keyMap.RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Resend integration not configured. Go to Settings → Integrations to add your Resend API key." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fromEmail = keyMap.FROM_EMAIL_ADDRESS || "noreply@example.com";
    let sentCount = 0;
    let failCount = 0;
    const results: any[] = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];

      // Add 200ms delay between sends
      if (i > 0) await delay(200);

      try {
        const fromField = msg.from_name
          ? `${msg.from_name} <${msg.from_email || fromEmail}>`
          : msg.from_email || fromEmail;

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${keyMap.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromField,
            to: msg.candidate_email,
            subject: msg.subject,
            html: msg.body_html || msg.body?.replace(/\n/g, "<br>") || "",
          }),
        });

        if (!res.ok) {
          const errBody = await res.text();
          console.error(`Resend error for ${msg.candidate_name}:`, res.status, errBody);
          await supabaseAdmin
            .from("outreach_messages")
            .update({ status: "failed", error_message: `Resend ${res.status}: ${errBody.slice(0, 200)}` })
            .eq("id", msg.id);
          failCount++;
          results.push({ id: msg.id, candidate: msg.candidate_name, status: "failed", error: errBody.slice(0, 100) });
          continue;
        }

        const now = new Date().toISOString();
        // Update message as sent
        await supabaseAdmin
          .from("outreach_messages")
          .update({ status: "sent", sent_at: now })
          .eq("id", msg.id);

        // Update shortlist entry outreach_sent_at
        if (msg.shortlist_id) {
          await supabaseAdmin
            .from("job_shortlist")
            .update({ outreach_sent_at: now, status: "contacted" })
            .eq("id", msg.shortlist_id);
        }

        sentCount++;
        results.push({ id: msg.id, candidate: msg.candidate_name, status: "sent" });
        console.log(`Sent email to ${msg.candidate_name} (${msg.candidate_email})`);
      } catch (err) {
        console.error(`Error sending to ${msg.candidate_name}:`, err);
        await supabaseAdmin
          .from("outreach_messages")
          .update({ status: "failed", error_message: err instanceof Error ? err.message : "Unknown error" })
          .eq("id", msg.id);
        failCount++;
        results.push({ id: msg.id, candidate: msg.candidate_name, status: "failed" });
      }
    }

    return new Response(
      JSON.stringify({
        sent: sentCount,
        failed: failCount,
        total: messages.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("send-outreach-batch error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
