-- Create import_entities table for storing extracted entities pending review
-- Entity types: CANDIDATE, CONTACT, ORG_NODE, NOTE
-- Status: pending_review, approved, rejected, needs_input
CREATE TYPE public.import_entity_type AS ENUM ('candidate', 'contact', 'org_node', 'note');
CREATE TYPE public.import_entity_status AS ENUM ('pending_review', 'approved', 'rejected', 'needs_input');

CREATE TABLE public.import_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.cv_import_batches(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.cv_import_items(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL REFERENCES public.teams(id),
  entity_type public.import_entity_type NOT NULL,
  status public.import_entity_status NOT NULL DEFAULT 'pending_review',
  extracted_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  edited_json JSONB,
  confidence REAL DEFAULT 0.5,
  missing_fields TEXT[] DEFAULT '{}',
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejected_reason TEXT,
  created_record_id UUID,
  created_record_type TEXT,
  duplicate_of_id UUID,
  duplicate_of_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add index for fast lookups
CREATE INDEX idx_import_entities_batch_id ON public.import_entities(batch_id);
CREATE INDEX idx_import_entities_status ON public.import_entities(status);
CREATE INDEX idx_import_entities_tenant_id ON public.import_entities(tenant_id);

-- Enable RLS
ALTER TABLE public.import_entities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for import_entities
CREATE POLICY "Users can view their team entities"
  ON public.import_entities FOR SELECT
  USING (
    check_demo_isolation(tenant_id, auth.uid()) AND 
    ((tenant_id = get_user_team_id(auth.uid())) OR has_role(auth.uid(), 'admin'::app_role))
  );

CREATE POLICY "Contributors can create entities"
  ON public.import_entities FOR INSERT
  WITH CHECK (
    check_demo_isolation(tenant_id, auth.uid()) AND
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'contributor'::app_role)) AND
    (tenant_id = get_user_team_id(auth.uid()))
  );

CREATE POLICY "Owners and admins can update entities"
  ON public.import_entities FOR UPDATE
  USING (
    check_demo_isolation(tenant_id, auth.uid()) AND
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'contributor'::app_role)) AND
    (tenant_id = get_user_team_id(auth.uid()))
  );

CREATE POLICY "Admins can delete entities"
  ON public.import_entities FOR DELETE
  USING (
    check_demo_isolation(tenant_id, auth.uid()) AND 
    has_role(auth.uid(), 'admin'::app_role)
  );

-- Trigger for updated_at
CREATE TRIGGER update_import_entities_updated_at
  BEFORE UPDATE ON public.import_entities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add candidates table if not exists (for Talent Database)
CREATE TABLE IF NOT EXISTS public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.teams(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  location TEXT,
  linkedin_url TEXT,
  headline TEXT,
  current_title TEXT,
  current_company TEXT,
  skills JSONB DEFAULT '[]'::jsonb,
  experience JSONB DEFAULT '[]'::jsonb,
  education JSONB DEFAULT '[]'::jsonb,
  raw_cv_text TEXT,
  cv_storage_path TEXT,
  source TEXT DEFAULT 'import',
  status TEXT DEFAULT 'active',
  owner_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on candidates if not already
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

-- RLS policies for candidates
CREATE POLICY "candidates_select_policy"
  ON public.candidates FOR SELECT
  USING (
    check_demo_isolation(tenant_id, auth.uid()) AND 
    ((tenant_id = get_user_team_id(auth.uid())) OR has_role(auth.uid(), 'admin'::app_role))
  );

CREATE POLICY "candidates_insert_policy"
  ON public.candidates FOR INSERT
  WITH CHECK (
    check_demo_isolation(tenant_id, auth.uid()) AND
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'contributor'::app_role)) AND
    (tenant_id = get_user_team_id(auth.uid()))
  );

CREATE POLICY "candidates_update_policy"
  ON public.candidates FOR UPDATE
  USING (
    check_demo_isolation(tenant_id, auth.uid()) AND
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR 
     (has_role(auth.uid(), 'contributor'::app_role) AND owner_id = auth.uid()))
  );

CREATE POLICY "candidates_delete_policy"
  ON public.candidates FOR DELETE
  USING (
    check_demo_isolation(tenant_id, auth.uid()) AND 
    has_role(auth.uid(), 'admin'::app_role)
  );

-- Trigger for updated_at on candidates
CREATE TRIGGER update_candidates_updated_at
  BEFORE UPDATE ON public.candidates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();