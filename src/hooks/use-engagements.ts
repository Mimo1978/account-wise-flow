import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Engagement {
  id: string;
  workspace_id: string;
  company_id: string | null;
  name: string;
  engagement_type: string;
  stage: string;
  owner_id: string | null;
  start_date: string | null;
  end_date: string | null;
  forecast_value: number;
  currency: string;
  health: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  companies?: { name: string } | null;
}

export interface EngagementFilters {
  stage?: string;
  engagement_type?: string;
}

export function useEngagements(workspaceId: string | undefined, filters?: EngagementFilters) {
  return useQuery({
    queryKey: ['engagements', workspaceId, filters],
    queryFn: async () => {
      if (!workspaceId) return [];
      let query = supabase
        .from('engagements')
        .select('*, companies(name)')
        .eq('workspace_id', workspaceId)
        .order('updated_at', { ascending: false });

      if (filters?.stage) query = query.eq('stage', filters.stage);
      if (filters?.engagement_type) query = query.eq('engagement_type', filters.engagement_type);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Engagement[];
    },
    enabled: !!workspaceId,
  });
}

export function useCreateEngagement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      workspace_id: string;
      name: string;
      company_id?: string | null;
      engagement_type?: string;
      stage?: string;
      description?: string | null;
      forecast_value?: number;
      start_date?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('engagements')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['engagements'] });
    },
  });
}

export function useEngagement(id: string | undefined, workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['engagement', id, workspaceId],
    queryFn: async () => {
      if (!id || !workspaceId) return null;
      const { data, error } = await supabase
        .from('engagements')
        .select('*, companies(name)')
        .eq('id', id)
        .eq('workspace_id', workspaceId)
        .maybeSingle();
      if (error) throw error;
      return data as Engagement | null;
    },
    enabled: !!id && !!workspaceId,
  });
}

export function useUpdateEngagement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Omit<Engagement, 'id' | 'workspace_id' | 'created_at' | 'updated_at' | 'companies'>>) => {
      const { data, error } = await supabase
        .from('engagements')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['engagements'] });
      qc.invalidateQueries({ queryKey: ['engagement'] });
    },
  });
}
