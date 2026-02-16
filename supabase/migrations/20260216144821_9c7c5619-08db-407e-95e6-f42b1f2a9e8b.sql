
-- Create the org_chart_edges table as single source of truth for hierarchy
CREATE TABLE public.org_chart_edges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  child_contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  parent_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  position_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- A contact can have only one parent per company
CREATE UNIQUE INDEX uq_org_chart_edge_child ON public.org_chart_edges (company_id, child_contact_id);

-- Only one root per company (partial unique index: only one row where parent_contact_id IS NULL per company)
CREATE UNIQUE INDEX uq_org_chart_one_root ON public.org_chart_edges (company_id) WHERE parent_contact_id IS NULL;

-- Index for fast parent lookups
CREATE INDEX idx_org_chart_edges_parent ON public.org_chart_edges (company_id, parent_contact_id);

-- Enable RLS
ALTER TABLE public.org_chart_edges ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can read/write edges for companies in their workspace
CREATE POLICY "Users can view org chart edges for their workspace companies"
ON public.org_chart_edges FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = org_chart_edges.company_id
    AND public.check_demo_isolation(c.team_id, auth.uid())
  )
);

CREATE POLICY "Users can insert org chart edges for editable companies"
ON public.org_chart_edges FOR INSERT
WITH CHECK (
  public.can_edit_company(auth.uid(), company_id)
);

CREATE POLICY "Users can update org chart edges for editable companies"
ON public.org_chart_edges FOR UPDATE
USING (
  public.can_edit_company(auth.uid(), company_id)
);

CREATE POLICY "Users can delete org chart edges for editable companies"
ON public.org_chart_edges FOR DELETE
USING (
  public.can_edit_company(auth.uid(), company_id)
);

-- Trigger for updated_at
CREATE TRIGGER update_org_chart_edges_updated_at
BEFORE UPDATE ON public.org_chart_edges
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing manager_id data into org_chart_edges
-- For contacts with manager_id set, create parent-child edges
INSERT INTO public.org_chart_edges (company_id, child_contact_id, parent_contact_id, position_index)
SELECT 
  c.company_id,
  c.id,
  c.manager_id,
  0
FROM public.contacts c
WHERE c.company_id IS NOT NULL
  AND c.manager_id IS NOT NULL
ON CONFLICT (company_id, child_contact_id) DO NOTHING;
