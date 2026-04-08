ALTER TABLE public.placements DROP CONSTRAINT IF EXISTS placements_company_id_fkey;
ALTER TABLE public.placements DROP COLUMN IF EXISTS company_id;
ALTER TABLE public.placements ADD COLUMN company_id uuid REFERENCES public.crm_companies(id) ON DELETE SET NULL;

ALTER TABLE public.placements DROP CONSTRAINT IF EXISTS placements_contact_id_fkey;
ALTER TABLE public.placements DROP COLUMN IF EXISTS contact_id;
ALTER TABLE public.placements ADD COLUMN contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL;