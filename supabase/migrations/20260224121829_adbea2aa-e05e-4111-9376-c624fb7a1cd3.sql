
-- Create engagements table
CREATE TABLE public.engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.teams(id),
  company_id uuid NULL REFERENCES public.companies(id),
  name text NOT NULL,
  engagement_type text NOT NULL DEFAULT 'consulting',
  stage text NOT NULL DEFAULT 'active',
  owner_id uuid NULL,
  start_date date NULL,
  end_date date NULL,
  forecast_value int4 NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GBP',
  health text NOT NULL DEFAULT 'green',
  description text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_engagements_workspace ON public.engagements (workspace_id);
CREATE INDEX idx_engagements_company ON public.engagements (workspace_id, company_id);
CREATE INDEX idx_engagements_stage ON public.engagements (workspace_id, stage);

-- Enable RLS
ALTER TABLE public.engagements ENABLE ROW LEVEL SECURITY;

-- RLS policies using existing helper pattern
CREATE POLICY "Users can view engagements in their workspace"
  ON public.engagements FOR SELECT
  USING (
    public.check_demo_isolation(workspace_id, auth.uid())
    AND workspace_id = public.get_user_team_id(auth.uid())
  );

CREATE POLICY "Users can create engagements in their workspace"
  ON public.engagements FOR INSERT
  WITH CHECK (
    public.check_demo_isolation(workspace_id, auth.uid())
    AND workspace_id = public.get_user_team_id(auth.uid())
  );

CREATE POLICY "Users can update engagements in their workspace"
  ON public.engagements FOR UPDATE
  USING (
    public.check_demo_isolation(workspace_id, auth.uid())
    AND workspace_id = public.get_user_team_id(auth.uid())
  );

CREATE POLICY "Users can delete engagements in their workspace"
  ON public.engagements FOR DELETE
  USING (
    public.check_demo_isolation(workspace_id, auth.uid())
    AND workspace_id = public.get_user_team_id(auth.uid())
  );

-- Updated_at trigger
CREATE TRIGGER update_engagements_updated_at
  BEFORE UPDATE ON public.engagements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
