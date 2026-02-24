import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Sow {
  id: string;
  workspace_id: string;
  company_id: string;
  engagement_id: string | null;
  sow_ref: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  renewal_date: string | null;
  value: number;
  currency: string;
  billing_model: string;
  notes: string | null;
  document_id: string | null;
  created_at: string;
  updated_at: string;
  companies?: { name: string } | null;
  engagements?: { name: string } | null;
}

export interface SowFilters {
  status?: string;
  company_id?: string;
}

export function useSows(workspaceId: string | undefined, filters?: SowFilters) {
  return useQuery({
    queryKey: ['sows', workspaceId, filters],
    queryFn: async () => {
      if (!workspaceId) return [];
      let query = supabase
        .from('sows')
        .select('*, companies(name), engagements(name)')
        .eq('workspace_id', workspaceId)
        .order('updated_at', { ascending: false });

      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.company_id) query = query.eq('company_id', filters.company_id);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Sow[];
    },
    enabled: !!workspaceId,
  });
}

export function useCreateSow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      workspace_id: string;
      company_id: string;
      engagement_id?: string | null;
      sow_ref?: string | null;
      status?: string;
      start_date?: string | null;
      end_date?: string | null;
      renewal_date?: string | null;
      value?: number;
      currency?: string;
      billing_model?: string;
      notes?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('sows')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sows'] });
    },
  });
}

export function useUpdateSow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Omit<Sow, 'id' | 'workspace_id' | 'created_at' | 'updated_at' | 'companies' | 'engagements'>>) => {
      const { data, error } = await supabase
        .from('sows')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sows'] });
    },
  });
}
