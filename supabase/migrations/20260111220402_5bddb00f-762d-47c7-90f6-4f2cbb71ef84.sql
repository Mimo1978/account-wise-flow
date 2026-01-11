
-- Create audit_log table
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  diff JSONB NOT NULL DEFAULT '{}',
  context JSONB NOT NULL DEFAULT '{}'
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_by ON public.audit_log(changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON public.audit_log(changed_at DESC);

-- Enable RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Helper function to get entity team_id for audit access control
CREATE OR REPLACE FUNCTION public.get_entity_team_id(_entity_type TEXT, _entity_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _team_id UUID;
BEGIN
  IF _entity_type = 'company' THEN
    SELECT team_id INTO _team_id FROM public.companies WHERE id = _entity_id;
  ELSIF _entity_type = 'contact' THEN
    SELECT team_id INTO _team_id FROM public.contacts WHERE id = _entity_id;
  END IF;
  RETURN _team_id;
END;
$$;

-- Function to check if user can view audit log entry
CREATE OR REPLACE FUNCTION public.can_view_audit(_user_id UUID, _entity_type TEXT, _entity_id UUID)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_team_id UUID;
  _entity_team_id UUID;
BEGIN
  -- Admin can view all
  IF public.has_role(_user_id, 'admin') THEN
    RETURN TRUE;
  END IF;

  _user_team_id := public.get_user_team_id(_user_id);
  _entity_team_id := public.get_entity_team_id(_entity_type, _entity_id);

  -- Manager can view within team scope
  IF public.has_role(_user_id, 'manager') THEN
    RETURN _entity_team_id IS NULL OR _entity_team_id = _user_team_id;
  END IF;

  -- Contributor/Viewer can view for entities they have access to
  IF _entity_type = 'company' THEN
    RETURN public.can_edit_company(_user_id, _entity_id) 
      OR EXISTS (SELECT 1 FROM public.companies WHERE id = _entity_id);
  ELSIF _entity_type = 'contact' THEN
    RETURN public.can_edit_contact(_user_id, _entity_id)
      OR EXISTS (SELECT 1 FROM public.contacts WHERE id = _entity_id);
  END IF;

  RETURN FALSE;
END;
$$;

-- RLS Policies for audit_log
CREATE POLICY "Users can view audit logs based on access" ON public.audit_log
FOR SELECT USING (public.can_view_audit(auth.uid(), entity_type, entity_id));

-- Only system (triggers) can insert audit logs
CREATE POLICY "System can insert audit logs" ON public.audit_log
FOR INSERT WITH CHECK (true);

-- No updates allowed (immutable)
-- No deletes allowed (immutable)

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _entity_type TEXT;
  _entity_id UUID;
  _action TEXT;
  _diff JSONB;
  _old_data JSONB;
  _new_data JSONB;
  _changed_fields TEXT[];
BEGIN
  -- Determine entity type from table name
  _entity_type := TG_TABLE_NAME;
  
  -- Handle different operations
  IF TG_OP = 'INSERT' THEN
    _action := 'create';
    _entity_id := NEW.id;
    _new_data := to_jsonb(NEW);
    _diff := jsonb_build_object(
      'after', _new_data,
      'fields_changed', ARRAY(SELECT jsonb_object_keys(_new_data))
    );
  ELSIF TG_OP = 'UPDATE' THEN
    _action := 'update';
    _entity_id := NEW.id;
    _old_data := to_jsonb(OLD);
    _new_data := to_jsonb(NEW);
    
    -- Find changed fields only
    SELECT array_agg(key) INTO _changed_fields
    FROM (
      SELECT key FROM jsonb_each(_new_data)
      EXCEPT
      SELECT key FROM jsonb_each(_old_data) WHERE _old_data->key = _new_data->key
    ) changed;
    
    -- Only log if there are actual changes (excluding updated_at)
    _changed_fields := array_remove(_changed_fields, 'updated_at');
    
    IF _changed_fields IS NULL OR array_length(_changed_fields, 1) IS NULL THEN
      RETURN NEW;
    END IF;
    
    _diff := jsonb_build_object(
      'before', (SELECT jsonb_object_agg(key, value) FROM jsonb_each(_old_data) WHERE key = ANY(_changed_fields)),
      'after', (SELECT jsonb_object_agg(key, value) FROM jsonb_each(_new_data) WHERE key = ANY(_changed_fields)),
      'fields_changed', _changed_fields
    );
  ELSIF TG_OP = 'DELETE' THEN
    _action := 'delete';
    _entity_id := OLD.id;
    _old_data := to_jsonb(OLD);
    _diff := jsonb_build_object(
      'before', _old_data,
      'fields_changed', ARRAY(SELECT jsonb_object_keys(_old_data))
    );
  END IF;

  -- Insert audit log entry
  INSERT INTO public.audit_log (entity_type, entity_id, action, changed_by, diff, context)
  VALUES (
    _entity_type,
    _entity_id,
    _action,
    auth.uid(),
    _diff,
    jsonb_build_object('source', 'trigger')
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Create audit triggers for companies
DROP TRIGGER IF EXISTS audit_companies_insert ON public.companies;
CREATE TRIGGER audit_companies_insert
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_companies_update ON public.companies;
CREATE TRIGGER audit_companies_update
  AFTER UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_companies_delete ON public.companies;
CREATE TRIGGER audit_companies_delete
  AFTER DELETE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_trigger_func();

-- Create audit triggers for contacts
DROP TRIGGER IF EXISTS audit_contacts_insert ON public.contacts;
CREATE TRIGGER audit_contacts_insert
  AFTER INSERT ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_contacts_update ON public.contacts;
CREATE TRIGGER audit_contacts_update
  AFTER UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_contacts_delete ON public.contacts;
CREATE TRIGGER audit_contacts_delete
  AFTER DELETE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_trigger_func();
