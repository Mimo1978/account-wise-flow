import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WorkspaceBillingSettings {
  id: string;
  workspace_id: string;
  legal_name: string | null;
  trading_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  vat_number: string | null;
  tax_label: string;
  payment_terms_days: number;
  bank_account_name: string | null;
  bank_sort_code: string | null;
  bank_account_number: string | null;
  bank_iban: string | null;
  bank_swift: string | null;
  invoice_prefix: string;
  next_invoice_number: number;
  currency: string;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export function useBillingSettings(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['billing-settings', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      const { data, error } = await supabase
        .from('workspace_billing_settings' as any)
        .select('*')
        .eq('workspace_id', workspaceId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as WorkspaceBillingSettings | null;
    },
    enabled: !!workspaceId,
  });
}

export function useUpsertBillingSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<WorkspaceBillingSettings> & { workspace_id: string }) => {
      const { data: existing } = await supabase
        .from('workspace_billing_settings' as any)
        .select('id')
        .eq('workspace_id', input.workspace_id)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('workspace_billing_settings' as any)
          .update(input)
          .eq('workspace_id', input.workspace_id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('workspace_billing_settings' as any)
          .insert(input)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing-settings'] });
    },
  });
}
