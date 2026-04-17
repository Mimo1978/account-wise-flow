import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-workspace-key",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Authenticate via workspace API key in header
    const workspaceKey = req.headers.get("x-workspace-key");
    if (!workspaceKey) {
      return new Response(JSON.stringify({ error: "Missing x-workspace-key header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Find workspace by API key
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("id, name")
      .eq("inbound_api_key", workspaceKey)
      .single();

    if (teamError || !team) {
      return new Response(JSON.stringify({ error: "Invalid workspace key" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const body = await req.json();
    const {
      name,       // sender full name
      email,      // sender email
      phone,      // sender phone (optional)
      message,    // the enquiry message
      source,     // "website" | "email" | "linkedin" | "referral" | "other"
      subject,    // email subject if from email
      metadata,   // any extra fields from the form
    } = body;

    if (!message && !email) {
      return new Response(JSON.stringify({ error: "message or email required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // === STEP 1: Create the lead record ===
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert({
        workspace_id: team.id,
        title: subject || `Inbound enquiry from ${name || email || "unknown"}`,
        sender_name: name || null,
        sender_email: email || null,
        sender_phone: phone || null,
        message: message || subject || "",
        source: source || "inbound",
        source_channel: source || "website",
        status: "new",
        raw_payload: body,
        created_by: "00000000-0000-0000-0000-000000000000", // system user placeholder
      })
      .select()
      .single();

    if (leadError) throw leadError;

    // === STEP 2: AI classification ===
    const classifyPrompt = `You are an AI assistant for a recruitment CRM. Classify this inbound enquiry.

Source: ${source || "website"}
From: ${name || "Unknown"} <${email || "no email"}>
Message: ${message || subject || ""}

Return ONLY valid JSON:
{
  "intent": "candidate_application" | "client_brief" | "general_enquiry" | "referral" | "partnership" | "spam",
  "sentiment": "positive" | "neutral" | "negative",
  "summary": "one sentence summary of what they want",
  "urgency": "high" | "medium" | "low",
  "draft_reply": "a warm, professional 2-3 sentence acknowledgement reply that confirms receipt, sets expectations on response time (within 1 business day), and feels human not robotic. Use their first name if available.",
  "suggested_action": "call_back" | "send_info" | "schedule_meeting" | "add_to_talent" | "create_deal" | "ignore"
}`;

    let classification = {
      intent: "general_enquiry",
      sentiment: "neutral",
      summary: "Inbound enquiry received",
      urgency: "medium",
      draft_reply: `Thank you for getting in touch${name ? `, ${name.split(" ")[0]}` : ""}. We have received your enquiry and one of our team will be in touch within 1 business day.`,
      suggested_action: "call_back",
    };

    try {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          max_tokens: 500,
          messages: [{ role: "user", content: classifyPrompt }],
        }),
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const content = aiData.choices?.[0]?.message?.content || "";
        const match = content.match(/\{[\s\S]*\}/);
        if (match) classification = { ...classification, ...JSON.parse(match[0]) };
      }
    } catch (e) {
      console.error("AI classification failed:", e);
    }

    // === STEP 3: Update lead with AI analysis ===
    await supabase
      .from("leads")
      .update({
        ai_intent: classification.intent,
        ai_sentiment: classification.sentiment,
        ai_summary: classification.summary,
        ai_draft_reply: classification.draft_reply,
        notes: `AI Summary: ${classification.summary}\nSuggested action: ${classification.suggested_action}\nUrgency: ${classification.urgency}`,
      })
      .eq("id", lead.id);

    // === STEP 4: Auto-send acknowledgement if Resend is configured ===
    if (email) {
      try {
        // Get Resend config for this workspace
        const { data: integrations } = await supabase
          .from("integration_settings")
          .select("key_name, key_value")
          .eq("team_id", team.id)
          .eq("service", "resend");

        const keys = Object.fromEntries((integrations || []).map((k: any) => [k.key_name, k.key_value]));

        if (keys.RESEND_API_KEY && keys.FROM_EMAIL_ADDRESS && classification.intent !== "spam") {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${keys.RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: keys.FROM_EMAIL_ADDRESS,
              to: email,
              subject: `Re: ${subject || "Your enquiry"}`,
              html: `

${classification.draft_reply.replace(/\n/g, "
")}

`,
            }),
          });

          await supabase
            .from("leads")
            .update({
              status: "acknowledged",
              responded_at: new Date().toISOString(),
            })
            .eq("id", lead.id);
        }
      } catch (emailErr) {
        console.error("Auto-reply failed:", emailErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        lead_id: lead.id,
        intent: classification.intent,
        acknowledged: !!email && classification.intent !== "spam",
        message: "Lead received and classified",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Inbound lead error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
