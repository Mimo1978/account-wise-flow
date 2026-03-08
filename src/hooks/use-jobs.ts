import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from '@/components/ui/sonner';

export interface Job {
  id: string;
  workspace_id: string;
  company_id: string | null;
  title: string;
  raw_brief: string | null;
  full_spec: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  job_type: string | null;
  location: string | null;
  remote_policy: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  companies?: { name: string } | null;
}

export interface JobAdvert {
  id: string;
  job_id: string;
  workspace_id: string;
  board: string | null;
  content: string | null;
  word_count: number | null;
  character_count: number | null;
  status: string;
  published_at: string | null;
  expires_at: string | null;
  board_job_id: string | null;
  created_at: string;
}

export interface JobShortlistEntry {
  id: string;
  job_id: string;
  workspace_id: string;
  candidate_id: string | null;
  match_score: number | null;
  match_reasons: string[] | null;
  status: string;
  outreach_sent_at: string | null;
  response_received_at: string | null;
  candidate_interest: string | null;
  availability_confirmed: string | null;
  interview_booked_at: string | null;
  notes: string | null;
  created_at: string;
  candidates?: { name: string; current_title: string | null } | null;
}

export interface JobApplication {
  id: string;
  job_id: string;
  workspace_id: string;
  applicant_name: string | null;
  applicant_email: string | null;
  applicant_phone: string | null;
  cv_url: string | null;
  cover_letter: string | null;
  source: string | null;
  ai_match_score: number | null;
  ai_summary: string | null;
  status: string;
  candidate_id: string | null;
  created_at: string;
}

// ---------- Jobs list ----------
export function useJobs() {
  const { currentWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ['jobs', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const { data, error } = await supabase
        .from('jobs')
        .select('*, companies(name)')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Job[];
    },
    enabled: !!currentWorkspace?.id,
  });
}

// ---------- Single job ----------
export function useJob(id: string | undefined) {
  return useQuery({
    queryKey: ['jobs', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('jobs')
        .select('*, companies(name)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Job;
    },
    enabled: !!id,
  });
}

// ---------- Job adverts ----------
export function useJobAdverts(jobId: string | undefined) {
  return useQuery({
    queryKey: ['job_adverts', jobId],
    queryFn: async () => {
      if (!jobId) return [];
      const { data, error } = await supabase
        .from('job_adverts')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as JobAdvert[];
    },
    enabled: !!jobId,
  });
}

// ---------- Job shortlist ----------
export function useJobShortlist(jobId: string | undefined) {
  return useQuery({
    queryKey: ['job_shortlist', jobId],
    queryFn: async () => {
      if (!jobId) return [];
      const { data, error } = await supabase
        .from('job_shortlist')
        .select('*, candidates(name, current_title)')
        .eq('job_id', jobId)
        .order('match_score', { ascending: false });
      if (error) throw error;
      return (data ?? []) as JobShortlistEntry[];
    },
    enabled: !!jobId,
  });
}

// ---------- Job applications ----------
export function useJobApplications(jobId: string | undefined) {
  return useQuery({
    queryKey: ['job_applications', jobId],
    queryFn: async () => {
      if (!jobId) return [];
      const { data, error } = await supabase
        .from('job_applications')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as JobApplication[];
    },
    enabled: !!jobId,
  });
}

// ---------- Create job ----------
export function useCreateJob() {
  const qc = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  return useMutation({
    mutationFn: async (payload: Partial<Job> & { title: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !currentWorkspace?.id) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('jobs')
        .insert({
          ...payload,
          workspace_id: currentWorkspace.id,
          created_by: user.id,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job created');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------- Update job status ----------
export function useUpdateJobStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('jobs')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job status updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------- Application / Shortlist counts (aggregated) ----------
export function useJobCounts(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['job_counts', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return {};
      const [{ data: apps }, { data: shorts }] = await Promise.all([
        supabase.from('job_applications').select('job_id').eq('workspace_id', workspaceId),
        supabase.from('job_shortlist').select('job_id').eq('workspace_id', workspaceId),
      ]);
      const appCounts: Record<string, number> = {};
      const shortCounts: Record<string, number> = {};
      (apps ?? []).forEach((a: any) => { appCounts[a.job_id] = (appCounts[a.job_id] || 0) + 1; });
      (shorts ?? []).forEach((s: any) => { shortCounts[s.job_id] = (shortCounts[s.job_id] || 0) + 1; });
      return { appCounts, shortCounts };
    },
    enabled: !!workspaceId,
  });
}

// ---------- New (unreviewed) application count for nav badge ----------
export function useNewApplicationsCount() {
  const { currentWorkspace } = useWorkspace();
  return useQuery({
    queryKey: ['new_applications_count', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return 0;
      const { count, error } = await supabase
        .from('job_applications')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', currentWorkspace.id)
        .eq('status', 'new');
      if (error) return 0;
      return count ?? 0;
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 30000, // poll every 30s
  });
}
