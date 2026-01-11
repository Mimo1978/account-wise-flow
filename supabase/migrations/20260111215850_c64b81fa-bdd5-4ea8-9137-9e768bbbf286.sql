
-- Add team_id columns to existing tables (additive only)
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS team_id UUID;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS team_id UUID;
ALTER TABLE public.company_team_members ADD COLUMN IF NOT EXISTS team_id UUID;
ALTER TABLE public.contact_team_members ADD COLUMN IF NOT EXISTS team_id UUID;

-- Create teams table for reference (optional, allows named teams)
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on teams
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Teams policies
CREATE POLICY "Anyone can view teams" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Admins can manage teams" ON public.teams FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Create function to get user's team_id
CREATE OR REPLACE FUNCTION public.get_user_team_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Update can_edit_company to enforce team scope for managers
CREATE OR REPLACE FUNCTION public.can_edit_company(_user_id UUID, _company_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    -- Admin: full access
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
$$;

-- Update can_edit_contact to enforce team scope for managers
CREATE OR REPLACE FUNCTION public.can_edit_contact(_user_id UUID, _contact_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    -- Admin: full access
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
$$;

-- Function to check if user can insert (for team scoping on create)
CREATE OR REPLACE FUNCTION public.can_insert_with_team(_user_id UUID, _team_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    -- Admin: can insert with any team_id or null
    public.has_role(_user_id, 'admin')
    -- Manager/Contributor: can only insert with their team_id or null
    OR (
      (public.has_role(_user_id, 'manager') OR public.has_role(_user_id, 'contributor'))
      AND (_team_id IS NULL OR _team_id = public.get_user_team_id(_user_id))
    )
  )
$$;

-- Update companies INSERT policy to enforce team scoping
DROP POLICY IF EXISTS "Contributors and above can insert companies" ON public.companies;
CREATE POLICY "Contributors and above can insert companies" ON public.companies
FOR INSERT WITH CHECK (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'contributor'))
  AND public.can_insert_with_team(auth.uid(), team_id)
);

-- Update contacts INSERT policy to enforce team scoping
DROP POLICY IF EXISTS "Contributors and above can insert contacts" ON public.contacts;
CREATE POLICY "Contributors and above can insert contacts" ON public.contacts
FOR INSERT WITH CHECK (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'contributor'))
  AND public.can_insert_with_team(auth.uid(), team_id)
);

-- Add trigger to auto-set team_id on insert for companies
CREATE OR REPLACE FUNCTION public.set_default_team_id_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only set if team_id is null and user is not admin
  IF NEW.team_id IS NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.team_id := public.get_user_team_id(auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_company_team_id ON public.companies;
CREATE TRIGGER set_company_team_id
  BEFORE INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.set_default_team_id_company();

-- Add trigger to auto-set team_id on insert for contacts
CREATE OR REPLACE FUNCTION public.set_default_team_id_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only set if team_id is null and user is not admin
  IF NEW.team_id IS NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.team_id := public.get_user_team_id(auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_contact_team_id ON public.contacts;
CREATE TRIGGER set_contact_team_id
  BEFORE INSERT ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_default_team_id_contact();

-- Update user_roles trigger for updated_at
DROP TRIGGER IF EXISTS update_user_roles_updated_at ON public.user_roles;
CREATE TRIGGER update_user_roles_updated_at
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Teams updated_at trigger
DROP TRIGGER IF EXISTS update_teams_updated_at ON public.teams;
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
