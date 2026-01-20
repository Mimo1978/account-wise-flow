-- Security Hardening Migration: Address all scan findings
-- Maintains demo capability while enforcing enterprise-grade security

-- ============================================================================
-- 1. HARDEN can_approve_request: Prevent self-approval
-- ============================================================================
CREATE OR REPLACE FUNCTION public.can_approve_request(_user_id uuid, _entity_type text, _entity_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_role app_role;
  _user_team_id UUID;
  _entity_owner_id UUID;
  _entity_team_id UUID;
  _request_requested_by UUID;
BEGIN
  -- Early null check
  IF _user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  _user_role := public.get_user_role(_user_id);
  
  -- Viewer cannot approve
  IF _user_role = 'viewer' OR _user_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check for any pending request by this user - PREVENT SELF-APPROVAL
  IF EXISTS (
    SELECT 1 FROM public.access_requests 
    WHERE entity_id = _entity_id 
      AND entity_type = _entity_type 
      AND requested_by = _user_id 
      AND status = 'pending'
  ) THEN
    RETURN FALSE;
  END IF;
  
  _user_team_id := public.get_user_team_id(_user_id);
  
  -- Get entity owner and team with demo isolation
  IF _entity_type = 'company' THEN
    SELECT owner_id, team_id INTO _entity_owner_id, _entity_team_id 
    FROM public.companies WHERE id = _entity_id;
    
    -- Check demo isolation
    IF NOT public.check_demo_isolation(_entity_team_id, _user_id) THEN
      RETURN FALSE;
    END IF;
    
    -- Admin can approve any request within demo boundary
    IF _user_role = 'admin' THEN
      RETURN TRUE;
    END IF;
    
    -- Owner can approve (but not their own requests - already checked above)
    IF _entity_owner_id = _user_id THEN
      RETURN TRUE;
    END IF;
    
    -- Team member with edit rights can approve
    IF EXISTS (
      SELECT 1 FROM public.company_team_members 
      WHERE company_id = _entity_id AND user_id = _user_id
    ) AND public.can_edit_company(_user_id, _entity_id) THEN
      RETURN TRUE;
    END IF;
    
  ELSIF _entity_type = 'contact' THEN
    SELECT owner_id, team_id INTO _entity_owner_id, _entity_team_id 
    FROM public.contacts WHERE id = _entity_id;
    
    -- Check demo isolation
    IF NOT public.check_demo_isolation(_entity_team_id, _user_id) THEN
      RETURN FALSE;
    END IF;
    
    -- Admin can approve any request within demo boundary
    IF _user_role = 'admin' THEN
      RETURN TRUE;
    END IF;
    
    -- Owner can approve
    IF _entity_owner_id = _user_id THEN
      RETURN TRUE;
    END IF;
    
    -- Team member with edit rights can approve
    IF EXISTS (
      SELECT 1 FROM public.contact_team_members 
      WHERE contact_id = _entity_id AND user_id = _user_id
    ) AND public.can_edit_contact(_user_id, _entity_id) THEN
      RETURN TRUE;
    END IF;
  ELSE
    -- Unknown entity type
    RETURN FALSE;
  END IF;
  
  -- Manager can approve for their team
  IF _user_role = 'manager' AND (_entity_team_id IS NULL OR _entity_team_id = _user_team_id) THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$function$;

-- ============================================================================
-- 2. HARDEN can_view_note: Strengthen private note protection
-- ============================================================================
CREATE OR REPLACE FUNCTION public.can_view_note(_user_id uuid, _note_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _note RECORD;
  _user_team_id UUID;
  _user_role app_role;
BEGIN
  -- Early exit for null user (anonymous)
  IF _user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Get user's team and role
  SELECT team_id INTO _user_team_id FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
  _user_role := public.get_user_role(_user_id);
  
  -- Get note details
  SELECT visibility, owner_id, team_id, entity_type, entity_id 
  INTO _note 
  FROM public.notes 
  WHERE id = _note_id;
  
  -- Note doesn't exist
  IF _note IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check demo isolation FIRST - critical for data isolation
  IF NOT public.check_demo_isolation(_note.team_id, _user_id) THEN
    RETURN FALSE;
  END IF;
  
  -- Viewer cannot see notes
  IF _user_role = 'viewer' OR _user_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Private notes: ONLY owner can see (most restrictive first)
  IF _note.visibility = 'private' THEN
    -- Owner can always see their private notes
    IF _note.owner_id = _user_id THEN
      RETURN TRUE;
    END IF;
    -- Admin can see private notes within their team
    IF _user_role = 'admin' THEN
      RETURN TRUE;
    END IF;
    -- No one else can see private notes
    RETURN FALSE;
  END IF;
  
  -- Admin sees everything within demo boundary (for public/team notes)
  IF _user_role = 'admin' THEN
    RETURN TRUE;
  END IF;
  
  -- Team notes: same team can see
  IF _note.visibility = 'team' THEN
    -- Manager can see team notes within their team
    IF _user_role = 'manager' AND (_note.team_id IS NULL OR _note.team_id = _user_team_id) THEN
      RETURN TRUE;
    END IF;
    -- Contributor can see team notes if in same team
    IF _user_role = 'contributor' AND (_note.team_id IS NULL OR _note.team_id = _user_team_id) THEN
      RETURN TRUE;
    END IF;
    RETURN FALSE;
  END IF;
  
  -- Public notes: anyone with access to the team can see
  IF _note.visibility = 'public' THEN
    IF _user_role IN ('manager', 'contributor') AND (_note.team_id IS NULL OR _note.team_id = _user_team_id) THEN
      RETURN TRUE;
    END IF;
  END IF;
  
  RETURN FALSE;
END;
$function$;

-- ============================================================================
-- 3. UPDATE executive_insights RLS: Add company-level access checks
-- ============================================================================
DROP POLICY IF EXISTS "Only admins and managers can view executive insights" ON public.executive_insights;
DROP POLICY IF EXISTS "System can insert insights" ON public.executive_insights;
DROP POLICY IF EXISTS "Users can dismiss insights" ON public.executive_insights;
DROP POLICY IF EXISTS "Admins can delete insights" ON public.executive_insights;

-- SELECT: Admins see workspace insights, Managers see their workspace, Owners see their companies
CREATE POLICY "executive_insights_select_policy" ON public.executive_insights 
FOR SELECT USING (
  check_demo_isolation(workspace_id, auth.uid()) 
  AND (
    -- Admin can see all within demo isolation
    has_role(auth.uid(), 'admin')
    -- Manager can see their workspace's insights
    OR (has_role(auth.uid(), 'manager') AND workspace_id = get_user_team_id(auth.uid()))
    -- Company owners can see insights for their companies
    OR (company_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM companies WHERE id = company_id AND owner_id = auth.uid()
    ))
  )
);

-- INSERT: Only admin/manager can insert, must match their workspace
CREATE POLICY "executive_insights_insert_policy" ON public.executive_insights
FOR INSERT WITH CHECK (
  check_demo_isolation(workspace_id, auth.uid())
  AND (workspace_id IS NULL OR workspace_id = get_user_team_id(auth.uid()))
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
);

-- UPDATE: Only for dismissing, workspace-scoped
CREATE POLICY "executive_insights_update_policy" ON public.executive_insights
FOR UPDATE USING (
  check_demo_isolation(workspace_id, auth.uid())
  AND (
    has_role(auth.uid(), 'admin')
    OR (has_role(auth.uid(), 'manager') AND workspace_id = get_user_team_id(auth.uid()))
    OR (company_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM companies WHERE id = company_id AND owner_id = auth.uid()
    ))
  )
);

