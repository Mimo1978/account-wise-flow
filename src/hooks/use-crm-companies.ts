import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { CrmCompany } from "@/types/crm";

const TABLE = "crm_companies";

function fromTable() {
  return supabase.from(TABLE as any);
}

export function useCrmCompanies(filters?: {
  search?: string;
  industry?: string;
  country?: string;
  size?: string;
}) {
  return useQuery({
    queryKey: ["crm_companies", filters],
    queryFn: async () => {
      let q = fromTable()
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (filters?.search) {
        q = q.or(
          `name.ilike.%${filters.search}%,industry.ilike.%${filters.search}%,city.ilike.%${filters.search}%`
        );
      }
      if (filters?.industry) q = q.eq("industry", filters.industry);
      if (filters?.country) q = q.eq("country", filters.country);
      if (filters?.size) q = q.eq("size", filters.size);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as CrmCompany[];
    },
  });
}

export function useCrmCompany(id: string | undefined) {
  return useQuery({
    queryKey: ["crm_companies", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await fromTable()
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as unknown as CrmCompany;
    },
    enabled: !!id,
  });
}

export function useCreateCrmCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<CrmCompany>) => {
      const { data, error } = await fromTable()
        .insert(input as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CrmCompany;
    },
    onSuccess: () => {
      toast.success("Company created");
      qc.invalidateQueries({ queryKey: ["crm_companies"] });
    },
  });
}

export function useUpdateCrmCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<CrmCompany>) => {
      const { data, error } = await fromTable()
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CrmCompany;
    },
    onSuccess: () => {
      toast.success("Company updated");
      qc.invalidateQueries({ queryKey: ["crm_companies"] });
    },
  });
}

export function useSoftDeleteCrmCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable()
        .delete()
        .eq("id", id);
      if (error) {
        console.error("[useSoftDeleteCrmCompany] Delete failed:", error);
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Company deleted");
      qc.invalidateQueries({ queryKey: ["crm_companies"] });
      qc.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}
