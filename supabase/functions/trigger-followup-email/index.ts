import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Triggered automatically by bland-call-webhook when the AI agent commits
 * to email a contact during a call.
 *
 * Pipeline:
 *  1. Compose a personalised follow-up email via Lovable AI from the call
 *     summary + key points + the topic the agent agreed to send
 *  2. Try to send it via Resend (if RESEND_API_KEY is set)
 *  3. Either way, log a `crm_activities` row + `outreach_events` row, write
 *     a note on the contact / candidate, and clear `followup_email_pending`
 */

async function composeEmail(opts: {
  entityName: string;
  topic: string;
  callSummary: string;
  keyPoints: string[];
  noticePeriod: string | null;
  availability: string | null;
}, apiKey: string): Promise<{ subject: string; html: string; plain: string }> {
  const sys = `You write short, professional follow-up emails after recruitment phone calls.
Tone: warm, concise, British English. Maximum 150 words. No greeting like "I hope this finds you well".
Open with a single line referencing the call. Cover the topic the recruiter agreed to send. Close with a clear next step.
Return JSON via the tool call only.`;
  const user = `Recipient: ${opts.entityName}
Topic the recruiter agreed to send: ${opts.topic}
Call summary: ${opts.callSummary}
${opts.noticePeriod ? `Notice period mentioned: ${opts.noticePeriod}\n` : ""}${opts.availability ? `Availability mentioned: ${opts.availability}\n` : ""}${opts.keyPoints.length ? `Key points discussed:\n- ${opts.keyPoints.join("\n- ")}` : ""}`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      tools: [{
        type: "function",
        function: {
          name: "compose_followup_email",
          parameters: {
            type: "object",
            properties: {
              subject: { type: "string", description: "Short subject line, max 70 chars" },
              plain: { type: "string", description: "Plain text email body" },
              html: { type: "string", description: "HTML email body — use <p> tags, no inline styles" },
            },
            required: ["subject", "plain", "html"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "compose_followup_email" } },
    }),
  });
  if (!resp.ok) throw new Error(`AI compose failed: ${resp.status}`);
  const data = await resp.json();
  const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("No tool args");
  return JSON.parse(args);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const {
      target_id,
      workspace_id,
      campaign_id,
      user_id,
      entity_email,
      entity_name,
      topic,
      call_summary,
      key_points,
      notice_period,
      availability,
      candidate_id,
      contact_id,
    } = body;

    if (!entity_email || !target_id || !workspace_id) {
      return new Response(JSON.stringify({ error: "missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Compose the email
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) throw new Error("LOVABLE_API_KEY not configured");
    const composed = await composeEmail({
      entityName: entity_name || "there",
      topic: topic || "Information from our call",
      callSummary: call_summary || "",
      keyPoints: Array.isArray(key_points) ? key_points : [],
      noticePeriod: notice_period || null,
      availability: availability || null,
    }, lovableKey);

    // 2. Try to send via user's Resend integration; fall back to draft only
    let sent = false;
    let sendError: string | null = null;
    let providerId: string | null = null;
    try {
      let resendKey: string | null = null;
      if (user_id) {
        const { data: keyRow } = await supabase
          .from("integration_settings")
          .select("key_value")
          .eq("user_id", user_id)
          .eq("service", "resend")
          .eq("key_name", "RESEND_API_KEY")
          .maybeSingle();
        resendKey = keyRow?.key_value || null;
      }
      resendKey = resendKey || Deno.env.get("RESEND_API_KEY") || null;

      if (resendKey) {
        const fromAddress = Deno.env.get("DEFAULT_FROM_EMAIL") || "onboarding@resend.dev";
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromAddress,
            to: [entity_email],
            subject: composed.subject,
            html: composed.html,
            text: composed.plain,
          }),
        });
        if (r.ok) {
          const j = await r.json();
          providerId = j?.id || null;
          sent = true;
        } else {
          sendError = `resend ${r.status}: ${(await r.text()).slice(0, 200)}`;
        }
      } else {
        sendError = "No Resend API key configured — email saved as draft";
      }
    } catch (e: any) {
      sendError = e?.message || "send error";
    }

    const now = new Date().toISOString();

    // 3. Log on outreach_events so the campaign view shows the follow-up
    try {
      await supabase.from("outreach_events").insert({
        workspace_id,
        campaign_id: campaign_id || null,
        target_id,
        candidate_id: candidate_id || null,
        contact_id: contact_id || null,
        event_type: "email_sent",
        channel: "email",
        subject: composed.subject,
        body: composed.plain,
        metadata: {
          source: "ai_call_followup",
          topic,
          sent,
          send_error: sendError,
          provider: sent ? "resend" : null,
          provider_id: providerId,
        },
      });
    } catch (e) { console.error("outreach_events insert failed:", e); }

    // 4. Mirror the email body into a CRM activity
    try {
      await supabase.from("crm_activities").insert({
        type: "email",
        direction: "outbound",
        subject: `${sent ? "Sent" : "Draft"} follow-up: ${composed.subject}`.slice(0, 500),
        body: `${composed.plain}\n\n---\nAuto-generated from AI call · Topic: ${topic}${sendError ? `\nNote: ${sendError}` : ""}`.slice(0, 8000),
        contact_id: contact_id || null,
        status: sent ? "completed" : "draft",
        completed_at: sent ? now : null,
        created_by: user_id || null,
      });
    } catch (e) { console.error("crm_activities insert failed:", e); }

    // 5. Add a note so the contact / candidate file shows the follow-up
    try {
      const noteBody = `✉️ ${sent ? "Follow-up email sent" : "Follow-up email drafted"} — ${topic}\n\nSubject: ${composed.subject}\n\n${composed.plain}${sendError ? `\n\n⚠️ ${sendError}` : ""}`;
      if (candidate_id) {
        await supabase.from("candidate_notes").insert({
          candidate_id,
          title: `✉️ Follow-up: ${composed.subject}`.slice(0, 200),
          body: noteBody.slice(0, 8000),
          visibility: "team",
          owner_id: user_id || null,
          team_id: workspace_id,
          tags: ["ai-email", "follow-up", sent ? "sent" : "drafted"],
        });
      } else if (contact_id) {
        await supabase.from("notes").insert({
          entity_type: "contact",
          entity_id: contact_id,
          content: noteBody.slice(0, 8000),
          source: "ai_email",
          visibility: "team",
          owner_id: user_id || null,
          team_id: workspace_id,
        });
      }
    } catch (e) { console.error("note insert failed:", e); }

    // 6. Clear pending flag if sent
    if (sent) {
      try {
        await supabase
          .from("outreach_targets")
          .update({ followup_email_pending: false })
          .eq("id", target_id)
          .eq("workspace_id", workspace_id);
      } catch (e) { console.error("clear flag failed:", e); }
    }

    // 7. In-app notification
    if (user_id) {
      try {
        await supabase.from("notifications").insert({
          user_id,
          workspace_id,
          type: sent ? "email_sent" : "email_drafted",
          title: sent ? `✉️ Follow-up email sent — ${entity_name}` : `📝 Follow-up email drafted — ${entity_name}`,
          body: `${composed.subject}${sendError ? ` · ${sendError}` : ""}`.slice(0, 500),
          link: candidate_id ? `/talent/${candidate_id}` : (contact_id ? `/contacts/${contact_id}` : "/outreach"),
          read: false,
        });
      } catch (e) { console.error("notification failed:", e); }
    }

    return new Response(JSON.stringify({ ok: true, sent, send_error: sendError, subject: composed.subject }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("trigger-followup-email error:", e);
    return new Response(JSON.stringify({ error: e?.message || "server_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
