import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CrmDeal } from "@/types/crm";

const TABLE = "crm_deals";
function fromTable() { return supabase.from(TABLE as any); }

export function useCreateCrmDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<CrmDeal>) => {
      const { data, error } = await fromTable()
        .insert(input as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CrmDeal;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm_deals"] }),
  });
}
