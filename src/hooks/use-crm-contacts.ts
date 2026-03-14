import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CrmContact } from "@/types/crm";

const TABLE = "crm_contacts";

function fromTable() {
  return supabase.from(TABLE as any);
}

export type CrmContactWithCompany = CrmContact & {
  crm_companies: { id: string; name: string } | null;
};

export function useCrmContacts(filters?: {
  search?: string;
  company_id?: string;
  gdpr?: "consented" | "pending";
}) {
  return useQuery({
    queryKey: ["crm_contacts", filters],
    queryFn: async () => {
      let q = fromTable()
        .select("*, crm_companies(id, name)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (filters?.search) {
        q = q.or(
          `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,job_title.ilike.%${filters.search}%`
        );
      }
      if (filters?.company_id) q = q.eq("company_id", filters.company_id);
      if (filters?.gdpr === "consented") q = q.eq("gdpr_consent", true);
      if (filters?.gdpr === "pending") q = q.eq("gdpr_consent", false);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as CrmContactWithCompany[];
    },
  });
}

export function useCrmContact(id: string | undefined) {
  return useQuery({
    queryKey: ["crm_contacts", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await fromTable()
        .select("*, crm_companies(id, name)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as unknown as CrmContactWithCompany;
    },
    enabled: !!id,
  });
}

export function useContactsForCompany(companyId: string | undefined) {
  return useQuery({
    queryKey: ["crm_contacts", "company", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await fromTable()
        .select("*")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("last_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CrmContact[];
    },
    enabled: !!companyId,
  });
}

export function useCreateCrmContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<CrmContact>) => {
      const { data, error } = await fromTable()
        .insert(input as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CrmContact;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm_contacts"] }),
  });
}

export function useUpdateCrmContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<CrmContact>) => {
      const { data, error } = await fromTable()
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CrmContact;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm_contacts"] }),
  });
}

export function useSoftDeleteCrmContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable()
        .delete()
        .eq("id", id);
      if (error) {
        console.error("[useSoftDeleteCrmContact] Delete failed:", error);
        throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm_contacts"] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["all-contacts"] });
    },
  });
}
