import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface PreCheckResult {
  passed: boolean;
  blockers: string[];
  warnings: string[];
}

interface CallAnswers {
  availability?: string;
  availability_date?: string;
  interest_level?: "high" | "medium" | "low" | "not_interested";
  notice_period?: string;
  best_callback_time?: string;
  opted_out?: boolean;
  wants_meeting?: boolean;
  meeting_slot?: string;
}

interface AICallRequest {
  target_id: string;
  workspace_id: string;
  script_id?: string;
  recruiter_calendar_slots?: string[];
  /** If provided, continues an existing conversation with additional user input */
  conversation_history?: Array<{ role: "assistant" | "user"; content: string }>;
  user_message?: string;
}

// ─── Pre-call checks ──────────────────────────────────────────────────────────

function runPreChecks(target: Record<string, unknown>): PreCheckResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Hard blocks
  if (target.do_not_call === true) blockers.push("Target is marked Do Not Call");
  if (target.do_not_contact === true) blockers.push("Target is marked Do Not Contact");
  if (!target.entity_phone) blockers.push("No phone number available");
  if (target.state === "opted_out") blockers.push("Target has opted out");

  // Max attempts check
  const attempts = (target.call_attempts as number) ?? 0;
  const max = (target.max_call_attempts as number) ?? 3;
  if (attempts >= max) blockers.push(`Maximum call attempts reached (${attempts}/${max})`);

  // Calling hours check (UTC-based if no timezone override)
  const now = new Date();
  const hourUTC = now.getUTCHours();
  const startHour = parseInt(((target.calling_hours_start as string) ?? "09:00").split(":")[0]);
  const endHour = parseInt(((target.calling_hours_end as string) ?? "18:00").split(":")[0]);
  if (hourUTC < startHour || hourUTC >= endHour) {
    warnings.push(`Outside configured calling hours (${startHour}:00–${endHour}:00 UTC)`);
  }

  // Consent warnings
  const consent = target.consent_status as string;
  if (!consent || consent === "unknown") warnings.push("Consent status unknown — ensure GDPR compliance");
  if (consent === "withdrawn") blockers.push("Consent withdrawn by candidate");

  // Snooze check
  if (target.snooze_until) {
    const snoozeUntil = new Date(target.snooze_until as string);
    if (snoozeUntil > now) {
      blockers.push(`Target snoozed until ${snoozeUntil.toISOString().split("T")[0]}`);
    }
  }

  return { passed: blockers.length === 0, blockers, warnings };
}

// ─── Build call script prompt ─────────────────────────────────────────────────

function buildSystemPrompt(
  target: Record<string, unknown>,
  script: Record<string, unknown> | null,
  jobSpec: Record<string, unknown> | null,
  recruiterSlots: string[]
): string {
  const candidateName = (target.entity_name as string) || "the candidate";
  const jobTitle = (jobSpec?.title as string) || "the role";
  const jobCompany = "our client";
  const jobLocation = (jobSpec?.location as string) || "to be confirmed";
  const jobRate = (jobSpec?.salary_range as string) || (jobSpec?.day_rate_range as string) || "competitive";

  // Merge script call_blocks if present
  let scriptContext = "";
  if (script?.body) {
    scriptContext = `\n\nApproved call script body:\n${script.body}`;
  }

  const slotsText =
    recruiterSlots.length > 0
      ? `\nAvailable meeting slots to offer:\n${recruiterSlots.map((s, i) => `  Slot ${i + 1}: ${s}`).join("\n")}`
      : "\nNo pre-defined meeting slots — offer to call back at the candidate's preferred time.";

  return `You are an AI recruitment assistant making an outbound call on behalf of a recruitment agency.

IDENTITY DISCLOSURE (MANDATORY — never hide this):
- You must immediately identify yourself as an AI assistant at the start of any call.
- State the agency/recruiter you are calling on behalf of.
- Always ask permission before proceeding.

CANDIDATE DETAILS:
- Name: ${candidateName}
- Current title: ${(target.entity_title as string) || "unknown"}
- Company: ${(target.entity_company as string) || "unknown"}
- Phone: ${(target.entity_phone as string) || "on file"}

ROLE DETAILS:
- Job title: ${jobTitle}
- Company: ${jobCompany}
- Location: ${jobLocation}
- Rate/Salary: ${jobRate}
${slotsText}
${scriptContext}

CONVERSATION RULES:
1. ALWAYS start by identifying yourself as an AI and the agency you represent.
2. Ask for permission to continue BEFORE discussing the role.
3. If candidate says it is not a good time — offer a specific callback time slot and end the call.
4. If candidate is not interested — thank them, offer opt-out, and end gracefully.
5. If candidate opts out — confirm their opt-out immediately, log it, and end the call.
6. Structured questions to ask (in order, only if permission granted):
   a. Current availability — are they actively looking?
   b. Notice period — how long before they can start?
   c. Interest level in the role described
   d. Best callback time if they want more details
   e. If interested — offer 1–2 meeting slots for a follow-up call
7. Keep answers concise — this is a phone call, not an email.
8. Use ONLY the allowed data fields for the candidate (name, title, company, phone). Do NOT invent data.

RESPONSE FORMAT:
After each exchange, you will respond as the call agent with spoken dialogue ONLY.
At the END of the full conversation (when you output "CALL_COMPLETE"), also output a JSON block:
\`\`\`json
{
  "outcome": "connected|voicemail|not_interested|callback_requested|meeting_booked|opted_out",
  "interest_level": "high|medium|low|not_interested",
  "availability": "immediate|2_weeks|1_month|not_available|unknown",
  "availability_date": "ISO date or null",
  "notice_period": "string or null",
  "best_callback_time": "string or null",
  "opted_out": true|false,
  "wants_meeting": true|false,
  "meeting_slot": "chosen slot string or null",
  "summary": "1-2 sentence call summary"
}
\`\`\``;
}

