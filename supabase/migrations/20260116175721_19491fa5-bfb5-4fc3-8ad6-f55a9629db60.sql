
-- ============================================================
-- RLS HARDENING MIGRATION
-- Ensures anonymous users get zero rows on all internal tables
-- ============================================================

-- 1. FIX AUDIT_LOG INSERT POLICY
-- The current policy allows inserts when changed_by IS NULL, creating a security hole
DROP POLICY IF EXISTS "Authenticated users can insert audit logs via triggers" ON public.audit_log;

CREATE POLICY "Only authenticated users can insert audit logs"
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- 2. ADD EXPLICIT AUTH CHECK TO POLICIES THAT RELY ON SECURITY DEFINER FUNCTIONS
-- While these functions return false for anonymous users, adding explicit checks provides defense-in-depth

-- access_requests: Add explicit auth check to SELECT policies
DROP POLICY IF EXISTS "Users can view their own requests" ON public.access_requests;
CREATE POLICY "Users can view their own requests"
ON public.access_requests
FOR SELECT
TO authenticated
USING (auth.uid() = requested_by);

DROP POLICY IF EXISTS "Approvers can view requests" ON public.access_requests;
CREATE POLICY "Approvers can view requests"
ON public.access_requests
FOR SELECT
TO authenticated
USING (can_approve_request(auth.uid(), entity_type, entity_id));

DROP POLICY IF EXISTS "Approvers can update requests" ON public.access_requests;
CREATE POLICY "Approvers can update requests"
ON public.access_requests
FOR UPDATE
TO authenticated
USING (can_approve_request(auth.uid(), entity_type, entity_id));

DROP POLICY IF EXISTS "Admins can delete requests with demo isolation" ON public.access_requests;
CREATE POLICY "Admins can delete requests with demo isolation"
ON public.access_requests
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- companies: Ensure UPDATE/DELETE require authentication
DROP POLICY IF EXISTS "Users with edit permission can update companies" ON public.companies;
CREATE POLICY "Users with edit permission can update companies"
ON public.companies
FOR UPDATE
TO authenticated
USING (can_edit_company(auth.uid(), id));

DROP POLICY IF EXISTS "Admins can delete companies with demo isolation" ON public.companies;
CREATE POLICY "Admins can delete companies with demo isolation"
ON public.companies
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND check_demo_isolation(team_id, auth.uid()));

-- contacts: Ensure UPDATE/DELETE require authentication
DROP POLICY IF EXISTS "Users with edit permission can update contacts" ON public.contacts;
CREATE POLICY "Users with edit permission can update contacts"
ON public.contacts
FOR UPDATE
TO authenticated
USING (can_edit_contact(auth.uid(), id));

DROP POLICY IF EXISTS "Admins can delete contacts with demo isolation" ON public.contacts;
CREATE POLICY "Admins can delete contacts with demo isolation"
ON public.contacts
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND check_demo_isolation(team_id, auth.uid()));

-- notes: Ensure UPDATE/DELETE require authentication
DROP POLICY IF EXISTS "Owners and admins can update notes with demo isolation" ON public.notes;
CREATE POLICY "Owners and admins can update notes with demo isolation"
ON public.notes
FOR UPDATE
TO authenticated
USING ((has_role(auth.uid(), 'admin'::app_role) OR (owner_id = auth.uid())) AND check_demo_isolation(team_id, auth.uid()));

DROP POLICY IF EXISTS "Admins can delete notes with demo isolation" ON public.notes;
CREATE POLICY "Admins can delete notes with demo isolation"
ON public.notes
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND check_demo_isolation(team_id, auth.uid()));

-- teams: Ensure SELECT/ALL require authentication
DROP POLICY IF EXISTS "Users can view their own team" ON public.teams;
CREATE POLICY "Users can view their own team"
ON public.teams
FOR SELECT
TO authenticated
USING (
  (has_role(auth.uid(), 'admin'::app_role) AND NOT is_demo) 
  OR (has_role(auth.uid(), 'admin'::app_role) AND is_demo AND is_demo_user(auth.uid())) 
  OR (id = get_user_team_id(auth.uid()))
);

DROP POLICY IF EXISTS "Admins can manage teams with demo isolation" ON public.teams;
CREATE POLICY "Admins can manage teams with demo isolation"
ON public.teams
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND ((is_demo_user(auth.uid()) AND is_demo = true) OR (NOT is_demo_user(auth.uid()) AND is_demo = false))
);

