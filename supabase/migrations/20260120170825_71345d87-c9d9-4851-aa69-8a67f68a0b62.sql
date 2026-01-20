-- Executive Insights Layer - Data Model
-- Purpose: Surface revenue risk, growth opportunities, reduce manual review dependency

-- ============================================
-- 1. EXECUTIVE INSIGHTS TABLE
-- Stores AI-generated executive-level insights
-- ============================================
CREATE TABLE public.executive_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL CHECK (insight_type IN (
    'relationship_coverage',
    'renewal_risk', 
    'contract_expiry',
    'missing_roles',
    'activity_summary',
    'growth_opportunity',
    'engagement_gap'
  )),
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('critical', 'warning', 'info', 'positive')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  related_contact_ids UUID[] DEFAULT '{}',
  related_entity_ids UUID[] DEFAULT '{}',
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  dismissed_by UUID,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for efficient queries
CREATE INDEX idx_executive_insights_workspace ON public.executive_insights(workspace_id);
CREATE INDEX idx_executive_insights_company ON public.executive_insights(company_id);
CREATE INDEX idx_executive_insights_type ON public.executive_insights(insight_type);
CREATE INDEX idx_executive_insights_severity ON public.executive_insights(severity);
CREATE INDEX idx_executive_insights_active ON public.executive_insights(workspace_id, is_dismissed, expires_at);

-- Enable RLS
ALTER TABLE public.executive_insights ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only workspace members can view insights
CREATE POLICY "Users can view insights in their workspace"
ON public.executive_insights FOR SELECT
USING (
  check_demo_isolation(workspace_id, auth.uid()) AND
  (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    (workspace_id = get_user_team_id(auth.uid()))
  )
);

CREATE POLICY "System can insert insights"
ON public.executive_insights FOR INSERT
WITH CHECK (
  check_demo_isolation(workspace_id, auth.uid()) AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
);

CREATE POLICY "Users can dismiss insights"
ON public.executive_insights FOR UPDATE
USING (
  check_demo_isolation(workspace_id, auth.uid()) AND
  (workspace_id = get_user_team_id(auth.uid()))
);

CREATE POLICY "Admins can delete insights"
ON public.executive_insights FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) AND
  check_demo_isolation(workspace_id, auth.uid())
);

-- ============================================
-- 2. RELATIONSHIP COVERAGE SCORES
-- Tracks penetration depth per company/department
-- ============================================
CREATE TABLE public.relationship_coverage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  department TEXT,
  coverage_score INTEGER NOT NULL DEFAULT 0 CHECK (coverage_score >= 0 AND coverage_score <= 100),
  executive_coverage BOOLEAN NOT NULL DEFAULT false,
  champion_count INTEGER NOT NULL DEFAULT 0,
  blocker_count INTEGER NOT NULL DEFAULT 0,
  total_contacts INTEGER NOT NULL DEFAULT 0,
  engaged_contacts INTEGER NOT NULL DEFAULT 0,
  last_engagement_date TIMESTAMP WITH TIME ZONE,
  gap_analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_relationship_coverage_workspace ON public.relationship_coverage(workspace_id);
CREATE INDEX idx_relationship_coverage_company ON public.relationship_coverage(company_id);
CREATE INDEX idx_relationship_coverage_score ON public.relationship_coverage(coverage_score);
CREATE UNIQUE INDEX idx_relationship_coverage_unique ON public.relationship_coverage(company_id, COALESCE(department, ''));

