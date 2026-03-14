
ALTER TABLE public.engagements
ADD COLUMN IF NOT EXISTS hiring_manager_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL;
