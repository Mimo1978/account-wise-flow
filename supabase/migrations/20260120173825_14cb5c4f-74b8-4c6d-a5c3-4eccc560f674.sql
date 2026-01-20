-- Tighten executive tables: Remove company owner access, restrict to managers/admins only
-- This addresses scan findings about strategic insights being visible to individual contributors

-- ============================================================================
-- 1. executive_insights: Restrict to admin/manager only
-- ============================================================================
DROP POLICY IF EXISTS "executive_insights_select_policy" ON public.executive_insights;
DROP POLICY IF EXISTS "executive_insights_update_policy" ON public.executive_insights;

CREATE POLICY "executive_insights_select_policy" ON public.executive_insights 
FOR SELECT USING (
  check_demo_isolation(workspace_id, auth.uid()) 
  AND (
    has_role(auth.uid(), 'admin')
    OR (has_role(auth.uid(), 'manager') AND workspace_id = get_user_team_id(auth.uid()))
  )
);

CREATE POLICY "executive_insights_update_policy" ON public.executive_insights
FOR UPDATE USING (
  check_demo_isolation(workspace_id, auth.uid())
  AND (
    has_role(auth.uid(), 'admin')
    OR (has_role(auth.uid(), 'manager') AND workspace_id = get_user_team_id(auth.uid()))
  )
);

-- ============================================================================
-- 2. risk_signals: Restrict to admin/manager only
-- ============================================================================
DROP POLICY IF EXISTS "risk_signals_select_policy" ON public.risk_signals;

CREATE POLICY "risk_signals_select_policy" ON public.risk_signals
FOR SELECT USING (
  check_demo_isolation(workspace_id, auth.uid())
  AND (
    has_role(auth.uid(), 'admin')
    OR (has_role(auth.uid(), 'manager') AND workspace_id = get_user_team_id(auth.uid()))
  )
);

-- ============================================================================
-- 3. activity_summaries: Restrict to admin/manager only
-- ============================================================================
DROP POLICY IF EXISTS "activity_summaries_select_policy" ON public.activity_summaries;

CREATE POLICY "activity_summaries_select_policy" ON public.activity_summaries
FOR SELECT USING (
  check_demo_isolation(workspace_id, auth.uid())
  AND (
    has_role(auth.uid(), 'admin')
    OR (has_role(auth.uid(), 'manager') AND workspace_id = get_user_team_id(auth.uid()))
  )
);

-- ============================================================================
-- 4. relationship_coverage: Restrict to admin/manager only
-- ============================================================================
DROP POLICY IF EXISTS "relationship_coverage_select_policy" ON public.relationship_coverage;

CREATE POLICY "relationship_coverage_select_policy" ON public.relationship_coverage
FOR SELECT USING (
  check_demo_isolation(workspace_id, auth.uid())
  AND (
    has_role(auth.uid(), 'admin')
    OR (has_role(auth.uid(), 'manager') AND workspace_id = get_user_team_id(auth.uid()))
  )
);