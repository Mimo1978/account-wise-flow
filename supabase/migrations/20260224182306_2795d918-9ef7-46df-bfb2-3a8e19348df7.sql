
-- =============================================================
-- AUTOMATED OUTREACH ARCHITECTURE
-- =============================================================

-- 1. Subscription tier enum and premium flag on workspace
CREATE TYPE public.subscription_tier AS ENUM ('free', 'starter', 'professional', 'premium');

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS subscription_tier subscription_tier NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- 2. Calendar connections (Google / Microsoft OAuth tokens)
CREATE TABLE public.calendar_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('google', 'microsoft')),
  provider_account_email text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  calendar_id text DEFAULT 'primary',
  is_active boolean NOT NULL DEFAULT true,
  auto_schedule_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id, provider)
);

ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own calendar connections"
  ON public.calendar_connections FOR ALL
  USING (auth.uid() = user_id);

CREATE TRIGGER update_calendar_connections_updated_at
  BEFORE UPDATE ON public.calendar_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Inbound responses - AI processes email/SMS replies
CREATE TABLE public.outreach_inbound_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.outreach_campaigns(id) ON DELETE SET NULL,
  target_id uuid REFERENCES public.outreach_targets(id) ON DELETE SET NULL,
  candidate_id uuid REFERENCES public.candidates(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'sms', 'voicemail', 'other')),
  raw_content text NOT NULL,
  sender_identifier text,
  received_at timestamptz NOT NULL DEFAULT now(),
  -- AI classification fields
  ai_intent text CHECK (ai_intent IN (
    'interested', 'not_interested', 'meeting_request', 'callback_request',
    'info_request', 'opt_out', 'out_of_office', 'forwarded', 'unclassified'
  )),
  ai_sentiment text CHECK (ai_sentiment IN ('positive', 'neutral', 'negative')),
  ai_summary text,
  ai_confidence numeric(3,2),
  ai_processed_at timestamptz,
  ai_raw_analysis jsonb,
  -- Follow-up scheduling
  follow_up_type text CHECK (follow_up_type IN ('meeting', 'call', 'email', 'none')),
  follow_up_scheduled_at timestamptz,
  follow_up_calendar_event_id text,
  follow_up_status text DEFAULT 'pending' CHECK (follow_up_status IN ('pending', 'scheduled', 'confirmed', 'failed', 'skipped')),
  -- Processing status
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processing', 'classified', 'actioned', 'failed')),
  actioned_by uuid,
  actioned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.outreach_inbound_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view inbound responses"
  ON public.outreach_inbound_responses FOR SELECT
  USING (workspace_id IN (
    SELECT team_id FROM public.user_roles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Workspace members can insert inbound responses"
  ON public.outreach_inbound_responses FOR INSERT
  WITH CHECK (workspace_id IN (
    SELECT team_id FROM public.user_roles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Workspace members can update inbound responses"
  ON public.outreach_inbound_responses FOR UPDATE
  USING (workspace_id IN (
    SELECT team_id FROM public.user_roles WHERE user_id = auth.uid()
  ));

CREATE TRIGGER update_inbound_responses_updated_at
  BEFORE UPDATE ON public.outreach_inbound_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Scheduled actions queue (AI-created follow-ups)
CREATE TABLE public.outreach_scheduled_actions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.outreach_campaigns(id) ON DELETE SET NULL,
  target_id uuid REFERENCES public.outreach_targets(id) ON DELETE SET NULL,
  inbound_response_id uuid REFERENCES public.outreach_inbound_responses(id) ON DELETE SET NULL,
  action_type text NOT NULL CHECK (action_type IN ('calendar_booking', 'callback', 'follow_up_email', 'follow_up_sms', 'ai_call')),
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'executed', 'cancelled', 'failed')),
  requires_approval boolean NOT NULL DEFAULT true,
  approved_by uuid,
  approved_at timestamptz,
  execution_result jsonb,
  executed_at timestamptz,
  -- Calendar booking details
  calendar_connection_id uuid REFERENCES public.calendar_connections(id) ON DELETE SET NULL,
  calendar_event_id text,
  meeting_title text,
  meeting_duration_minutes integer DEFAULT 30,
  meeting_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.outreach_scheduled_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can manage scheduled actions"
  ON public.outreach_scheduled_actions FOR ALL
  USING (workspace_id IN (
    SELECT team_id FROM public.user_roles WHERE user_id = auth.uid()
  ));

CREATE TRIGGER update_scheduled_actions_updated_at
  BEFORE UPDATE ON public.outreach_scheduled_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Automation settings per campaign
CREATE TABLE public.outreach_automation_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.outreach_campaigns(id) ON DELETE CASCADE UNIQUE,
  workspace_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  -- AI response processing
  ai_response_processing_enabled boolean NOT NULL DEFAULT false,
  auto_classify_responses boolean NOT NULL DEFAULT true,
  auto_log_feedback boolean NOT NULL DEFAULT true,
  -- Calendar auto-scheduling
  auto_schedule_meetings boolean NOT NULL DEFAULT false,
  auto_schedule_callbacks boolean NOT NULL DEFAULT false,
  preferred_calendar_connection_id uuid REFERENCES public.calendar_connections(id) ON DELETE SET NULL,
  meeting_buffer_minutes integer DEFAULT 15,
  default_meeting_duration integer DEFAULT 30,
  scheduling_window_days integer DEFAULT 5,
  -- AI Agent behavior
  ai_acknowledge_responses boolean NOT NULL DEFAULT false,
  ai_send_confirmations boolean NOT NULL DEFAULT false,
  require_human_approval boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.outreach_automation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can manage automation settings"
  ON public.outreach_automation_settings FOR ALL
  USING (workspace_id IN (
    SELECT team_id FROM public.user_roles WHERE user_id = auth.uid()
  ));

CREATE TRIGGER update_automation_settings_updated_at
  BEFORE UPDATE ON public.outreach_automation_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Helper function: check premium subscription
CREATE OR REPLACE FUNCTION public.is_premium_workspace(_workspace_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams
    WHERE id = _workspace_id
      AND subscription_tier = 'premium'
      AND (subscription_expires_at IS NULL OR subscription_expires_at > now())
  )
$$;

-- 7. Add indexes for performance
CREATE INDEX idx_inbound_responses_workspace ON public.outreach_inbound_responses(workspace_id);
CREATE INDEX idx_inbound_responses_campaign ON public.outreach_inbound_responses(campaign_id);
CREATE INDEX idx_inbound_responses_target ON public.outreach_inbound_responses(target_id);
CREATE INDEX idx_inbound_responses_status ON public.outreach_inbound_responses(status);
CREATE INDEX idx_scheduled_actions_workspace ON public.outreach_scheduled_actions(workspace_id);
CREATE INDEX idx_scheduled_actions_status ON public.outreach_scheduled_actions(status, scheduled_for);
CREATE INDEX idx_calendar_connections_user ON public.calendar_connections(user_id);

-- 8. Enable realtime for inbound responses (live updates in UI)
ALTER PUBLICATION supabase_realtime ADD TABLE public.outreach_inbound_responses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.outreach_scheduled_actions;
