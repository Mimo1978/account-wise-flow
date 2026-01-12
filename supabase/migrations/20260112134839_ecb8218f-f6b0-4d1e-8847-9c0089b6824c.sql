-- Add is_demo flag to teams table for demo workspace isolation
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- Create security definer function to check if user is in demo mode
CREATE OR REPLACE FUNCTION public.is_demo_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.teams t ON ur.team_id = t.id
    WHERE ur.user_id = _user_id
      AND t.is_demo = true
  )
$$;

-- Create security definer function to get demo status of a team
CREATE OR REPLACE FUNCTION public.is_demo_team(_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_demo FROM public.teams WHERE id = _team_id),
    false
  )
$$;

-- Create security definer function to check demo data isolation
-- Demo users can only see demo data, non-demo users can only see non-demo data
CREATE OR REPLACE FUNCTION public.check_demo_isolation(_team_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    -- If no team_id provided, allow only non-demo users
    WHEN _team_id IS NULL THEN NOT public.is_demo_user(_user_id)
    -- Otherwise check: demo users see demo data, non-demo users see non-demo data
    ELSE public.is_demo_user(_user_id) = public.is_demo_team(_team_id)
  END
$$;

-- Update companies RLS to enforce demo isolation
DROP POLICY IF EXISTS "companies_select_policy" ON public.companies;
CREATE POLICY "companies_select_policy" ON public.companies
FOR SELECT TO authenticated
USING (
  -- Admin sees all within their demo/non-demo scope
  (public.has_role(auth.uid(), 'admin') AND public.check_demo_isolation(team_id, auth.uid()))
  OR
  -- Manager sees their team's data within demo scope
  (public.has_role(auth.uid(), 'manager') 
   AND team_id = public.get_user_team_id(auth.uid())
   AND public.check_demo_isolation(team_id, auth.uid()))
  OR
  -- Contributor/Viewer sees owned, team-assigned, or team scoped within demo scope
  (owner_id = auth.uid() AND public.check_demo_isolation(team_id, auth.uid()))
  OR
  (EXISTS (
    SELECT 1 FROM public.company_team_members 
    WHERE company_id = companies.id AND user_id = auth.uid()
  ) AND public.check_demo_isolation(team_id, auth.uid()))
  OR
  (team_id = public.get_user_team_id(auth.uid()) AND public.check_demo_isolation(team_id, auth.uid()))
);

-- Update contacts RLS to enforce demo isolation
DROP POLICY IF EXISTS "contacts_select_policy" ON public.contacts;
CREATE POLICY "contacts_select_policy" ON public.contacts
FOR SELECT TO authenticated
USING (
  -- Admin sees all within their demo/non-demo scope
  (public.has_role(auth.uid(), 'admin') AND public.check_demo_isolation(team_id, auth.uid()))
  OR
  -- Manager sees their team's data within demo scope
  (public.has_role(auth.uid(), 'manager') 
   AND team_id = public.get_user_team_id(auth.uid())
   AND public.check_demo_isolation(team_id, auth.uid()))
  OR
  -- Contributor/Viewer sees owned, team-assigned, or team scoped within demo scope
  (owner_id = auth.uid() AND public.check_demo_isolation(team_id, auth.uid()))
  OR
  (EXISTS (
    SELECT 1 FROM public.contact_team_members 
    WHERE contact_id = contacts.id AND user_id = auth.uid()
  ) AND public.check_demo_isolation(team_id, auth.uid()))
  OR
  (team_id = public.get_user_team_id(auth.uid()) AND public.check_demo_isolation(team_id, auth.uid()))
);

-- Update notes RLS to enforce demo isolation
DROP POLICY IF EXISTS "notes_select_policy" ON public.notes;
CREATE POLICY "notes_select_policy" ON public.notes
FOR SELECT TO authenticated
USING (
  public.can_view_note(id, auth.uid())
  AND public.check_demo_isolation(team_id, auth.uid())
);

-- Create a demo team for isolation (if not exists)
INSERT INTO public.teams (name, is_demo)
SELECT 'Demo Workspace', true
WHERE NOT EXISTS (SELECT 1 FROM public.teams WHERE is_demo = true);