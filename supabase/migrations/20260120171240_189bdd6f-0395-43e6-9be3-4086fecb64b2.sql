-- Security Hardening Migration
-- Fixes: audit log tampering, executive insights access, role-based restrictions

-- ============================================
-- 1. HARDEN AUDIT LOG - Prevent user insertion
-- Only triggers should insert audit logs
-- ============================================

-- Drop the overly permissive insert policy
DROP POLICY IF EXISTS "Only authenticated users can insert audit logs" ON public.audit_log;

-- Create restrictive policy: Only allow inserts from database triggers (no direct user access)
-- This works because triggers run with SECURITY DEFINER and bypass RLS
CREATE POLICY "audit_log_insert_denied_to_users"
ON public.audit_log FOR INSERT
TO authenticated
WITH CHECK (false);  -- Deny all direct user inserts; triggers bypass RLS

-- Also ensure service role can insert (for edge functions that need to log)
-- Note: Service role bypasses RLS by default

-- ============================================
-- 2. HARDEN EXECUTIVE INSIGHTS - Admin/Manager only
-- ============================================

DROP POLICY IF EXISTS "Users can view insights in their workspace" ON public.executive_insights;

CREATE POLICY "Only admins and managers can view executive insights"
ON public.executive_insights FOR SELECT
USING (
  check_demo_isolation(workspace_id, auth.uid()) AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
);

-- ============================================
-- 3. HARDEN RISK SIGNALS - Admin/Manager/Account Owner only
-- ============================================

DROP POLICY IF EXISTS "Users can view risks in their workspace" ON public.risk_signals;

CREATE POLICY "Only admins managers and owners can view risk signals"
ON public.risk_signals FOR SELECT
USING (
  check_demo_isolation(workspace_id, auth.uid()) AND
  (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR
    -- Company owner can see their company's risks
    EXISTS (
      SELECT 1 FROM public.companies 
      WHERE id = risk_signals.company_id 
      AND owner_id = auth.uid()
    )
  )
);

-- ============================================
-- 4. HARDEN ACTIVITY SUMMARIES - Admin/Manager only
-- ============================================

DROP POLICY IF EXISTS "Users can view summaries in their workspace" ON public.activity_summaries;

CREATE POLICY "Only admins and managers can view activity summaries"
ON public.activity_summaries FOR SELECT
USING (
  check_demo_isolation(workspace_id, auth.uid()) AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
);

-- ============================================
-- 5. HARDEN RELATIONSHIP COVERAGE - Admin/Manager/Account Owner only
-- ============================================

DROP POLICY IF EXISTS "Users can view coverage in their workspace" ON public.relationship_coverage;

CREATE POLICY "Only admins managers and owners can view coverage"
ON public.relationship_coverage FOR SELECT
USING (
  check_demo_isolation(workspace_id, auth.uid()) AND
  (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR
    -- Company owner can see their coverage
    EXISTS (
      SELECT 1 FROM public.companies 
      WHERE id = relationship_coverage.company_id 
      AND owner_id = auth.uid()
    )
  )
);

-- ============================================
-- 6. HARDEN EXECUTIVE QUERIES - User's own queries only
-- Already correct but let's ensure it's strict
-- ============================================

-- No changes needed - already restricted to user_id = auth.uid()

-- ============================================
-- 7. Add function to validate edge function access
-- For use in edge functions to verify proper authorization
-- ============================================

CREATE OR REPLACE FUNCTION public.can_access_executive_features(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT (
    public.has_role(_user_id, 'admin'::app_role) OR 
    public.has_role(_user_id, 'manager'::app_role)
  )
$$;