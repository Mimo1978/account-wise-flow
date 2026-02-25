
-- Create billing_plans table
CREATE TABLE public.billing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.teams(id),
  engagement_id uuid NOT NULL REFERENCES public.engagements(id),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  plan_name text NOT NULL,
  plan_type text NOT NULL DEFAULT 'consulting',
  status text NOT NULL DEFAULT 'active',
  frequency text NOT NULL DEFAULT 'monthly',
  currency text NOT NULL DEFAULT 'GBP',
  billing_mode text NOT NULL DEFAULT 'fixed',
  fixed_amount numeric NULL,
  day_rate numeric NULL,
  included_days int4 NULL,
  estimated_days int4 NULL,
  vat_rate numeric NULL,
  po_number text NULL,
  invoice_day_of_month int4 NULL,
  next_run_date date NULL,
  last_run_at timestamptz NULL,
  end_date date NULL,
  notes text NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_billing_plans_workspace ON public.billing_plans (workspace_id);
CREATE INDEX idx_billing_plans_engagement ON public.billing_plans (engagement_id);
CREATE INDEX idx_billing_plans_next_run ON public.billing_plans (workspace_id, next_run_date) WHERE next_run_date IS NOT NULL;

-- Enable RLS
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;

-- RLS: workspace members can SELECT
CREATE POLICY "billing_plans_select_policy"
ON public.billing_plans FOR SELECT
USING (
  check_demo_isolation(workspace_id, auth.uid())
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR workspace_id = get_user_team_id(auth.uid())
  )
);

-- RLS: admin/manager can INSERT
CREATE POLICY "billing_plans_insert_policy"
ON public.billing_plans FOR INSERT
WITH CHECK (
  check_demo_isolation(workspace_id, auth.uid())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  AND workspace_id = get_user_team_id(auth.uid())
);

-- RLS: admin/manager can UPDATE
CREATE POLICY "billing_plans_update_policy"
ON public.billing_plans FOR UPDATE
USING (
  check_demo_isolation(workspace_id, auth.uid())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  AND workspace_id = get_user_team_id(auth.uid())
);

-- RLS: admin/manager can DELETE
CREATE POLICY "billing_plans_delete_policy"
ON public.billing_plans FOR DELETE
USING (
  check_demo_isolation(workspace_id, auth.uid())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
);

-- updated_at trigger
CREATE TRIGGER update_billing_plans_updated_at
BEFORE UPDATE ON public.billing_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
