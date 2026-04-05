ALTER TABLE public.crm_companies
  ADD COLUMN IF NOT EXISTS source_company_id UUID
  REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_crm_companies_source
  ON public.crm_companies(source_company_id);