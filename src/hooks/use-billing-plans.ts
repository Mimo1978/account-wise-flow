import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BillingPlan {
  id: string;
  workspace_id: string;
  engagement_id: string;
  company_id: string;
  plan_name: string;
  plan_type: string;
  status: string;
  frequency: string;
  currency: string;
  billing_mode: string;
  fixed_amount: number | null;
  day_rate: number | null;
  included_days: number | null;
  estimated_days: number | null;
  vat_rate: number | null;
  po_number: string | null;
  invoice_day_of_month: number | null;
  next_run_date: string | null;
  last_run_at: string | null;
  end_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  engagements?: { name: string } | null;
  companies?: { name: string } | null;
}

export function useBillingPlans(workspaceId: string | undefined, engagementId?: string) {
  return useQuery({
    queryKey: ['billing-plans', workspaceId, engagementId],
    queryFn: async () => {
      if (!workspaceId) return [];
      let query = supabase
        .from('billing_plans' as any)
        .select('*, engagements(name), companies(name)')
        .eq('workspace_id', workspaceId)
        .order('updated_at', { ascending: false });

      if (engagementId) query = query.eq('engagement_id', engagementId);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as BillingPlan[];
    },
    enabled: !!workspaceId,
  });
}

export function useCreateBillingPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      workspace_id: string;
      engagement_id: string;
      company_id: string;
      plan_name: string;
      plan_type?: string;
      status?: string;
      frequency?: string;
      currency?: string;
      billing_mode?: string;
      fixed_amount?: number | null;
      day_rate?: number | null;
      included_days?: number | null;
      estimated_days?: number | null;
      vat_rate?: number | null;
      po_number?: string | null;
      invoice_day_of_month?: number | null;
      next_run_date?: string | null;
      end_date?: string | null;
      notes?: string | null;
      created_by?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('billing_plans' as any)
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing-plans'] });
    },
  });
}

export function useUpdateBillingPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Omit<BillingPlan, 'id' | 'workspace_id' | 'created_at' | 'updated_at' | 'engagements' | 'companies'>>) => {
      const { data, error } = await supabase
        .from('billing_plans' as any)
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing-plans'] });
    },
  });
}

export function useDeleteBillingPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('billing_plans' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing-plans'] });
    },
  });
}
