
-- Create SOWs (contracts) table
CREATE TABLE public.sows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.teams(id),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  engagement_id uuid NULL REFERENCES public.engagements(id),
  sow_ref text NULL,
  status text NOT NULL DEFAULT 'draft',
  start_date date NULL,
  end_date date NULL,
  renewal_date date NULL,
  value int4 NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GBP',
  billing_model text NOT NULL DEFAULT 'fixed',
  notes text NULL,
  document_id uuid NULL REFERENCES public.documents(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_sows_workspace ON public.sows (workspace_id);
CREATE INDEX idx_sows_company ON public.sows (workspace_id, company_id);
CREATE INDEX idx_sows_dates ON public.sows (workspace_id, renewal_date, end_date);

-- Enable RLS
ALTER TABLE public.sows ENABLE ROW LEVEL SECURITY;

-- RLS Policies (workspace-scoped, matching existing patterns)
CREATE POLICY "sows_select_policy"
  ON public.sows FOR SELECT
  USING (
    check_demo_isolation(workspace_id, auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR workspace_id = get_user_team_id(auth.uid())
    )
  );

CREATE POLICY "sows_insert_policy"
  ON public.sows FOR INSERT
  WITH CHECK (
    check_demo_isolation(workspace_id, auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'contributor'::app_role)
    )
    AND workspace_id = get_user_team_id(auth.uid())
  );

CREATE POLICY "sows_update_policy"
  ON public.sows FOR UPDATE
  USING (
    check_demo_isolation(workspace_id, auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'contributor'::app_role)
    )
    AND workspace_id = get_user_team_id(auth.uid())
  );

CREATE POLICY "sows_delete_policy"
  ON public.sows FOR DELETE
  USING (
    check_demo_isolation(workspace_id, auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_sows_updated_at
  BEFORE UPDATE ON public.sows
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