-- user_roles: Ensure all policies require authentication
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all roles with demo isolation" ON public.user_roles;
CREATE POLICY "Admins can view all roles with demo isolation"
ON public.user_roles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND check_demo_isolation(team_id, auth.uid()));

DROP POLICY IF EXISTS "Admins can insert roles with demo isolation" ON public.user_roles;
CREATE POLICY "Admins can insert roles with demo isolation"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND check_demo_isolation(team_id, auth.uid()));

DROP POLICY IF EXISTS "Admins can update roles with demo isolation" ON public.user_roles;
CREATE POLICY "Admins can update roles with demo isolation"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND check_demo_isolation(team_id, auth.uid()));

DROP POLICY IF EXISTS "Admins can delete roles with demo isolation" ON public.user_roles;
CREATE POLICY "Admins can delete roles with demo isolation"
ON public.user_roles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND check_demo_isolation(team_id, auth.uid()));

-- company_team_members: Ensure ALL and SELECT require authentication
DROP POLICY IF EXISTS "Team members can view company assignments" ON public.company_team_members;
CREATE POLICY "Team members can view company assignments"
ON public.company_team_members
FOR SELECT
TO authenticated
USING (
  (team_id = get_user_team_id(auth.uid())) 
  OR can_edit_company(auth.uid(), company_id) 
  OR (has_role(auth.uid(), 'admin'::app_role) AND check_demo_isolation(team_id, auth.uid()))
);

DROP POLICY IF EXISTS "Company editors can manage team with demo isolation" ON public.company_team_members;
CREATE POLICY "Company editors can manage team with demo isolation"
ON public.company_team_members
FOR ALL
TO authenticated
USING (can_edit_company(auth.uid(), company_id) AND check_demo_isolation(team_id, auth.uid()));

-- contact_team_members: Ensure ALL and SELECT require authentication
DROP POLICY IF EXISTS "Team members can view contact assignments" ON public.contact_team_members;
CREATE POLICY "Team members can view contact assignments"
ON public.contact_team_members
FOR SELECT
TO authenticated
USING (
  (team_id = get_user_team_id(auth.uid())) 
  OR can_edit_contact(auth.uid(), contact_id) 
  OR (has_role(auth.uid(), 'admin'::app_role) AND check_demo_isolation(team_id, auth.uid()))
);

DROP POLICY IF EXISTS "Contact editors can manage team with demo isolation" ON public.contact_team_members;
CREATE POLICY "Contact editors can manage team with demo isolation"
ON public.contact_team_members
FOR ALL
TO authenticated
USING (can_edit_contact(auth.uid(), contact_id) AND check_demo_isolation(team_id, auth.uid()));

-- audit_log: Ensure SELECT requires authentication
DROP POLICY IF EXISTS "Users can view audit logs based on access" ON public.audit_log;
CREATE POLICY "Users can view audit logs based on access"
ON public.audit_log
FOR SELECT
TO authenticated
USING (can_view_audit(auth.uid(), entity_type, entity_id));

-- INSERT policies that need explicit auth check
DROP POLICY IF EXISTS "Users can create their own requests" ON public.access_requests;
CREATE POLICY "Users can create their own requests"
ON public.access_requests
FOR INSERT
TO authenticated
WITH CHECK (requested_by = auth.uid() AND status = 'pending'::access_request_status);

DROP POLICY IF EXISTS "Contributors and above can insert companies" ON public.companies;
CREATE POLICY "Contributors and above can insert companies"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'contributor'::app_role)) 
  AND can_insert_with_team(auth.uid(), team_id)
);

DROP POLICY IF EXISTS "Contributors and above can insert contacts" ON public.contacts;
CREATE POLICY "Contributors and above can insert contacts"
ON public.contacts
FOR INSERT
TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'contributor'::app_role)) 
  AND can_insert_with_team(auth.uid(), team_id)
);

DROP POLICY IF EXISTS "Contributors and above can create notes with demo isolation" ON public.notes;
CREATE POLICY "Contributors and above can create notes with demo isolation"
ON public.notes
FOR INSERT
TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'contributor'::app_role)) 
  AND owner_id = auth.uid() 
  AND check_demo_isolation(team_id, auth.uid())
);
