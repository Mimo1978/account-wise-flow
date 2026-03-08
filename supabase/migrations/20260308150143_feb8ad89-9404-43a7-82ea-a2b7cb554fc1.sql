-- Add channel column if not exists and phone fields to outreach_messages
ALTER TABLE public.outreach_messages 
ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'email',
ADD COLUMN IF NOT EXISTS candidate_phone text,
ADD COLUMN IF NOT EXISTS sms_body text,
ADD COLUMN IF NOT EXISTS ai_call_script text,
ADD COLUMN IF NOT EXISTS twilio_sid text;

-- Create index for channel queries
CREATE INDEX IF NOT EXISTS idx_outreach_messages_channel ON public.outreach_messages(channel);

-- Add workspace setting for AI call enablement
-- This will be stored in workspace_settings.outreach_rules JSON