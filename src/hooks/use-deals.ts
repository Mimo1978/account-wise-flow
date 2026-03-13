import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Deal {
  id: string;
  workspace_id: string | null;
  company_id: string | null;
  engagement_id: string | null;
  title: string;
  /** @deprecated Use title instead */
  name: string;
  stage: string;
  owner_id: string | null;
  value: number;
  currency: string;
  probability: number;
  expected_close_date: string | null;
  next_step: string | null;
  next_step_due: string | null;
  created_at: string;
  updated_at: string;
  companies?: { name: string } | null;
  crm_companies?: { id: string; name: string } | null;
  engagements?: { name: string } | null;
  contact_id?: string | null;
  project_id?: string | null;
  status?: string;
  notes?: string | null;
}

export const DEAL_STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] as const;

export const DEAL_STAGE_LABELS: Record<string, string> = {
  lead: 'Lead',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

export function useDeals(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['deals', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from('crm_deals')
        .select('*, crm_companies(id, name)')
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((d: any) => ({
        ...d,
        name: d.title, // backward compat
        companies: d.crm_companies, // backward compat
      })) as Deal[];
    },
    enabled: !!workspaceId,
  });
}

export function useCreateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      workspace_id: string;
      company_id?: string;
      title: string;
      stage?: string;
      value?: number;
      probability?: number;
      expected_close_date?: string | null;
      next_step?: string | null;
      next_step_due?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('crm_deals')
        .insert(input as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] });
      qc.invalidateQueries({ queryKey: ['all-crm-deals'] });
    },
  });
}

export function useUpdateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Record<string, any>) => {
      const { data, error } = await supabase
        .from('crm_deals')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] });
      qc.invalidateQueries({ queryKey: ['all-crm-deals'] });
      qc.invalidateQueries({ queryKey: ['company-deals'] });
    },
  });
}

export function useDeleteDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crm_deals')
        .update({ deleted_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] });
      qc.invalidateQueries({ queryKey: ['all-crm-deals'] });
    },
  });
}
