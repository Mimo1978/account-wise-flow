
-- Add workflow columns to crm_projects
ALTER TABLE public.crm_projects
  ADD COLUMN IF NOT EXISTS workflow_stage text,
  ADD COLUMN IF NOT EXISTS workflow_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS workflow_completed_stages jsonb DEFAULT '[]'::jsonb;

-- Create project_stage_events table
CREATE TABLE public.project_stage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.crm_projects(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.teams(id),
  stage_name text NOT NULL,
  stage_entered_at timestamptz NOT NULL DEFAULT now(),
  stage_completed_at timestamptz,
  completed_by uuid,
  notes text,
  next_stage text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_stage_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for project_stage_events
CREATE POLICY "Users can view stage events" ON public.project_stage_events
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert stage events" ON public.project_stage_events
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update stage events" ON public.project_stage_events
  FOR UPDATE TO authenticated USING (true);

-- Index for quick lookups
CREATE INDEX idx_project_stage_events_project_id ON public.project_stage_events(project_id);
CREATE INDEX idx_project_stage_events_workspace_id ON public.project_stage_events(workspace_id);
