
-- Create invoices table
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.teams(id),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  engagement_id uuid NULL REFERENCES public.engagements(id),
  invoice_number text NULL,
  status text NOT NULL DEFAULT 'draft',
  amount integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GBP',
  issued_date date NULL,
  due_date date NULL,
  paid_date date NULL,
  notes text NULL,
  document_id uuid NULL REFERENCES public.documents(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_invoices_workspace ON public.invoices (workspace_id);
CREATE INDEX idx_invoices_due ON public.invoices (workspace_id, due_date);
CREATE INDEX idx_invoices_status ON public.invoices (workspace_id, status);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- RLS policies (workspace-scoped, same pattern as sows)
CREATE POLICY "invoices_select_policy"
  ON public.invoices FOR SELECT
  USING (
    check_demo_isolation(workspace_id, auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR workspace_id = get_user_team_id(auth.uid())
    )
  );

CREATE POLICY "invoices_insert_policy"
  ON public.invoices FOR INSERT
  WITH CHECK (
    check_demo_isolation(workspace_id, auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'contributor'::app_role)
    )
    AND workspace_id = get_user_team_id(auth.uid())
  );

CREATE POLICY "invoices_update_policy"
  ON public.invoices FOR UPDATE
  USING (
    check_demo_isolation(workspace_id, auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'contributor'::app_role)
    )
    AND workspace_id = get_user_team_id(auth.uid())
  );

CREATE POLICY "invoices_delete_policy"
  ON public.invoices FOR DELETE
  USING (
    check_demo_isolation(workspace_id, auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    )
  );
