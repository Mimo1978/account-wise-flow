import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/use-permissions";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

export type DeletableRecordType = 
  | "crm_projects" | "crm_deals" | "crm_companies" | "crm_contacts" 
  | "crm_invoices" | "crm_documents" | "companies" | "contacts" | "jobs";

interface SoftDeleteInput {
  recordType: DeletableRecordType;
  recordId: string;
  recordName: string;
  reason: string;
}

interface DeletionRequestInput {
  recordType: DeletableRecordType;
  recordId: string;
  recordName: string;
  reason: string;
}

interface ReviewInput {
  requestId: string;
  action: "approved" | "rejected";
  notes?: string;
  recordType: DeletableRecordType;
  recordId: string;
}

interface RestoreInput {
  recordType: DeletableRecordType;
  recordId: string;
}

// Determine what deletion action the user can take
export function useDeletionPermission() {
  const { role, isAdmin, isManager, userId } = usePermissions();
  
  return {
    // Admin can delete immediately
    canDeleteDirectly: isAdmin,
    // Manager can delete own records
    canDeleteOwn: isAdmin || isManager,
    // Contributor can request deletion
    canRequestDeletion: role === 'contributor' || isManager || isAdmin,
    // Viewer cannot do anything
    canSeeDeleteOption: role !== 'viewer' && role !== null,
    // Admin can restore and purge
    canRestore: isAdmin,
    canPurge: isAdmin,
    // For reviewing requests
    canReviewRequests: isAdmin || isManager,
    role,
    userId,
  };
}

export function useSoftDelete() {
  const qc = useQueryClient();
  const { userId } = usePermissions();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async ({ recordType, recordId, recordName, reason }: SoftDeleteInput) => {
      const now = new Date().toISOString();
      const purgeAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const { error } = await supabase
        .from(recordType as any)
        .update({
          deleted_at: now,
          deleted_by: userId,
          deletion_reason: reason,
          deletion_scheduled_purge_at: purgeAt,
        } as any)
        .eq("id", recordId);

      if (error) throw error;

      // Log to audit
      if (currentWorkspace?.id) {
        await supabase.from("audit_log" as any).insert({
          workspace_id: currentWorkspace.id,
          entity_type: recordType,
          entity_id: recordId,
          action: "record_deleted",
          changed_by: userId,
          diff: { record_name: recordName, reason, scheduled_purge_at: purgeAt },
          context: { source: "deletion_system" },
        } as any);
      }

      return { recordId, recordType };
    },
    onSuccess: (_, vars) => {
      toast.success(`${vars.recordName} has been deleted. Recoverable for 30 days.`);
      qc.invalidateQueries({ queryKey: [vars.recordType] });
      qc.invalidateQueries({ queryKey: ["deletion_requests"] });
      qc.invalidateQueries({ queryKey: ["recycle_bin"] });
    },
    onError: (err: any) => {
      toast.error("Failed to delete: " + (err.message || "Unknown error"));
    },
  });
}

export function useRequestDeletion() {
  const qc = useQueryClient();
  const { userId } = usePermissions();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async ({ recordType, recordId, recordName, reason }: DeletionRequestInput) => {
      const { error } = await supabase.from("deletion_requests" as any).insert({
        workspace_id: currentWorkspace?.id,
        record_type: recordType,
        record_id: recordId,
        record_name: recordName,
        requested_by: userId,
        reason,
        status: "pending",
      } as any);

      if (error) throw error;

      // Notify admins/managers
      if (currentWorkspace?.id) {
        const { data: adminRoles } = await supabase
          .from("user_roles" as any)
          .select("user_id")
          .eq("team_id", currentWorkspace.id)
          .in("role", ["admin", "manager"]);

        if (adminRoles?.length) {
          const notifications = adminRoles
            .filter((r: any) => r.user_id !== userId)
            .map((r: any) => ({
              workspace_id: currentWorkspace.id,
              user_id: r.user_id,
              type: "deletion_request",
              title: `Deletion requested: ${recordName}`,
              body: reason,
              link: "/admin/governance",
            }));

          if (notifications.length > 0) {
            await supabase.from("notifications" as any).insert(notifications as any);
          }
        }

        // Audit log
        await supabase.from("audit_log" as any).insert({
          workspace_id: currentWorkspace.id,
          entity_type: recordType,
          entity_id: recordId,
          action: "deletion_requested",
          changed_by: userId,
          diff: { record_name: recordName, reason },
          context: { source: "deletion_system" },
        } as any);
      }
    },
    onSuccess: () => {
      toast.success("Deletion request submitted for review.");
      qc.invalidateQueries({ queryKey: ["deletion_requests"] });
    },
    onError: (err: any) => {
      toast.error("Failed to submit request: " + (err.message || "Unknown error"));
    },
  });
}

