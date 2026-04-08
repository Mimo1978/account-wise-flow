ALTER TABLE public.placements DROP CONSTRAINT IF EXISTS placements_deal_id_fkey;
ALTER TABLE public.placements DROP COLUMN IF EXISTS deal_id;
ALTER TABLE public.placements ADD COLUMN deal_id uuid REFERENCES public.crm_deals(id) ON DELETE SET NULL;

ALTER TABLE public.placements DROP CONSTRAINT IF EXISTS placements_candidate_id_fkey;
ALTER TABLE public.placements DROP COLUMN IF EXISTS candidate_id;
ALTER TABLE public.placements ADD COLUMN candidate_id uuid REFERENCES public.candidates(id) ON DELETE SET NULL;