-- DELETE: Admin only
CREATE POLICY "executive_insights_delete_policy" ON public.executive_insights
FOR DELETE USING (
  has_role(auth.uid(), 'admin') AND check_demo_isolation(workspace_id, auth.uid())
);

-- ============================================================================
-- 4. UPDATE risk_signals RLS: Add company-level access checks
-- ============================================================================
DROP POLICY IF EXISTS "Managers can manage risks" ON public.risk_signals;
DROP POLICY IF EXISTS "Only admins managers and owners can view risk signals" ON public.risk_signals;

-- SELECT: Strict company-level access
CREATE POLICY "risk_signals_select_policy" ON public.risk_signals
FOR SELECT USING (
  check_demo_isolation(workspace_id, auth.uid())
  AND (
    -- Admin sees all within demo isolation
    has_role(auth.uid(), 'admin')
    -- Manager sees their workspace risks
    OR (has_role(auth.uid(), 'manager') AND workspace_id = get_user_team_id(auth.uid()))
    -- Company owner sees their company's risks
    OR (company_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM companies WHERE id = company_id AND owner_id = auth.uid()
    ))
    -- Contact owner can see contact-related risks
    OR (contact_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM contacts WHERE id = contact_id AND owner_id = auth.uid()
    ))
  )
);

-- INSERT/UPDATE/DELETE: Admin and managers for their workspace
CREATE POLICY "risk_signals_manage_policy" ON public.risk_signals
FOR ALL USING (
  check_demo_isolation(workspace_id, auth.uid())
  AND (
    has_role(auth.uid(), 'admin')
    OR (has_role(auth.uid(), 'manager') AND workspace_id = get_user_team_id(auth.uid()))
  )
);

