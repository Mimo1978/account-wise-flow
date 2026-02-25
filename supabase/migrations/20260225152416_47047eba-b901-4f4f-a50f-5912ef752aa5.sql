
-- ============================================================
-- BILLING V2: New tables + invoices extension
-- ============================================================

-- 1) workspace_billing_settings
CREATE TABLE public.workspace_billing_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  legal_name text NULL,
  trading_name text NULL,
  address_line1 text NULL,
  address_line2 text NULL,
  city text NULL,
  postcode text NULL,
  country text NULL,
  vat_number text NULL,
  tax_label text NOT NULL DEFAULT 'VAT',
  payment_terms_days int4 NOT NULL DEFAULT 14,
  bank_account_name text NULL,
  bank_sort_code text NULL,
  bank_account_number text NULL,
  bank_iban text NULL,
  bank_swift text NULL,
  invoice_prefix text NOT NULL DEFAULT 'INV',
  next_invoice_number int4 NOT NULL DEFAULT 1,
  currency text NOT NULL DEFAULT 'GBP',
  logo_url text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id)
);

ALTER TABLE public.workspace_billing_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workspace billing settings"
  ON public.workspace_billing_settings FOR SELECT
  USING (workspace_id = public.get_user_team_id(auth.uid()) AND public.check_demo_isolation(workspace_id, auth.uid()));

CREATE POLICY "Admins/managers can insert billing settings"
  ON public.workspace_billing_settings FOR INSERT
  WITH CHECK (
    workspace_id = public.get_user_team_id(auth.uid())
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Admins/managers can update billing settings"
  ON public.workspace_billing_settings FOR UPDATE
  USING (
    workspace_id = public.get_user_team_id(auth.uid())
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

CREATE TRIGGER update_workspace_billing_settings_updated_at
  BEFORE UPDATE ON public.workspace_billing_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) company_billing_profiles
CREATE TABLE public.company_billing_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  billing_email text NULL,
  billing_contact_id uuid NULL REFERENCES public.contacts(id) ON DELETE SET NULL,
  billing_address_line1 text NULL,
  billing_address_line2 text NULL,
  billing_city text NULL,
  billing_postcode text NULL,
  billing_country text NULL,
  vat_number text NULL,
  po_number text NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, company_id)
);

CREATE INDEX idx_company_billing_profiles_workspace ON public.company_billing_profiles(workspace_id);
CREATE INDEX idx_company_billing_profiles_company ON public.company_billing_profiles(company_id);

ALTER TABLE public.company_billing_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workspace billing profiles"
  ON public.company_billing_profiles FOR SELECT
  USING (workspace_id = public.get_user_team_id(auth.uid()) AND public.check_demo_isolation(workspace_id, auth.uid()));

