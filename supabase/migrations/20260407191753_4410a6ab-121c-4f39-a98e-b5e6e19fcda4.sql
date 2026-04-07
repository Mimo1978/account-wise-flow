
CREATE TABLE public.placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  candidate_id uuid REFERENCES public.candidates(id) ON DELETE SET NULL,
  engagement_id uuid REFERENCES public.engagements(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  job_id uuid REFERENCES public.job_specs(id) ON DELETE SET NULL,
  placement_type text NOT NULL DEFAULT 'contractor' CHECK (placement_type IN ('contractor','permanent','consulting')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled','on_hold')),
  start_date date NOT NULL,
  end_date date,
  rate_per_day numeric,
  currency text NOT NULL DEFAULT 'GBP',
  salary numeric,
  placement_fee numeric,
  fee_percentage numeric,
  invoice_frequency text DEFAULT 'monthly' CHECK (invoice_frequency IN ('weekly','monthly','milestone')),
  billing_contact_email text,
  po_number text,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_placements_workspace ON public.placements(workspace_id);
CREATE INDEX idx_placements_candidate ON public.placements(candidate_id);
CREATE INDEX idx_placements_company ON public.placements(company_id);
CREATE INDEX idx_placements_status ON public.placements(status);

ALTER TABLE public.placements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workspace placements"
  ON public.placements FOR SELECT TO authenticated
  USING (check_demo_isolation(workspace_id, auth.uid()));

CREATE POLICY "Users can insert workspace placements"
  ON public.placements FOR INSERT TO authenticated
  WITH CHECK (check_demo_isolation(workspace_id, auth.uid()));

CREATE POLICY "Users can update workspace placements"
  ON public.placements FOR UPDATE TO authenticated
  USING (check_demo_isolation(workspace_id, auth.uid()));

CREATE TRIGGER update_placements_updated_at
  BEFORE UPDATE ON public.placements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
