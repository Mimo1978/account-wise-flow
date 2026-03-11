-- Add pipeline_type to jobs for Confirmed/Speculative/Internal/Proposal
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS pipeline_type text NOT NULL DEFAULT 'confirmed';
-- Add spec config fields for the 5-question quick-config
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS spec_seniority text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS spec_sectors text[];
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS spec_work_location text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS spec_must_have_skills text[];
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS spec_approved boolean NOT NULL DEFAULT false;