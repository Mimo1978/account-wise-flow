import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CrmDocument } from "@/types/crm";

const TABLE = "crm_documents";
function fromTable() { return supabase.from(TABLE as any); }

export type CrmDocumentWithRelations = CrmDocument & {
  crm_companies: { id: string; name: string } | null;
  crm_deals: { id: string; title: string } | null;
};

export function useCrmDocuments(filters?: {
  deal_id?: string;
  company_id?: string;
  type?: string;
  status?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ["crm_documents", filters],
    queryFn: async () => {
      let q = fromTable()
        .select("*, crm_companies(id, name), crm_deals(id, title)")
        .order("created_at", { ascending: false });

      if (filters?.deal_id) q = q.eq("deal_id", filters.deal_id);
      if (filters?.company_id) q = q.eq("company_id", filters.company_id);
      if (filters?.type) q = q.eq("type", filters.type);
      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.search) q = q.or(`title.ilike.%${filters.search}%`);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as CrmDocumentWithRelations[];
    },
  });
}

export function useCreateCrmDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<CrmDocument>) => {
      const { data, error } = await fromTable()
        .insert(input as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CrmDocument;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm_documents"] }),
  });
}

export function useUpdateCrmDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<CrmDocument>) => {
      const { data, error } = await fromTable()
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CrmDocument;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm_documents"] }),
  });
}

export async function getSignedDocumentUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("crm-documents")
    .createSignedUrl(storagePath, 3600); // 1 hour
  if (error) { console.error("Signed URL error:", error); return null; }
  return data.signedUrl;
}

export async function uploadCrmDocument(
  file: File,
  path: string
): Promise<string> {
  const { error } = await supabase.storage
    .from("crm-documents")
    .upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

export const DOC_TYPE_LABELS: Record<string, string> = {
  sow: "SOW",
  contract: "Contract",
  proposal: "Proposal",
  nda: "NDA",
  invoice: "Invoice",
  other: "Other",
};

export const DOC_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  signed: "Signed",
  rejected: "Rejected",
};

export const DOC_STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  signed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};
