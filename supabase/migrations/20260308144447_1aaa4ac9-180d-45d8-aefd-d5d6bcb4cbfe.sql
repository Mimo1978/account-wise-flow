ALTER TABLE public.job_shortlist ADD COLUMN IF NOT EXISTS concerns text[] DEFAULT '{}';
ALTER TABLE public.job_shortlist ADD COLUMN IF NOT EXISTS availability_warning text DEFAULT NULL;