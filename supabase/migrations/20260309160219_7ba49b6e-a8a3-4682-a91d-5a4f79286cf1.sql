ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.teams(id);
ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS probability integer DEFAULT 50;
ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS expected_close_date date;
ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS next_step text;
ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS next_step_due date;
ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS engagement_id uuid;

CREATE INDEX IF NOT EXISTS idx_crm_deals_workspace_id ON public.crm_deals(workspace_id);