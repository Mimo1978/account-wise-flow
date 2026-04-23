import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Bland.ai call-completed webhook.
 * Bland POSTs the full call object (transcript, summary, duration, recording_url, etc.)
 * once the call ends. We:
 *  1. Find the matching crm_activities row (logged when the call was initiated)
 *  2. Generate a concise AI summary + extract structured outcome (meeting booked, callback, etc.)
 *  3. Update the activity with status=completed, full body, completed_at, recording link
 */

interface BlandWebhook {
  call_id?: string;
  to?: string;
  from?: string;
  call_length?: number;          // minutes
  completed?: boolean;
  status?: string;
  summary?: string;
  concatenated_transcript?: string;
  transcripts?: Array<{ user: string; text: string; created_at?: string }>;
  recording_url?: string;
  metadata?: {
    contact_id?: string;
    candidate_id?: string;
    company_id?: string;
    workspace_id?: string;
    user_id?: string;
    purpose?: string;
    entity_name?: string;
  };
  answered_by?: string;
  variables?: Record<string, unknown>;
}

async function aiSummarise(transcript: string, purpose: string, apiKey: string): Promise<{
  summary: string;
  outcome: string;
  meeting_agreed: boolean;
  meeting_when?: string;
  meeting_iso?: string;
  duration_minutes?: number;
  next_step?: string;
  sentiment: "positive" | "neutral" | "negative";
}> {
  const nowIso = new Date().toISOString();
  const sys = `You analyse outbound recruitment/sales call transcripts.
The current date/time is ${nowIso} (UTC). Use this to resolve relative references like "tomorrow", "next Tuesday", "in 2 weeks".
Return ONLY a JSON object with these fields:
- summary: 2-4 sentence neutral summary of what happened on the call
- outcome: short label e.g. "Meeting booked", "Callback requested", "Not interested", "No answer", "Voicemail", "Follow-up agreed"
- meeting_agreed: boolean — true if a meeting, demo, OR a callback at a specific time was agreed
- meeting_when: human-readable when (e.g. "Thursday 2pm", "tomorrow morning"), or omit
- meeting_iso: ISO 8601 datetime in UTC for the agreed slot (e.g. "2026-04-25T13:00:00Z"). If only a vague day is given, pick a sensible default (mornings = 09:00, afternoons = 14:00, "next week" = next Monday 09:00). Omit only if truly no time was discussed.
- duration_minutes: expected meeting length in minutes (default 30 if not stated)
- next_step: the concrete next action the rep should take
- sentiment: "positive" | "neutral" | "negative"`;
  const user = `Call purpose: ${purpose || "n/a"}\n\nTranscript:\n"""\n${transcript.slice(0, 12000)}\n"""`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      tools: [{
        type: "function",
        function: {
          name: "log_call_outcome",
          description: "Structured outcome of the call",
          parameters: {
            type: "object",
            properties: {
              summary: { type: "string" },
              outcome: { type: "string" },
              meeting_agreed: { type: "boolean" },
              meeting_when: { type: "string" },
              meeting_iso: { type: "string", description: "ISO 8601 UTC datetime of the agreed slot" },
              duration_minutes: { type: "number" },
              next_step: { type: "string" },
              sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
            },
            required: ["summary", "outcome", "meeting_agreed", "sentiment"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "log_call_outcome" } },
    }),
  });

  if (!resp.ok) throw new Error(`AI summarise failed: ${resp.status}`);
  const data = await resp.json();
  const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("No tool_call args returned");
  return JSON.parse(args);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const payload = (await req.json()) as BlandWebhook;
    const callId = payload.call_id;
    if (!callId) {
      return new Response(JSON.stringify({ error: "missing call_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const transcript = payload.concatenated_transcript
      || (payload.transcripts || []).map(t => `${t.user}: ${t.text}`).join("\n")
      || "";

    const purpose = payload.metadata?.purpose || "";
    const userId = payload.metadata?.user_id;
    const contactId = payload.metadata?.contact_id;

    // AI summary (if we have any transcript)
    let analysis = {
      summary: payload.summary || "Call completed — no transcript captured.",
      outcome: payload.completed ? "Call completed" : (payload.status || "Unknown"),
      meeting_agreed: false as boolean,
      meeting_when: undefined as string | undefined,
      next_step: undefined as string | undefined,
      sentiment: "neutral" as "positive" | "neutral" | "negative",
    };
    if (transcript.trim().length > 30 && Deno.env.get("LOVABLE_API_KEY")) {
      try {
        analysis = await aiSummarise(transcript, purpose, Deno.env.get("LOVABLE_API_KEY")!);
      } catch (e) {
        console.error("AI summarise error:", e);
      }
    }

    const durationMin = typeof payload.call_length === "number" ? payload.call_length : null;
    const recording = payload.recording_url ? `\n\nRecording: ${payload.recording_url}` : "";
    const meetingLine = analysis.meeting_agreed
      ? `\n\n📅 Meeting agreed${analysis.meeting_when ? ` — ${analysis.meeting_when}` : ""}`
      : "";
    const nextStepLine = analysis.next_step ? `\n\nNext step: ${analysis.next_step}` : "";

    const body = `${analysis.summary}\n\nOutcome: ${analysis.outcome} · Sentiment: ${analysis.sentiment}${durationMin !== null ? ` · Duration: ${durationMin.toFixed(1)} min` : ""}${meetingLine}${nextStepLine}${recording}\n\n---\nFull transcript:\n${transcript || "(none)"}\n\nProvider: bland · Call ID: ${callId}`;

    const subject = analysis.meeting_agreed
      ? `📅 AI Call → Meeting agreed${analysis.meeting_when ? ` (${analysis.meeting_when})` : ""}`
      : `AI Call: ${analysis.outcome}`;

    // Find the activity row that was logged when the call started.
    // We stored "Call ID: <callId>" in the body — match on that.
    const { data: existing } = await supabase
      .from("crm_activities")
      .select("id")
      .eq("type", "call")
      .ilike("body", `%Call ID: ${callId}%`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (existing && existing.length > 0) {
      await supabase
        .from("crm_activities")
        .update({
          subject: subject.slice(0, 500),
          body: body.slice(0, 8000),
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", existing[0].id);
    } else {
      // No prior row (fallback) — create one
      await supabase.from("crm_activities").insert({
        type: "call",
        direction: "outbound",
        subject: subject.slice(0, 500),
        body: body.slice(0, 8000),
        contact_id: contactId || null,
        status: "completed",
        completed_at: new Date().toISOString(),
        created_by: userId || null,
      });
    }

    // ─────────────────────────────────────────────────────────────
    // Auto-create a diary event when the AI detected an agreed slot
    // ─────────────────────────────────────────────────────────────
    let diaryEventId: string | null = null;
    const workspaceId = payload.metadata?.workspace_id;
    const candidateId = payload.metadata?.candidate_id;
    const companyId = payload.metadata?.company_id;
    const entityName = payload.metadata?.entity_name || "contact";

    if (analysis.meeting_agreed && userId && workspaceId) {
      let startIso: string | null = null;
      if (analysis.meeting_iso) {
        const d = new Date(analysis.meeting_iso);
        if (!isNaN(d.getTime())) startIso = d.toISOString();
      }
      // Fallback: schedule for tomorrow 09:00 UTC if AI gave us no parseable time
      if (!startIso) {
        const t = new Date();
        t.setUTCDate(t.getUTCDate() + 1);
        t.setUTCHours(9, 0, 0, 0);
        startIso = t.toISOString();
      }
      const durationMin = Math.max(15, Math.min(180, analysis.duration_minutes ?? 30));
      const endIso = new Date(new Date(startIso).getTime() + durationMin * 60_000).toISOString();

      const title = `${analysis.outcome.toLowerCase().includes("callback") ? "Callback" : "Meeting"} — ${entityName}`;
      const description = `Auto-booked from AI call.\n\n${analysis.summary}${analysis.next_step ? `\n\nNext step: ${analysis.next_step}` : ""}${payload.recording_url ? `\n\nRecording: ${payload.recording_url}` : ""}`;

      const { data: diary, error: diaryErr } = await supabase
        .from("diary_events")
        .insert({
          workspace_id: workspaceId,
          user_id: userId,
          title: title.slice(0, 200),
          description: description.slice(0, 4000),
          start_time: startIso,
          end_time: endIso,
          event_type: "call",
          contact_id: contactId || null,
          candidate_id: candidateId || null,
          company_id: companyId || null,
          status: "scheduled",
        })
        .select("id")
        .single();

      if (diaryErr) {
        console.error("diary_events insert failed:", diaryErr);
      } else {
        diaryEventId = diary?.id ?? null;
      }
    }

    // ─────────────────────────────────────────────────────────────
    // Auto-create a Note on the contact / candidate record so the
    // call summary lives where the rep expects to find it.
    // ─────────────────────────────────────────────────────────────
    let noteId: string | null = null;
    try {
      const noteEntityType = candidateId ? "candidate" : (contactId ? "contact" : null);
      const noteEntityId = candidateId || contactId || null;
      if (noteEntityType && noteEntityId && workspaceId) {
        const noteContent = [
          `📞 AI Call · ${analysis.outcome}`,
          analysis.summary,
          analysis.meeting_agreed && analysis.meeting_when
            ? `📅 Meeting agreed — ${analysis.meeting_when}`
            : "",
          analysis.next_step ? `Next step: ${analysis.next_step}` : "",
          durationMin !== null ? `Duration: ${durationMin.toFixed(1)} min · Sentiment: ${analysis.sentiment}` : `Sentiment: ${analysis.sentiment}`,
          payload.recording_url ? `Recording: ${payload.recording_url}` : "",
        ].filter(Boolean).join("\n\n");

        const { data: note, error: noteErr } = await supabase
          .from("notes")
          .insert({
            entity_type: noteEntityType,
            entity_id: noteEntityId,
            content: noteContent.slice(0, 8000),
            visibility: "team",
            source: "ai_call",
            owner_id: userId || null,
            team_id: workspaceId,
            pinned: analysis.meeting_agreed,
          })
          .select("id")
          .single();
        if (noteErr) console.error("notes insert failed:", noteErr);
        else noteId = note?.id ?? null;
      }
    } catch (e) {
      console.error("note creation error:", e);
    }

    // ─────────────────────────────────────────────────────────────
    // In-app notification so the rep sees the bell counter increment
    // ─────────────────────────────────────────────────────────────
    if (userId) {
      try {
        const link = candidateId
          ? `/talent/${candidateId}`
          : (contactId ? `/contacts/${contactId}` : "/home");
        const titlePrefix = analysis.meeting_agreed ? "📅 Meeting booked" : "📞 Call ended";
        await supabase.from("notifications").insert({
          user_id: userId,
          workspace_id: workspaceId || null,
          type: analysis.meeting_agreed ? "call_meeting_booked" : "call_completed",
          title: `${titlePrefix} — ${entityName}`,
          body: `${analysis.outcome}. ${analysis.summary}`.slice(0, 500),
          link,
          read: false,
        });
      } catch (e) {
        console.error("notification insert failed:", e);
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      meeting_agreed: analysis.meeting_agreed,
      diary_event_id: diaryEventId,
      note_id: noteId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("bland-call-webhook error:", err);
    return new Response(JSON.stringify({ error: "server_error", message: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});