export function useReviewDeletionRequest() {
  const qc = useQueryClient();
  const { userId } = usePermissions();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async ({ requestId, action, notes, recordType, recordId }: ReviewInput) => {
      const now = new Date().toISOString();

      const { error: reqErr } = await supabase
        .from("deletion_requests" as any)
        .update({
          status: action,
          reviewed_by: userId,
          reviewed_at: now,
          review_notes: notes || null,
          ...(action === "approved"
            ? { scheduled_purge_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() }
            : {}),
        } as any)
        .eq("id", requestId);

      if (reqErr) throw reqErr;

      if (action === "approved") {
        const purgeAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const { error: delErr } = await supabase
          .from(recordType as any)
          .update({
            deleted_at: now,
            deleted_by: userId,
            deletion_scheduled_purge_at: purgeAt,
          } as any)
          .eq("id", recordId);

        if (delErr) throw delErr;
      }

      // Audit
      if (currentWorkspace?.id) {
        await supabase.from("audit_log" as any).insert({
          workspace_id: currentWorkspace.id,
          entity_type: recordType,
          entity_id: recordId,
          action: action === "approved" ? "deletion_approved" : "deletion_rejected",
          changed_by: userId,
          diff: { notes },
          context: { source: "deletion_system" },
        } as any);
      }
    },
    onSuccess: (_, vars) => {
      toast.success(`Request ${vars.action}.`);
      qc.invalidateQueries({ queryKey: ["deletion_requests"] });
      qc.invalidateQueries({ queryKey: [vars.recordType] });
      qc.invalidateQueries({ queryKey: ["recycle_bin"] });
    },
    onError: (err: any) => {
      toast.error("Failed: " + (err.message || "Unknown error"));
    },
  });
}

export function useRestoreRecord() {
  const qc = useQueryClient();
  const { userId } = usePermissions();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async ({ recordType, recordId }: RestoreInput) => {
      const { error } = await supabase
        .from(recordType as any)
        .update({
          deleted_at: null,
          deleted_by: null,
          deletion_reason: null,
          deletion_scheduled_purge_at: null,
        } as any)
        .eq("id", recordId);

      if (error) throw error;

      if (currentWorkspace?.id) {
        await supabase.from("audit_log" as any).insert({
          workspace_id: currentWorkspace.id,
          entity_type: recordType,
          entity_id: recordId,
          action: "record_restored",
          changed_by: userId,
          diff: {},
          context: { source: "deletion_system" },
        } as any);
      }
    },
    onSuccess: (_, vars) => {
      toast.success("Record restored successfully.");
      qc.invalidateQueries({ queryKey: [vars.recordType] });
      qc.invalidateQueries({ queryKey: ["recycle_bin"] });
    },
    onError: (err: any) => {
      toast.error("Restore failed: " + (err.message || "Unknown error"));
    },
  });
}

export function usePurgeRecord() {
  const qc = useQueryClient();
  const { userId } = usePermissions();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async ({ recordType, recordId }: RestoreInput) => {
      const { error } = await supabase.from(recordType as any).delete().eq("id", recordId);
      if (error) throw error;

      if (currentWorkspace?.id) {
        await supabase.from("audit_log" as any).insert({
          workspace_id: currentWorkspace.id,
          entity_type: recordType,
          entity_id: recordId,
          action: "record_purged",
          changed_by: userId,
          diff: {},
          context: { source: "deletion_system" },
        } as any);
      }
    },
    onSuccess: (_, vars) => {
      toast.success("Record permanently purged.");
      qc.invalidateQueries({ queryKey: [vars.recordType] });
      qc.invalidateQueries({ queryKey: ["recycle_bin"] });
    },
    onError: (err: any) => {
      toast.error("Purge failed: " + (err.message || "Unknown error"));
    },
  });
}

export function useDeletionRequests(workspaceId?: string) {
  return useQuery({
    queryKey: ["deletion_requests", workspaceId],
    queryFn: async () => {
      let q = supabase
        .from("deletion_requests" as any)
        .select("*")
        .order("requested_at", { ascending: false });

      if (workspaceId) q = q.eq("workspace_id", workspaceId);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!workspaceId,
  });
}

export function useRecycleBin(workspaceId?: string) {
  return useQuery({
    queryKey: ["recycle_bin", workspaceId],
    queryFn: async () => {
      const tables: DeletableRecordType[] = [
        "crm_projects", "crm_deals", "crm_companies", "crm_contacts",
        "crm_invoices", "companies", "contacts", "jobs",
      ];

      const results: any[] = [];

      for (const table of tables) {
        const nameCol = table === "crm_contacts" ? "first_name" : "name";
        const selectCols = table === "crm_contacts"
          ? "id, first_name, last_name, deleted_at, deleted_by, deletion_reason, deletion_scheduled_purge_at"
          : "id, name, deleted_at, deleted_by, deletion_reason, deletion_scheduled_purge_at";

        // Use title for deals
        const actualSelect = table === "crm_deals"
          ? "id, title, deleted_at, deleted_by, deletion_reason, deletion_scheduled_purge_at"
          : selectCols;

        const { data } = await supabase
          .from(table as any)
          .select(actualSelect)
          .not("deleted_at", "is", null)
          .order("deleted_at", { ascending: false })
          .limit(100);

        if (data) {
          results.push(
            ...data.map((r: any) => ({
              ...r,
              record_type: table,
              display_name: r.name || r.title || `${r.first_name || ""} ${r.last_name || ""}`.trim() || "Untitled",
            }))
          );
        }
      }

      return results.sort(
        (a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime()
      );
    },
    enabled: !!workspaceId,
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications" as any)
        .select("*")
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("notifications" as any).update({ read: true } as any).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
