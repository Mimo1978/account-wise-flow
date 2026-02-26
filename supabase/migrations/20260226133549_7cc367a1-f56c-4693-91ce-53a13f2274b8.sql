-- Allow multiple top-level contacts in org chart hierarchy
-- Previous unique partial index forced a single root per company and blocked sibling roots.
DROP INDEX IF EXISTS public.uq_org_chart_one_root;

-- Keep root lookups performant without enforcing uniqueness
CREATE INDEX IF NOT EXISTS idx_org_chart_edges_root_lookup
  ON public.org_chart_edges (company_id)
  WHERE parent_contact_id IS NULL;