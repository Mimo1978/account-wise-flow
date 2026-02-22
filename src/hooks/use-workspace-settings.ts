import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';

export interface OutreachRules {
  prevent_state_downgrade: boolean;
  lock_opted_out: boolean;
  manager_can_reopen: boolean;
  treat_wrong_number_as_opt_out: boolean;
  auto_snooze_on_max_attempts: boolean;
}

export interface DataQualityRules {
  require_manager_approval_for_merge: boolean;
  auto_suggest_canonical: boolean;
  block_cross_company_merge_for_non_managers: boolean;
}

export interface WorkspaceSettings {
  id: string;
  workspace_id: string;
  short_tenure_threshold_months: number;
  gap_threshold_months: number;
  contract_hop_min_stints: number;
  contract_hop_lookback_months: number;
  top_tier_companies: Record<string, string[]>;
  outreach_rules: OutreachRules;
  data_quality_rules: DataQualityRules;
  created_at: string;
  updated_at: string;
}

export function useWorkspaceSettings() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['workspace-settings', currentWorkspace?.id],
    queryFn: async () => {
      if (!user || !currentWorkspace) return null;

      const { data, error } = await supabase
        .from('workspace_settings')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows found, which is OK for first-time setup
        throw error;
      }

      // If no settings exist, return defaults
      if (!data) {
        return {
          id: '',
          workspace_id: currentWorkspace.id,
          short_tenure_threshold_months: 9,
          gap_threshold_months: 6,
          contract_hop_min_stints: 3,
          contract_hop_lookback_months: 24,
          top_tier_companies: {},
          outreach_rules: {
            prevent_state_downgrade: true,
            lock_opted_out: true,
            manager_can_reopen: false,
            treat_wrong_number_as_opt_out: true,
            auto_snooze_on_max_attempts: true,
           },
           data_quality_rules: {
             require_manager_approval_for_merge: true,
             auto_suggest_canonical: true,
             block_cross_company_merge_for_non_managers: true,
           },
           created_at: new Date().toISOString(),
           updated_at: new Date().toISOString(),
        };
      }

      return data as unknown as WorkspaceSettings;
    },
    enabled: !!user && !!currentWorkspace,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<WorkspaceSettings>) => {
      if (!currentWorkspace) throw new Error('No workspace selected');

      // If settings don't exist, create them
      if (!settings?.id) {
        const { data, error } = await supabase
          .from('workspace_settings')
          .insert({
            workspace_id: currentWorkspace.id,
            short_tenure_threshold_months: updates.short_tenure_threshold_months ?? 9,
            gap_threshold_months: updates.gap_threshold_months ?? 6,
            contract_hop_min_stints: updates.contract_hop_min_stints ?? 3,
            contract_hop_lookback_months: updates.contract_hop_lookback_months ?? 24,
            top_tier_companies: updates.top_tier_companies ?? {},
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }

      // Otherwise update
      const { data, error } = await supabase
        .from('workspace_settings')
        .update(updates as any)
        .eq('workspace_id', currentWorkspace.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['workspace-settings', currentWorkspace?.id], data);
      toast.success('Settings saved');
    },
    onError: (error) => {
      console.error('Failed to update settings:', error);
      toast.error('Failed to save settings');
    },
  });

  return {
    settings,
    isLoading,
    error,
    updateSettings: updateSettingsMutation.mutate,
    isUpdating: updateSettingsMutation.isPending,
  };
}
