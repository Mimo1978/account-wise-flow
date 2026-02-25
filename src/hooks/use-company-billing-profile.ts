import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CompanyBillingProfile {
  id: string;
  workspace_id: string;
  company_id: string;
  billing_email: string | null;
  billing_contact_id: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_postcode: string | null;
  billing_country: string | null;
  vat_number: string | null;
  po_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useCompanyBillingProfile(workspaceId: string | undefined, companyId: string | undefined) {
  return useQuery({
    queryKey: ['company-billing-profile', workspaceId, companyId],
    queryFn: async () => {
      if (!workspaceId || !companyId) return null;
      const { data, error } = await supabase
        .from('company_billing_profiles' as any)
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('company_id', companyId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as CompanyBillingProfile | null;
    },
    enabled: !!workspaceId && !!companyId,
  });
}

export function useUpsertCompanyBillingProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<CompanyBillingProfile> & { workspace_id: string; company_id: string }) => {
      const { data: existing } = await supabase
        .from('company_billing_profiles' as any)
        .select('id')
        .eq('workspace_id', input.workspace_id)
        .eq('company_id', input.company_id)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('company_billing_profiles' as any)
          .update(input)
          .eq('workspace_id', input.workspace_id)
          .eq('company_id', input.company_id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('company_billing_profiles' as any)
          .insert(input)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-billing-profile'] });
    },
  });
}
