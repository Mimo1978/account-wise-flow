/**
 * Deterministic enum mappings for the Outreach module.
 * All values are literal DB enum labels — no guessing.
 * Single source of truth for labels, ordering, styling, and categories.
 */

import type {
  OutreachTargetState,
  OutreachEventType,
  OutreachChannel,
  CallOutcomeType,
} from "@/hooks/use-outreach";

// ─── TARGET STATE ─────────────────────────────────────────────────────────────

export const TARGET_STATE_LABEL: Record<OutreachTargetState, string> = {
  queued: "Queued",
  contacted: "Contacted",
  responded: "Responded",
  booked: "Booked",
  snoozed: "Snoozed",
  opted_out: "Opted Out",
  converted: "Converted",
  closed: "Closed",
};

export const TARGET_STATE_BADGE_CLASS: Record<OutreachTargetState, string> = {
  queued: "bg-muted text-muted-foreground",
  contacted: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  responded: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  booked: "bg-primary/10 text-primary",
  snoozed: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  opted_out: "bg-destructive/10 text-destructive",
  converted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  closed: "bg-muted text-muted-foreground",
};

export const TARGET_STATE_CATEGORY = {
  queued: "QUEUE",
  contacted: "ACTIVE",
  responded: "WAITING",
  booked: "COMPLETED",
  snoozed: "SNOOZED",
  opted_out: "COMPLIANCE",
  converted: "COMPLETED",
  closed: "CLOSED",
} as const;

// ─── State precedence (higher = stickier, never downgrade) ────────────────────

const STATE_PRECEDENCE: Record<OutreachTargetState, number> = {
  queued: 0,
  contacted: 1,
  snoozed: 2,
  responded: 3,
  booked: 4,
  converted: 5,
  opted_out: 6,
  closed: 7,
};

export const TARGET_STATE_ORDER = STATE_PRECEDENCE;

/**
 * Returns the higher-precedence state. Targets never downgrade.
 */
export function resolveState(
  current: OutreachTargetState,
  proposed: OutreachTargetState,
): OutreachTargetState {
  return STATE_PRECEDENCE[proposed] >= STATE_PRECEDENCE[current] ? proposed : current;
}

// ─── EVENT TYPE ───────────────────────────────────────────────────────────────

export const EVENT_TYPE_LABEL: Record<OutreachEventType, string> = {
  email_sent: "Email Sent",
  sms_sent: "SMS Sent",
  call_made: "Call Made",
  call_scheduled: "Call Scheduled",
  call_completed: "Call Completed",
  responded: "Responded",
  booked: "Meeting Booked",
  snoozed: "Snoozed",
  opted_out: "Opted Out",
  note_added: "Note Added",
  status_changed: "Status Changed",
  added_to_campaign: "Added to Campaign",
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

// ─── CHANNEL ──────────────────────────────────────────────────────────────────

export const CHANNEL_LABEL: Record<OutreachChannel, string> = {
  email: "Email",
  sms: "SMS",
  call: "Call",
  linkedin: "LinkedIn",
  other: "Other",
};

// ─── CALL OUTCOME ─────────────────────────────────────────────────────────────

export const CALL_OUTCOME_LABEL: Record<CallOutcomeType, string> = {
  connected: "Connected",
  voicemail: "Voicemail",
  no_answer: "No Answer",
  busy: "Busy",
  wrong_number: "Wrong Number",
  interested: "Interested",
  not_interested: "Not Interested",
  callback_requested: "Callback Requested",
  meeting_booked: "Meeting Booked",
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
      return null;
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
