
-- Add shortlist persistence columns to jobs table
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS shortlist_search_string text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS shortlist_params jsonb;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS shortlist_run_at timestamptz;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS shortlist_locked boolean NOT NULL DEFAULT false;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS shortlist_locked_at timestamptz;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS shortlist_count integer NOT NULL DEFAULT 0;

-- Add match_breakdown jsonb to job_shortlist for detailed scoring
ALTER TABLE public.job_shortlist ADD COLUMN IF NOT EXISTS match_breakdown jsonb;
