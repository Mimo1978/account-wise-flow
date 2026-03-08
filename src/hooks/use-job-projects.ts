import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export interface JobProjectLink {
  id: string;
  job_id: string;
  project_id: string;
  created_at: string;
  created_by: string | null;
  project?: { id: string; name: string; engagement_type: string; stage: string } | null;
}

export function useJobProjects(jobId: string | undefined) {
  return useQuery({
    queryKey: ['jobs_projects', jobId],
    queryFn: async () => {
      if (!jobId) return [];
      const { data, error } = await supabase
        .from('jobs_projects' as any)
        .select('*, engagements(id, name, engagement_type, stage)')
        .eq('job_id', jobId);
      if (error) throw error;
      return (data ?? []).map((d: any) => ({
        ...d,
        project: d.engagements,
      })) as JobProjectLink[];
    },
    enabled: !!jobId,
  });
}

export function useLinkJobToProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, projectId }: { jobId: string; projectId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('jobs_projects' as any)
        .insert({ job_id: jobId, project_id: projectId, created_by: user?.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs_projects'] });
      toast.success('Job linked to project');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUnlinkJobFromProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('jobs_projects' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs_projects'] });
      toast.success('Project unlinked');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
