
-- TABLE: jobs
CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.teams(id) NOT NULL,
  company_id uuid REFERENCES public.companies(id),
  title text NOT NULL,
  raw_brief text,
  full_spec text,
  salary_min numeric,
  salary_max numeric,
  salary_currency text DEFAULT 'GBP',
  job_type text,
  location text,
  remote_policy text,
  start_date date,
  end_date date,
  status text DEFAULT 'draft',
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- TABLE: job_adverts
CREATE TABLE public.job_adverts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.jobs(id) NOT NULL,
  workspace_id uuid REFERENCES public.teams(id) NOT NULL,
  board text,
  content text,
  word_count integer,
  character_count integer,
  status text DEFAULT 'draft',
  published_at timestamptz,
  expires_at timestamptz,
  board_job_id text,
  created_at timestamptz DEFAULT now()
);

-- TABLE: job_board_formats
CREATE TABLE public.job_board_formats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.teams(id) NOT NULL,
  board text,
  max_words integer,
  max_characters integer,
  required_sections text[],
  template text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- TABLE: job_shortlist
CREATE TABLE public.job_shortlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.jobs(id) NOT NULL,
  workspace_id uuid REFERENCES public.teams(id) NOT NULL,
  candidate_id uuid REFERENCES public.candidates(id),
  match_score integer,
  match_reasons text[],
  status text DEFAULT 'pending',
  outreach_sent_at timestamptz,
  response_received_at timestamptz,
  candidate_interest text,
  availability_confirmed text,
  interview_booked_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- TABLE: job_applications
CREATE TABLE public.job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.jobs(id) NOT NULL,
  workspace_id uuid REFERENCES public.teams(id) NOT NULL,
  applicant_name text,
  applicant_email text,
  applicant_phone text,
  cv_url text,
  cover_letter text,
  source text,
  ai_match_score integer,
  ai_summary text,
  status text DEFAULT 'new',
  candidate_id uuid REFERENCES public.candidates(id),
  created_at timestamptz DEFAULT now()
);

-- TABLE: outreach_messages
CREATE TABLE public.outreach_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.jobs(id),
  shortlist_id uuid REFERENCES public.job_shortlist(id),
  workspace_id uuid REFERENCES public.teams(id) NOT NULL,
  channel text,
  subject text,
  body text,
  sent_at timestamptz,
  opened_at timestamptz,
  replied_at timestamptz,
  reply_content text,
  status text DEFAULT 'draft',
  created_at timestamptz DEFAULT now()
);

-- Performance indexes
CREATE INDEX idx_jobs_workspace_status ON public.jobs(workspace_id, status);
CREATE INDEX idx_job_shortlist_job_status ON public.job_shortlist(job_id, status);
CREATE INDEX idx_job_applications_job_status ON public.job_applications(job_id, status);
CREATE INDEX idx_outreach_messages_job_status ON public.outreach_messages(job_id, status);

-- Enable RLS on all tables
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_adverts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_board_formats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_shortlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_messages ENABLE ROW LEVEL SECURITY;

-- RLS: workspace members can read rows in their workspace
CREATE POLICY "Workspace members can read jobs" ON public.jobs
  FOR SELECT TO authenticated
  USING (workspace_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Workspace members can insert jobs" ON public.jobs
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id = public.get_user_team_id(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Workspace members can update jobs" ON public.jobs
  FOR UPDATE TO authenticated
  USING (workspace_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Workspace members can delete jobs" ON public.jobs
  FOR DELETE TO authenticated
  USING (workspace_id = public.get_user_team_id(auth.uid()));

-- job_adverts
CREATE POLICY "Workspace members can read job_adverts" ON public.job_adverts
  FOR SELECT TO authenticated
  USING (workspace_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Workspace members can insert job_adverts" ON public.job_adverts
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Workspace members can update job_adverts" ON public.job_adverts
  FOR UPDATE TO authenticated
  USING (workspace_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Workspace members can delete job_adverts" ON public.job_adverts
  FOR DELETE TO authenticated
  USING (workspace_id = public.get_user_team_id(auth.uid()));

-- job_board_formats
CREATE POLICY "Workspace members can read job_board_formats" ON public.job_board_formats
  FOR SELECT TO authenticated
  USING (workspace_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Workspace members can insert job_board_formats" ON public.job_board_formats
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Workspace members can update job_board_formats" ON public.job_board_formats
  FOR UPDATE TO authenticated
  USING (workspace_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Workspace members can delete job_board_formats" ON public.job_board_formats
  FOR DELETE TO authenticated
  USING (workspace_id = public.get_user_team_id(auth.uid()));

-- job_shortlist
CREATE POLICY "Workspace members can read job_shortlist" ON public.job_shortlist
  FOR SELECT TO authenticated
  USING (workspace_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Workspace members can insert job_shortlist" ON public.job_shortlist
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Workspace members can update job_shortlist" ON public.job_shortlist
  FOR UPDATE TO authenticated
  USING (workspace_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Workspace members can delete job_shortlist" ON public.job_shortlist
  FOR DELETE TO authenticated
  USING (workspace_id = public.get_user_team_id(auth.uid()));

-- job_applications
CREATE POLICY "Workspace members can read job_applications" ON public.job_applications
  FOR SELECT TO authenticated
  USING (workspace_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Workspace members can insert job_applications" ON public.job_applications
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Workspace members can update job_applications" ON public.job_applications
  FOR UPDATE TO authenticated
  USING (workspace_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Workspace members can delete job_applications" ON public.job_applications
  FOR DELETE TO authenticated
  USING (workspace_id = public.get_user_team_id(auth.uid()));

-- outreach_messages
CREATE POLICY "Workspace members can read outreach_messages" ON public.outreach_messages
  FOR SELECT TO authenticated
  USING (workspace_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Workspace members can insert outreach_messages" ON public.outreach_messages
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Workspace members can update outreach_messages" ON public.outreach_messages
  FOR UPDATE TO authenticated
  USING (workspace_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Workspace members can delete outreach_messages" ON public.outreach_messages
  FOR DELETE TO authenticated
  USING (workspace_id = public.get_user_team_id(auth.uid()));

-- Updated_at triggers
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
