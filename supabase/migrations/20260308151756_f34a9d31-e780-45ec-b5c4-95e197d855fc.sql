
-- Add AI assessment columns to job_applications
ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS ai_strengths text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_gaps text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_recommended_action text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz DEFAULT NULL;

-- Index for faster filtering
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON public.job_applications(status);
CREATE INDEX IF NOT EXISTS idx_job_applications_ai_score ON public.job_applications(ai_match_score DESC NULLS LAST);
