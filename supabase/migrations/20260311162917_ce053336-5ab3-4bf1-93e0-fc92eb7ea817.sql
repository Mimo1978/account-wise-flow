
-- Automation pipeline tables
CREATE TABLE public.automation_pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle','running','paused','complete','error')),
  current_step INTEGER NOT NULL DEFAULT 0,
  steps_completed JSONB NOT NULL DEFAULT '[]'::jsonb,
  steps_failed JSONB NOT NULL DEFAULT '[]'::jsonb,
  run_by TEXT DEFAULT 'manual',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(job_id)
);

CREATE TABLE public.automation_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES public.automation_pipelines(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','complete','failed','skipped')),
  input_data JSONB DEFAULT '{}'::jsonb,
  output_data JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pipeline_id, step_number)
);

-- Add automation_enabled to jobs
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS automation_enabled BOOLEAN DEFAULT false;

-- RLS
ALTER TABLE public.automation_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workspace pipelines" ON public.automation_pipelines
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT team_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage own workspace pipelines" ON public.automation_pipelines
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT team_id FROM public.user_roles WHERE user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT team_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can view pipeline steps" ON public.automation_steps
  FOR SELECT TO authenticated
  USING (pipeline_id IN (SELECT id FROM public.automation_pipelines WHERE workspace_id IN (SELECT team_id FROM public.user_roles WHERE user_id = auth.uid())));

CREATE POLICY "Users can manage pipeline steps" ON public.automation_steps
  FOR ALL TO authenticated
  USING (pipeline_id IN (SELECT id FROM public.automation_pipelines WHERE workspace_id IN (SELECT team_id FROM public.user_roles WHERE user_id = auth.uid())))
  WITH CHECK (pipeline_id IN (SELECT id FROM public.automation_pipelines WHERE workspace_id IN (SELECT team_id FROM public.user_roles WHERE user_id = auth.uid())));

-- Updated_at trigger
CREATE TRIGGER update_automation_pipelines_updated_at
  BEFORE UPDATE ON public.automation_pipelines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
