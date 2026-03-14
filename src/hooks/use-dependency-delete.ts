import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/use-permissions";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";
import type { DeletableRecordType } from "@/hooks/use-deletion";

interface DeleteInput {
  recordType: DeletableRecordType;
  recordId: string;
  recordName: string;
}

const RELATED_QUERY_KEYS: Record<string, string[][]> = {
  companies: [["companies"], ["crm_companies"], ["crm-company-sync"]],
  crm_companies: [["crm_companies"], ["companies"], ["crm-company-sync"]],
  contacts: [["contacts"], ["all-contacts"], ["crm_contacts"], ["company-contacts"]],
  crm_contacts: [["crm_contacts"], ["contacts"], ["all-contacts"], ["company-contacts"]],
  crm_deals: [["crm_deals"], ["deals"], ["company-deals"]],
  crm_projects: [["crm_projects"], ["company-projects"]],
  crm_invoices: [["crm_invoices"], ["company-invoices"]],
  engagements: [["engagements"]],
  jobs: [["jobs"]],
  crm_documents: [["crm_documents"]],
};

function invalidateRelated(qc: ReturnType<typeof useQueryClient>, recordType: string) {
  const keys = RELATED_QUERY_KEYS[recordType] || [[recordType]];
  keys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
  qc.invalidateQueries({ queryKey: ["deletion_requests"] });
  qc.invalidateQueries({ queryKey: ["recycle_bin"] });
  qc.invalidateQueries({ queryKey: ["dependency-check"] });
}

async function unlinkCompanyDeps(recordId: string) {
  const unlinked: string[] = [];

  // Unlink native contacts
  await (supabase
    .from("contacts" as any)
    .update({ company_id: null } as any) as any)
    .eq("company_id", recordId);
  unlinked.push("contacts");

  // Find crm_companies ID by name for CRM table unlinking
  const { data: company } = await (supabase
    .from("companies" as any)
    .select("name") as any)
    .eq("id", recordId)
    .maybeSingle();

  const companyName = (company as any)?.name;
  if (companyName) {
    const { data: crmMatch } = await (supabase
      .from("crm_companies" as any)
      .select("id") as any)
      .eq("name", companyName)
      .limit(1)
      .maybeSingle();

    const crmId = (crmMatch as any)?.id;
    if (crmId) {
      // Unlink CRM contacts
      await (supabase
        .from("crm_contacts" as any)
        .update({ company_id: null } as any) as any)
        .eq("company_id", crmId);

      // Unlink closed deals only
      await (supabase
        .from("crm_deals" as any)
        .update({ company_id: null } as any) as any)
        .eq("company_id", crmId)
        .in("stage", ["won", "lost"]);
      unlinked.push("closed_deals");

      // Unlink paid/void invoices
      await (supabase
        .from("crm_invoices" as any)
        .update({ company_id: null } as any) as any)
        .eq("company_id", crmId)
        .in("status", ["paid", "void", "cancelled"]);
      unlinked.push("paid_invoices");

      // Unlink documents
      await (supabase
        .from("crm_documents" as any)
        .update({ company_id: null } as any) as any)
        .eq("company_id", crmId);
      unlinked.push("documents");

      // Delete the CRM mirror record
      await supabase.from("crm_companies" as any).delete().eq("id", crmId);
    }
  }

  // Unlink engagements
  await (supabase
    .from("engagements" as any)
    .update({ company_id: null } as any) as any)
    .eq("company_id", recordId);
  unlinked.push("projects");

  return unlinked;
}

async function unlinkContactDeps(recordId: string) {
  const unlinked: string[] = [];

  await (supabase
    .from("crm_deals" as any)
    .update({ contact_id: null } as any) as any)
    .eq("contact_id", recordId);
  unlinked.push("deals");

  return unlinked;
}

async function unlinkDealDeps(recordId: string) {
  const unlinked: string[] = [];

  await (supabase
    .from("crm_documents" as any)
    .update({ deal_id: null } as any) as any)
    .eq("deal_id", recordId);
  unlinked.push("documents");

  return unlinked;
}

async function unlinkProjectDeps(recordId: string) {
  const unlinked: string[] = [];

  await (supabase
    .from("invoices" as any)
    .update({ engagement_id: null } as any) as any)
    .eq("engagement_id", recordId)
    .in("status", ["paid", "void", "cancelled"]);
  unlinked.push("paid_invoices");

  await (supabase
    .from("sows" as any)
    .update({ engagement_id: null } as any) as any)
    .eq("engagement_id", recordId);
  unlinked.push("sows");

  await (supabase
    .from("jobs" as any)
    .update({ engagement_id: null } as any) as any)
    .eq("engagement_id", recordId);
  unlinked.push("jobs");

  return unlinked;
}

export function useDependencyDelete() {
  const qc = useQueryClient();
  const { userId } = usePermissions();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async ({ recordType, recordId, recordName }: DeleteInput) => {
      let unlinked: string[] = [];

      // Step 1: Unlink dependencies
      switch (recordType) {
        case "companies":
        case "crm_companies":
          unlinked = await unlinkCompanyDeps(recordId);
          break;
        case "contacts":
        case "crm_contacts":
          unlinked = await unlinkContactDeps(recordId);
          break;
        case "crm_deals":
          unlinked = await unlinkDealDeps(recordId);
          break;
        case "engagements":
          unlinked = await unlinkProjectDeps(recordId);
          break;
      }

      // Step 2: Hard delete
      const { error } = await supabase
        .from(recordType as any)
        .delete()
        .eq("id", recordId);

      if (error) {
        console.error(`[DependencyDelete] Failed on ${recordType}/${recordId}:`, error);
        throw error;
      }

      // Step 3: Audit log
      if (currentWorkspace?.id) {
        await supabase.from("audit_log" as any).insert({
          workspace_id: currentWorkspace.id,
          entity_type: recordType,
          entity_id: recordId,
          action: "record_deleted",
          changed_by: userId,
          diff: {
            record_name: recordName,
            dependencies_unlinked: unlinked,
          },
          context: { source: "dependency_delete" },
        } as any);
      }

      return { recordId, recordType, recordName, unlinked };
    },
    onSuccess: (result) => {
      const unlinkedMsg =
        result.unlinked.length > 0
          ? ` (${result.unlinked.length} linked record types unlinked)`
          : "";
      toast.success(`${result.recordName} deleted.${unlinkedMsg}`);
      // Invalidate everything related
      for (const key of Object.keys(RELATED_QUERY_KEYS)) {
        invalidateRelated(qc, key);
      }
    },
    onError: (err: any) => {
      console.error("[DependencyDelete] Error:", err);
      toast.error("Failed to delete: " + (err.message || "Unknown error"));
    },
  });
}
