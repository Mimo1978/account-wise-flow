
-- Add script assignment and calling settings columns to outreach_campaigns
ALTER TABLE public.outreach_campaigns
  ADD COLUMN IF NOT EXISTS email_script_id uuid REFERENCES public.outreach_scripts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sms_script_id uuid REFERENCES public.outreach_scripts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS call_script_id uuid REFERENCES public.outreach_scripts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS calendar_connection_id text,
  ADD COLUMN IF NOT EXISTS calling_hours_start time DEFAULT '09:00:00'::time,
  ADD COLUMN IF NOT EXISTS calling_hours_end time DEFAULT '18:00:00'::time,
  ADD COLUMN IF NOT EXISTS max_call_attempts integer DEFAULT 3,
  ADD COLUMN IF NOT EXISTS opt_out_required boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS calling_timezone text DEFAULT 'UTC';