CREATE POLICY "Admins/managers can insert billing profiles"
  ON public.company_billing_profiles FOR INSERT
  WITH CHECK (
    workspace_id = public.get_user_team_id(auth.uid())
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Admins/managers can update billing profiles"
  ON public.company_billing_profiles FOR UPDATE
  USING (
    workspace_id = public.get_user_team_id(auth.uid())
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

CREATE TRIGGER update_company_billing_profiles_updated_at
  BEFORE UPDATE ON public.company_billing_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) invoice_plans (automation)
CREATE TABLE public.invoice_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  engagement_id uuid NULL REFERENCES public.engagements(id) ON DELETE SET NULL,
  sow_id uuid NULL REFERENCES public.sows(id) ON DELETE SET NULL,
  deal_id uuid NULL REFERENCES public.deals(id) ON DELETE SET NULL,
  name text NOT NULL,
  plan_type text NOT NULL DEFAULT 'consulting',
  status text NOT NULL DEFAULT 'active',
  frequency text NOT NULL DEFAULT 'monthly',
  interval_count int4 NOT NULL DEFAULT 1,
  invoice_day_of_month int4 NULL,
  invoice_day_of_week int4 NULL,
  start_date date NOT NULL DEFAULT current_date,
  end_date date NULL,
  next_run_date date NULL,
  amount_mode text NOT NULL DEFAULT 'fixed',
  fixed_amount numeric NULL,
  currency text NOT NULL DEFAULT 'GBP',
  rate_per_day numeric NULL,
  estimated_days int4 NULL,
  vat_rate numeric NULL,
  description text NULL,
  draft_auto_create boolean NOT NULL DEFAULT true,
  auto_send boolean NOT NULL DEFAULT false,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoice_plans_workspace ON public.invoice_plans(workspace_id);
CREATE INDEX idx_invoice_plans_company ON public.invoice_plans(company_id);
CREATE INDEX idx_invoice_plans_engagement ON public.invoice_plans(engagement_id);
CREATE INDEX idx_invoice_plans_next_run ON public.invoice_plans(next_run_date);
CREATE INDEX idx_invoice_plans_status ON public.invoice_plans(status);

ALTER TABLE public.invoice_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workspace invoice plans"
  ON public.invoice_plans FOR SELECT
  USING (workspace_id = public.get_user_team_id(auth.uid()) AND public.check_demo_isolation(workspace_id, auth.uid()));

CREATE POLICY "Admins/managers can insert invoice plans"
  ON public.invoice_plans FOR INSERT
  WITH CHECK (
    workspace_id = public.get_user_team_id(auth.uid())
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Admins/managers can update invoice plans"
  ON public.invoice_plans FOR UPDATE
  USING (
    workspace_id = public.get_user_team_id(auth.uid())
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Admins/managers can delete invoice plans"
  ON public.invoice_plans FOR DELETE
  USING (
    workspace_id = public.get_user_team_id(auth.uid())
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

CREATE TRIGGER update_invoice_plans_updated_at
  BEFORE UPDATE ON public.invoice_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) invoice_line_items
CREATE TABLE public.invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  sort_order int4 NOT NULL DEFAULT 1,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoice_line_items_invoice ON public.invoice_line_items(invoice_id);

ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workspace line items"
  ON public.invoice_line_items FOR SELECT
  USING (workspace_id = public.get_user_team_id(auth.uid()) AND public.check_demo_isolation(workspace_id, auth.uid()));

CREATE POLICY "Admins/managers can insert line items"
  ON public.invoice_line_items FOR INSERT
  WITH CHECK (
    workspace_id = public.get_user_team_id(auth.uid())
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Admins/managers can update line items"
  ON public.invoice_line_items FOR UPDATE
  USING (
    workspace_id = public.get_user_team_id(auth.uid())
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Admins/managers can delete line items"
  ON public.invoice_line_items FOR DELETE
  USING (
    workspace_id = public.get_user_team_id(auth.uid())
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

-- 5) Extend invoices table with new columns (safe nullable additions)
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS subtotal numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pdf_url text NULL,
  ADD COLUMN IF NOT EXISTS billing_to_name text NULL,
  ADD COLUMN IF NOT EXISTS billing_to_email text NULL,
  ADD COLUMN IF NOT EXISTS billing_to_address jsonb NULL,
  ADD COLUMN IF NOT EXISTS po_number text NULL,
  ADD COLUMN IF NOT EXISTS vat_number text NULL,
  ADD COLUMN IF NOT EXISTS invoice_plan_id uuid NULL REFERENCES public.invoice_plans(id) ON DELETE SET NULL;

-- 6) Drop and recreate invoice_runs to match the new schema
-- The existing invoice_runs has different columns (billing_plan_id, dedupe_key, etc.)
-- We'll add the new columns alongside
ALTER TABLE public.invoice_runs
  ADD COLUMN IF NOT EXISTS ran_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS due_date date NULL,
  ADD COLUMN IF NOT EXISTS plans_processed int4 DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoices_created int4 DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoices_skipped int4 DEFAULT 0,
  ADD COLUMN IF NOT EXISTS errors jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by uuid NULL;

-- 7) Function to recompute invoice totals from line items
CREATE OR REPLACE FUNCTION public.recompute_invoice_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subtotal numeric;
  v_invoice RECORD;
BEGIN
  SELECT COALESCE(SUM(line_total), 0) INTO v_subtotal
  FROM public.invoice_line_items
  WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);

  UPDATE public.invoices
  SET subtotal = v_subtotal,
      total = v_subtotal + tax_amount,
      amount = v_subtotal + tax_amount,
      updated_at = now()
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER recompute_invoice_totals_on_line_change
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_line_items
  FOR EACH ROW EXECUTE FUNCTION public.recompute_invoice_totals();
