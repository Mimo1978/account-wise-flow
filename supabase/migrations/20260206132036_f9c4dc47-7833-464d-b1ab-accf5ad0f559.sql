-- Create job_spec_type enum
CREATE TYPE public.job_spec_type AS ENUM ('permanent', 'contract');

-- Create job_specs table
CREATE TABLE public.job_specs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  client_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  sector TEXT,
  location TEXT,
  type public.job_spec_type NOT NULL DEFAULT 'permanent',
  day_rate_range TEXT,
  salary_range TEXT,
  description_text TEXT,
  key_skills TEXT[] DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.job_specs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: workspace scoped
CREATE POLICY "job_specs_select_policy" ON public.job_specs
  FOR SELECT USING (
    check_demo_isolation(workspace_id, auth.uid()) AND
    (has_role(auth.uid(), 'admin'::app_role) OR workspace_id = get_user_team_id(auth.uid()))
  );

CREATE POLICY "job_specs_insert_policy" ON public.job_specs
  FOR INSERT WITH CHECK (
    check_demo_isolation(workspace_id, auth.uid()) AND
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'contributor'::app_role)) AND
    workspace_id = get_user_team_id(auth.uid())
  );

CREATE POLICY "job_specs_update_policy" ON public.job_specs
  FOR UPDATE USING (
    check_demo_isolation(workspace_id, auth.uid()) AND
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR 
     (has_role(auth.uid(), 'contributor'::app_role) AND created_by = auth.uid()))
  );

CREATE POLICY "job_specs_delete_policy" ON public.job_specs
  FOR DELETE USING (
    check_demo_isolation(workspace_id, auth.uid()) AND
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  );

-- Add updated_at trigger
CREATE TRIGGER update_job_specs_updated_at
  BEFORE UPDATE ON public.job_specs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for workspace lookups
CREATE INDEX idx_job_specs_workspace_id ON public.job_specs(workspace_id);
CREATE INDEX idx_job_specs_client_company_id ON public.job_specs(client_company_id);