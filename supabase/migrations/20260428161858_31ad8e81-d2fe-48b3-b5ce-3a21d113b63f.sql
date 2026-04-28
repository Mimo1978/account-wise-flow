-- Allow source = 'ai_call' on notes (was rejected by check, silently failing inserts)
ALTER TABLE public.notes DROP CONSTRAINT IF EXISTS notes_source_check;
ALTER TABLE public.notes ADD CONSTRAINT notes_source_check
  CHECK (source = ANY (ARRAY['ui'::text, 'ai_import'::text, 'api'::text, 'voice'::text, 'ai_call'::text, 'ai_email'::text, 'ai_sms'::text]));

-- Persist structured AI-call outcome on the outreach target
ALTER TABLE public.outreach_targets
  ADD COLUMN IF NOT EXISTS last_call_metadata jsonb,
  ADD COLUMN IF NOT EXISTS last_call_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_call_outcome text,
  ADD COLUMN IF NOT EXISTS last_call_transcript text,
  ADD COLUMN IF NOT EXISTS followup_email_pending boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS followup_email_topic text;

CREATE INDEX IF NOT EXISTS idx_outreach_targets_followup_pending
  ON public.outreach_targets(workspace_id) WHERE followup_email_pending;

COMMENT ON COLUMN public.outreach_targets.last_call_metadata IS
  'AI call structured outcome: { summary, outcome, sentiment, notice_period, availability, next_step, meeting_when, recording_url, email_followup_requested, followup_email_topic }';
COMMENT ON COLUMN public.outreach_targets.followup_email_pending IS
  'TRUE when the AI agent agreed to email the contact — picked up automatically and queued as a follow-up message';