-- Enable required extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Fix FK constraints so deleting a company sets related records to NULL
-- instead of blocking the deletion

ALTER TABLE public.engagements
  DROP CONSTRAINT IF EXISTS engagements_company_id_fkey,
  ADD CONSTRAINT engagements_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;

ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_company_id_fkey,
  ADD CONSTRAINT contacts_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;

-- Schedule nightly purge of soft-deleted records older than 30 days
-- Runs at 2am every night
SELECT cron.schedule(
  'nightly-data-purge',
  '0 2 * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/scheduled-purge',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.anon_key', true),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    )
  $$
);