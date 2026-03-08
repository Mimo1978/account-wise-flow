
-- Create storage bucket for CV uploads (public for download URLs)
INSERT INTO storage.buckets (id, name, public) VALUES ('cvs', 'cvs', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload to cvs bucket
CREATE POLICY "Anyone can upload CVs" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'cvs');

-- Allow anyone to read CVs
CREATE POLICY "Anyone can read CVs" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'cvs');

-- RLS: Allow anon to SELECT active jobs with published internal adverts
CREATE POLICY "Public can view active jobs" ON public.jobs
  FOR SELECT TO anon
  USING (status = 'active');

-- RLS: Allow anon to SELECT published internal adverts
CREATE POLICY "Public can view published adverts" ON public.job_adverts
  FOR SELECT TO anon
  USING (status = 'published' AND board = 'internal');

-- RLS: Allow anon to INSERT job applications
CREATE POLICY "Public can submit applications" ON public.job_applications
  FOR INSERT TO anon
  WITH CHECK (source = 'internal_board');

-- Allow anon to read company name for job board display
CREATE POLICY "Public can view companies for jobs" ON public.companies
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.company_id = companies.id
        AND j.status = 'active'
    )
  );

-- Add linkedin_url column to job_applications if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_applications' AND column_name = 'linkedin_url'
  ) THEN
    ALTER TABLE public.job_applications ADD COLUMN linkedin_url text;
  END IF;
END $$;

-- Add gdpr_consent column to job_applications if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_applications' AND column_name = 'gdpr_consent'
  ) THEN
    ALTER TABLE public.job_applications ADD COLUMN gdpr_consent boolean NOT NULL DEFAULT false;
  END IF;
END $$;
