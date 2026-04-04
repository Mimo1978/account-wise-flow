-- Table linking talent candidates to client companies as deployed/proposed consultants

CREATE TABLE public.talent_company_engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.teams(id),
  talent_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'interviewing', 'deployed')),
  role_type text,
  department text,
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tce_workspace ON public.talent_company_engagements (workspace_id);
CREATE INDEX idx_tce_company ON public.talent_company_engagements (company_id);
CREATE INDEX idx_tce_talent ON public.talent_company_engagements (talent_id);

ALTER TABLE public.talent_company_engagements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view talent engagements in their workspace"
  ON public.talent_company_engagements FOR SELECT
  USING (workspace_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Users can insert talent engagements in their workspace"
  ON public.talent_company_engagements FOR INSERT
  WITH CHECK (workspace_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Users can update talent engagements in their workspace"
  ON public.talent_company_engagements FOR UPDATE
  USING (workspace_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Users can delete talent engagements in their workspace"
  ON public.talent_company_engagements FOR DELETE
  USING (workspace_id = public.get_user_team_id(auth.uid()));

CREATE TRIGGER update_tce_updated_at
  BEFORE UPDATE ON public.talent_company_engagements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();