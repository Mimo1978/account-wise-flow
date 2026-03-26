
-- Add team_id to crm_companies
ALTER TABLE public.crm_companies ADD COLUMN team_id uuid REFERENCES public.teams(id);

-- Add team_id to crm_contacts
ALTER TABLE public.crm_contacts ADD COLUMN team_id uuid REFERENCES public.teams(id);

-- Backfill crm_companies team_id from companies table by matching name
UPDATE public.crm_companies cc
SET team_id = c.team_id
FROM public.companies c
WHERE lower(trim(cc.name)) = lower(trim(c.name))
  AND c.team_id IS NOT NULL
  AND cc.team_id IS NULL;

-- Backfill crm_contacts team_id from contacts table by matching email
UPDATE public.crm_contacts cc
SET team_id = c.team_id
FROM public.contacts c
WHERE lower(trim(cc.email)) = lower(trim(c.email))
  AND c.team_id IS NOT NULL
  AND cc.team_id IS NULL
  AND cc.email IS NOT NULL;
