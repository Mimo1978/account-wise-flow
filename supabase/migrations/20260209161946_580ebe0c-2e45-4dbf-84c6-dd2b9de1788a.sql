
-- Fix check_demo_isolation: users with BOTH demo and production roles
-- should be able to operate in both contexts.
-- The current logic uses is_demo_user() which returns true if ANY role is demo,
-- blocking production writes for users who also have a demo workspace.

CREATE OR REPLACE FUNCTION public.check_demo_isolation(_team_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT CASE
    -- If no team_id provided, allow if user has at least one non-demo role
    WHEN _team_id IS NULL THEN 
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        LEFT JOIN public.teams t ON ur.team_id = t.id
        WHERE ur.user_id = _user_id
          AND (t.id IS NULL OR t.is_demo = false)
      )
    -- If team_id is provided, check that user has a role in a team
    -- with the same demo status as the target team
    ELSE 
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.teams t ON ur.team_id = t.id
        WHERE ur.user_id = _user_id
          AND t.is_demo = (SELECT is_demo FROM public.teams WHERE id = _team_id)
      )
  END
$$;
