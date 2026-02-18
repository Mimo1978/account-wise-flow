import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";
import type { OutreachScript, GuardrailRule, CallBlock } from "@/lib/script-types";
import { DEFAULT_GUARDRAILS } from "@/lib/script-types";



// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useOutreachScripts(campaignId?: string) {
  const { currentWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ["outreach_scripts", currentWorkspace?.id, campaignId],
    enabled: !!currentWorkspace?.id,
    queryFn: async () => {
      let q = db
        .from("outreach_scripts")
        .select("*")
        .eq("workspace_id", currentWorkspace!.id)
        .order("created_at", { ascending: false });

      if (campaignId) q = q.eq("campaign_id", campaignId);

      const { data, error } = await q;
      if (error) throw error;

      return (data ?? []).map(deserialise) as OutreachScript[];
    },
  });
}

export function useCreateScript() {
  const { currentWorkspace } = useWorkspace();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: Omit<OutreachScript, "id" | "created_at" | "updated_at" | "workspace_id" | "version">
    ) => {
      const { data, error } = await db
        .from("outreach_scripts")
        .insert({
          ...serialise(input),
          workspace_id: currentWorkspace!.id,
          version: 1,
        })
        .select()
        .single();
      if (error) throw error;
      return deserialise(data) as OutreachScript;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["outreach_scripts"] });
      toast.success("Script saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateScript() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<OutreachScript> & { id: string }) => {
      // Bump version
      const { data: current } = await db
        .from("outreach_scripts")
        .select("version")
        .eq("id", id)
        .single();

      const { data, error } = await db
        .from("outreach_scripts")
        .update({ ...serialise(patch as OutreachScript), version: (current?.version ?? 1) + 1 })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return deserialise(data) as OutreachScript;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["outreach_scripts"] });
      toast.success("Script updated (v+1)");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("outreach_scripts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["outreach_scripts"] });
      toast.success("Script deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}




function serialise(s: Partial<OutreachScript>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...s };
  if (s.guardrails) out.guardrails = JSON.stringify(s.guardrails);
  if (s.call_blocks) out.call_blocks = JSON.stringify(s.call_blocks);
  delete (out as Record<string, unknown>).id;
  return out;
}

function deserialise(row: Record<string, unknown>): OutreachScript {
  return {
    ...row,
    guardrails: tryParse<GuardrailRule[]>(row.guardrails as string, DEFAULT_GUARDRAILS),
    call_blocks: tryParse<CallBlock[]>(row.call_blocks as string, []),
  } as OutreachScript;
}

function tryParse<T>(val: string | undefined | null, fallback: T): T {
  if (!val) return fallback;
  if (typeof val === "object") return val as T;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}
