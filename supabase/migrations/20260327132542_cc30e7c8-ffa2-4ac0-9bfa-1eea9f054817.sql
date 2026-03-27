ALTER TABLE public.talent_documents 
ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT,
ADD COLUMN IF NOT EXISTS pdf_conversion_status TEXT DEFAULT 'pending';

-- Set existing PDFs as not_needed
UPDATE public.talent_documents
SET pdf_conversion_status = 'not_needed',
    pdf_storage_path = file_path
WHERE LOWER(file_name) LIKE '%.pdf' 
   OR file_type = 'PDF';