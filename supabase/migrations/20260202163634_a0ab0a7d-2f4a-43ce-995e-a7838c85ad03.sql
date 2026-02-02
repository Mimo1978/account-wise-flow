-- Create unified documents table for talent, contacts, companies
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.teams(id),
  
  -- Polymorphic entity reference
  entity_type TEXT NOT NULL CHECK (entity_type IN ('candidate', 'contact', 'company')),
  entity_id UUID NOT NULL,
  
  -- Document metadata
  name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'other' CHECK (document_type IN ('cv', 'job_spec', 'proposal', 'bid', 'contract', 'nda', 'sow', 'cover_letter', 'other')),
  storage_path TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  
  -- Text extraction for AI features
  raw_text TEXT,
  text_extracted_at TIMESTAMP WITH TIME ZONE,
  
  -- Ownership & audit
  owner_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Soft delete support
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Indexes for efficient queries
CREATE INDEX idx_documents_entity ON public.documents(entity_type, entity_id);
CREATE INDEX idx_documents_tenant ON public.documents(tenant_id);
CREATE INDEX idx_documents_type ON public.documents(document_type);
CREATE INDEX idx_documents_active ON public.documents(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "documents_select_policy"
ON public.documents
FOR SELECT
USING (
  check_demo_isolation(tenant_id, auth.uid())
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR tenant_id = get_user_team_id(auth.uid())
  )
);

CREATE POLICY "documents_insert_policy"
ON public.documents
FOR INSERT
WITH CHECK (
  check_demo_isolation(tenant_id, auth.uid())
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'contributor'::app_role)
  )
  AND tenant_id = get_user_team_id(auth.uid())
);

CREATE POLICY "documents_update_policy"
ON public.documents
FOR UPDATE
USING (
  check_demo_isolation(tenant_id, auth.uid())
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR (has_role(auth.uid(), 'contributor'::app_role) AND owner_id = auth.uid())
  )
);

CREATE POLICY "documents_delete_policy"
ON public.documents
FOR DELETE
USING (
  check_demo_isolation(tenant_id, auth.uid())
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for general documents if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for documents bucket
CREATE POLICY "documents_bucket_select"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'documents'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "documents_bucket_insert"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'documents'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "documents_bucket_update"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'documents'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "documents_bucket_delete"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'documents'
  AND auth.uid() IS NOT NULL
);