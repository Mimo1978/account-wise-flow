import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CrmInvoiceLineItem } from "@/types/crm";

const TABLE = "crm_invoice_line_items";
function fromTable() { return supabase.from(TABLE as any); }

export function useCrmInvoiceLineItems(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ["crm_invoice_line_items", invoiceId],
    queryFn: async () => {
      if (!invoiceId) return [];
      const { data, error } = await fromTable()
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("id", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CrmInvoiceLineItem[];
    },
    enabled: !!invoiceId,
  });
}

export function useCreateCrmInvoiceLineItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<CrmInvoiceLineItem>) => {
      const { data, error } = await fromTable()
        .insert(input as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CrmInvoiceLineItem;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["crm_invoice_line_items", (vars as any).invoice_id] });
      qc.invalidateQueries({ queryKey: ["crm_invoices"] });
    },
  });
}

export function useUpdateCrmInvoiceLineItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; invoice_id?: string } & Partial<CrmInvoiceLineItem>) => {
      const { data, error } = await fromTable()
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CrmInvoiceLineItem;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm_invoice_line_items"] });
      qc.invalidateQueries({ queryKey: ["crm_invoices"] });
    },
  });
}

export function useDeleteCrmInvoiceLineItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, invoiceId }: { id: string; invoiceId: string }) => {
      const { error } = await fromTable().delete().eq("id", id);
      if (error) throw error;
      return invoiceId;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["crm_invoice_line_items", vars.invoiceId] });
      qc.invalidateQueries({ queryKey: ["crm_invoices"] });
    },
  });
}
