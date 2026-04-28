import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getKeys(supabase: any, userId: string, service: string): Promise<Record<string, string>> {
  const { data } = await supabase
    .from("integration_settings")
    .select("key_name, key_value")
    .eq("user_id", userId)
    .eq("service", service);
  return Object.fromEntries((data || []).filter((r: any) => r.key_value).map((r: any) => [r.key_name, r.key_value]));
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

    const body = await req.json();
    const {
      to_number,
      purpose,
      custom_instructions,
      target_id,
      campaign_id,
      workspace_id,
    } = body;
    // Accept both legacy `contact_id` and new `entity_id`/`entity_type`
    const entityType: "contact" | "crm_contact" | "candidate" =
      body.entity_type || (body.contact_id ? "contact" : "contact");
    const entityId: string | null = body.entity_id || body.contact_id || null;
    if (!to_number) return new Response(JSON.stringify({ error: "to_number is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Get all integration keys
    const blandKeys = await getKeys(supabase, user.id, "bland");
    const twilioKeys = await getKeys(supabase, user.id, "twilio");

    // Get contact name and company
    let firstName = "there";
    let entityName = "";
    let companyName = "";
    let companyId = null;
    let resolvedContactId: string | null = null;
    let resolvedCandidateId: string | null = null;

    if (entityId) {
      if (entityType === "candidate") {
        const { data: cand } = await supabase.from("candidates").select("name").eq("id", entityId).maybeSingle();
        if (cand) {
          resolvedCandidateId = entityId;
          if (cand.name) { firstName = cand.name.split(" ")[0]; entityName = cand.name; }
        }
      } else if (entityType === "crm_contact") {
        const { data: c } = await supabase.from("crm_contacts").select("first_name, last_name, company_id").eq("id", entityId).maybeSingle();
        if (c) {
          resolvedContactId = entityId;
          firstName = c.first_name || "there";
          entityName = `${c.first_name || ""} ${c.last_name || ""}`.trim();
          companyId = c.company_id || null;
          if (companyId) {
            const { data: co } = await supabase.from("crm_companies").select("name").eq("id", companyId).maybeSingle();
            if (co?.name) companyName = co.name;
          }
        }
      } else {
        // contact (canonical)
        const { data: c } = await supabase.from("contacts").select("name, company_id").eq("id", entityId).maybeSingle();
        if (c) {
          resolvedContactId = entityId;
          if (c.name) { firstName = c.name.split(" ")[0]; entityName = c.name; }
          companyId = c.company_id || null;
          if (companyId) {
            const { data: co } = await supabase.from("companies").select("name").eq("id", companyId).maybeSingle();
            if (co?.name) companyName = co.name;
          }
        } else {
          // Last-ditch fallback: maybe it's a candidate id
          const { data: cand } = await supabase.from("candidates").select("name").eq("id", entityId).maybeSingle();
          if (cand) {
            resolvedCandidateId = entityId;
            if (cand.name) { firstName = cand.name.split(" ")[0]; entityName = cand.name; }
          }
        }
      }
    }

    // Resolve workspace (team) for diary booking
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("team_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    const workspaceId = workspace_id || roleRow?.team_id || null;

    // Get call script from outreach_scripts if one exists for 'call' channel
    const { data: scripts } = await supabase
      .from("outreach_scripts")
      .select("body, name")
      .eq("workspace_id", user.id)
      .eq("channel", "call")
      .eq("is_default", true)
      .limit(1);
    const defaultScript = scripts?.[0]?.body || null;

    // Build the AI task/script
    const task = `You are a professional recruitment consultant making a friendly outbound call on behalf of Client Mapper recruitment.

Contact name: ${firstName}${companyName ? ` at ${companyName}` : ""}
Call purpose: ${purpose || "introduce yourself and discuss a potential opportunity"}
${custom_instructions ? `Additional instructions: ${custom_instructions}` : ""}
${defaultScript ? `Call script to follow:\n${defaultScript}` : ""}

Opening: Greet them by first name, introduce yourself as a recruitment consultant, confirm this is a good time to talk.

During the call:
- Be warm, professional, and concise
- Listen carefully — do not interrupt
- If they are interested: ask about their current availability and notice period
- If they are not available: ask when they might be open to opportunities
- If they want more details: explain the role purpose and ask if you can send a follow-up email
- If they are not interested: thank them and ask if they know anyone suitable
- Always confirm a clear next step before ending
- Keep under 5 minutes unless they are clearly engaged

End the call professionally and confirm any agreed next step.`;

    let callId = null;
    let provider = null;

    if (blandKeys.BLAND_API_KEY) {
      // === BLAND.AI — full two-way conversation ===
      provider = "bland";
      const webhookUrl = `${supabaseUrl}/functions/v1/bland-call-webhook`;
      const blandRes = await fetch("https://api.bland.ai/v1/calls", {
        method: "POST",
        headers: {
          authorization: blandKeys.BLAND_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone_number: to_number,
          task,
          model: "enhanced",
          language: "en-GB",
          voice: "june",
          max_duration: 12,
          wait_for_greeting: true,
          record: true,
          amd: true,
          interruption_threshold: 150,
          temperature: 0.7,
          webhook: webhookUrl,
          analysis_schema: {
            meeting_agreed: "boolean",
            meeting_when: "string",
            outcome: "string",
            sentiment: "string",
          },
          metadata: {
            contact_id: resolvedContactId,
            candidate_id: resolvedCandidateId,
            company_id: companyId,
            workspace_id: workspaceId,
            user_id: user.id,
            purpose: purpose || "",
            entity_name: entityName || firstName,
          },
        }),
      });

      if (!blandRes.ok) {
        const errText = await blandRes.text();
        if (blandRes.status === 429) {
          return new Response(JSON.stringify({
            error: "rate_limit_exceeded",
            message: "Bland.ai has temporarily rate-limited international calls. Please try again in a few minutes.",
            provider: "bland",
            fallback: true,
          }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({
          error: "provider_error",
          message: `Bland.ai could not place the call (${blandRes.status}). Please try again later.`,
          provider: "bland",
          fallback: true,
          details: errText.slice(0, 500),
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const blandData = await blandRes.json();
      callId = blandData.call_id;
      if (!callId) {
        return new Response(JSON.stringify({
          error: "provider_error",
          message: blandData.message || "Bland.ai accepted the request but did not return a call ID, so no call was started.",
          provider: "bland",
          fallback: true,
          details: JSON.stringify(blandData).slice(0, 500),
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

    } else if (twilioKeys.TWILIO_ACCOUNT_SID && twilioKeys.TWILIO_AUTH_TOKEN && twilioKeys.TWILIO_PHONE_NUMBER) {
      // === TWILIO FALLBACK — scripted one-way message ===
      provider = "twilio";
      const message = purpose
        ? `Hello ${firstName}, this is a message from your recruitment consultant. ${purpose}. Please call us back at your convenience. Thank you.`
        : `Hello ${firstName}, this is a message from your recruitment consultant. We have an opportunity we think may interest you. Please call us back at your convenience. Thank you.`;

      const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Amy" language="en-GB">${message.replace(/[<>&"']/g, " ")}</Say></Response>`;

      const twilioRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioKeys.TWILIO_ACCOUNT_SID}/Calls.json`,
        {
          method: "POST",
          headers: {
            Authorization: "Basic " + btoa(`${twilioKeys.TWILIO_ACCOUNT_SID}:${twilioKeys.TWILIO_AUTH_TOKEN}`),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ From: twilioKeys.TWILIO_PHONE_NUMBER, To: to_number, Twiml: twiml }).toString(),
        }
      );

      if (!twilioRes.ok) {
        const errText = await twilioRes.text();
        return new Response(JSON.stringify({
          error: "provider_error",
          message: `Twilio could not place the call (${twilioRes.status}). Please try again later.`,
          provider: "twilio",
          fallback: true,
          details: errText.slice(0, 500),
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const twilioData = await twilioRes.json();
      callId = twilioData.sid;
      if (!callId) {
        return new Response(JSON.stringify({
          error: "provider_error",
          message: "Twilio accepted the request but did not return a call ID, so no call was started.",
          provider: "twilio",
          fallback: true,
          details: JSON.stringify(twilioData).slice(0, 500),
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

    } else {
      return new Response(JSON.stringify({
        error: "integration_not_configured",
        message: "No calling provider configured. Go to Admin → Integrations and add your Bland.ai key for two-way AI calls, or Twilio for basic scripted calls.",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Initiator profile (for audit trail)
    const { data: initiatorProfile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .maybeSingle();
    const initiatorName = `${initiatorProfile?.first_name || ""} ${initiatorProfile?.last_name || ""}`.trim() || user.email || user.id;

    const scriptForLog = (custom_instructions || "").slice(0, 4000);

    // Log the call to crm_activities (kept for CRM timeline)
    await supabase.from("crm_activities").insert({
      type: "call",
      direction: "outbound",
      subject: `AI Call: ${purpose || "Outreach"}`,
      body: `Provider: ${provider}. Call ID: ${callId}. Initiated by: ${initiatorName}. Purpose: ${purpose || "General outreach"}.\n\n--- Script ---\n${scriptForLog}`.substring(0, 8000),
      contact_id: resolvedContactId,
      candidate_id: resolvedCandidateId,
      company_id: companyId,
      status: provider === "bland" ? "in_progress" : "completed",
      created_by: user.id,
    });

    // Log a "Call started" note immediately on the person's record so it's
    // traceable even before the webhook fires.
    const startedAt = new Date().toISOString();
    const startNoteBody = [
      `📞 AI Call started — ${purpose || "Outbound call"}`,
      `Initiated by: ${initiatorName}`,
      `To: ${to_number}`,
      `Provider: ${provider} · Call ID: ${callId}`,
      `Time: ${startedAt}`,
      scriptForLog ? `\n--- Script delivered to AI agent ---\n${scriptForLog}` : "",
    ].filter(Boolean).join("\n");

    try {
      if (resolvedCandidateId && workspaceId) {
        await supabase.from("candidate_notes").insert({
          candidate_id: resolvedCandidateId,
          title: `📞 AI Call started — ${purpose || "Outreach"}`,
          body: startNoteBody.slice(0, 8000),
          visibility: "team",
          owner_id: user.id,
          team_id: workspaceId,
          tags: ["ai-call", "started"],
        });
      } else if (resolvedContactId && workspaceId) {
        await supabase.from("notes").insert({
          entity_type: "contact",
          entity_id: resolvedContactId,
          content: startNoteBody.slice(0, 8000),
          visibility: "team",
          source: "ai_call",
          owner_id: user.id,
          team_id: workspaceId,
        });
      }
    } catch (noteErr) {
      console.error("initiate-ai-call: start-note insert failed:", noteErr);
    }

    return new Response(JSON.stringify({
      success: true,
      call_id: callId,
      call_sid: callId,
      provider,
      message: provider === "bland"
        ? `Two-way AI call started to ${to_number}. Bland.ai is now having a full conversation with ${firstName}. The transcript will be available after the call ends.`
        : `Scripted call placed to ${to_number}. ${firstName} will hear a message asking them to call back.`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("initiate-ai-call error:", err);
    return new Response(
      JSON.stringify({ error: "server_error", message: err.message, fallback: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
