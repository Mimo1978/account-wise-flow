ALTER TABLE public.crm_deals
  ADD COLUMN IF NOT EXISTS candidate_id UUID
  REFERENCES public.candidates(id) ON DELETE SET NULL;

ALTER TABLE public.crm_deals
  ADD COLUMN IF NOT EXISTS engagement_id UUID
  REFERENCES public.engagements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_crm_deals_candidate
  ON public.crm_deals(candidate_id);