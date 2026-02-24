import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Deal {
  id: string;
  workspace_id: string;
  company_id: string;
  engagement_id: string | null;
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
  engagements?: { name: string } | null;
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
        .from('deals')
        .select('*, companies(name), engagements(name)')
        .eq('workspace_id', workspaceId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Deal[];
    },
    enabled: !!workspaceId,
  });
}

export function useCreateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      workspace_id: string;
      company_id: string;
      name: string;
      stage?: string;
      value?: number;
      probability?: number;
      expected_close_date?: string | null;
      next_step?: string | null;
      next_step_due?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('deals')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] });
    },
  });
}

export function useUpdateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Omit<Deal, 'id' | 'workspace_id' | 'created_at' | 'updated_at' | 'companies' | 'engagements'>>) => {
      const { data, error } = await supabase
        .from('deals')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] });
    },
  });
}
