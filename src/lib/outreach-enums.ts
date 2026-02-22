/**
 * Deterministic enum mappings for the Outreach module.
 * All values are literal DB enum labels — no guessing.
 */

import type { OutreachTargetState, OutreachEventType, CallOutcomeType } from "@/hooks/use-outreach";

// ─── Category maps ────────────────────────────────────────────────────────────

export const TARGET_STATE_CATEGORY: Record<OutreachTargetState, "active" | "terminal" | "paused"> = {
  queued: "active",
  contacted: "active",
  responded: "active",
  booked: "active",
  snoozed: "paused",
  opted_out: "terminal",
  converted: "terminal",
};

export const EVENT_TYPE_CATEGORY: Record<OutreachEventType, "contact" | "response" | "lifecycle" | "system"> = {
  email_sent: "contact",
  sms_sent: "contact",
  call_made: "contact",
  call_scheduled: "contact",
  call_completed: "contact",
  responded: "response",
  booked: "response",
  snoozed: "lifecycle",
  opted_out: "lifecycle",
  note_added: "system",
  status_changed: "system",
  added_to_campaign: "system",
};

export const CALL_OUTCOME_CATEGORY: Record<CallOutcomeType, "positive" | "neutral" | "negative"> = {
  connected: "neutral",
  voicemail: "neutral",
  no_answer: "neutral",
  busy: "neutral",
  wrong_number: "negative",
  interested: "positive",
  not_interested: "negative",
  callback_requested: "positive",
  meeting_booked: "positive",
};

// ─── State precedence (higher = stickier, never downgrade) ────────────────────

const STATE_PRECEDENCE: Record<OutreachTargetState, number> = {
  queued: 0,
  contacted: 1,
  snoozed: 2,
  responded: 3,
  booked: 4,
  converted: 5,
  opted_out: 6, // highest — terminal & sticky
};

/**
 * Returns the higher-precedence state. Targets never downgrade.
 * `opted_out` always wins. `converted`/`booked` beat lower states.
 */
export function resolveState(
  current: OutreachTargetState,
  proposed: OutreachTargetState,
): OutreachTargetState {
  return STATE_PRECEDENCE[proposed] >= STATE_PRECEDENCE[current] ? proposed : current;
}

// ─── Contact-type events (trigger contacted_count / last_contacted_at) ───────

const CONTACT_EVENTS = new Set<OutreachEventType>([
  "email_sent",
  "sms_sent",
  "call_made",
  "call_completed",
]);

export function isContactEvent(et: OutreachEventType): boolean {
  return CONTACT_EVENTS.has(et);
}

const RESPONSE_EVENTS = new Set<OutreachEventType>(["responded", "booked"]);

export function isResponseEvent(et: OutreachEventType): boolean {
  return RESPONSE_EVENTS.has(et);
}

const CALL_EVENTS = new Set<OutreachEventType>(["call_made", "call_scheduled", "call_completed"]);

export function isCallEvent(et: OutreachEventType): boolean {
  return CALL_EVENTS.has(et);
}

// ─── Call outcome → target state mapping ──────────────────────────────────────

export function callOutcomeToState(outcome: CallOutcomeType): OutreachTargetState | null {
  switch (outcome) {
    case "meeting_booked":
      return "booked";
    case "interested":
    case "connected":
      return "contacted";
    case "callback_requested":
      return "snoozed";
    case "not_interested":
      return "opted_out";
    default:
      return null; // voicemail, no_answer, busy, wrong_number — no state change
  }
}

// ─── Compliance gating ────────────────────────────────────────────────────────

export interface ComplianceFlags {
  state: OutreachTargetState;
  do_not_contact: boolean;
  do_not_call: boolean;
}

export function isOutreachBlocked(flags: ComplianceFlags): boolean {
  return flags.state === "opted_out" || flags.do_not_contact;
}

export function isCallBlocked(flags: ComplianceFlags): boolean {
  return isOutreachBlocked(flags) || flags.do_not_call;
}
