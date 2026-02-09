
-- Add missing columns to companies table for full CRM functionality
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS headquarters text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS switchboard text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS regions text[] DEFAULT '{}';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS relationship_status text DEFAULT 'warm';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS account_manager text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS notes text;
