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
  is_confidential: boolean;
  pipeline_type: string;
  spec_approved: boolean;
  spec_seniority: string | null;
  spec_sectors: string[] | null;
  spec_must_have_skills: string[] | null;
  spec_work_location: string | null;
  shortlist_count: number;
  shortlist_locked: boolean;
  shortlist_locked_at: string | null;
  shortlist_search_string: string | null;
  shortlist_params: any;
  shortlist_run_at: string | null;
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
  concerns: string[] | null;
  availability_warning: string | null;
  status: string;
  priority: number;
  outreach_sent_at: string | null;
  response_received_at: string | null;
  candidate_interest: string | null;
  availability_confirmed: string | null;
  interview_booked_at: string | null;
  notes: string | null;
  created_at: string;
  candidates?: { name: string; current_title: string | null; availability_status: string | null; location: string | null } | null;
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
  linkedin_url: string | null;
  source: string | null;
  ai_match_score: number | null;
  ai_summary: string | null;
  ai_strengths: string[] | null;
  ai_gaps: string[] | null;
  ai_recommended_action: string | null;
  processed_at: string | null;
  status: string;
  candidate_id: string | null;
  gdpr_consent: boolean;
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
        .select('*, companies(name), hiring_manager:hiring_manager_id(id, first_name, last_name, job_title)')
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
        .select('*, companies(name), hiring_manager:hiring_manager_id(id, first_name, last_name, job_title)')
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
        .select('*, candidates(name, current_title, availability_status, location)')
        .eq('job_id', jobId)
        .order('priority', { ascending: true })
        .order('match_score', { ascending: false });
      if (error) throw error;
      return (data ?? []) as JobShortlistEntry[];
    },
    enabled: !!jobId,
  });
}

// ---------- Update shortlist entry status ----------
export function useUpdateShortlistStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('job_shortlist').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['job_shortlist'] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------- Bulk approve shortlist ----------
export function useApproveAllShortlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase
        .from('job_shortlist')
        .update({ status: 'approved' })
        .eq('job_id', jobId)
        .in('status', ['pending', 'reserve']);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job_shortlist'] });
      toast.success('All candidates approved for outreach');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------- Update shortlist priority ----------
