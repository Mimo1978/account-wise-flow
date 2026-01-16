-- Create function to join demo team (creates demo team and assigns user to it)
CREATE OR REPLACE FUNCTION public.join_demo_team(_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _demo_team_id UUID;
  _existing_demo_role UUID;
BEGIN
  -- Check if user already has a demo role
  SELECT id INTO _existing_demo_role
  FROM public.user_roles ur
  JOIN public.teams t ON ur.team_id = t.id
  WHERE ur.user_id = _user_id AND t.is_demo = true
  LIMIT 1;
  
  IF _existing_demo_role IS NOT NULL THEN
    -- User already in a demo team, return their team
    SELECT team_id INTO _demo_team_id
    FROM public.user_roles
    WHERE id = _existing_demo_role;
    RETURN _demo_team_id;
  END IF;
  
  -- Get or create the shared demo team
  SELECT id INTO _demo_team_id
  FROM public.teams
  WHERE is_demo = true AND name = 'Demo Workspace'
  LIMIT 1;
  
  IF _demo_team_id IS NULL THEN
    -- Create the demo team
    INSERT INTO public.teams (name, is_demo)
    VALUES ('Demo Workspace', true)
    RETURNING id INTO _demo_team_id;
  END IF;
  
  -- Add user to demo team with contributor role (full feature access)
  INSERT INTO public.user_roles (user_id, role, team_id)
  VALUES (_user_id, 'contributor', _demo_team_id)
  ON CONFLICT (user_id, role) DO UPDATE SET team_id = _demo_team_id;
  
  RETURN _demo_team_id;
END;
$$;

-- Create function to check if user has a real (non-demo) workspace
CREATE OR REPLACE FUNCTION public.has_real_workspace(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    LEFT JOIN public.teams t ON ur.team_id = t.id
    WHERE ur.user_id = _user_id
      AND (t.id IS NULL OR t.is_demo = false)
  )
$$;

-- Create function to leave demo team (remove demo role)
CREATE OR REPLACE FUNCTION public.leave_demo_team(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.user_roles
  WHERE user_id = _user_id
    AND team_id IN (SELECT id FROM public.teams WHERE is_demo = true);
  RETURN true;
END;
$$;

-- Create function to reset demo data for a user (delete their demo data and reseed)
CREATE OR REPLACE FUNCTION public.reset_demo_data(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _demo_team_id UUID;
BEGIN
  -- Get user's demo team
  SELECT ur.team_id INTO _demo_team_id
  FROM public.user_roles ur
  JOIN public.teams t ON ur.team_id = t.id
  WHERE ur.user_id = _user_id AND t.is_demo = true
  LIMIT 1;
  
  IF _demo_team_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Delete user's demo notes
  DELETE FROM public.notes
  WHERE owner_id = _user_id AND team_id = _demo_team_id;
  
  -- Delete user's demo contacts
  DELETE FROM public.contacts
  WHERE owner_id = _user_id AND team_id = _demo_team_id;
  
  -- Delete user's demo companies  
  DELETE FROM public.companies
  WHERE owner_id = _user_id AND team_id = _demo_team_id;
  
  RETURN true;
END;
$$;