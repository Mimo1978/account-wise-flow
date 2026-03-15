ALTER TABLE public.commercial_documents 
ADD COLUMN IF NOT EXISTS deletion_scheduled_purge_at timestamptz DEFAULT NULL;