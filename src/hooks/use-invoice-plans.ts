import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface InvoicePlan {
  id: string;
  workspace_id: string;
  company_id: string;
  engagement_id: string | null;
  sow_id: string | null;
  deal_id: string | null;
  name: string;
  plan_type: string;
  status: string;
  frequency: string;
  interval_count: number;
  invoice_day_of_month: number | null;
  invoice_day_of_week: number | null;
  start_date: string;
  end_date: string | null;
  next_run_date: string | null;
  amount_mode: string;
  fixed_amount: number | null;
  currency: string;
  rate_per_day: number | null;
  estimated_days: number | null;
  vat_rate: number | null;
  description: string | null;
  draft_auto_create: boolean;
  auto_send: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  companies?: { name: string } | null;
  engagements?: { name: string } | null;
}

export function useInvoicePlans(workspaceId: string | undefined, engagementId?: string) {
  return useQuery({
    queryKey: ['invoice-plans', workspaceId, engagementId],
    queryFn: async () => {
      if (!workspaceId) return [];
      let query = supabase
        .from('invoice_plans' as any)
        .select('*, companies(name), engagements(name)')
        .eq('workspace_id', workspaceId)
        .order('updated_at', { ascending: false });

      if (engagementId) query = query.eq('engagement_id', engagementId);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as InvoicePlan[];
    },
    enabled: !!workspaceId,
  });
}

export function useCreateInvoicePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<InvoicePlan, 'id' | 'created_at' | 'updated_at' | 'companies' | 'engagements'>) => {
      const { data, error } = await supabase
        .from('invoice_plans' as any)
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice-plans'] });
    },
  });
}

export function useUpdateInvoicePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<InvoicePlan>) => {
      const { data, error } = await supabase
        .from('invoice_plans' as any)
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice-plans'] });
    },
  });
}

export function useDeleteInvoicePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('invoice_plans' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice-plans'] });
    },
  });
}