export function useUpdateShortlistPriority() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: { id: string; priority: number }[]) => {
      for (const u of updates) {
        const { error } = await supabase.from('job_shortlist').update({ priority: u.priority }).eq('id', u.id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['job_shortlist'] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------- Remove from shortlist ----------
export function useRemoveFromShortlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('job_shortlist').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job_shortlist'] });
      toast.success('Removed from shortlist');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------- Run shortlist (AI matching) ----------
export function useRunShortlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const { data, error } = await supabase.functions.invoke('run-shortlist', {
        body: { job_id: jobId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as {
        shortlisted: number;
        total_scored: number;
        below_threshold: number;
        top_candidate: { name: string; score: number } | null;
        job_title: string;
      };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['job_shortlist'] });
      if (data.shortlisted > 0) {
        const topMsg = data.top_candidate
          ? ` Top match: ${data.top_candidate.name} (${data.top_candidate.score}%)`
          : '';
        toast.success(`${data.shortlisted} candidates shortlisted.${topMsg}`);
      } else {
        toast.info('No candidates scored above the threshold (50%)');
      }
    },
    onError: (e: Error) => toast.error(e.message),
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

// ---------- Outreach messages for a job ----------
export interface OutreachMessage {
  id: string;
  job_id: string;
  workspace_id: string;
  shortlist_id: string | null;
  candidate_id: string | null;
  candidate_name: string | null;
  candidate_email: string | null;
  candidate_phone: string | null;
  subject: string;
  body: string | null;
  body_html: string | null;
  sms_body: string | null;
  ai_call_script: string | null;
  from_name: string | null;
  from_email: string | null;
  automation_level: string;
  campaign_name: string | null;
  channel: string;
  status: string;
  sent_at: string | null;
  error_message: string | null;
  twilio_sid: string | null;
  created_at: string;
}

export function useOutreachMessages(jobId: string | undefined) {
  return useQuery({
    queryKey: ['outreach_messages', jobId],
    queryFn: async () => {
      if (!jobId) return [];
      const { data, error } = await supabase
        .from('outreach_messages')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as OutreachMessage[];
    },
    enabled: !!jobId,
  });
}

export function useDraftOutreach() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      job_id: string;
      automation_level: string;
      from_name?: string;
      from_email?: string;
      campaign_name?: string;
      channels?: string[];
      recruiter_phone?: string;
      agency_name?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('draft-outreach', {
        body: payload,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { drafted: number; email_count: number; sms_count: number; ai_call_count: number; total_approved: number; channels_requested: string[]; job_title: string; campaign_name: string };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['outreach_messages'] });
      const parts = [];
      if (data.email_count > 0) parts.push(`${data.email_count} email${data.email_count !== 1 ? 's' : ''}`);
      if (data.sms_count > 0) parts.push(`${data.sms_count} SMS`);
      if (data.ai_call_count > 0) parts.push(`${data.ai_call_count} AI call${data.ai_call_count !== 1 ? 's' : ''}`);
      toast.success(`Drafted ${parts.join(', ')} for ${data.job_title}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSendOutreachSms() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (messageIds: string[]) => {
      const { data, error } = await supabase.functions.invoke('send-outreach-sms', {
        body: { message_ids: messageIds },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { sent: number; failed: number; total: number; results: any[] };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['outreach_messages'] });
      qc.invalidateQueries({ queryKey: ['job_shortlist'] });
      if (data.sent > 0) toast.success(`${data.sent} SMS sent`);
      if (data.failed > 0) toast.error(`${data.failed} SMS failed`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSendOutreachAiCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (messageIds: string[]) => {
      const { data, error } = await supabase.functions.invoke('send-outreach-ai-call', {
        body: { message_ids: messageIds },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { sent: number; failed: number; total: number; results: any[] };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['outreach_messages'] });
      qc.invalidateQueries({ queryKey: ['job_shortlist'] });
      if (data.sent > 0) toast.success(`${data.sent} AI call${data.sent !== 1 ? 's' : ''} initiated`);
      if (data.failed > 0) toast.error(`${data.failed} call${data.failed !== 1 ? 's' : ''} failed`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSendOutreachBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (messageIds: string[]) => {
      const { data, error } = await supabase.functions.invoke('send-outreach-batch', {
        body: { message_ids: messageIds },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { sent: number; failed: number; total: number; results: any[] };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['outreach_messages'] });
      qc.invalidateQueries({ queryKey: ['job_shortlist'] });
      if (data.sent > 0) toast.success(`${data.sent} email${data.sent !== 1 ? 's' : ''} sent successfully`);
      if (data.failed > 0) toast.error(`${data.failed} email${data.failed !== 1 ? 's' : ''} failed to send`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateOutreachMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, subject, body }: { id: string; subject?: string; body?: string }) => {
      const update: any = {};
      if (subject !== undefined) update.subject = subject;
      if (body !== undefined) {
        update.body = body;
        update.body_html = body.replace(/\n/g, '<br>');
      }
      const { error } = await supabase.from('outreach_messages').update(update).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['outreach_messages'] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------- Log candidate reply (parse with AI) ----------
export function useLogCandidateReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { shortlist_id?: string; message_id?: string; reply_text: string }) => {
      const { data, error } = await supabase.functions.invoke('parse-candidate-reply', {
        body: payload,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as {
        success: boolean;
        parsed: {
          interest: string;
          availability_text: string;
          availability_date: string | null;
          preferred_contact: string;
          questions: string[];
          sentiment: string;
        };
        candidate_name: string;
        job_title: string;
        job_id: string;
        notification: {
          message: string;
          should_book_call: boolean;
          was_rejected: boolean;
        };
      };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['job_shortlist'] });
      qc.invalidateQueries({ queryKey: ['outreach_messages'] });
      qc.invalidateQueries({ queryKey: ['unreviewed_replies_count'] });
      toast.success(data.notification.message);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------- Unreviewed replies count for notification badges ----------
export function useUnreviewedRepliesCount(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['unreviewed_replies_count', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return 0;
      const { count, error } = await supabase
        .from('job_shortlist')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('status', 'responded')
        .not('response_received_at', 'is', null);
      if (error) return 0;
      return count ?? 0;
    },
    enabled: !!workspaceId,
    refetchInterval: 30000,
  });
}

// ---------- Job-level unreviewed replies count ----------
export function useJobUnreviewedReplies(jobId: string | undefined) {
  return useQuery({
    queryKey: ['job_unreviewed_replies', jobId],
    queryFn: async () => {
      if (!jobId) return 0;
      const { count, error } = await supabase
        .from('job_shortlist')
        .select('id', { count: 'exact', head: true })
        .eq('job_id', jobId)
        .eq('status', 'responded')
        .not('response_received_at', 'is', null);
      if (error) return 0;
      return count ?? 0;
    },
    enabled: !!jobId,
    refetchInterval: 30000,
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
    refetchInterval: 30000,
  });
}

// ---------- Update application status (with automated email) ----------
export function useUpdateApplicationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, oldStatus }: { id: string; status: string; oldStatus?: string }) => {
      const { error } = await supabase
        .from('job_applications')
        .update({ status } as any)
        .eq('id', id);
      if (error) throw error;
      
      // Fire-and-forget: send automated status email
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      fetch(`https://${projectId}.supabase.co/functions/v1/send-applicant-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ application_id: id, new_status: status, old_status: oldStatus }),
      }).catch(() => {});
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job_applications'] });
      qc.invalidateQueries({ queryKey: ['new_applications_count'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------- Bulk update application status ----------
export function useBulkUpdateApplicationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      const { error } = await supabase
        .from('job_applications')
        .update({ status } as any)
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      qc.invalidateQueries({ queryKey: ['job_applications'] });
      qc.invalidateQueries({ queryKey: ['new_applications_count'] });
      toast.success(`Applications updated to ${status}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------- Convert application to candidate ----------
export function useConvertToCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (app: JobApplication) => {
      // Check if candidate already exists
      if (app.candidate_id) throw new Error('Already converted to candidate');
      
      let candidateId: string | null = null;
      if (app.applicant_email) {
        const { data: existing } = await supabase
          .from('candidates')
          .select('id')
          .eq('email', app.applicant_email)
          .limit(1)
          .maybeSingle();
        if (existing) candidateId = existing.id;
      }

      if (!candidateId) {
        const { data: newCand, error: candErr } = await supabase
          .from('candidates')
          .insert({
            name: app.applicant_name || 'Unknown',
            email: app.applicant_email,
            phone: app.applicant_phone,
            linkedin_url: app.linkedin_url,
            tenant_id: app.workspace_id,
            source: 'application',
          } as any)
          .select('id')
          .single();
        if (candErr) throw candErr;
        candidateId = newCand.id;
      }

      // Link application to candidate
      const { error: linkErr } = await supabase
        .from('job_applications')
        .update({ candidate_id: candidateId, status: 'shortlisted' } as any)
        .eq('id', app.id);
      if (linkErr) throw linkErr;

      return candidateId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job_applications'] });
      qc.invalidateQueries({ queryKey: ['candidates'] });
      toast.success('Candidate added to talent database');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------- Process application (trigger AI scoring) ----------
export function useProcessApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (applicationId: string) => {
      const { data, error } = await supabase.functions.invoke('process-application', {
        body: { application_id: applicationId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['job_applications'] });
      if (data?.score != null) {
        toast.success(`AI scored: ${data.score}/100 — ${data.recommended_action}`);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
