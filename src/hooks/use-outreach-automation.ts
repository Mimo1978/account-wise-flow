import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface AutomationSettings {
  id: string;
  campaign_id: string;
  workspace_id: string;
  ai_response_processing_enabled: boolean;
  auto_classify_responses: boolean;
  auto_log_feedback: boolean;
  auto_schedule_meetings: boolean;
  auto_schedule_callbacks: boolean;
  preferred_calendar_connection_id?: string;
  meeting_buffer_minutes: number;
  default_meeting_duration: number;
  scheduling_window_days: number;
  ai_acknowledge_responses: boolean;
  ai_send_confirmations: boolean;
  require_human_approval: boolean;
}

export interface CalendarConnection {
  id: string;
  workspace_id: string;
  user_id: string;
  provider: "google" | "microsoft";
  provider_account_email?: string;
  is_active: boolean;
  auto_schedule_enabled: boolean;
  calendar_id: string;
}

export interface InboundResponse {
  id: string;
  workspace_id: string;
  campaign_id?: string;
  target_id?: string;
  candidate_id?: string;
  contact_id?: string;
  channel: string;
  raw_content: string;
  sender_identifier?: string;
  received_at: string;
  ai_intent?: string;
  ai_sentiment?: string;
  ai_summary?: string;
  ai_confidence?: number;
  follow_up_type?: string;
  follow_up_status?: string;
  status: string;
}

export interface ScheduledAction {
  id: string;
  workspace_id: string;
  campaign_id?: string;
  target_id?: string;
  action_type: string;
  scheduled_for: string;
  status: string;
  requires_approval: boolean;
  meeting_title?: string;
  meeting_duration_minutes?: number;
  meeting_notes?: string;
}

// ── Automation Settings ──

export function useAutomationSettings(campaignId?: string) {
  const { currentWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ["automation-settings", campaignId],
    enabled: !!currentWorkspace?.id && !!campaignId,
    queryFn: async () => {
      const { data, error } = await db
        .from("outreach_automation_settings")
        .select("*")
        .eq("campaign_id", campaignId!)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return (data ?? null) as AutomationSettings | null;
    },
  });
}

export function useUpsertAutomationSettings() {
  const { currentWorkspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<AutomationSettings> & { campaign_id: string }) => {
      const { data: existing } = await db
        .from("outreach_automation_settings")
        .select("id")
        .eq("campaign_id", input.campaign_id)
        .single();

      if (existing) {
        const { data, error } = await db
          .from("outreach_automation_settings")
          .update(input)
          .eq("campaign_id", input.campaign_id)
          .select()
          .single();
        if (error) throw error;
        return data as AutomationSettings;
      } else {
        const { data, error } = await db
          .from("outreach_automation_settings")
          .insert({ ...input, workspace_id: currentWorkspace!.id })
          .select()
          .single();
        if (error) throw error;
        return data as AutomationSettings;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["automation-settings", vars.campaign_id] });
      toast.success("Automation settings saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Calendar Connections ──

export function useCalendarConnections() {
  const { currentWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ["calendar-connections", currentWorkspace?.id],
    enabled: !!currentWorkspace?.id,
    queryFn: async () => {
      const { data, error } = await db
        .from("calendar_connections")
        .select("*")
        .eq("workspace_id", currentWorkspace!.id)
        .eq("is_active", true);
      if (error) throw error;
      return (data ?? []) as CalendarConnection[];
    },
  });
}

// ── Inbound Responses ──

export function useInboundResponses(campaignId?: string) {
  const { currentWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ["inbound-responses", currentWorkspace?.id, campaignId],
    enabled: !!currentWorkspace?.id,
    queryFn: async () => {
      let q = db
        .from("outreach_inbound_responses")
        .select("*")
        .eq("workspace_id", currentWorkspace!.id)
        .order("received_at", { ascending: false })
        .limit(100);
      if (campaignId) q = q.eq("campaign_id", campaignId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as InboundResponse[];
    },
  });
}

// ── Scheduled Actions ──

export function useScheduledActions(campaignId?: string) {
  const { currentWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ["scheduled-actions", currentWorkspace?.id, campaignId],
    enabled: !!currentWorkspace?.id,
    queryFn: async () => {
      let q = db
        .from("outreach_scheduled_actions")
        .select("*")
        .eq("workspace_id", currentWorkspace!.id)
        .order("scheduled_for", { ascending: true });
      if (campaignId) q = q.eq("campaign_id", campaignId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ScheduledAction[];
    },
  });
}

export function useApproveScheduledAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (actionId: string) => {
      const { error } = await db
        .from("outreach_scheduled_actions")
        .update({ status: "approved", approved_at: new Date().toISOString() })
        .eq("id", actionId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduled-actions"] });
      toast.success("Action approved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCancelScheduledAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (actionId: string) => {
      const { error } = await db
        .from("outreach_scheduled_actions")
        .update({ status: "cancelled" })
        .eq("id", actionId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduled-actions"] });
      toast.success("Action cancelled");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Process inbound response via edge function ──

export function useProcessInboundResponse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      workspace_id: string;
      campaign_id?: string;
      target_id?: string;
      candidate_id?: string;
      contact_id?: string;
      channel: "email" | "sms" | "voicemail" | "other";
      raw_content: string;
      sender_identifier?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("ai-response-processor", {
        body: payload,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inbound-responses"] });
      qc.invalidateQueries({ queryKey: ["outreach_targets"] });
      qc.invalidateQueries({ queryKey: ["scheduled-actions"] });
      toast.success("Response processed by AI");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
