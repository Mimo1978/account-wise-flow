
ALTER TABLE public.engagements ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE SET NULL;

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS hiring_manager_id UUID REFERENCES public.crm_contacts(id) ON DELETE SET NULL;
