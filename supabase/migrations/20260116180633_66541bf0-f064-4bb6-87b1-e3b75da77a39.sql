
-- ============================================================
-- SECURITY DEFINER FUNCTION HARDENING
-- Fix can_view_audit which allows overly broad access via EXISTS
-- ============================================================

-- ISSUE: can_view_audit has an EXISTS check that returns TRUE if ANY row exists
-- in contacts/companies, regardless of user access rights. This bypasses RLS.
-- Line 260: OR EXISTS (SELECT 1 FROM public.companies WHERE id = _entity_id);
-- Line 263: OR EXISTS (SELECT 1 FROM public.contacts WHERE id = _entity_id);

-- FIX: Replace with proper ownership/team checks for contributors/viewers

CREATE OR REPLACE FUNCTION public.can_view_audit(_user_id uuid, _entity_type text, _entity_id uuid)
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  _user_team_id UUID;
  _user_role app_role;
  _entity_team_id UUID;
  _entity_owner_id UUID;
BEGIN
  -- Early exit for null user
  IF _user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  _user_role := public.get_user_role(_user_id);
  
  -- Viewer role cannot view audit logs
  IF _user_role = 'viewer' OR _user_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Admin can view all (within demo isolation, checked by RLS)
  IF _user_role = 'admin' THEN
    -- Check demo isolation for admin
    _entity_team_id := public.get_entity_team_id(_entity_type, _entity_id);
    RETURN public.check_demo_isolation(_entity_team_id, _user_id);
  END IF;

  _user_team_id := public.get_user_team_id(_user_id);
  _entity_team_id := public.get_entity_team_id(_entity_type, _entity_id);

  -- Manager can view within team scope (with demo isolation)
  IF _user_role = 'manager' THEN
    RETURN (_entity_team_id IS NULL OR _entity_team_id = _user_team_id) 
           AND public.check_demo_isolation(_entity_team_id, _user_id);
  END IF;

  -- Contributor can only view audit for entities they can edit
  IF _user_role = 'contributor' THEN
    IF _entity_type = 'company' THEN
      RETURN public.can_edit_company(_user_id, _entity_id);
    ELSIF _entity_type = 'contact' THEN
      RETURN public.can_edit_contact(_user_id, _entity_id);
    END IF;
  END IF;

  RETURN FALSE;
END;
$function$;

-- Also add null-user check to can_view_note for defense-in-depth
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
  SELECT visibility, owner_id, team_id, entity_type, entity_id INTO _note FROM public.notes WHERE id = _note_id;
  
  IF _note IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check demo isolation first
  IF NOT public.check_demo_isolation(_note.team_id, _user_id) THEN
    RETURN FALSE;
  END IF;
  
  -- Admin sees everything within demo boundary
  IF _user_role = 'admin' THEN
    RETURN TRUE;
  END IF;
  
  -- Viewer cannot see notes
  IF _user_role = 'viewer' OR _user_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Public notes: anyone with access to the entity can see
  IF _note.visibility = 'public' THEN
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
  END IF;
  
  -- Private notes: only owner, assigned team members, or admin
  IF _note.visibility = 'private' THEN
    -- Owner can always see their private notes
    IF _note.owner_id = _user_id THEN
      RETURN TRUE;
    END IF;
    -- Check if user is a team member of the entity
    IF _note.entity_type = 'contact' THEN
      IF EXISTS (SELECT 1 FROM public.contact_team_members WHERE contact_id = _note.entity_id AND user_id = _user_id) THEN
        RETURN TRUE;
      END IF;
    ELSIF _note.entity_type = 'company' THEN
      IF EXISTS (SELECT 1 FROM public.company_team_members WHERE company_id = _note.entity_id AND user_id = _user_id) THEN
        RETURN TRUE;
      END IF;
    END IF;
  END IF;
  
  RETURN FALSE;
END;
$function$;