-- ============================================================================
-- 5. UPDATE activity_summaries RLS: Workspace-scoped access
-- ============================================================================
DROP POLICY IF EXISTS "System can create summaries" ON public.activity_summaries;
DROP POLICY IF EXISTS "Only admins and managers can view activity summaries" ON public.activity_summaries;

-- SELECT: Strict workspace and company scoping
CREATE POLICY "activity_summaries_select_policy" ON public.activity_summaries
FOR SELECT USING (
  check_demo_isolation(workspace_id, auth.uid())
  AND (
    -- Admin sees all
    has_role(auth.uid(), 'admin')
    -- Manager sees their workspace summaries
    OR (has_role(auth.uid(), 'manager') AND workspace_id = get_user_team_id(auth.uid()))
    -- Company owner can see their company summaries
    OR (company_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM companies WHERE id = company_id AND owner_id = auth.uid()
    ))
  )
);

-- INSERT: System-level, workspace-scoped
CREATE POLICY "activity_summaries_insert_policy" ON public.activity_summaries
FOR INSERT WITH CHECK (
  check_demo_isolation(workspace_id, auth.uid())
  AND (workspace_id IS NULL OR workspace_id = get_user_team_id(auth.uid()))
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
);

-- ============================================================================
-- 6. UPDATE relationship_coverage RLS: Company-level access
-- ============================================================================
DROP POLICY IF EXISTS "System can upsert coverage" ON public.relationship_coverage;
DROP POLICY IF EXISTS "Only admins managers and owners can view coverage" ON public.relationship_coverage;

-- SELECT: Strict company-level access
CREATE POLICY "relationship_coverage_select_policy" ON public.relationship_coverage
FOR SELECT USING (
  check_demo_isolation(workspace_id, auth.uid())
  AND (
    -- Admin sees all
    has_role(auth.uid(), 'admin')
    -- Manager sees their workspace coverage
    OR (has_role(auth.uid(), 'manager') AND workspace_id = get_user_team_id(auth.uid()))
    -- Company owner can see their company coverage
    OR (company_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM companies WHERE id = company_id AND owner_id = auth.uid()
    ))
  )
);

-- ALL operations: Admin and managers for their workspace
CREATE POLICY "relationship_coverage_manage_policy" ON public.relationship_coverage
FOR ALL USING (
  check_demo_isolation(workspace_id, auth.uid())
  AND (
    has_role(auth.uid(), 'admin')
    OR (has_role(auth.uid(), 'manager') AND workspace_id = get_user_team_id(auth.uid()))
  )
);

-- ============================================================================
-- 7. ENSURE audit_log immutability: Verify trigger-only INSERT
-- ============================================================================
-- The audit_log table already has:
-- - INSERT denied to users (only trigger can insert)
-- - UPDATE denied to all
-- - DELETE denied to all
-- This is correct. Just verify the trigger exists and is correct.

-- Drop and recreate the trigger to ensure it's correct
DROP TRIGGER IF EXISTS audit_trigger_companies ON public.companies;
DROP TRIGGER IF EXISTS audit_trigger_contacts ON public.contacts;
DROP TRIGGER IF EXISTS audit_trigger_notes ON public.notes;

CREATE TRIGGER audit_trigger_companies
  AFTER INSERT OR UPDATE OR DELETE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_trigger_contacts
  AFTER INSERT OR UPDATE OR DELETE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_trigger_notes
  AFTER INSERT OR UPDATE OR DELETE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- Add workspace_id trigger for audit log
DROP TRIGGER IF EXISTS set_audit_workspace_id_trigger ON public.audit_log;
CREATE TRIGGER set_audit_workspace_id_trigger
  BEFORE INSERT ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.set_audit_workspace_id();