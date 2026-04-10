import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CrmDeal } from "@/types/crm";

const TABLE = "crm_deals";
function fromTable() { return supabase.from(TABLE as any); }

export type CrmDealWithRelations = CrmDeal & {
  crm_companies: { id: string; name: string } | null;
  crm_opportunities: { id: string; title: string } | null;
  crm_contacts: { id: string; first_name: string; last_name: string } | null;
};

export function useCrmDeals(filters?: {
  search?: string;
  company_id?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: ["crm_deals", filters],
    queryFn: async () => {
      let q = fromTable()
        .select("*, crm_companies(id, name), crm_opportunities(id, title), crm_contacts(id, first_name, last_name)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (filters?.search) q = q.or(`title.ilike.%${filters.search}%`);
      if (filters?.company_id) q = q.eq("company_id", filters.company_id);
      if (filters?.status) q = q.eq("status", filters.status);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as CrmDealWithRelations[];
    },
  });
}

export function useCrmDeal(id: string | undefined) {
  return useQuery({
    queryKey: ["crm_deals", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await fromTable()
        .select("*, crm_companies(id, name), crm_opportunities(id, title), crm_contacts(id, first_name, last_name)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as unknown as CrmDealWithRelations;
    },
    enabled: !!id,
  });
}

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm_deals"] });
      qc.invalidateQueries({ queryKey: ["crm_opportunities"] });
      qc.invalidateQueries({ queryKey: ["deals"] });
      qc.invalidateQueries({ queryKey: ["all-crm-deals"] });
    },
  });
}

export function useUpdateCrmDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<CrmDeal>) => {
      const { data, error } = await fromTable()
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CrmDeal;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm_deals"] }),
  });
}

export const DEAL_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  complete: "Complete",
  cancelled: "Cancelled",
};

export const DEAL_STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  complete: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export const PAYMENT_TERMS = ["30 days", "60 days", "monthly", "milestone", "upfront"];
