import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface EmailTemplate {
  id: string;
  user_id: string;
  name: string;
  subject: string;
  body_html: string;
  created_at: string;
  updated_at: string;
}

const TABLE = "email_templates";
function fromTable() { return supabase.from(TABLE as any); }

export function useEmailTemplates() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["email_templates", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await fromTable()
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as EmailTemplate[];
    },
    enabled: !!user,
  });
}

export function useCreateEmailTemplate() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { name: string; subject: string; body_html: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await fromTable()
        .insert({ ...input, user_id: user.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as EmailTemplate;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email_templates"] }),
  });
}

export function useUpdateEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; subject?: string; body_html?: string }) => {
      const { data, error } = await fromTable()
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as EmailTemplate;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email_templates"] }),
  });
}

export function useDeleteEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email_templates"] }),
  });
}
