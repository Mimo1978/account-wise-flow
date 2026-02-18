import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

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
  | "converted";
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
      const rows = targets.map((t) => ({
        ...t,
        workspace_id: currentWorkspace!.id,
        state: "queued" as OutreachTargetState,
      }));
      const { data, error } = await db
        .from("outreach_targets")
        .insert(rows)
        .select();
      if (error) throw error;
      return data as OutreachTarget[];
    },
    onSuccess: (data: OutreachTarget[]) => {
      qc.invalidateQueries({ queryKey: ["outreach_targets"] });
      toast.success(`${data.length} target${data.length > 1 ? "s" : ""} added`);
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
        .select("campaign_id, candidate_id, contact_id")
        .eq("id", targetId)
        .single();

      const patch: Record<string, unknown> = {
        state,
        last_contacted_at: new Date().toISOString(),
      };
      if (snoozeUntil) patch.snooze_until = snoozeUntil;
      if (optOutReason) patch.opt_out_reason = optOutReason;

      const { error: updateError } = await db
        .from("outreach_targets")
        .update(patch)
        .eq("id", targetId);
      if (updateError) throw updateError;

      const { error: eventError } = await db.from("outreach_events").insert({
        workspace_id: currentWorkspace!.id,
        campaign_id: target?.campaign_id,
        target_id: targetId,
        candidate_id: target?.candidate_id,
        contact_id: target?.contact_id,
        event_type: eventType,
        metadata,
      });
      if (eventError) throw eventError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["outreach_targets"] });
      qc.invalidateQueries({ queryKey: ["outreach_events"] });
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
      const { error } = await db.from("call_outcomes").insert({
        ...input,
        workspace_id: currentWorkspace!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["outreach_targets"] });
      toast.success("Call outcome logged");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
