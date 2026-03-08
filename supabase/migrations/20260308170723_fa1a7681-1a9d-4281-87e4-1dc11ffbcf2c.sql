
-- Drop the old FK to crm_projects
ALTER TABLE public.jobs_projects 
  DROP CONSTRAINT IF EXISTS jobs_projects_project_id_fkey;

-- Add new FK to engagements
ALTER TABLE public.jobs_projects 
  ADD CONSTRAINT jobs_projects_project_id_fkey 
  FOREIGN KEY (project_id) REFERENCES public.engagements(id) ON DELETE CASCADE;
