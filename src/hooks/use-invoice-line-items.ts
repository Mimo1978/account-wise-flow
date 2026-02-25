import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface InvoiceLineItem {
  id: string;
  workspace_id: string;
  invoice_id: string;
  sort_order: number;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
}

export function useInvoiceLineItems(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ['invoice-line-items', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return [];
      const { data, error } = await supabase
        .from('invoice_line_items' as any)
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as InvoiceLineItem[];
    },
    enabled: !!invoiceId,
  });
}

export function useCreateInvoiceLineItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      workspace_id: string;
      invoice_id: string;
      sort_order?: number;
      description: string;
      quantity: number;
      unit_price: number;
      line_total: number;
    }) => {
      const { data, error } = await supabase
        .from('invoice_line_items' as any)
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['invoice-line-items', vars.invoice_id] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useDeleteInvoiceLineItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, invoiceId }: { id: string; invoiceId: string }) => {
      const { error } = await supabase
        .from('invoice_line_items' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
      return invoiceId;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['invoice-line-items', vars.invoiceId] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}
