import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CrmOpportunity, CrmOpportunityStage } from "@/types/crm";

const TABLE = "crm_opportunities";
function fromTable() { return supabase.from(TABLE as any); }

export type CrmOpportunityWithRelations = CrmOpportunity & {
  crm_companies: { id: string; name: string } | null;
  crm_contacts: { id: string; first_name: string; last_name: string } | null;
  crm_projects: { id: string; name: string } | null;
};

export function useCrmOpportunities(filters?: {
  search?: string;
  company_id?: string;
  stage?: string;
  project_id?: string;
}) {
  return useQuery({
    queryKey: ["crm_opportunities", filters],
    queryFn: async () => {
      let q = fromTable()
        .select("*, crm_companies(id, name), crm_contacts(id, first_name, last_name), crm_projects(id, name)")
        .order("created_at", { ascending: false });

      if (filters?.search) {
        q = q.or(`title.ilike.%${filters.search}%`);
      }
      if (filters?.company_id) q = q.eq("company_id", filters.company_id);
      if (filters?.stage) q = q.eq("stage", filters.stage);
      if (filters?.project_id) q = q.eq("project_id", filters.project_id);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as CrmOpportunityWithRelations[];
    },
  });
}

export function useCrmOpportunity(id: string | undefined) {
  return useQuery({
    queryKey: ["crm_opportunities", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await fromTable()
        .select("*, crm_companies(id, name), crm_contacts(id, first_name, last_name), crm_projects(id, name)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as unknown as CrmOpportunityWithRelations;
    },
    enabled: !!id,
  });
}

export function useCreateCrmOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<CrmOpportunity>) => {
      const { data, error } = await fromTable()
        .insert(input as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CrmOpportunity;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm_opportunities"] }),
  });
}

export function useUpdateCrmOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<CrmOpportunity>) => {
      const { data, error } = await fromTable()
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CrmOpportunity;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm_opportunities"] }),
  });
}

export const STAGE_ORDER: CrmOpportunityStage[] = [
  "lead", "qualified", "proposal", "negotiation", "closed_won", "closed_lost",
];

export const STAGE_LABELS: Record<CrmOpportunityStage, string> = {
  lead: "Lead",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
};

export const STAGE_PROBABILITY: Record<CrmOpportunityStage, number> = {
  lead: 10,
  qualified: 25,
  proposal: 50,
  negotiation: 75,
  closed_won: 100,
  closed_lost: 0,
};

export const STAGE_COLORS: Record<CrmOpportunityStage, string> = {
  lead: "bg-muted text-muted-foreground",
  qualified: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  proposal: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  negotiation: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  closed_won: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  closed_lost: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};
