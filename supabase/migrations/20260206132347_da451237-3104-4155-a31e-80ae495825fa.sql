-- Create table for storing job spec match results
CREATE TABLE public.job_spec_matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_spec_id UUID NOT NULL REFERENCES public.job_specs(id) ON DELETE CASCADE,
  talent_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  
  -- Score breakdown
  overall_score REAL NOT NULL DEFAULT 0,
  skill_match_score REAL NOT NULL DEFAULT 0,
  sector_company_score REAL NOT NULL DEFAULT 0,
  tenure_score REAL NOT NULL DEFAULT 0,
  recency_score REAL NOT NULL DEFAULT 0,
  
  -- Detailed breakdown JSON for flexible scoring
  score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Flags and suggestions
  risk_flags TEXT[] NOT NULL DEFAULT '{}'::text[],
  suggested_questions TEXT[] NOT NULL DEFAULT '{}'::text[],
  top_evidence_snippets TEXT[] NOT NULL DEFAULT '{}'::text[],
  
  -- AI explanation
  match_reasoning TEXT,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'completed',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Unique constraint to prevent duplicate matches
  CONSTRAINT unique_job_spec_talent UNIQUE (job_spec_id, talent_id)
);

-- Create indexes for efficient querying
CREATE INDEX idx_job_spec_matches_job_spec ON public.job_spec_matches(job_spec_id);
CREATE INDEX idx_job_spec_matches_talent ON public.job_spec_matches(talent_id);
CREATE INDEX idx_job_spec_matches_workspace ON public.job_spec_matches(workspace_id);
CREATE INDEX idx_job_spec_matches_score ON public.job_spec_matches(job_spec_id, overall_score DESC);

-- Enable RLS
ALTER TABLE public.job_spec_matches ENABLE ROW LEVEL SECURITY;

-- RLS Policies: workspace-scoped access
CREATE POLICY "job_spec_matches_select_policy"
ON public.job_spec_matches
FOR SELECT
USING (
  check_demo_isolation(workspace_id, auth.uid())
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR workspace_id = get_user_team_id(auth.uid())
  )
);

CREATE POLICY "job_spec_matches_insert_policy"
ON public.job_spec_matches
FOR INSERT
WITH CHECK (
  check_demo_isolation(workspace_id, auth.uid())
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'contributor'::app_role)
  )
  AND workspace_id = get_user_team_id(auth.uid())
);

CREATE POLICY "job_spec_matches_update_policy"
ON public.job_spec_matches
FOR UPDATE
USING (
  check_demo_isolation(workspace_id, auth.uid())
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  )
);

CREATE POLICY "job_spec_matches_delete_policy"
ON public.job_spec_matches
FOR DELETE
USING (
  check_demo_isolation(workspace_id, auth.uid())
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_job_spec_matches_updated_at
  BEFORE UPDATE ON public.job_spec_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();