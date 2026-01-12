-- SECURITY FIX S6: Remove overly permissive RLS policies and consolidate access rules

-- 1. Drop overly permissive "Anyone can view" policies on sensitive tables
DROP POLICY IF EXISTS "Anyone can view contacts" ON public.contacts;
DROP POLICY IF EXISTS "Anyone can view companies" ON public.companies;
DROP POLICY IF EXISTS "Anyone can view teams" ON public.teams;
DROP POLICY IF EXISTS "Anyone can view company team members" ON public.company_team_members;
DROP POLICY IF EXISTS "Anyone can view contact team members" ON public.contact_team_members;

-- 2. Drop duplicate/conflicting notes SELECT policy (keep notes_select_policy which has demo isolation)
DROP POLICY IF EXISTS "Users can view notes based on visibility" ON public.notes;

-- 3. Create proper restrictive policy for teams table
CREATE POLICY "Users can view their own team"
ON public.teams
FOR SELECT
USING (
  -- Admins can see all teams (with demo isolation)
  (has_role(auth.uid(), 'admin'::app_role) AND NOT is_demo)
  OR
  -- Demo admins can see demo teams
  (has_role(auth.uid(), 'admin'::app_role) AND is_demo AND is_demo_user(auth.uid()))
  OR
  -- Users can see their own team
  (id = get_user_team_id(auth.uid()))
);

-- 4. Create proper restrictive policy for company_team_members
CREATE POLICY "Team members can view company assignments"
ON public.company_team_members
FOR SELECT
USING (
  -- User is part of the same team
  (team_id = get_user_team_id(auth.uid()))
  OR
  -- User can edit the company
  can_edit_company(auth.uid(), company_id)
  OR
  -- Admins can see all (with demo isolation)
  (has_role(auth.uid(), 'admin'::app_role) AND check_demo_isolation(team_id, auth.uid()))
);

-- 5. Create proper restrictive policy for contact_team_members
CREATE POLICY "Team members can view contact assignments"
ON public.contact_team_members
FOR SELECT
USING (
  -- User is part of the same team
  (team_id = get_user_team_id(auth.uid()))
  OR
  -- User can edit the contact
  can_edit_contact(auth.uid(), contact_id)
  OR
  -- Admins can see all (with demo isolation)
  (has_role(auth.uid(), 'admin'::app_role) AND check_demo_isolation(team_id, auth.uid()))
);

-- 6. Add explicit deny policies for audit_log modifications (make immutability explicit)
CREATE POLICY "Audit logs are immutable - no updates"
ON public.audit_log
AS RESTRICTIVE
FOR UPDATE
USING (false);

CREATE POLICY "Audit logs are immutable - no deletes"
ON public.audit_log
AS RESTRICTIVE
FOR DELETE
USING (false);