-- Create doc_kind enum for talent documents
CREATE TYPE public.doc_kind AS ENUM ('cv', 'cover_letter', 'certification', 'other');

-- Create parse_status enum for text extraction status
CREATE TYPE public.parse_status AS ENUM ('pending', 'parsed', 'failed');

-- Create talent_documents table
CREATE TABLE public.talent_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  talent_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  doc_kind public.doc_kind NOT NULL DEFAULT 'cv',
  parsed_text TEXT NULL,
  parse_status public.parse_status NOT NULL DEFAULT 'pending',
  text_hash TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_talent_documents_workspace_id ON public.talent_documents(workspace_id);
CREATE INDEX idx_talent_documents_talent_id ON public.talent_documents(talent_id);
CREATE INDEX idx_talent_documents_doc_kind ON public.talent_documents(doc_kind);

-- Enable Row Level Security
ALTER TABLE public.talent_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only workspace members can access
CREATE POLICY "talent_documents_select_policy"
ON public.talent_documents
FOR SELECT
USING (
  check_demo_isolation(workspace_id, auth.uid())
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR workspace_id = get_user_team_id(auth.uid())
  )
);

CREATE POLICY "talent_documents_insert_policy"
ON public.talent_documents
FOR INSERT
WITH CHECK (
  check_demo_isolation(workspace_id, auth.uid())
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'contributor'::app_role)
  )
  AND workspace_id = get_user_team_id(auth.uid())
);

CREATE POLICY "talent_documents_update_policy"
ON public.talent_documents
FOR UPDATE
USING (
  check_demo_isolation(workspace_id, auth.uid())
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR (has_role(auth.uid(), 'contributor'::app_role) AND uploaded_by = auth.uid())
  )
);

CREATE POLICY "talent_documents_delete_policy"
ON public.talent_documents
FOR DELETE
USING (
  check_demo_isolation(workspace_id, auth.uid())
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_talent_documents_updated_at
BEFORE UPDATE ON public.talent_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create private storage bucket for candidate CVs
INSERT INTO storage.buckets (id, name, public)
VALUES ('candidate_cvs', 'candidate_cvs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Only authenticated workspace members can access their files
CREATE POLICY "candidate_cvs_select_policy"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'candidate_cvs'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "candidate_cvs_insert_policy"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'candidate_cvs'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "candidate_cvs_update_policy"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'candidate_cvs'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "candidate_cvs_delete_policy"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'candidate_cvs'
  AND auth.role() = 'authenticated'
);