import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CrmActivity } from "@/types/crm";

const TABLE = "crm_activities";
function fromTable() { return supabase.from(TABLE as any); }

export function useCrmActivities(filters?: {
  company_id?: string;
  contact_id?: string;
  opportunity_id?: string;
}) {
  return useQuery({
    queryKey: ["crm_activities", filters],
    queryFn: async () => {
      let q = fromTable()
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (filters?.company_id) q = q.eq("company_id", filters.company_id);
      if (filters?.contact_id) q = q.eq("contact_id", filters.contact_id);
      if (filters?.opportunity_id) q = q.eq("opportunity_id", filters.opportunity_id);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as CrmActivity[];
    },
    enabled: !!(filters?.company_id || filters?.contact_id || filters?.opportunity_id),
  });
}

export function useCreateCrmActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<CrmActivity>) => {
      const { data, error } = await fromTable()
        .insert(input as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CrmActivity;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm_activities"] }),
  });
}
