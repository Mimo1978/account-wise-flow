
ALTER TABLE public.job_shortlist ADD COLUMN IF NOT EXISTS priority integer DEFAULT 0;

-- Update ordering: use priority first, then match_score
COMMENT ON COLUMN public.job_shortlist.priority IS 'Lower number = higher priority. 0 = unset. Used for recruiter reordering.';
