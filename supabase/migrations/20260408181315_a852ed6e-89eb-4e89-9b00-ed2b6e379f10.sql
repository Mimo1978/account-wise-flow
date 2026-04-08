
ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS deal_type text DEFAULT 'contractor' CHECK (deal_type IN ('contractor','permanent','consulting'));

ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS candidate_id uuid REFERENCES public.candidates(id) ON DELETE SET NULL;

ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS engagement_id uuid REFERENCES public.engagements(id) ON DELETE SET NULL;

ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS day_rate numeric;

ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS salary numeric;

ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS fee_percentage numeric DEFAULT 20;

ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS billing_email text;