-- Enable RLS
ALTER TABLE public.relationship_coverage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view coverage in their workspace"
ON public.relationship_coverage FOR SELECT
USING (
  check_demo_isolation(workspace_id, auth.uid()) AND
  (workspace_id = get_user_team_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "System can upsert coverage"
ON public.relationship_coverage FOR ALL
USING (
  check_demo_isolation(workspace_id, auth.uid()) AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
);

-- ============================================
-- 3. RISK SIGNALS TABLE
-- Tracks renewal, expiry, and engagement risks
-- ============================================
CREATE TABLE public.risk_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  risk_type TEXT NOT NULL CHECK (risk_type IN (
    'renewal_risk',
    'contract_expiry',
    'champion_departure',
    'engagement_decline',
    'blocker_escalation',
    'coverage_gap',
    'activity_stall'
  )),
  risk_level TEXT NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('critical', 'high', 'medium', 'low')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  trigger_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommended_actions TEXT[],
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by UUID,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_risk_signals_workspace ON public.risk_signals(workspace_id);
CREATE INDEX idx_risk_signals_company ON public.risk_signals(company_id);
CREATE INDEX idx_risk_signals_type ON public.risk_signals(risk_type);
CREATE INDEX idx_risk_signals_level ON public.risk_signals(risk_level);
CREATE INDEX idx_risk_signals_active ON public.risk_signals(workspace_id, is_resolved, due_date);

-- Enable RLS
ALTER TABLE public.risk_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view risks in their workspace"
ON public.risk_signals FOR SELECT
USING (
  check_demo_isolation(workspace_id, auth.uid()) AND
  (workspace_id = get_user_team_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Managers can manage risks"
ON public.risk_signals FOR ALL
USING (
  check_demo_isolation(workspace_id, auth.uid()) AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
);

-- ============================================
-- 4. ACTIVITY SUMMARIES TABLE
-- Aggregated team activity for executive view
-- ============================================
CREATE TABLE public.activity_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  summary_type TEXT NOT NULL CHECK (summary_type IN ('daily', 'weekly', 'monthly')),
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Metrics structure: {
  --   meetings_count, calls_count, emails_count, notes_added,
  --   contacts_added, contacts_updated, engagement_changes,
  --   top_topics: [], active_users: []
  -- }
  ai_summary TEXT,
  highlights TEXT[],
  concerns TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_activity_summaries_workspace ON public.activity_summaries(workspace_id);
CREATE INDEX idx_activity_summaries_company ON public.activity_summaries(company_id);
CREATE INDEX idx_activity_summaries_period ON public.activity_summaries(period_start, period_end);
CREATE UNIQUE INDEX idx_activity_summaries_unique ON public.activity_summaries(workspace_id, COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid), period_start, summary_type);

-- Enable RLS
ALTER TABLE public.activity_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view summaries in their workspace"
ON public.activity_summaries FOR SELECT
USING (
  check_demo_isolation(workspace_id, auth.uid()) AND
  (workspace_id = get_user_team_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "System can create summaries"
ON public.activity_summaries FOR INSERT
WITH CHECK (
  check_demo_isolation(workspace_id, auth.uid()) AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
);

-- ============================================
-- 5. EXECUTIVE QUERIES LOG
-- Tracks natural language questions for learning
-- ============================================
CREATE TABLE public.executive_queries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  query_text TEXT NOT NULL,
  query_type TEXT CHECK (query_type IN (
    'exposure_analysis',
    'next_action',
    'contract_review',
    'coverage_check',
    'risk_assessment',
    'general'
  )),
  response_summary TEXT,
  response_data JSONB,
  feedback_rating INTEGER CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_executive_queries_workspace ON public.executive_queries(workspace_id);
CREATE INDEX idx_executive_queries_user ON public.executive_queries(user_id);
CREATE INDEX idx_executive_queries_type ON public.executive_queries(query_type);

-- Enable RLS
ALTER TABLE public.executive_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own queries"
ON public.executive_queries FOR SELECT
USING (user_id = auth.uid() AND check_demo_isolation(workspace_id, auth.uid()));

CREATE POLICY "Users can create queries"
ON public.executive_queries FOR INSERT
WITH CHECK (user_id = auth.uid() AND check_demo_isolation(workspace_id, auth.uid()));

CREATE POLICY "Users can rate their queries"
ON public.executive_queries FOR UPDATE
USING (user_id = auth.uid() AND check_demo_isolation(workspace_id, auth.uid()));

-- ============================================
-- 6. TRIGGERS FOR UPDATED_AT
-- ============================================
CREATE TRIGGER update_executive_insights_updated_at
  BEFORE UPDATE ON public.executive_insights
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_relationship_coverage_updated_at
  BEFORE UPDATE ON public.relationship_coverage
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_risk_signals_updated_at
  BEFORE UPDATE ON public.risk_signals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();