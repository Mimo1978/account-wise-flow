-- Create talent_questions table for caching generated interview questions
CREATE TABLE public.talent_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  talent_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  job_spec_id UUID NULL REFERENCES public.job_specs(id) ON DELETE CASCADE,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  cv_hash TEXT NULL,
  spec_hash TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ensure unique per talent+spec combination
  CONSTRAINT talent_questions_unique_combo UNIQUE (talent_id, job_spec_id)
);

-- Create indexes for efficient lookups
CREATE INDEX idx_talent_questions_talent_id ON public.talent_questions(talent_id);
CREATE INDEX idx_talent_questions_workspace_id ON public.talent_questions(workspace_id);
CREATE INDEX idx_talent_questions_job_spec_id ON public.talent_questions(job_spec_id) WHERE job_spec_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.talent_questions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "talent_questions_select_policy" ON public.talent_questions
  FOR SELECT USING (
    check_demo_isolation(workspace_id, auth.uid()) AND 
    (has_role(auth.uid(), 'admin'::app_role) OR workspace_id = get_user_team_id(auth.uid()))
  );

CREATE POLICY "talent_questions_insert_policy" ON public.talent_questions
  FOR INSERT WITH CHECK (
    check_demo_isolation(workspace_id, auth.uid()) AND
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'contributor'::app_role)) AND
    workspace_id = get_user_team_id(auth.uid())
  );

CREATE POLICY "talent_questions_update_policy" ON public.talent_questions
  FOR UPDATE USING (
    check_demo_isolation(workspace_id, auth.uid()) AND 
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR workspace_id = get_user_team_id(auth.uid()))
  );

CREATE POLICY "talent_questions_delete_policy" ON public.talent_questions
  FOR DELETE USING (
    check_demo_isolation(workspace_id, auth.uid()) AND 
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  );

-- Add updated_at trigger
CREATE TRIGGER update_talent_questions_updated_at
  BEFORE UPDATE ON public.talent_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE public.talent_questions IS 'Cached AI-generated interview questions per talent/job spec combination';
COMMENT ON COLUMN public.talent_questions.cv_hash IS 'Hash of CV text used to detect changes requiring regeneration';
COMMENT ON COLUMN public.talent_questions.spec_hash IS 'Hash of job spec used to detect changes requiring regeneration';