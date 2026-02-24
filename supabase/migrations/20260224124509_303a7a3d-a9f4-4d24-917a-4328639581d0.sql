
-- Create deals table
CREATE TABLE public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.teams(id),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  engagement_id uuid NULL REFERENCES public.engagements(id),
  name text NOT NULL,
  stage text NOT NULL DEFAULT 'lead',
  owner_id uuid NULL,
  value integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GBP',
  probability integer NOT NULL DEFAULT 10,
  expected_close_date date NULL,
  next_step text NULL,
  next_step_due date NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_deals_workspace ON public.deals (workspace_id);
CREATE INDEX idx_deals_stage ON public.deals (workspace_id, stage);
CREATE INDEX idx_deals_close ON public.deals (workspace_id, expected_close_date);

-- Enable RLS
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "deals_select_policy"
  ON public.deals FOR SELECT
  USING (
    check_demo_isolation(workspace_id, auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR workspace_id = get_user_team_id(auth.uid())
    )
  );

CREATE POLICY "deals_insert_policy"
  ON public.deals FOR INSERT
  WITH CHECK (
    check_demo_isolation(workspace_id, auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'contributor'::app_role)
    )
    AND workspace_id = get_user_team_id(auth.uid())
  );

CREATE POLICY "deals_update_policy"
  ON public.deals FOR UPDATE
  USING (
    check_demo_isolation(workspace_id, auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'contributor'::app_role)
    )
    AND workspace_id = get_user_team_id(auth.uid())
  );

CREATE POLICY "deals_delete_policy"
  ON public.deals FOR DELETE
  USING (
    check_demo_isolation(workspace_id, auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    )
  );
