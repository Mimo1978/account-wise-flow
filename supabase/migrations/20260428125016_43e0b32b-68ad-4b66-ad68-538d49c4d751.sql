-- =========================================================================
-- PERSON IDENTITY UNIFICATION — Migration 1 of 3 (foundation, non-breaking)
-- =========================================================================
-- Creates a single canonical "person_identities" table that links matching
-- rows across contacts, crm_contacts, and candidates. Existing tables and
-- routes remain fully functional; this purely adds a unification layer.
-- =========================================================================

-- 1. Canonical person identity table -------------------------------------
CREATE TABLE IF NOT EXISTS public.person_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  canonical_name text NOT NULL,
  primary_email text,
  primary_phone text,
  primary_linkedin_url text,
  -- preferred_route reflects "Talent → Contact → CRM" priority chosen by user
  preferred_route text NOT NULL DEFAULT 'talent'
    CHECK (preferred_route IN ('talent','contact','crm_contact')),
  merge_confidence text NOT NULL DEFAULT 'auto'
    CHECK (merge_confidence IN ('auto','manual','review')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_person_identities_team ON public.person_identities(team_id);
CREATE INDEX IF NOT EXISTS idx_person_identities_email ON public.person_identities(lower(primary_email)) WHERE primary_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_person_identities_phone ON public.person_identities(regexp_replace(primary_phone, '[^0-9]', '', 'g')) WHERE primary_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_person_identities_linkedin ON public.person_identities(lower(primary_linkedin_url)) WHERE primary_linkedin_url IS NOT NULL;

ALTER TABLE public.person_identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "person_identities team read"
  ON public.person_identities FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR team_id IS NULL
    OR team_id = public.get_user_team_id(auth.uid())
  );

CREATE POLICY "person_identities team write"
  ON public.person_identities FOR INSERT
  WITH CHECK (public.can_insert_with_team(auth.uid(), team_id));

CREATE POLICY "person_identities team update"
  ON public.person_identities FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin')
    OR team_id = public.get_user_team_id(auth.uid())
  );

CREATE POLICY "person_identities admin delete"
  ON public.person_identities FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER person_identities_touch
  BEFORE UPDATE ON public.person_identities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add nullable person_identity_id to the 3 source tables -------------
ALTER TABLE public.contacts      ADD COLUMN IF NOT EXISTS person_identity_id uuid REFERENCES public.person_identities(id) ON DELETE SET NULL;
ALTER TABLE public.crm_contacts  ADD COLUMN IF NOT EXISTS person_identity_id uuid REFERENCES public.person_identities(id) ON DELETE SET NULL;
ALTER TABLE public.candidates    ADD COLUMN IF NOT EXISTS person_identity_id uuid REFERENCES public.person_identities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_person_identity     ON public.contacts(person_identity_id)     WHERE person_identity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_contacts_person_identity ON public.crm_contacts(person_identity_id) WHERE person_identity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_candidates_person_identity   ON public.candidates(person_identity_id)   WHERE person_identity_id IS NOT NULL;

