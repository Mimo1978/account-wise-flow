import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Invoice {
  id: string;
  workspace_id: string;
  company_id: string;
  engagement_id: string | null;
  invoice_number: string | null;
  status: string;
  amount: number;
  currency: string;
  issued_date: string | null;
  due_date: string | null;
  paid_date: string | null;
  notes: string | null;
  document_id: string | null;
  created_at: string;
  updated_at: string;
  companies?: { name: string } | null;
  engagements?: { name: string } | null;
}

export interface InvoiceFilters {
  status?: string;
  company_id?: string;
}

export function useInvoices(workspaceId: string | undefined, filters?: InvoiceFilters) {
  return useQuery({
    queryKey: ['invoices', workspaceId, filters],
    queryFn: async () => {
      if (!workspaceId) return [];
      let query = supabase
        .from('invoices')
        .select('*, companies(name), engagements(name)')
        .eq('workspace_id', workspaceId)
        .order('updated_at', { ascending: false });

      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.company_id) query = query.eq('company_id', filters.company_id);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Invoice[];
    },
    enabled: !!workspaceId,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      company_id: string;
      deal_id?: string | null;
      project_id?: string | null;
      invoice_number?: string | null;
      status?: string;
      subtotal?: number;
      vat_rate?: number;
      vat_amount?: number;
      total?: number;
      currency?: string;
      issue_date?: string | null;
      due_date?: string | null;
      notes?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('crm_invoices' as any)
        .insert(input as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm_invoices'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Omit<Invoice, 'id' | 'workspace_id' | 'created_at' | 'updated_at' | 'companies' | 'engagements'>>) => {
      const { data, error } = await supabase
        .from('invoices')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}
