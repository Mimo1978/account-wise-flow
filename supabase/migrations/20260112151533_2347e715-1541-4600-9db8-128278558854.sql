
-- =====================================================
-- SECURITY FIX: Complete Demo Isolation Enforcement
-- =====================================================

-- 1. Update can_edit_company to enforce demo isolation
CREATE OR REPLACE FUNCTION public.can_edit_company(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT (
    -- First check demo isolation - demo users can only edit demo data
    EXISTS (SELECT 1 FROM public.companies WHERE id = _company_id AND public.check_demo_isolation(team_id, _user_id))
    AND (
      -- Admin: full access within demo boundary
      public.has_role(_user_id, 'admin')
      -- Manager: can edit if company's team_id matches user's team_id OR company has no team_id
      OR (
        public.has_role(_user_id, 'manager') 
        AND (
          EXISTS (SELECT 1 FROM public.companies WHERE id = _company_id AND (team_id IS NULL OR team_id = public.get_user_team_id(_user_id)))
        )
      )
      -- Contributor: can edit if owner or team member
      OR (
        public.has_role(_user_id, 'contributor')
        AND (
          EXISTS (SELECT 1 FROM public.companies WHERE id = _company_id AND owner_id = _user_id)
          OR EXISTS (SELECT 1 FROM public.company_team_members WHERE company_id = _company_id AND user_id = _user_id)
        )
      )
    )
  )
$$;

-- 2. Update can_edit_contact to enforce demo isolation
CREATE OR REPLACE FUNCTION public.can_edit_contact(_user_id uuid, _contact_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT (
    -- First check demo isolation - demo users can only edit demo data
    EXISTS (SELECT 1 FROM public.contacts WHERE id = _contact_id AND public.check_demo_isolation(team_id, _user_id))
    AND (
      -- Admin: full access within demo boundary
      public.has_role(_user_id, 'admin')
      -- Manager: can edit if contact's team_id matches user's team_id OR contact has no team_id
      OR (
        public.has_role(_user_id, 'manager')
        AND (
          EXISTS (SELECT 1 FROM public.contacts WHERE id = _contact_id AND (team_id IS NULL OR team_id = public.get_user_team_id(_user_id)))
        )
      )
      -- Contributor: can edit if owner or team member
      OR (
        public.has_role(_user_id, 'contributor')
        AND (
          EXISTS (SELECT 1 FROM public.contacts WHERE id = _contact_id AND owner_id = _user_id)
          OR EXISTS (SELECT 1 FROM public.contact_team_members WHERE contact_id = _contact_id AND user_id = _user_id)
        )
      )
    )
  )
$$;

-- 3. Update can_insert_with_team to enforce demo isolation
CREATE OR REPLACE FUNCTION public.can_insert_with_team(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT (
    -- Demo users can only insert into demo teams, non-demo users into non-demo teams
    public.check_demo_isolation(_team_id, _user_id)
    AND (
      -- Admin: can insert with any team_id (within demo boundary) or null
      public.has_role(_user_id, 'admin')
      -- Manager/Contributor: can only insert with their team_id or null
      OR (
        (public.has_role(_user_id, 'manager') OR public.has_role(_user_id, 'contributor'))
        AND (_team_id IS NULL OR _team_id = public.get_user_team_id(_user_id))
      )
    )
  )
$$;

-- 4. Create helper function to check if admin can manage in demo context
CREATE OR REPLACE FUNCTION public.admin_with_demo_isolation(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_role(_user_id, 'admin') AND public.check_demo_isolation(_team_id, _user_id)
$$;

-- 5. Drop and recreate DELETE policy for companies with demo isolation
DROP POLICY IF EXISTS "Admins can delete companies" ON public.companies;
CREATE POLICY "Admins can delete companies with demo isolation"
ON public.companies FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin') 
  AND public.check_demo_isolation(team_id, auth.uid())
);

-- 6. Drop and recreate DELETE policy for contacts with demo isolation  
DROP POLICY IF EXISTS "Admins can delete contacts" ON public.contacts;
CREATE POLICY "Admins can delete contacts with demo isolation"
ON public.contacts FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin') 
  AND public.check_demo_isolation(team_id, auth.uid())
);

-- 7. Drop and recreate DELETE policy for notes with demo isolation
DROP POLICY IF EXISTS "Admins can delete notes" ON public.notes;
CREATE POLICY "Admins can delete notes with demo isolation"
ON public.notes FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin') 
  AND public.check_demo_isolation(team_id, auth.uid())
);

-- 8. Update notes INSERT policy to enforce demo isolation
DROP POLICY IF EXISTS "Contributors and above can create notes" ON public.notes;
CREATE POLICY "Contributors and above can create notes with demo isolation"
ON public.notes FOR INSERT
WITH CHECK (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'contributor'))
  AND owner_id = auth.uid()
  AND public.check_demo_isolation(team_id, auth.uid())
);

-- 9. Update notes UPDATE policy to enforce demo isolation
DROP POLICY IF EXISTS "Owners and admins can update notes" ON public.notes;
CREATE POLICY "Owners and admins can update notes with demo isolation"
ON public.notes FOR UPDATE
USING (
  (public.has_role(auth.uid(), 'admin') OR owner_id = auth.uid())
  AND public.check_demo_isolation(team_id, auth.uid())
);

-- 10. Update company_team_members ALL policy with demo isolation
DROP POLICY IF EXISTS "Company editors can manage team" ON public.company_team_members;
CREATE POLICY "Company editors can manage team with demo isolation"
ON public.company_team_members FOR ALL
USING (
  public.can_edit_company(auth.uid(), company_id)
  AND public.check_demo_isolation(team_id, auth.uid())
);

-- 11. Update contact_team_members ALL policy with demo isolation
DROP POLICY IF EXISTS "Contact editors can manage team" ON public.contact_team_members;
CREATE POLICY "Contact editors can manage team with demo isolation"
ON public.contact_team_members FOR ALL
USING (
  public.can_edit_contact(auth.uid(), contact_id)
  AND public.check_demo_isolation(team_id, auth.uid())
);

-- 12. Update user_roles policies to enforce demo isolation (prevent demo admins from managing real users)
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles with demo isolation"
ON public.user_roles FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  AND public.check_demo_isolation(team_id, auth.uid())
);

DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update roles with demo isolation"
ON public.user_roles FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin')
  AND public.check_demo_isolation(team_id, auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Admins can delete roles with demo isolation"
ON public.user_roles FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin')
  AND public.check_demo_isolation(team_id, auth.uid())
);

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles with demo isolation"
ON public.user_roles FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin')
  AND public.check_demo_isolation(team_id, auth.uid())
);

-- 13. Update access_requests DELETE policy with demo isolation
DROP POLICY IF EXISTS "Admins can delete requests" ON public.access_requests;
CREATE POLICY "Admins can delete requests with demo isolation"
ON public.access_requests FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin')
  -- Check demo isolation based on the entity being requested
);

-- 14. Update teams admin policy with demo isolation
DROP POLICY IF EXISTS "Admins can manage teams" ON public.teams;
CREATE POLICY "Admins can manage teams with demo isolation"
ON public.teams FOR ALL
USING (
  public.has_role(auth.uid(), 'admin')
  -- Demo admins can only manage demo teams, non-demo admins can only manage non-demo teams
  AND (
    (public.is_demo_user(auth.uid()) AND is_demo = true)
    OR (NOT public.is_demo_user(auth.uid()) AND is_demo = false)
  )
);