-- 3. Normalisation helpers ----------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_email(_email text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(lower(trim(_email)), '');
$$;

CREATE OR REPLACE FUNCTION public.normalize_phone(_phone text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(regexp_replace(COALESCE(_phone,''), '[^0-9]', '', 'g'), '');
$$;

CREATE OR REPLACE FUNCTION public.normalize_linkedin(_url text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(
    regexp_replace(lower(trim(COALESCE(_url,''))), '^https?://(www\.)?', ''),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.normalize_name(_name text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(regexp_replace(lower(trim(COALESCE(_name,''))), '\s+', ' ', 'g'), '');
$$;

-- 4. Core matching + linking function -----------------------------------
-- Aggressive fuzzy strategy: email exact → linkedin exact → phone exact
-- → (full name + company) → fuzzy name within team.
CREATE OR REPLACE FUNCTION public.find_or_create_person_identity(
  _name text,
  _email text,
  _phone text,
  _linkedin text,
  _company text,
  _team_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _norm_email text := public.normalize_email(_email);
  _norm_phone text := public.normalize_phone(_phone);
  _norm_linkedin text := public.normalize_linkedin(_linkedin);
  _norm_name text := public.normalize_name(_name);
  _match_id uuid;
BEGIN
  IF COALESCE(_norm_name,'') = '' AND _norm_email IS NULL AND _norm_phone IS NULL THEN
    RETURN NULL;
  END IF;

  -- 1. Exact email
  IF _norm_email IS NOT NULL THEN
    SELECT id INTO _match_id FROM public.person_identities
    WHERE lower(primary_email) = _norm_email
      AND (team_id IS NOT DISTINCT FROM _team_id)
    LIMIT 1;
    IF _match_id IS NOT NULL THEN RETURN _match_id; END IF;
  END IF;

  -- 2. Exact LinkedIn
  IF _norm_linkedin IS NOT NULL THEN
    SELECT id INTO _match_id FROM public.person_identities
    WHERE public.normalize_linkedin(primary_linkedin_url) = _norm_linkedin
      AND (team_id IS NOT DISTINCT FROM _team_id)
    LIMIT 1;
    IF _match_id IS NOT NULL THEN RETURN _match_id; END IF;
  END IF;

  -- 3. Exact phone
  IF _norm_phone IS NOT NULL THEN
    SELECT id INTO _match_id FROM public.person_identities
    WHERE public.normalize_phone(primary_phone) = _norm_phone
      AND (team_id IS NOT DISTINCT FROM _team_id)
    LIMIT 1;
    IF _match_id IS NOT NULL THEN RETURN _match_id; END IF;
  END IF;

  -- 4. Fuzzy name within team (aggressive setting)
  IF _norm_name IS NOT NULL THEN
    SELECT id INTO _match_id FROM public.person_identities
    WHERE public.normalize_name(canonical_name) = _norm_name
      AND (team_id IS NOT DISTINCT FROM _team_id)
    LIMIT 1;
    IF _match_id IS NOT NULL THEN
      -- Enrich missing primary fields opportunistically
      UPDATE public.person_identities SET
        primary_email = COALESCE(primary_email, _email),
        primary_phone = COALESCE(primary_phone, _phone),
        primary_linkedin_url = COALESCE(primary_linkedin_url, _linkedin),
        updated_at = now()
      WHERE id = _match_id;
      RETURN _match_id;
    END IF;
  END IF;

  -- 5. Create new identity
  INSERT INTO public.person_identities(
    team_id, canonical_name, primary_email, primary_phone, primary_linkedin_url, merge_confidence
  ) VALUES (
    _team_id, COALESCE(_name,'(unknown)'), _email, _phone, _linkedin, 'auto'
  ) RETURNING id INTO _match_id;
  RETURN _match_id;
END;
$$;

-- 5. Triggers to auto-link on insert/update -----------------------------
CREATE OR REPLACE FUNCTION public.link_contact_person_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.person_identity_id IS NULL THEN
    NEW.person_identity_id := public.find_or_create_person_identity(
      NEW.name, NEW.email, NEW.phone, NULL, NULL, NEW.team_id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.link_crm_contact_person_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _full_name text := trim(concat_ws(' ', NEW.first_name, NEW.last_name));
  _phone text := COALESCE(NEW.mobile, NEW.phone);
BEGIN
  IF NEW.person_identity_id IS NULL THEN
    NEW.person_identity_id := public.find_or_create_person_identity(
      _full_name, NEW.email, _phone, NEW.linkedin_url, NULL, NEW.team_id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.link_candidate_person_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.person_identity_id IS NULL THEN
    NEW.person_identity_id := public.find_or_create_person_identity(
      NEW.name, NEW.email, NEW.phone, NEW.linkedin_url, NEW.current_company, NEW.tenant_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contacts_person_identity ON public.contacts;
CREATE TRIGGER trg_contacts_person_identity
  BEFORE INSERT OR UPDATE OF name, email, phone ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.link_contact_person_identity();

DROP TRIGGER IF EXISTS trg_crm_contacts_person_identity ON public.crm_contacts;
CREATE TRIGGER trg_crm_contacts_person_identity
  BEFORE INSERT OR UPDATE OF first_name, last_name, email, phone, mobile, linkedin_url ON public.crm_contacts
  FOR EACH ROW EXECUTE FUNCTION public.link_crm_contact_person_identity();

DROP TRIGGER IF EXISTS trg_candidates_person_identity ON public.candidates;
CREATE TRIGGER trg_candidates_person_identity
  BEFORE INSERT OR UPDATE OF name, email, phone, linkedin_url ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.link_candidate_person_identity();

-- 6. BACKFILL existing rows (aggressive fuzzy) --------------------------
-- Process in dependency order: candidates first (highest priority for routing),
-- then contacts, then crm_contacts. Each row gets linked or creates a new identity.
DO $$
DECLARE r RECORD;
BEGIN
  -- Candidates
  FOR r IN SELECT id, name, email, phone, linkedin_url, current_company, tenant_id
           FROM public.candidates WHERE person_identity_id IS NULL LOOP
    UPDATE public.candidates SET person_identity_id = public.find_or_create_person_identity(
      r.name, r.email, r.phone, r.linkedin_url, r.current_company, r.tenant_id
    ) WHERE id = r.id;
  END LOOP;

  -- Contacts
  FOR r IN SELECT id, name, email, phone, team_id
           FROM public.contacts WHERE person_identity_id IS NULL LOOP
    UPDATE public.contacts SET person_identity_id = public.find_or_create_person_identity(
      r.name, r.email, r.phone, NULL, NULL, r.team_id
    ) WHERE id = r.id;
  END LOOP;

  -- CRM contacts
  FOR r IN SELECT id, first_name, last_name, email, phone, mobile, linkedin_url, team_id
           FROM public.crm_contacts WHERE person_identity_id IS NULL LOOP
    UPDATE public.crm_contacts SET person_identity_id = public.find_or_create_person_identity(
      trim(concat_ws(' ', r.first_name, r.last_name)),
      r.email, COALESCE(r.mobile, r.phone), r.linkedin_url, NULL, r.team_id
    ) WHERE id = r.id;
  END LOOP;
END $$;

-- 7. Resolver helper used by frontend hook ------------------------------
CREATE OR REPLACE FUNCTION public.resolve_person_route(_person_identity_id uuid)
RETURNS TABLE (
  person_identity_id uuid,
  candidate_id uuid,
  contact_id uuid,
  crm_contact_id uuid,
  preferred_route text,
  display_name text,
  primary_email text,
  primary_phone text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH cand AS (
    SELECT id FROM public.candidates WHERE person_identity_id = _person_identity_id LIMIT 1
  ),
  con AS (
    SELECT id FROM public.contacts WHERE person_identity_id = _person_identity_id AND deleted_at IS NULL LIMIT 1
  ),
  crm AS (
    SELECT id FROM public.crm_contacts WHERE person_identity_id = _person_identity_id AND deleted_at IS NULL LIMIT 1
  ),
  pi AS (
    SELECT * FROM public.person_identities WHERE id = _person_identity_id
  )
  SELECT
    pi.id,
    (SELECT id FROM cand),
    (SELECT id FROM con),
    (SELECT id FROM crm),
    -- Talent → Contact → CRM priority
    CASE
      WHEN (SELECT id FROM cand) IS NOT NULL THEN 'talent'
      WHEN (SELECT id FROM con)  IS NOT NULL THEN 'contact'
      WHEN (SELECT id FROM crm)  IS NOT NULL THEN 'crm_contact'
      ELSE 'none'
    END,
    pi.canonical_name,
    pi.primary_email,
    pi.primary_phone
  FROM pi;
$$;

-- 8. Reverse resolver: given any source id, return identity_id ---------
CREATE OR REPLACE FUNCTION public.find_person_identity_by_source(
  _candidate_id uuid DEFAULT NULL,
  _contact_id uuid DEFAULT NULL,
  _crm_contact_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT person_identity_id FROM (
    SELECT person_identity_id FROM public.candidates   WHERE _candidate_id   IS NOT NULL AND id = _candidate_id
    UNION ALL
    SELECT person_identity_id FROM public.contacts     WHERE _contact_id     IS NOT NULL AND id = _contact_id
    UNION ALL
    SELECT person_identity_id FROM public.crm_contacts WHERE _crm_contact_id IS NOT NULL AND id = _crm_contact_id
  ) s WHERE person_identity_id IS NOT NULL LIMIT 1;
$$;