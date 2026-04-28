-- =========================================================================
-- OUTREACH IDENTITY TAGGING — Migration 2 of 3
-- Non-breaking: all new columns are nullable; existing reads keep working.
-- =========================================================================

-- 1. Add identity + source columns ---------------------------------------
ALTER TABLE public.outreach_targets
  ADD COLUMN IF NOT EXISTS person_identity_id uuid REFERENCES public.person_identities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contact_source text
    CHECK (contact_source IS NULL OR contact_source IN ('contacts','crm_contacts','candidates'));

CREATE INDEX IF NOT EXISTS idx_outreach_targets_person_identity
  ON public.outreach_targets(person_identity_id) WHERE person_identity_id IS NOT NULL;

-- 2. Backfill identity + source from existing FK pointers ---------------
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT id, candidate_id, contact_id
    FROM public.outreach_targets
    WHERE person_identity_id IS NULL OR contact_source IS NULL
  LOOP
    DECLARE
      _pid uuid;
      _src text;
    BEGIN
      _pid := public.find_person_identity_by_source(r.candidate_id, r.contact_id, NULL);

      IF r.candidate_id IS NOT NULL THEN
        _src := 'candidates';
      ELSIF r.contact_id IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM public.contacts WHERE id = r.contact_id) THEN
          _src := 'contacts';
        ELSIF EXISTS (SELECT 1 FROM public.crm_contacts WHERE id = r.contact_id) THEN
          _src := 'crm_contacts';
        END IF;
      END IF;

      UPDATE public.outreach_targets
      SET person_identity_id = COALESCE(_pid, person_identity_id),
          contact_source = COALESCE(_src, contact_source)
      WHERE id = r.id;
    END;
  END LOOP;
END $$;

-- 3. Trigger: auto-tag new/updated targets ------------------------------
CREATE OR REPLACE FUNCTION public.tag_outreach_target_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  -- Resolve source first (cheap)
  IF NEW.contact_source IS NULL THEN
    IF NEW.candidate_id IS NOT NULL THEN
      NEW.contact_source := 'candidates';
    ELSIF NEW.contact_id IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.contacts WHERE id = NEW.contact_id) THEN
        NEW.contact_source := 'contacts';
      ELSIF EXISTS (SELECT 1 FROM public.crm_contacts WHERE id = NEW.contact_id) THEN
        NEW.contact_source := 'crm_contacts';
      END IF;
    END IF;
  END IF;

  -- Resolve identity
  IF NEW.person_identity_id IS NULL THEN
    NEW.person_identity_id := public.find_person_identity_by_source(
      NEW.candidate_id, NEW.contact_id, NULL
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_outreach_targets_identity ON public.outreach_targets;
CREATE TRIGGER trg_outreach_targets_identity
  BEFORE INSERT OR UPDATE OF candidate_id, contact_id ON public.outreach_targets
  FOR EACH ROW EXECUTE FUNCTION public.tag_outreach_target_identity();

-- 4. Safety-net repair function -----------------------------------------
CREATE OR REPLACE FUNCTION public.link_orphan_outreach_targets()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _count integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can run identity repair';
  END IF;

  WITH updated AS (
    UPDATE public.outreach_targets ot
    SET person_identity_id = public.find_person_identity_by_source(ot.candidate_id, ot.contact_id, NULL),
        contact_source = CASE
          WHEN ot.candidate_id IS NOT NULL THEN 'candidates'
          WHEN EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = ot.contact_id) THEN 'contacts'
          WHEN EXISTS (SELECT 1 FROM public.crm_contacts cc WHERE cc.id = ot.contact_id) THEN 'crm_contacts'
          ELSE ot.contact_source
        END
    WHERE ot.person_identity_id IS NULL OR ot.contact_source IS NULL
    RETURNING ot.id
  )
  SELECT count(*) INTO _count FROM updated;
  RETURN _count;
END;
$$;