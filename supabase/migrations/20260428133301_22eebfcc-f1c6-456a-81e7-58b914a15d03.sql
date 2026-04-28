-- Real-time propagation of contact details (email/phone) across all linked
-- records sharing the same person_identity_id, and into outreach_targets.

CREATE OR REPLACE FUNCTION public.sync_person_contact(
  _person_identity_id uuid,
  _email text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _update_email boolean DEFAULT true,
  _update_phone boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := NULLIF(trim(coalesce(_email, '')), '');
  v_phone text := NULLIF(trim(coalesce(_phone, '')), '');
BEGIN
  IF _person_identity_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.candidates
     SET email = CASE WHEN _update_email THEN v_email ELSE email END,
         phone = CASE WHEN _update_phone THEN v_phone ELSE phone END,
         updated_at = now()
   WHERE person_identity_id = _person_identity_id;

  UPDATE public.contacts
     SET email = CASE WHEN _update_email THEN v_email ELSE email END,
         phone = CASE WHEN _update_phone THEN v_phone ELSE phone END,
         updated_at = now()
   WHERE person_identity_id = _person_identity_id;

  UPDATE public.crm_contacts
     SET email = CASE WHEN _update_email THEN v_email ELSE email END,
         phone = CASE WHEN _update_phone THEN v_phone ELSE phone END,
         updated_at = now()
   WHERE person_identity_id = _person_identity_id;

  UPDATE public.outreach_targets
     SET entity_email = CASE WHEN _update_email THEN v_email ELSE entity_email END,
         entity_phone = CASE WHEN _update_phone THEN v_phone ELSE entity_phone END,
         updated_at = now()
   WHERE person_identity_id = _person_identity_id;

  UPDATE public.person_identities
     SET primary_email = CASE WHEN _update_email THEN v_email ELSE primary_email END,
         primary_phone = CASE WHEN _update_phone THEN v_phone ELSE primary_phone END,
         updated_at = now()
   WHERE id = _person_identity_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_person_contact(uuid, text, text, boolean, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.fanout_person_contact_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid uuid := NEW.person_identity_id;
  v_email_changed boolean := (NEW.email IS DISTINCT FROM OLD.email);
  v_phone_changed boolean := (NEW.phone IS DISTINCT FROM OLD.phone);
BEGIN
  IF v_pid IS NULL OR (NOT v_email_changed AND NOT v_phone_changed) THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME <> 'candidates' THEN
    UPDATE public.candidates
       SET email = CASE WHEN v_email_changed THEN NEW.email ELSE email END,
           phone = CASE WHEN v_phone_changed THEN NEW.phone ELSE phone END,
           updated_at = now()
     WHERE person_identity_id = v_pid
       AND ( (v_email_changed AND email IS DISTINCT FROM NEW.email)
          OR (v_phone_changed AND phone IS DISTINCT FROM NEW.phone) );
  END IF;

  IF TG_TABLE_NAME <> 'contacts' THEN
    UPDATE public.contacts
       SET email = CASE WHEN v_email_changed THEN NEW.email ELSE email END,
           phone = CASE WHEN v_phone_changed THEN NEW.phone ELSE phone END,
           updated_at = now()
     WHERE person_identity_id = v_pid
       AND ( (v_email_changed AND email IS DISTINCT FROM NEW.email)
          OR (v_phone_changed AND phone IS DISTINCT FROM NEW.phone) );
  END IF;

  IF TG_TABLE_NAME <> 'crm_contacts' THEN
    UPDATE public.crm_contacts
       SET email = CASE WHEN v_email_changed THEN NEW.email ELSE email END,
           phone = CASE WHEN v_phone_changed THEN NEW.phone ELSE phone END,
           updated_at = now()
     WHERE person_identity_id = v_pid
       AND ( (v_email_changed AND email IS DISTINCT FROM NEW.email)
          OR (v_phone_changed AND phone IS DISTINCT FROM NEW.phone) );
  END IF;

  UPDATE public.outreach_targets
     SET entity_email = CASE WHEN v_email_changed THEN NEW.email ELSE entity_email END,
         entity_phone = CASE WHEN v_phone_changed THEN NEW.phone ELSE entity_phone END,
         updated_at = now()
   WHERE person_identity_id = v_pid
     AND ( (v_email_changed AND entity_email IS DISTINCT FROM NEW.email)
        OR (v_phone_changed AND entity_phone IS DISTINCT FROM NEW.phone) );

  UPDATE public.person_identities
     SET primary_email = CASE WHEN v_email_changed THEN NEW.email ELSE primary_email END,
         primary_phone = CASE WHEN v_phone_changed THEN NEW.phone ELSE primary_phone END,
         updated_at = now()
   WHERE id = v_pid;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fanout_contact_candidates ON public.candidates;
CREATE TRIGGER trg_fanout_contact_candidates
  AFTER UPDATE OF email, phone ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.fanout_person_contact_change();

DROP TRIGGER IF EXISTS trg_fanout_contact_contacts ON public.contacts;
CREATE TRIGGER trg_fanout_contact_contacts
  AFTER UPDATE OF email, phone ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.fanout_person_contact_change();

DROP TRIGGER IF EXISTS trg_fanout_contact_crm_contacts ON public.crm_contacts;
CREATE TRIGGER trg_fanout_contact_crm_contacts
  AFTER UPDATE OF email, phone ON public.crm_contacts
  FOR EACH ROW EXECUTE FUNCTION public.fanout_person_contact_change();

-- Backfill stale outreach_targets denormalised columns
UPDATE public.outreach_targets ot
   SET entity_phone = COALESCE(c.phone, ct.phone, cr.phone, ot.entity_phone),
       entity_email = COALESCE(c.email, ct.email, cr.email, ot.entity_email),
       updated_at = now()
  FROM public.outreach_targets ot2
  LEFT JOIN public.candidates c ON c.person_identity_id = ot2.person_identity_id
  LEFT JOIN public.contacts ct ON ct.person_identity_id = ot2.person_identity_id
  LEFT JOIN public.crm_contacts cr ON cr.person_identity_id = ot2.person_identity_id
 WHERE ot.id = ot2.id
   AND ot2.person_identity_id IS NOT NULL
   AND (
        ot.entity_phone IS DISTINCT FROM COALESCE(c.phone, ct.phone, cr.phone, ot.entity_phone)
     OR ot.entity_email IS DISTINCT FROM COALESCE(c.email, ct.email, cr.email, ot.entity_email)
   );

COMMENT ON FUNCTION public.sync_person_contact IS
  'Single entrypoint to update email/phone for a person across every linked record (candidates/contacts/crm_contacts) and every outreach_target row sharing the same person_identity_id.';