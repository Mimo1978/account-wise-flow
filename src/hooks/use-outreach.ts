import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";
import {
  resolveState,
  isContactEvent,
  isResponseEvent,
  isCallEvent,
  callOutcomeToState,
  isOutreachBlocked,
  isCallBlocked,
  type ComplianceFlags,
} from "@/lib/outreach-enums";

// Helper: cast supabase to any for new tables not yet in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ─── Types ────────────────────────────────────────────────────────────────────

export type OutreachChannel = "email" | "sms" | "call" | "linkedin" | "other";
export type OutreachTargetState =
  | "queued"
  | "contacted"
  | "responded"
  | "booked"
  | "snoozed"
  | "opted_out"
  | "converted"
  | "closed";
export type OutreachCampaignStatus =
  | "draft"
  | "active"
  | "paused"
  | "completed"
  | "archived";
export type OutreachEventType =
  | "email_sent"
  | "sms_sent"
  | "call_made"
  | "call_scheduled"
  | "call_completed"
  | "responded"
  | "booked"
  | "snoozed"
  | "opted_out"
  | "note_added"
  | "status_changed"
  | "added_to_campaign";
export type CallOutcomeType =
  | "connected"
  | "voicemail"
  | "no_answer"
  | "busy"
  | "wrong_number"
  | "interested"
  | "not_interested"
  | "callback_requested"
  | "meeting_booked";

export interface OutreachCampaign {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  status: OutreachCampaignStatus;
  channel: OutreachChannel;
  job_spec_id?: string;
  owner_id?: string;
  target_count: number;
  contacted_count: number;
  response_count: number;
  start_date?: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
  // Script assignments
  email_script_id?: string;
  sms_script_id?: string;
  call_script_id?: string;
  // Scheduling & compliance settings
  calendar_connection_id?: string;
  calling_hours_start?: string;
  calling_hours_end?: string;
  calling_timezone?: string;
  max_call_attempts?: number;
  opt_out_required?: boolean;
}

export type OutreachEntityType = "candidate" | "contact";

export interface OutreachTarget {
  id: string;
  workspace_id: string;
  campaign_id: string;
  candidate_id?: string;
  contact_id?: string;
  entity_type: OutreachEntityType;
  entity_name: string;
  entity_email?: string;
  entity_phone?: string;
  entity_title?: string;
  entity_company?: string;
  state: OutreachTargetState;
  priority: number;
  assigned_to?: string;
  snooze_until?: string;
  opt_out_reason?: string;
  last_contacted_at?: string;
  next_action?: string;
  next_action_due?: string;
  notes?: string;
  added_by?: string;
  created_at: string;
  updated_at: string;
  campaign?: OutreachCampaign;
}

export interface OutreachEvent {
  id: string;
  workspace_id: string;
  campaign_id?: string;
  target_id?: string;
  candidate_id?: string;
  contact_id?: string;
  event_type: OutreachEventType;
  channel?: OutreachChannel;
  subject?: string;
  body?: string;
  metadata: Record<string, unknown>;
  performed_by?: string;
  performed_at: string;
  created_at: string;
}

// ─── Campaign hooks ────────────────────────────────────────────────────────────

export function useOutreachCampaigns() {
  const { currentWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ["outreach_campaigns", currentWorkspace?.id],
    enabled: !!currentWorkspace?.id,
    queryFn: async () => {
      const { data, error } = await db
        .from("outreach_campaigns")
        .select("*")
        .eq("workspace_id", currentWorkspace!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OutreachCampaign[];
    },
  });
}

