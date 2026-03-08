-- Add reply tracking columns to outreach_messages
ALTER TABLE public.outreach_messages
ADD COLUMN IF NOT EXISTS reply_content TEXT,
ADD COLUMN IF NOT EXISTS replied_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS parsed_interest TEXT,
ADD COLUMN IF NOT EXISTS parsed_availability_text TEXT,
ADD COLUMN IF NOT EXISTS parsed_availability_date DATE,
ADD COLUMN IF NOT EXISTS parsed_preferred_contact TEXT,
ADD COLUMN IF NOT EXISTS parsed_questions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS parsed_sentiment TEXT;

-- Create index for reply tracking queries
CREATE INDEX IF NOT EXISTS idx_outreach_messages_replied_at ON public.outreach_messages(replied_at) WHERE replied_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_outreach_messages_job_interest ON public.outreach_messages(job_id, parsed_interest) WHERE parsed_interest IS NOT NULL;