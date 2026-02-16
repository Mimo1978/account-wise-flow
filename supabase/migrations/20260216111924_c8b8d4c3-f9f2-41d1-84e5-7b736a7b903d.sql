-- Add ceo_contact_id to companies table
ALTER TABLE public.companies
ADD COLUMN ceo_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;