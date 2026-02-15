
-- Add manager_id column to contacts table (self-referencing FK)
ALTER TABLE public.contacts
  ADD COLUMN manager_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;

-- Index for fast child lookups
CREATE INDEX idx_contacts_manager_id ON public.contacts(manager_id);