// ─── Parse structured answers from AI response ─────────────────────────────

function extractJsonFromResponse(text: string): CallAnswers | null {
  const match = text.match(/```json\s*([\s\S]*?)```/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as CallAnswers;
  } catch {
    return null;
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const supabaseAuthed = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authError } = await supabaseAuthed.auth.getClaims(token);
    if (authError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const body = await req.json() as AICallRequest;
    const { target_id, workspace_id, script_id, recruiter_calendar_slots = [], conversation_history, user_message } = body;

    if (!target_id || !workspace_id) {
      return new Response(JSON.stringify({ error: "target_id and workspace_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Fetch target ──────────────────────────────────────────────────────
    const { data: target, error: targetError } = await supabaseUser
      .from("outreach_targets")
      .select("*")
      .eq("id", target_id)
      .eq("workspace_id", workspace_id)
      .single();

    if (targetError || !target) {
      return new Response(JSON.stringify({ error: "Target not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── PRE-CHECKS (skip if continuing existing conversation) ─────────────
    if (!conversation_history || conversation_history.length === 0) {
      const preCheck = runPreChecks(target as Record<string, unknown>);
      if (!preCheck.passed) {
        // Log a blocked event
        await supabaseUser.from("outreach_events").insert({
          workspace_id,
          target_id,
          campaign_id: target.campaign_id,
          candidate_id: target.candidate_id,
          event_type: "call_made",
          metadata: {
            blocked: true,
            blockers: preCheck.blockers,
            warnings: preCheck.warnings,
            call_type: "ai",
          },
        });
        return new Response(
          JSON.stringify({ blocked: true, blockers: preCheck.blockers, warnings: preCheck.warnings }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Increment call attempt counter
      await supabaseUser
        .from("outreach_targets")
        .update({ call_attempts: (target.call_attempts ?? 0) + 1 })
        .eq("id", target_id);
    }

    // ─── Fetch script (optional) ──────────────────────────────────────────
    let script: Record<string, unknown> | null = null;
    if (script_id) {
      const { data: s } = await supabaseUser
        .from("outreach_scripts")
        .select("*")
        .eq("id", script_id)
        .single();
      script = s;
    } else {
      // Auto-pick default CALL script for campaign
      const { data: s } = await supabaseUser
        .from("outreach_scripts")
        .select("*")
        .eq("campaign_id", target.campaign_id)
        .eq("channel", "call")
        .eq("is_default", true)
        .maybeSingle();
      script = s;
    }

    // ─── Fetch job spec (optional, via campaign) ──────────────────────────
    let jobSpec: Record<string, unknown> | null = null;
    if (target.campaign_id) {
      const { data: campaign } = await supabaseUser
        .from("outreach_campaigns")
        .select("job_spec_id")
        .eq("id", target.campaign_id)
        .single();
      if (campaign?.job_spec_id) {
        const { data: js } = await supabaseUser
          .from("job_specs")
          .select("*")
          .eq("id", campaign.job_spec_id)
          .single();
        jobSpec = js;
      }
    }

    // ─── Build messages for AI ────────────────────────────────────────────
    const systemPrompt = buildSystemPrompt(
      target as Record<string, unknown>,
      script,
      jobSpec,
      recruiter_calendar_slots
    );

    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    if (conversation_history && conversation_history.length > 0) {
      messages.push(...conversation_history);
    }

    if (user_message) {
      messages.push({ role: "user", content: user_message });
    } else if (!conversation_history || conversation_history.length === 0) {
      // First turn — AI initiates the call
      messages.push({
        role: "user",
        content: "[CALL_INITIATED] The phone has connected. Begin the call now.",
      });
    }

    // ─── Call AI ──────────────────────────────────────────────────────────
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        temperature: 0.4,
        max_tokens: 800,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please top up your workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const assistantText: string = aiData.choices?.[0]?.message?.content ?? "";

    // ─── Check if call is complete ─────────────────────────────────────────
    const isCallComplete = assistantText.includes("CALL_COMPLETE");
    const structuredAnswers = isCallComplete ? extractJsonFromResponse(assistantText) : null;

    // Strip the JSON block from display text
    const displayText = assistantText
      .replace(/CALL_COMPLETE/g, "")
      .replace(/```json[\s\S]*?```/g, "")
      .trim();

    // ─── If call complete — write outcomes ─────────────────────────────────
    if (isCallComplete && structuredAnswers) {
      const now = new Date().toISOString();

      // Determine new state
      let newState: string = "contacted";
      let eventType: string = "call_completed";

      if (structuredAnswers.opted_out) {
        newState = "opted_out";
        eventType = "opted_out";
      } else if (structuredAnswers.wants_meeting) {
        newState = "booked";
        eventType = "booked";
      } else if (structuredAnswers.availability_date) {
        newState = "contacted";
        eventType = "call_completed";
      }

      // Build target update patch
      const targetPatch: Record<string, unknown> = {
        state: newState,
        last_contacted_at: now,
      };
      if (structuredAnswers.opted_out) {
        targetPatch.do_not_call = true;
        targetPatch.do_not_contact = true;
      }
      if (structuredAnswers.availability_date) {
        targetPatch.availability_date = structuredAnswers.availability_date;
        targetPatch.next_action_at = structuredAnswers.availability_date;
      }
      if (structuredAnswers.meeting_slot) {
        targetPatch.booked_meeting_id = structuredAnswers.meeting_slot;
        targetPatch.next_action_at = null;
      }

      // Persist target update
      await supabaseUser
        .from("outreach_targets")
        .update(targetPatch)
        .eq("id", target_id);

      // Persist call outcome
      await supabaseUser.from("call_outcomes").insert({
        target_id,
        workspace_id,
        candidate_id: target.candidate_id ?? null,
        contact_id: target.contact_id ?? null,
        outcome: structuredAnswers.wants_meeting
          ? "meeting_booked"
          : structuredAnswers.opted_out
          ? "not_interested"
          : "connected",
        notes: structuredAnswers.summary ?? displayText,
        called_at: now,
        call_type: "ai",
        ai_transcript: [...(conversation_history ?? []), { role: "assistant", content: displayText }],
        structured_answers: structuredAnswers,
        availability_date: structuredAnswers.availability_date ?? null,
        notice_period: structuredAnswers.notice_period ?? null,
        interest_level: structuredAnswers.interest_level ?? null,
        best_callback_time: structuredAnswers.best_callback_time ?? null,
      });

      // Persist outreach event
      await supabaseUser.from("outreach_events").insert({
        workspace_id,
        target_id,
        campaign_id: target.campaign_id,
        candidate_id: target.candidate_id,
        contact_id: target.contact_id,
        event_type: eventType,
        channel: "call",
        body: displayText,
        metadata: {
          call_type: "ai",
          outcome: structuredAnswers.outcome,
          structured_answers: structuredAnswers,
          performed_by_user: null,
        },
      });

      // Update candidate last_contacted_at if candidate_id exists
      if (target.candidate_id) {
        await supabaseUser
          .from("candidates")
          .update({ updated_at: now })
          .eq("id", target.candidate_id);
      }
    }

    return new Response(
      JSON.stringify({
        message: displayText,
        is_complete: isCallComplete,
        structured_answers: structuredAnswers,
        updated_history: [
          ...(conversation_history ?? []),
          { role: "assistant", content: displayText },
        ],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("ai-call-agent error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
