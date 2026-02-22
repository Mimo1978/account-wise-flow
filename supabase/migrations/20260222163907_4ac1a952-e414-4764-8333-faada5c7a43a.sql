
-- Add app_name and email_signature_footer to workspace_branding
ALTER TABLE public.workspace_branding
ADD COLUMN IF NOT EXISTS app_name text,
ADD COLUMN IF NOT EXISTS email_signature_footer text;
