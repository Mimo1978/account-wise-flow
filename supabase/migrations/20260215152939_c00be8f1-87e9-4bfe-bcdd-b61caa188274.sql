
-- =============================================
-- 1. Add missing columns to existing tables
-- =============================================

-- contacts: add seniority, location, status, notes, verification_status, email_private
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS seniority text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS email_private text;

-- companies: add data_quality
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS data_quality text DEFAULT 'unknown';

-- candidates: add availability_status, ai_overview
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS availability_status text DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS ai_overview text;

-- =============================================
-- 2. Create canvas_nodes table
-- =============================================
CREATE TABLE IF NOT EXISTS public.canvas_nodes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  candidate_id uuid REFERENCES public.candidates(id) ON DELETE SET NULL,
  label_name text,
  label_title text,
  department text,
  x numeric NOT NULL DEFAULT 0,
  y numeric NOT NULL DEFAULT 0,
  verification_status text DEFAULT 'unverified',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.canvas_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "canvas_nodes_select_policy" ON public.canvas_nodes
  FOR SELECT USING (
    check_demo_isolation(workspace_id, auth.uid())
    AND (has_role(auth.uid(), 'admin') OR workspace_id = get_user_team_id(auth.uid()))
  );

CREATE POLICY "canvas_nodes_insert_policy" ON public.canvas_nodes
  FOR INSERT WITH CHECK (
    check_demo_isolation(workspace_id, auth.uid())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'contributor'))
    AND workspace_id = get_user_team_id(auth.uid())
  );

CREATE POLICY "canvas_nodes_update_policy" ON public.canvas_nodes
  FOR UPDATE USING (
    check_demo_isolation(workspace_id, auth.uid())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'contributor'))
    AND workspace_id = get_user_team_id(auth.uid())
  );

CREATE POLICY "canvas_nodes_delete_policy" ON public.canvas_nodes
  FOR DELETE USING (
    check_demo_isolation(workspace_id, auth.uid())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  );

CREATE TRIGGER update_canvas_nodes_updated_at
  BEFORE UPDATE ON public.canvas_nodes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 3. Create canvas_edges table
-- =============================================
CREATE TABLE IF NOT EXISTS public.canvas_edges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  from_node_id uuid NOT NULL REFERENCES public.canvas_nodes(id) ON DELETE CASCADE,
  to_node_id uuid NOT NULL REFERENCES public.canvas_nodes(id) ON DELETE CASCADE,
  relationship_type text DEFAULT 'reports_to',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.canvas_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "canvas_edges_select_policy" ON public.canvas_edges
  FOR SELECT USING (
    check_demo_isolation(workspace_id, auth.uid())
    AND (has_role(auth.uid(), 'admin') OR workspace_id = get_user_team_id(auth.uid()))
  );

CREATE POLICY "canvas_edges_insert_policy" ON public.canvas_edges
  FOR INSERT WITH CHECK (
    check_demo_isolation(workspace_id, auth.uid())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'contributor'))
    AND workspace_id = get_user_team_id(auth.uid())
  );

CREATE POLICY "canvas_edges_update_policy" ON public.canvas_edges
  FOR UPDATE USING (
    check_demo_isolation(workspace_id, auth.uid())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'contributor'))
  );

CREATE POLICY "canvas_edges_delete_policy" ON public.canvas_edges
  FOR DELETE USING (
    check_demo_isolation(workspace_id, auth.uid())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  );

-- =============================================
-- 4. Indexes for performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_canvas_nodes_workspace_company ON public.canvas_nodes(workspace_id, company_id);
CREATE INDEX IF NOT EXISTS idx_canvas_nodes_contact ON public.canvas_nodes(contact_id);
CREATE INDEX IF NOT EXISTS idx_canvas_edges_workspace_company ON public.canvas_edges(workspace_id, company_id);
CREATE INDEX IF NOT EXISTS idx_canvas_edges_from ON public.canvas_edges(from_node_id);
CREATE INDEX IF NOT EXISTS idx_canvas_edges_to ON public.canvas_edges(to_node_id);
