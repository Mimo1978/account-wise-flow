
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS preferred_name text,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS team_size text,
  ADD COLUMN IF NOT EXISTS primary_use text,
  ADD COLUMN IF NOT EXISTS onboarding_phase integer NOT NULL DEFAULT 1;