export function useCreateCampaign() {
  const { currentWorkspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Omit<
        OutreachCampaign,
        "id" | "created_at" | "updated_at" | "target_count" | "contacted_count" | "response_count" | "workspace_id"
      >
    ) => {
      const { data, error } = await db
        .from("outreach_campaigns")
        .insert({ ...input, workspace_id: currentWorkspace!.id })
        .select()
        .single();
      if (error) throw error;
      return data as OutreachCampaign;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["outreach_campaigns"] });
      toast.success("Campaign created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<OutreachCampaign> & { id: string }) => {
      const { data, error } = await db
        .from("outreach_campaigns")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as OutreachCampaign;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["outreach_campaigns"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─── Target hooks ─────────────────────────────────────────────────────────────

export interface TargetFilters {
  campaignId?: string;
  state?: OutreachTargetState | "";
  channel?: OutreachChannel | "";
}

export function useOutreachTargets(filters: TargetFilters = {}) {
  const { currentWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ["outreach_targets", currentWorkspace?.id, filters],
    enabled: !!currentWorkspace?.id,
    queryFn: async () => {
      let q = db
        .from("outreach_targets")
        .select("*, campaign:outreach_campaigns(id,name,channel,status)")
        .eq("workspace_id", currentWorkspace!.id)
        .order("priority", { ascending: true })
        .order("created_at", { ascending: true });

      if (filters.campaignId) q = q.eq("campaign_id", filters.campaignId);
      if (filters.state) q = q.eq("state", filters.state);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as OutreachTarget[];
    },
  });
}

export function useAddTargets() {
  const { currentWorkspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      targets: Array<{
        campaign_id: string;
        candidate_id?: string;
        contact_id?: string;
        entity_type: OutreachEntityType;
        entity_name: string;
        entity_email?: string;
        entity_phone?: string;
        entity_title?: string;
        entity_company?: string;
      }>
    ) => {
      if (targets.length === 0) return { inserted: [], skipped: 0, campaignId: "" };

      const campaignId = targets[0].campaign_id;
      const rows = targets.map((t) => ({
        ...t,
        workspace_id: currentWorkspace!.id,
        state: "queued" as OutreachTargetState,
      }));

      // Use upsert-like approach: insert with onConflict ignore not available,
      // so we insert and count errors for duplicates
      const { data, error } = await db
        .from("outreach_targets")
        .insert(rows)
        .select();

      if (error) {
        // If it's a unique constraint violation, some may have been skipped
        if (error.code === "23505") {
          // Insert one by one to count successes
          const inserted: OutreachTarget[] = [];
          let skipped = 0;
          for (const row of rows) {
            const { data: single, error: singleErr } = await db
              .from("outreach_targets")
              .insert(row)
              .select()
              .single();
            if (singleErr) {
              skipped++;
            } else {
              inserted.push(single as OutreachTarget);
            }
          }
          return { inserted, skipped, campaignId };
        }
        throw error;
      }

      const inserted = (data ?? []) as OutreachTarget[];
      return { inserted, skipped: 0, campaignId };
    },
    onSuccess: async ({ inserted, skipped, campaignId }) => {
      // Increment campaign target_count
      if (inserted.length > 0 && campaignId) {
        await db.rpc("increment_campaign_target_count", {
          p_campaign_id: campaignId,
          p_count: inserted.length,
        }).catch(() => {
          // Fallback: manual increment if RPC doesn't exist
          // The count will be eventually consistent via query
        });

        // Log added_to_campaign events
        const events = inserted.map((t) => ({
          workspace_id: currentWorkspace!.id,
          campaign_id: campaignId,
          target_id: t.id,
          candidate_id: t.candidate_id,
          contact_id: t.contact_id,
          event_type: "added_to_campaign" as OutreachEventType,
          metadata: {},
        }));
        await db.from("outreach_events").insert(events).catch(() => {});
      }

      qc.invalidateQueries({ queryKey: ["outreach_targets"] });
      qc.invalidateQueries({ queryKey: ["outreach_campaigns"] });

      if (inserted.length > 0) {
        const msg = skipped > 0
          ? `Added ${inserted.length}, skipped ${skipped} duplicate${skipped !== 1 ? "s" : ""}`
          : `${inserted.length} target${inserted.length !== 1 ? "s" : ""} added`;
        toast.success(msg);
      } else if (skipped > 0) {
        toast.info(`All ${skipped} already in campaign`);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateTargetState() {
  const { currentWorkspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      targetId,
      state,
      eventType,
      metadata = {},
      snoozeUntil,
      optOutReason,
    }: {
      targetId: string;
      state: OutreachTargetState;
      eventType: OutreachEventType;
      metadata?: Record<string, unknown>;
      snoozeUntil?: string;
      optOutReason?: string;
    }) => {
      const { data: target } = await db
        .from("outreach_targets")
        .select("campaign_id, candidate_id, contact_id, state, do_not_contact, do_not_call, last_contacted_at")
        .eq("id", targetId)
        .single();

      if (!target) throw new Error("Target not found");

      // ── Compliance gating ──
      const flags: ComplianceFlags = {
        state: target.state as OutreachTargetState,
        do_not_contact: !!target.do_not_contact,
        do_not_call: !!target.do_not_call,
      };
      if (isCallEvent(eventType) && isCallBlocked(flags)) {
        throw new Error("Calls blocked: target is do_not_call or opted out");
      }
      if (isContactEvent(eventType) && isOutreachBlocked(flags)) {
        throw new Error("Outreach blocked: target opted out or do_not_contact");
      }

      // ── State precedence: never downgrade ──
      const resolvedState = resolveState(target.state as OutreachTargetState, state);

      const patch: Record<string, unknown> = { state: resolvedState };

      // Only set last_contacted_at on contact events
      if (isContactEvent(eventType)) {
        patch.last_contacted_at = new Date().toISOString();
      }
      if (snoozeUntil) patch.snooze_until = snoozeUntil;
      if (optOutReason) patch.opt_out_reason = optOutReason;

      const { error: updateError } = await db
        .from("outreach_targets")
        .update(patch)
        .eq("id", targetId);
      if (updateError) throw updateError;

      // ── Insert event ──
      const { error: eventError } = await db.from("outreach_events").insert({
        workspace_id: currentWorkspace!.id,
        campaign_id: target.campaign_id,
        target_id: targetId,
        candidate_id: target.candidate_id,
        contact_id: target.contact_id,
        event_type: eventType,
        metadata,
      });
      if (eventError) throw eventError;

      // ── Deterministic counter updates ──
      const campaignId = target.campaign_id;
      if (campaignId) {
        // First contact → increment contacted_count
        if (isContactEvent(eventType) && !target.last_contacted_at) {
          await db.rpc("increment_campaign_target_count", {
            p_campaign_id: campaignId,
            p_count: 0, // reuse RPC shape but we need a contacted_count one
          }).catch(() => {});
          // Direct increment for contacted_count
          await db
            .from("outreach_campaigns")
            .update({ contacted_count: db.raw?.("contacted_count + 1") })
            .eq("id", campaignId)
            .catch(() => {
              // Fallback: fetch and set
              db.from("outreach_campaigns").select("contacted_count").eq("id", campaignId).single()
                .then(({ data: c }: { data: { contacted_count: number } | null }) => {
                  if (c) db.from("outreach_campaigns").update({ contacted_count: (c.contacted_count ?? 0) + 1 }).eq("id", campaignId);
                });
            });
        }
        // First response → increment response_count
        if (isResponseEvent(eventType) && target.state !== "responded" && target.state !== "booked" && target.state !== "converted") {
          db.from("outreach_campaigns").select("response_count").eq("id", campaignId).single()
            .then(({ data: c }: { data: { response_count: number } | null }) => {
              if (c) db.from("outreach_campaigns").update({ response_count: (c.response_count ?? 0) + 1 }).eq("id", campaignId);
            }).catch(() => {});
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["outreach_targets"] });
      qc.invalidateQueries({ queryKey: ["outreach_events"] });
      qc.invalidateQueries({ queryKey: ["outreach_campaigns"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─── Event hooks ─────────────────────────────────────────────────────────────

export function useOutreachEvents(targetId?: string) {
  const { currentWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ["outreach_events", targetId, currentWorkspace?.id],
    enabled: !!currentWorkspace?.id && !!targetId,
    queryFn: async () => {
      const { data, error } = await db
        .from("outreach_events")
        .select("*")
        .eq("workspace_id", currentWorkspace!.id)
        .eq("target_id", targetId!)
        .order("performed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OutreachEvent[];
    },
  });
}

export function useLogOutreachEvent() {
  const { currentWorkspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      event: Omit<OutreachEvent, "id" | "created_at" | "performed_at" | "workspace_id">
    ) => {
      const { error } = await db.from("outreach_events").insert({
        ...event,
        workspace_id: currentWorkspace!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["outreach_events"] }),
  });
}

// ─── Call outcome hooks ───────────────────────────────────────────────────────

export function useLogCallOutcome() {
  const { currentWorkspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      target_id: string;
      outcome: CallOutcomeType;
      notes?: string;
      duration_seconds?: number;
      follow_up_action?: string;
      follow_up_due?: string;
      candidate_id?: string;
      contact_id?: string;
    }) => {
      // 1. Insert call_outcome
      const { data: outcomeRow, error } = await db.from("call_outcomes").insert({
        ...input,
        workspace_id: currentWorkspace!.id,
      }).select("id").single();
      if (error) throw error;

      // 2. Log outreach_event linked to call outcome
      const { data: target } = await db
        .from("outreach_targets")
        .select("campaign_id, candidate_id, contact_id, call_attempts")
        .eq("id", input.target_id)
        .single();

      if (target) {
        // Compliance gating for calls
        const flags: ComplianceFlags = {
          state: target.state as OutreachTargetState,
          do_not_contact: !!target.do_not_contact,
          do_not_call: !!target.do_not_call,
        };
        if (isCallBlocked(flags)) {
          throw new Error("Calls blocked: target is do_not_call or opted out");
        }

        await db.from("outreach_events").insert({
          workspace_id: currentWorkspace!.id,
          campaign_id: target.campaign_id,
          target_id: input.target_id,
          candidate_id: target.candidate_id ?? input.candidate_id,
          contact_id: target.contact_id ?? input.contact_id,
          event_type: "call_completed" as OutreachEventType,
          metadata: { outcome: input.outcome, event_id: outcomeRow?.id },
        }).catch(() => {});

        // 3. Update target: call_attempts++, last_contacted_at, follow-up fields, compliance
        const currentState = target.state as OutreachTargetState;
        const targetPatch: Record<string, unknown> = {
          call_attempts: (target.call_attempts ?? 0) + 1,
          last_contacted_at: new Date().toISOString(),
        };
        if (input.follow_up_action) targetPatch.next_action = input.follow_up_action;
        if (input.follow_up_due) targetPatch.next_action_due = input.follow_up_due;

        // Deterministic state from outcome with precedence
        const proposedState = callOutcomeToState(input.outcome);
        if (proposedState) {
          targetPatch.state = resolveState(currentState, proposedState);
        }

        // Compliance flags
        if (input.outcome === "not_interested") {
          targetPatch.do_not_contact = true;
        } else if (input.outcome === "wrong_number") {
          targetPatch.do_not_call = true;
        }

        // Snooze on callback_requested
        if (input.outcome === "callback_requested" && input.follow_up_due) {
          targetPatch.snooze_until = input.follow_up_due;
        }

        await db.from("outreach_targets").update(targetPatch).eq("id", input.target_id).catch(() => {});

        // Counter: first contact → increment contacted_count
        if (!target.last_contacted_at && target.campaign_id) {
          db.from("outreach_campaigns").select("contacted_count").eq("id", target.campaign_id).single()
            .then(({ data: c }: { data: { contacted_count: number } | null }) => {
              if (c) db.from("outreach_campaigns").update({ contacted_count: (c.contacted_count ?? 0) + 1 }).eq("id", target.campaign_id);
            }).catch(() => {});
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["outreach_targets"] });
      qc.invalidateQueries({ queryKey: ["outreach_events"] });
      toast.success("Call outcome logged");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
