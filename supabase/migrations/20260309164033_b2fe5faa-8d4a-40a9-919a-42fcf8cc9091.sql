
-- Create commercial_documents table
CREATE TABLE public.commercial_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.teams(id) NOT NULL,
  type text NOT NULL DEFAULT 'other',
  name text NOT NULL,
  company_id uuid REFERENCES public.companies(id),
  deal_id uuid,
  contact_id uuid REFERENCES public.contacts(id),
  value numeric DEFAULT 0,
  currency text DEFAULT 'GBP',
  start_date date,
  end_date date,
  signed_date date,
  status text DEFAULT 'draft',
  file_url text,
  file_name text,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.commercial_documents ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users can read documents in their workspace
CREATE POLICY "Users can view own workspace documents"
  ON public.commercial_documents FOR SELECT TO authenticated
  USING (
    workspace_id IN (
      SELECT team_id FROM public.user_roles WHERE user_id = auth.uid()
    )
  );

-- RLS: authenticated users can insert documents in their workspace
CREATE POLICY "Users can insert own workspace documents"
  ON public.commercial_documents FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (
      SELECT team_id FROM public.user_roles WHERE user_id = auth.uid()
    )
  );

-- RLS: creator can update their documents
CREATE POLICY "Creator can update documents"
  ON public.commercial_documents FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

-- RLS: creator can delete their documents
CREATE POLICY "Creator can delete documents"
  ON public.commercial_documents FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- updated_at trigger
CREATE TRIGGER set_updated_at_commercial_documents
  BEFORE UPDATE ON public.commercial_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for commercial documents
INSERT INTO storage.buckets (id, name, public) VALUES ('commercial-documents', 'commercial-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can upload
CREATE POLICY "Authenticated users can upload commercial docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'commercial-documents');

-- Storage RLS: authenticated users can read
CREATE POLICY "Authenticated users can read commercial docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'commercial-documents');
