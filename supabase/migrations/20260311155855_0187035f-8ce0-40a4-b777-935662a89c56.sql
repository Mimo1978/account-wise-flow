
-- Job searches history table
CREATE TABLE IF NOT EXISTS public.job_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  workspace_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  search_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  boolean_string TEXT,
  ai_rationale TEXT,
  results_by_pass JSONB DEFAULT '{}'::jsonb,
  total_found INTEGER DEFAULT 0,
  pool_size INTEGER DEFAULT 0,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  run_by UUID DEFAULT auth.uid()
);

ALTER TABLE public.job_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage job searches in their workspace"
  ON public.job_searches FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT team_id FROM public.user_roles WHERE user_id = auth.uid()
  ));

-- Add match_pass column to job_shortlist if not exists
DO $$ BEGIN
  ALTER TABLE public.job_shortlist ADD COLUMN IF NOT EXISTS match_pass INTEGER DEFAULT 1;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
