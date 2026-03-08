-- Junction table for linking jobs to projects
CREATE TABLE public.jobs_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.crm_projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(job_id, project_id)
);

-- Enable RLS
ALTER TABLE public.jobs_projects ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read/write (workspace isolation via join)
CREATE POLICY "Authenticated users can manage job-project links"
  ON public.jobs_projects
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX idx_jobs_projects_job_id ON public.jobs_projects(job_id);
CREATE INDEX idx_jobs_projects_project_id ON public.jobs_projects(project_id);
