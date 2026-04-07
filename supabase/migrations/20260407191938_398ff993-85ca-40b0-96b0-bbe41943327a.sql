
CREATE TABLE public.placement_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id uuid NOT NULL REFERENCES public.placements(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_days numeric NOT NULL DEFAULT 0,
  rate_per_day numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 0,
  vat_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GBP',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','cancelled')),
  sent_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_placement_invoices_placement ON public.placement_invoices(placement_id);
CREATE INDEX idx_placement_invoices_status ON public.placement_invoices(status);

ALTER TABLE public.placement_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage placement invoices"
  ON public.placement_invoices FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.placements p
    WHERE p.id = placement_id
    AND check_demo_isolation(p.workspace_id, auth.uid())
  ));

CREATE TRIGGER update_placement_invoices_updated_at
  BEFORE UPDATE ON public.placement_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
