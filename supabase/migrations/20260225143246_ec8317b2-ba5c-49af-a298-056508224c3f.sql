
-- Create invoice_runs table for idempotent invoice generation tracking
CREATE TABLE public.invoice_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.teams(id),
  billing_plan_id uuid NOT NULL REFERENCES public.billing_plans(id),
  engagement_id uuid NOT NULL REFERENCES public.engagements(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  dedupe_key text NOT NULL,
  invoice_id uuid REFERENCES public.invoices(id),
  status text NOT NULL DEFAULT 'created',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint for idempotency
ALTER TABLE public.invoice_runs
  ADD CONSTRAINT uq_invoice_runs_dedupe UNIQUE (workspace_id, dedupe_key);

-- Indexes
CREATE INDEX idx_invoice_runs_workspace ON public.invoice_runs (workspace_id);
CREATE INDEX idx_invoice_runs_billing_plan ON public.invoice_runs (billing_plan_id);

-- Enable RLS
ALTER TABLE public.invoice_runs ENABLE ROW LEVEL SECURITY;

-- Workspace members can read
CREATE POLICY "Workspace members can view invoice runs"
  ON public.invoice_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.team_id = invoice_runs.workspace_id
    )
  );

-- Insert restricted to service role (edge function uses service role key)
-- No INSERT policy for authenticated users = only service_role can insert
