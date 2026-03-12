import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProjectStageEvent {
  id: string;
  project_id: string;
  workspace_id: string;
  stage_name: string;
  stage_entered_at: string;
  stage_completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
  next_stage: string | null;
  created_at: string;
}

export function useProjectStageEvents(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project_stage_events", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await (supabase.from("project_stage_events" as any) as any)
        .select("*")
        .eq("project_id", projectId)
        .order("stage_entered_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProjectStageEvent[];
    },
    enabled: !!projectId,
  });
}

export function useAdvanceProjectStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      workspaceId,
      currentStage,
      nextStage,
      completedStages,
      notes,
    }: {
      projectId: string;
      workspaceId: string;
      currentStage: string | null;
      nextStage: string;
      completedStages: Array<{ stage: string; completed_at: string }>;
      notes?: string;
    }) => {
      const now = new Date().toISOString();
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Complete current stage event
      if (currentStage) {
        await (supabase.from("project_stage_events" as any) as any)
          .update({
            stage_completed_at: now,
            completed_by: user?.id,
            next_stage: nextStage,
          })
          .eq("project_id", projectId)
          .eq("stage_name", currentStage)
          .is("stage_completed_at", null);
      }

      // 2. Insert new stage event
      await (supabase.from("project_stage_events" as any) as any)
        .insert({
          project_id: projectId,
          workspace_id: workspaceId,
          stage_name: nextStage,
          stage_entered_at: now,
          notes,
        });

      // 3. Update project record
      const newCompleted = currentStage
        ? [...completedStages, { stage: currentStage, completed_at: now }]
        : completedStages;

      await (supabase.from("crm_projects" as any) as any)
        .update({
          workflow_stage: nextStage,
          workflow_completed_stages: newCompleted,
          workflow_started_at: completedStages.length === 0 && !currentStage ? now : undefined,
        })
        .eq("id", projectId);

      return { nextStage, completedStages: newCompleted };
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["crm_projects"] });
      qc.invalidateQueries({ queryKey: ["project_stage_events", vars.projectId] });
    },
  });
}
