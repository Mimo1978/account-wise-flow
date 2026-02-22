
CREATE OR REPLACE FUNCTION public.get_org_parent(p_company_id uuid, p_contact_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT parent_contact_id
  FROM public.org_chart_edges
  WHERE company_id = p_company_id
    AND child_contact_id = p_contact_id
  LIMIT 1;
$$;
