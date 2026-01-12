-- Create visibility enum for notes
CREATE TYPE public.note_visibility AS ENUM ('public', 'team', 'private');

-- Create notes table
CREATE TABLE public.notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('contact', 'company')),
  entity_id UUID NOT NULL,
  content TEXT NOT NULL,
  visibility note_visibility NOT NULL DEFAULT 'team',
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  pinned BOOLEAN NOT NULL DEFAULT false,
  source TEXT DEFAULT 'ui' CHECK (source IN ('ui', 'ai_import', 'api', 'voice')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX idx_notes_entity ON public.notes(entity_type, entity_id);
CREATE INDEX idx_notes_owner ON public.notes(owner_id);
CREATE INDEX idx_notes_team ON public.notes(team_id);
CREATE INDEX idx_notes_visibility ON public.notes(visibility);

-- Security definer function to check note visibility access
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
  -- Get user's team and role
  SELECT team_id INTO _user_team_id FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
  _user_role := public.get_user_role(_user_id);
  
  -- Get note details
  SELECT visibility, owner_id, team_id, entity_type, entity_id INTO _note FROM public.notes WHERE id = _note_id;
  
  IF _note IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Admin sees everything
  IF _user_role = 'admin' THEN
    RETURN TRUE;
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
$$;

-- RLS Policies for notes

-- SELECT: Based on visibility rules
CREATE POLICY "Users can view notes based on visibility"
ON public.notes
FOR SELECT
USING (public.can_view_note(auth.uid(), id));

-- INSERT: Contributors and above can create notes
CREATE POLICY "Contributors and above can create notes"
ON public.notes
FOR INSERT
WITH CHECK (
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'contributor'))
  AND owner_id = auth.uid()
);

-- UPDATE: Only owner or admin can update
CREATE POLICY "Owners and admins can update notes"
ON public.notes
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin') 
  OR owner_id = auth.uid()
);

-- DELETE: Only admin can delete notes (audit trail preservation)
CREATE POLICY "Admins can delete notes"
ON public.notes
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger to auto-set owner_id and team_id on insert
CREATE OR REPLACE FUNCTION public.set_note_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Set owner_id if not provided
  IF NEW.owner_id IS NULL THEN
    NEW.owner_id := auth.uid();
  END IF;
  
  -- Set team_id to user's team if not provided and user is not admin
  IF NEW.team_id IS NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.team_id := public.get_user_team_id(auth.uid());
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_note_defaults_trigger
BEFORE INSERT ON public.notes
FOR EACH ROW
EXECUTE FUNCTION public.set_note_defaults();

-- Trigger for updated_at
CREATE TRIGGER update_notes_updated_at
BEFORE UPDATE ON public.notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add audit triggers for notes
CREATE TRIGGER audit_notes_insert
AFTER INSERT ON public.notes
FOR EACH ROW
EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_notes_update
AFTER UPDATE ON public.notes
FOR EACH ROW
EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_notes_delete
AFTER DELETE ON public.notes
FOR EACH ROW
EXECUTE FUNCTION public.audit_trigger_func();