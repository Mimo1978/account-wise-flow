
-- Add logo_url to companies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE public.companies ADD COLUMN logo_url text;
  END IF;
END $$;

-- Create job_board_subscriptions table (future-ready)
CREATE TABLE IF NOT EXISTS public.job_board_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, company_id)
);

ALTER TABLE public.job_board_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage subscriptions"
  ON public.job_board_subscriptions
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow anon to read logo_url from companies (already have anon SELECT policy on companies for active jobs)
-- No additional policy needed since we already have "Public can view companies for jobs"
