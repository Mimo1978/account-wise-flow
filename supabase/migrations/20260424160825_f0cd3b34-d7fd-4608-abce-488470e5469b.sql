ALTER TABLE public.crm_activities
ADD COLUMN IF NOT EXISTS candidate_id UUID;

CREATE INDEX IF NOT EXISTS idx_crm_activities_candidate_id
ON public.crm_activities(candidate_id);

ALTER TABLE public.notes
DROP CONSTRAINT IF EXISTS notes_entity_type_check;

ALTER TABLE public.notes
ADD CONSTRAINT notes_entity_type_check
CHECK (entity_type IN ('contact', 'company', 'candidate'));

CREATE OR REPLACE FUNCTION public.can_view_note(_user_id UUID, _note_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _note RECORD;
  _user_team_id UUID;
  _user_role app_role;
BEGIN
  SELECT team_id INTO _user_team_id FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
  _user_role := public.get_user_role(_user_id);

  SELECT visibility, owner_id, team_id, entity_type, entity_id INTO _note FROM public.notes WHERE id = _note_id;

  IF _note IS NULL THEN
    RETURN FALSE;
  END IF;

  IF _user_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  IF _note.visibility = 'public' THEN
    RETURN TRUE;
  END IF;

  IF _note.visibility = 'team' THEN
    IF _user_role = 'manager' AND (_note.team_id IS NULL OR _note.team_id = _user_team_id) THEN
      RETURN TRUE;
    END IF;
    IF _user_role = 'contributor' AND (_note.team_id IS NULL OR _note.team_id = _user_team_id) THEN
      RETURN TRUE;
    END IF;
  END IF;

  IF _note.visibility = 'private' THEN
    IF _note.owner_id = _user_id THEN
      RETURN TRUE;
    END IF;
    IF _note.entity_type = 'contact' THEN
      IF EXISTS (SELECT 1 FROM public.contact_team_members WHERE contact_id = _note.entity_id AND user_id = _user_id) THEN
        RETURN TRUE;
      END IF;
    ELSIF _note.entity_type = 'company' THEN
      IF EXISTS (SELECT 1 FROM public.company_team_members WHERE company_id = _note.entity_id AND user_id = _user_id) THEN
        RETURN TRUE;
      END IF;
    ELSIF _note.entity_type = 'candidate' THEN
      IF EXISTS (
        SELECT 1
        FROM public.candidate_notes cn
        WHERE cn.candidate_id = _note.entity_id
          AND cn.team_id IS NOT DISTINCT FROM _note.team_id
          AND (
            cn.owner_id = _user_id
            OR cn.visibility = 'public'
            OR (cn.visibility = 'team' AND (_note.team_id IS NULL OR _note.team_id = _user_team_id))
          )
        LIMIT 1
      ) THEN
        RETURN TRUE;
      END IF;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$;