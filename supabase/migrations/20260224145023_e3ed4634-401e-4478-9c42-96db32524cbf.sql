
-- Add engagement_id to outreach tables
ALTER TABLE public.outreach_campaigns
  ADD COLUMN IF NOT EXISTS engagement_id uuid REFERENCES public.engagements(id);

ALTER TABLE public.outreach_targets
  ADD COLUMN IF NOT EXISTS engagement_id uuid REFERENCES public.engagements(id);

ALTER TABLE public.outreach_events
  ADD COLUMN IF NOT EXISTS engagement_id uuid REFERENCES public.engagements(id);

ALTER TABLE public.outreach_scripts
  ADD COLUMN IF NOT EXISTS engagement_id uuid REFERENCES public.engagements(id);

ALTER TABLE public.call_outcomes
  ADD COLUMN IF NOT EXISTS engagement_id uuid REFERENCES public.engagements(id);

-- Indexes for workspace + engagement_id queries
CREATE INDEX IF NOT EXISTS idx_outreach_campaigns_engagement ON public.outreach_campaigns(workspace_id, engagement_id);
CREATE INDEX IF NOT EXISTS idx_outreach_targets_engagement ON public.outreach_targets(workspace_id, engagement_id);
CREATE INDEX IF NOT EXISTS idx_outreach_events_engagement ON public.outreach_events(workspace_id, engagement_id);
CREATE INDEX IF NOT EXISTS idx_outreach_scripts_engagement ON public.outreach_scripts(workspace_id, engagement_id);
CREATE INDEX IF NOT EXISTS idx_call_outcomes_engagement ON public.call_outcomes(workspace_id, engagement_id);
