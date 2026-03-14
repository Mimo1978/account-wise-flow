
ALTER TABLE public.engagements ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.engagements ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;
ALTER TABLE public.engagements ADD COLUMN IF NOT EXISTS deletion_reason text DEFAULT NULL;
ALTER TABLE public.engagements ADD COLUMN IF NOT EXISTS deletion_scheduled_purge_at timestamptz DEFAULT NULL;
