import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CrmProject } from "@/types/crm";

const TABLE = "crm_projects";
function fromTable() { return supabase.from(TABLE as any); }

export type CrmProjectWithCompany = CrmProject & {
  crm_companies: { id: string; name: string } | null;
};

export function useCrmProjects(filters?: {
  search?: string;
  status?: string;
  company_id?: string;
}) {
  return useQuery({
    queryKey: ["crm_projects", filters],
    queryFn: async () => {
      let q = fromTable()
        .select("*, crm_companies(id, name)")
        .order("created_at", { ascending: false });

      if (filters?.search) {
        q = q.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }
      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.company_id) q = q.eq("company_id", filters.company_id);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as CrmProjectWithCompany[];
    },
  });
}

export function useCrmProject(id: string | undefined) {
  return useQuery({
    queryKey: ["crm_projects", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await fromTable()
        .select("*, crm_companies(id, name)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as unknown as CrmProjectWithCompany;
    },
    enabled: !!id,
  });
}

export function useCreateCrmProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<CrmProject>) => {
      const { data, error } = await fromTable()
        .insert(input as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CrmProject;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm_projects"] }),
  });
}

export function useUpdateCrmProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<CrmProject>) => {
      const { data, error } = await fromTable()
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CrmProject;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm_projects"] }),
  });
}
