ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS sender_name TEXT,
  ADD COLUMN IF NOT EXISTS sender_email TEXT,
  ADD COLUMN IF NOT EXISTS sender_phone TEXT,
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS source_channel TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS ai_intent TEXT,
  ADD COLUMN IF NOT EXISTS ai_sentiment TEXT,
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS ai_draft_reply TEXT,
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS responded_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS raw_payload JSONB;

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS inbound_api_key TEXT DEFAULT encode(gen_random_bytes(32), 'hex');

CREATE POLICY "Service role can insert leads" ON public.leads
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Service role can update leads" ON public.leads
  FOR UPDATE TO service_role USING (true);