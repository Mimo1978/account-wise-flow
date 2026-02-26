
-- Create storage bucket for CRM documents (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('crm-documents', 'crm-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for crm-documents bucket
CREATE POLICY "Authenticated users can upload crm documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'crm-documents');

CREATE POLICY "Authenticated users can view crm documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'crm-documents');

CREATE POLICY "Authenticated users can update crm documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'crm-documents');

CREATE POLICY "Authenticated users can delete crm documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'crm-documents');
