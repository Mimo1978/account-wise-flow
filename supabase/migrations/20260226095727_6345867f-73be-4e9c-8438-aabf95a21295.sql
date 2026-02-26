
-- 1. crm_companies
CREATE TABLE public.crm_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  website text,
  industry text,
  size text,
  phone text,
  address_line1 text,
  address_line2 text,
  city text,
  postcode text,
  country text,
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
ALTER TABLE public.crm_companies ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_crm_companies_updated_at BEFORE UPDATE ON public.crm_companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated users can read crm_companies" ON public.crm_companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert crm_companies" ON public.crm_companies FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update own crm_companies" ON public.crm_companies FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Users can soft-delete own crm_companies" ON public.crm_companies FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- 2. crm_contacts
CREATE TABLE public.crm_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.crm_companies(id) ON DELETE SET NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  mobile text,
  job_title text,
  linkedin_url text,
  preferred_contact text,
  gdpr_consent boolean NOT NULL DEFAULT false,
  gdpr_consent_date timestamptz,
  gdpr_consent_method text,
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_crm_contacts_updated_at BEFORE UPDATE ON public.crm_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated users can read crm_contacts" ON public.crm_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert crm_contacts" ON public.crm_contacts FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update own crm_contacts" ON public.crm_contacts FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Users can soft-delete own crm_contacts" ON public.crm_contacts FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- 3. crm_projects
CREATE TABLE public.crm_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.crm_companies(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','paused','cancelled')),
  start_date date,
  end_date date,
  budget numeric,
  currency text NOT NULL DEFAULT 'GBP',
  project_type text,
  assigned_to uuid,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_projects ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_crm_projects_updated_at BEFORE UPDATE ON public.crm_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated users can read crm_projects" ON public.crm_projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert crm_projects" ON public.crm_projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update own crm_projects" ON public.crm_projects FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Users can delete own crm_projects" ON public.crm_projects FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- 4. crm_opportunities
CREATE TABLE public.crm_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.crm_projects(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.crm_companies(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  title text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GBP',
  stage text NOT NULL DEFAULT 'lead' CHECK (stage IN ('lead','qualified','proposal','negotiation','closed_won','closed_lost')),
  probability integer NOT NULL DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  expected_close_date date,
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_opportunities ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_crm_opportunities_updated_at BEFORE UPDATE ON public.crm_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated users can read crm_opportunities" ON public.crm_opportunities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert crm_opportunities" ON public.crm_opportunities FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update own crm_opportunities" ON public.crm_opportunities FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Users can delete own crm_opportunities" ON public.crm_opportunities FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- 5. crm_deals
CREATE TABLE public.crm_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid REFERENCES public.crm_opportunities(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.crm_companies(id) ON DELETE SET NULL,
  title text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GBP',
  signed_date date,
  start_date date,
  end_date date,
  payment_terms text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','complete','cancelled')),
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_crm_deals_updated_at BEFORE UPDATE ON public.crm_deals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated users can read crm_deals" ON public.crm_deals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert crm_deals" ON public.crm_deals FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update own crm_deals" ON public.crm_deals FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Users can delete own crm_deals" ON public.crm_deals FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- 6. crm_documents
CREATE TABLE public.crm_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES public.crm_deals(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.crm_companies(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'other' CHECK (type IN ('sow','contract','proposal','nda','invoice','other')),
  title text NOT NULL,
  file_url text,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','signed','rejected')),
  sent_at timestamptz,
  signed_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_documents ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_crm_documents_updated_at BEFORE UPDATE ON public.crm_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated users can read crm_documents" ON public.crm_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert crm_documents" ON public.crm_documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update own crm_documents" ON public.crm_documents FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Users can delete own crm_documents" ON public.crm_documents FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- 7. crm_invoices
CREATE TABLE public.crm_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES public.crm_deals(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.crm_companies(id) ON DELETE SET NULL,
  invoice_number text UNIQUE,
  issue_date date,
  due_date date,
  subtotal numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 0,
  vat_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GBP',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','overdue','cancelled')),
  paid_at timestamptz,
  payment_method text,
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_invoices ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_crm_invoices_updated_at BEFORE UPDATE ON public.crm_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated users can read crm_invoices" ON public.crm_invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert crm_invoices" ON public.crm_invoices FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update own crm_invoices" ON public.crm_invoices FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Users can delete own crm_invoices" ON public.crm_invoices FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- 8. crm_invoice_line_items
CREATE TABLE public.crm_invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.crm_invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0
);
ALTER TABLE public.crm_invoice_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read crm_invoice_line_items" ON public.crm_invoice_line_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert crm_invoice_line_items" ON public.crm_invoice_line_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.crm_invoices WHERE id = invoice_id AND created_by = auth.uid()));
CREATE POLICY "Users can update own crm_invoice_line_items" ON public.crm_invoice_line_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.crm_invoices WHERE id = invoice_id AND created_by = auth.uid()));
CREATE POLICY "Users can delete own crm_invoice_line_items" ON public.crm_invoice_line_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.crm_invoices WHERE id = invoice_id AND created_by = auth.uid()));

-- 9. crm_activities
CREATE TABLE public.crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('call','email','sms','meeting','note','task')),
  contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.crm_companies(id) ON DELETE SET NULL,
  opportunity_id uuid REFERENCES public.crm_opportunities(id) ON DELETE SET NULL,
  subject text,
  body text,
  direction text CHECK (direction IN ('inbound','outbound')),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','failed')),
  scheduled_at timestamptz,
  completed_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read crm_activities" ON public.crm_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert crm_activities" ON public.crm_activities FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update own crm_activities" ON public.crm_activities FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Users can delete own crm_activities" ON public.crm_activities FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- 10. crm_ai_audit_log (no PII)
CREATE TABLE public.crm_ai_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  input_summary text,
  output_summary text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_ai_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read crm_ai_audit_log" ON public.crm_ai_audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert crm_ai_audit_log" ON public.crm_ai_audit_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
