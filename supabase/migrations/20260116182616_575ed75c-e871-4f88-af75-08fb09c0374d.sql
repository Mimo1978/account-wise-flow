-- Add workspace_id to audit_log for proper isolation tracking
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.teams(id);

-- Create workspace type enum
DO $$ BEGIN
  CREATE TYPE workspace_type AS ENUM ('real', 'demo');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add type column to teams table (derived from is_demo for migration)
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS type workspace_type;

-- Update existing teams to set type based on is_demo
UPDATE public.teams SET type = CASE WHEN is_demo = true THEN 'demo'::workspace_type ELSE 'real'::workspace_type END WHERE type IS NULL;

-- Set default for new teams
ALTER TABLE public.teams ALTER COLUMN type SET DEFAULT 'real'::workspace_type;

-- Create function to get current workspace_id for a user
CREATE OR REPLACE FUNCTION public.get_current_workspace_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT team_id
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Create function to get workspace details
CREATE OR REPLACE FUNCTION public.get_workspace_details(_workspace_id uuid)
RETURNS TABLE(id uuid, name text, type workspace_type, is_demo boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT t.id, t.name, t.type, t.is_demo
  FROM public.teams t
  WHERE t.id = _workspace_id
$$;

-- Create function to get user's workspaces
CREATE OR REPLACE FUNCTION public.get_user_workspaces(_user_id uuid)
RETURNS TABLE(workspace_id uuid, workspace_name text, workspace_type workspace_type, is_demo boolean, role app_role)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT ur.team_id, t.name, t.type, t.is_demo, ur.role
  FROM public.user_roles ur
  JOIN public.teams t ON ur.team_id = t.id
  WHERE ur.user_id = _user_id
$$;

-- Create index on audit_log workspace_id for performance
CREATE INDEX IF NOT EXISTS idx_audit_log_workspace_id ON public.audit_log(workspace_id);

-- Update audit_log RLS to include workspace isolation
DROP POLICY IF EXISTS "Users can view audit logs based on access" ON public.audit_log;
CREATE POLICY "Users can view audit logs based on access"
ON public.audit_log FOR SELECT
USING (
  public.can_view_audit(auth.uid(), entity_type, entity_id)
  AND (workspace_id IS NULL OR public.check_demo_isolation(workspace_id, auth.uid()))
);

-- Create trigger to auto-set workspace_id on audit_log inserts
CREATE OR REPLACE FUNCTION public.set_audit_workspace_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Try to get workspace_id from the entity being audited
  IF NEW.entity_type = 'companies' THEN
    SELECT team_id INTO NEW.workspace_id FROM public.companies WHERE id = NEW.entity_id;
  ELSIF NEW.entity_type = 'contacts' THEN
    SELECT team_id INTO NEW.workspace_id FROM public.contacts WHERE id = NEW.entity_id;
  ELSIF NEW.entity_type = 'notes' THEN
    SELECT team_id INTO NEW.workspace_id FROM public.notes WHERE id = NEW.entity_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_audit_workspace_id_trigger ON public.audit_log;
CREATE TRIGGER set_audit_workspace_id_trigger
BEFORE INSERT ON public.audit_log
FOR EACH ROW
EXECUTE FUNCTION public.set_audit_workspace_id();