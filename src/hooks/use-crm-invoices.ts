import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { CrmInvoice } from "@/types/crm";

const TABLE = "crm_invoices";
function fromTable() { return supabase.from(TABLE as any); }

export type CrmInvoiceWithRelations = CrmInvoice & {
  crm_companies: { id: string; name: string } | null;
  crm_deals: { id: string; title: string } | null;
};

export function useCrmInvoices(filters?: {
  search?: string;
  company_id?: string;
  status?: string;
  deal_id?: string;
}) {
  return useQuery({
    queryKey: ["crm_invoices", filters],
    queryFn: async () => {
      let q = fromTable()
        .select("*, crm_companies(id, name), crm_deals(id, title)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (filters?.search) q = q.or(`invoice_number.ilike.%${filters.search}%`);
      if (filters?.company_id) q = q.eq("company_id", filters.company_id);
      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.deal_id) q = q.eq("deal_id", filters.deal_id);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as CrmInvoiceWithRelations[];
    },
  });
}

export function useCrmInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ["crm_invoices", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await fromTable()
        .select("*, crm_companies(id, name), crm_deals(id, title, payment_terms, currency)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as unknown as CrmInvoiceWithRelations & {
        crm_deals: { id: string; title: string; payment_terms: string | null; currency: string } | null;
      };
    },
    enabled: !!id,
  });
}

export function useCreateCrmInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<CrmInvoice>) => {
      const { data, error } = await fromTable()
        .insert(input as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CrmInvoice;
    },
    onSuccess: () => {
      toast.success("Invoice created");
      qc.invalidateQueries({ queryKey: ["crm_invoices"] });
    },
  });
}

export function useUpdateCrmInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<CrmInvoice>) => {
      const { data, error } = await fromTable()
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CrmInvoice;
    },
    onSuccess: () => {
      toast.success("Invoice updated");
      qc.invalidateQueries({ queryKey: ["crm_invoices"] });
    },
  });
}

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

export const INVOICE_STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  cancelled: "bg-muted text-muted-foreground line-through",
};

/** Compute display status: if sent and past due, show overdue */
export function getDisplayStatus(invoice: CrmInvoice): string {
  if (invoice.status === "sent" && invoice.due_date) {
    const due = new Date(invoice.due_date);
    due.setHours(23, 59, 59, 999);
    if (due < new Date()) return "overdue";
  }
  return invoice.status;
}

export const VAT_RATES = [
  { label: "0%", value: 0 },
  { label: "5%", value: 5 },
  { label: "20%", value: 20 },
];

/** Get signed download URL for CRM invoice file */
export async function getCrmInvoiceSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("crm-invoices")
    .createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}
