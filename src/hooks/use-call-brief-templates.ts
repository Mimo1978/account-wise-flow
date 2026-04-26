import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CallBriefTemplate = {
  id: string;
  user_id: string;
  name: string;
  purpose: string | null;
  brief: string;
  enhanced: string | null;
  use_count: number;
  last_used_at: string | null;
  updated_at: string;
};

export function useCallBriefTemplates() {
  return useQuery({
    queryKey: ["call_brief_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_brief_templates")
        .select("*")
        .order("last_used_at", { ascending: false, nullsFirst: false })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as CallBriefTemplate[];
    },
  });
}

export function useSaveCallBriefTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; purpose: string; brief: string; enhanced?: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("call_brief_templates")
        .insert({
          user_id: auth.user.id,
          name: input.name,
          purpose: input.purpose || null,
          brief: input.brief,
          enhanced: input.enhanced || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as CallBriefTemplate;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["call_brief_templates"] }),
  });
}

export function useDeleteCallBriefTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("call_brief_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["call_brief_templates"] }),
  });
}

export function useUpdateCallBriefTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name?: string; purpose?: string; brief?: string; enhanced?: string | null }) => {
      const patch: Record<string, any> = { updated_at: new Date().toISOString() };
      if (input.name !== undefined) patch.name = input.name;
      if (input.purpose !== undefined) patch.purpose = input.purpose || null;
      if (input.brief !== undefined) patch.brief = input.brief;
      if (input.enhanced !== undefined) patch.enhanced = input.enhanced || null;
      const { data, error } = await supabase
        .from("call_brief_templates")
        .update(patch)
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data as CallBriefTemplate;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["call_brief_templates"] }),
  });
}

export function useTouchCallBriefTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: existing } = await supabase
        .from("call_brief_templates")
        .select("use_count")
        .eq("id", id)
        .single();
      const { error } = await supabase
        .from("call_brief_templates")
        .update({ use_count: (existing?.use_count || 0) + 1, last_used_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["call_brief_templates"] }),
  });
}