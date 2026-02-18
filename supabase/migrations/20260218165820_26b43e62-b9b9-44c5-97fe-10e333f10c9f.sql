
-- =====================================================
-- OUTREACH MODULE SCHEMA
-- outreach_campaigns, outreach_targets, outreach_scripts, outreach_events, call_outcomes
-- =====================================================

-- Enum types
CREATE TYPE public.outreach_channel AS ENUM ('email', 'sms', 'call', 'linkedin', 'other');
CREATE TYPE public.outreach_target_state AS ENUM ('queued', 'contacted', 'responded', 'booked', 'snoozed', 'opted_out', 'converted');
CREATE TYPE public.outreach_campaign_status AS ENUM ('draft', 'active', 'paused', 'completed', 'archived');
CREATE TYPE public.outreach_event_type AS ENUM ('email_sent', 'sms_sent', 'call_made', 'call_scheduled', 'call_completed', 'responded', 'booked', 'snoozed', 'opted_out', 'note_added', 'status_changed', 'added_to_campaign');
CREATE TYPE public.call_outcome_type AS ENUM ('connected', 'voicemail', 'no_answer', 'busy', 'wrong_number', 'interested', 'not_interested', 'callback_requested', 'meeting_booked');

-- =====================================================
-- outreach_campaigns
-- =====================================================
CREATE TABLE public.outreach_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status public.outreach_campaign_status NOT NULL DEFAULT 'draft',
  channel public.outreach_channel NOT NULL DEFAULT 'email',
  job_spec_id UUID REFERENCES public.job_specs(id) ON DELETE SET NULL,
  owner_id UUID,
  target_count INT NOT NULL DEFAULT 0,
  contacted_count INT NOT NULL DEFAULT 0,
  response_count INT NOT NULL DEFAULT 0,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.outreach_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can view campaigns"
  ON public.outreach_campaigns FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND team_id = workspace_id)
  );

CREATE POLICY "workspace members can insert campaigns"
  ON public.outreach_campaigns FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND team_id = workspace_id)
  );

CREATE POLICY "workspace members can update campaigns"
  ON public.outreach_campaigns FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND team_id = workspace_id)
  );

CREATE POLICY "workspace members can delete campaigns"
  ON public.outreach_campaigns FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.team_id = workspace_id
      AND ur.role IN ('admin', 'manager'))
  );

-- =====================================================
-- outreach_scripts
-- =====================================================
CREATE TABLE public.outreach_scripts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.outreach_campaigns(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  channel public.outreach_channel NOT NULL DEFAULT 'email',
  subject TEXT,
  body TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.outreach_scripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can view scripts"
  ON public.outreach_scripts FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND team_id = workspace_id)
  );

CREATE POLICY "workspace members can manage scripts"
  ON public.outreach_scripts FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND team_id = workspace_id)
  );

-- =====================================================
-- outreach_targets
-- =====================================================
CREATE TABLE public.outreach_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.outreach_campaigns(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  entity_name TEXT NOT NULL,
  entity_email TEXT,
  entity_phone TEXT,
  entity_title TEXT,
  entity_company TEXT,
  state public.outreach_target_state NOT NULL DEFAULT 'queued',
  priority INT NOT NULL DEFAULT 5,
  assigned_to UUID,
  snooze_until TIMESTAMPTZ,
  opt_out_reason TEXT,
  last_contacted_at TIMESTAMPTZ,
  next_action TEXT,
  next_action_due TIMESTAMPTZ,
  notes TEXT,
  added_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT outreach_target_has_entity CHECK (candidate_id IS NOT NULL OR contact_id IS NOT NULL)
);

ALTER TABLE public.outreach_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can view targets"
  ON public.outreach_targets FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND team_id = workspace_id)
  );

CREATE POLICY "workspace members can insert targets"
  ON public.outreach_targets FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND team_id = workspace_id)
  );

CREATE POLICY "workspace members can update targets"
  ON public.outreach_targets FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND team_id = workspace_id)
  );

CREATE POLICY "workspace members can delete targets"
  ON public.outreach_targets FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.team_id = workspace_id
      AND ur.role IN ('admin', 'manager'))
  );

-- =====================================================
-- outreach_events  (immutable audit trail)
-- =====================================================
CREATE TABLE public.outreach_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.outreach_campaigns(id) ON DELETE SET NULL,
  target_id UUID REFERENCES public.outreach_targets(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  event_type public.outreach_event_type NOT NULL,
  channel public.outreach_channel,
  subject TEXT,
  body TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  performed_by UUID,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.outreach_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can view events"
  ON public.outreach_events FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND team_id = workspace_id)
  );

CREATE POLICY "workspace members can insert events"
  ON public.outreach_events FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND team_id = workspace_id)
  );

-- No UPDATE or DELETE on events - immutable audit trail

-- =====================================================
-- call_outcomes
-- =====================================================
CREATE TABLE public.call_outcomes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES public.outreach_targets(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.outreach_events(id) ON DELETE SET NULL,
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  outcome public.call_outcome_type NOT NULL,
  duration_seconds INT,
  notes TEXT,
  follow_up_action TEXT,
  follow_up_due TIMESTAMPTZ,
  caller_id UUID,
  called_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.call_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can view call outcomes"
  ON public.call_outcomes FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND team_id = workspace_id)
  );

CREATE POLICY "workspace members can manage call outcomes"
  ON public.call_outcomes FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND team_id = workspace_id)
  );

-- =====================================================
-- Triggers: updated_at
-- =====================================================
CREATE TRIGGER update_outreach_campaigns_updated_at
  BEFORE UPDATE ON public.outreach_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_outreach_scripts_updated_at
  BEFORE UPDATE ON public.outreach_scripts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_outreach_targets_updated_at
  BEFORE UPDATE ON public.outreach_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_call_outcomes_updated_at
  BEFORE UPDATE ON public.call_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- Indexes for performance
-- =====================================================
CREATE INDEX idx_outreach_targets_campaign ON public.outreach_targets(campaign_id);
CREATE INDEX idx_outreach_targets_state ON public.outreach_targets(state);
CREATE INDEX idx_outreach_targets_workspace ON public.outreach_targets(workspace_id);
CREATE INDEX idx_outreach_events_target ON public.outreach_events(target_id);
CREATE INDEX idx_outreach_events_workspace ON public.outreach_events(workspace_id);
CREATE INDEX idx_outreach_campaigns_workspace ON public.outreach_campaigns(workspace_id);
CREATE INDEX idx_call_outcomes_target ON public.call_outcomes(target_id);
