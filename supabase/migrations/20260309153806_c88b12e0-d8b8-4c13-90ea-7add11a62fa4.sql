
-- Create leads table for lead capture flow
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.crm_companies(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'inbound',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  deal_id UUID REFERENCES public.crm_deals(id) ON DELETE SET NULL,
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- RLS policies for leads
CREATE POLICY "Authenticated users can view leads" ON public.leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Authenticated users can update leads" ON public.leads FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete leads" ON public.leads FOR DELETE TO authenticated USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

-- Add deal_id to crm_projects if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='crm_projects' AND column_name='deal_id') THEN
    ALTER TABLE public.crm_projects ADD COLUMN deal_id UUID REFERENCES public.crm_deals(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add contact_id to crm_deals if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='crm_deals' AND column_name='contact_id') THEN
    ALTER TABLE public.crm_deals ADD COLUMN contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add project_id to crm_deals if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='crm_deals' AND column_name='project_id') THEN
    ALTER TABLE public.crm_deals ADD COLUMN project_id UUID REFERENCES public.crm_projects(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add stage column to crm_deals for pipeline stages
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='crm_deals' AND column_name='stage') THEN
    ALTER TABLE public.crm_deals ADD COLUMN stage TEXT NOT NULL DEFAULT 'lead';
  END IF;
END $$;

-- Add project_id and deal_id to crm_invoices if not exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='crm_invoices' AND column_name='project_id') THEN
    ALTER TABLE public.crm_invoices ADD COLUMN project_id UUID REFERENCES public.crm_projects(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Update trigger for leads
CREATE OR REPLACE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
