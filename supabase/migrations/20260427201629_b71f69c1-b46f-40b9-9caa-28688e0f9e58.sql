ALTER TABLE public.outreach_scripts
  ADD COLUMN IF NOT EXISTS call_blocks jsonb,
  ADD COLUMN IF NOT EXISTS guardrails jsonb,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;