
-- Add AI call runtime fields to outreach_targets
ALTER TABLE public.outreach_targets
  ADD COLUMN IF NOT EXISTS do_not_call boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS do_not_contact boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_status text DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS call_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_call_attempts integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS calling_hours_start time DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS calling_hours_end time DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS calling_timezone text DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS availability_date timestamptz,
  ADD COLUMN IF NOT EXISTS next_action_at timestamptz,
  ADD COLUMN IF NOT EXISTS booked_meeting_id text;

-- Add AI call runtime fields to call_outcomes
ALTER TABLE public.call_outcomes
  ADD COLUMN IF NOT EXISTS ai_transcript jsonb,
  ADD COLUMN IF NOT EXISTS structured_answers jsonb,
  ADD COLUMN IF NOT EXISTS availability_date timestamptz,
  ADD COLUMN IF NOT EXISTS notice_period text,
  ADD COLUMN IF NOT EXISTS interest_level text,
  ADD COLUMN IF NOT EXISTS best_callback_time text,
  ADD COLUMN IF NOT EXISTS call_type text DEFAULT 'manual';

-- Index for next_action_at scheduling
CREATE INDEX IF NOT EXISTS idx_outreach_targets_next_action_at
  ON public.outreach_targets(next_action_at)
  WHERE next_action_at IS NOT NULL;

-- Index for call attempts filter
CREATE INDEX IF NOT EXISTS idx_outreach_targets_call_state
  ON public.outreach_targets(do_not_call, do_not_contact, state);
