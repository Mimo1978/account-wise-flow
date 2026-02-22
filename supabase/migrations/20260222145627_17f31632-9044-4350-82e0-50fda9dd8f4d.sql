
-- Trigger function: block any attempt to change contacts.manager_id and log a warning
CREATE OR REPLACE FUNCTION public.guard_manager_id_deprecated()
RETURNS TRIGGER AS $$
BEGIN
  -- If manager_id is being changed, block and log
  IF OLD.manager_id IS DISTINCT FROM NEW.manager_id THEN
    -- Log warning to audit_log
    INSERT INTO public.audit_log (entity_type, entity_id, action, changed_by, diff, context)
    VALUES (
      'contact',
      NEW.id,
      'manager_id_write_blocked',
      auth.uid(),
      jsonb_build_object('old_manager_id', OLD.manager_id, 'attempted_manager_id', NEW.manager_id),
      jsonb_build_object('reason', 'contacts.manager_id is deprecated; hierarchy lives in org_chart_edges only')
    );
    -- Preserve the old value (silently block the change)
    NEW.manager_id := OLD.manager_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_guard_manager_id ON public.contacts;
CREATE TRIGGER trg_guard_manager_id
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_manager_id_deprecated();
