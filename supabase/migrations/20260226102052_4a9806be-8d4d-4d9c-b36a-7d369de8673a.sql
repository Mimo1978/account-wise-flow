
-- Function to generate sequential CRM invoice numbers: INV-{YEAR}-{0001}
CREATE OR REPLACE FUNCTION public.generate_crm_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_year text;
  next_seq int;
BEGIN
  current_year := to_char(now(), 'YYYY');
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN invoice_number ~ ('^INV-' || current_year || '-\d{4}$')
      THEN CAST(substring(invoice_number from '\d{4}$') AS int)
      ELSE 0
    END
  ), 0) + 1
  INTO next_seq
  FROM public.crm_invoices;
  
  NEW.invoice_number := 'INV-' || current_year || '-' || lpad(next_seq::text, 4, '0');
  
  RETURN NEW;
END;
$function$;

-- Trigger to auto-generate invoice number on insert
CREATE TRIGGER trg_crm_invoice_number
  BEFORE INSERT ON public.crm_invoices
  FOR EACH ROW
  WHEN (NEW.invoice_number IS NULL OR NEW.invoice_number = '')
  EXECUTE FUNCTION public.generate_crm_invoice_number();

-- Add unique constraint on invoice_number
ALTER TABLE public.crm_invoices ADD CONSTRAINT crm_invoices_invoice_number_unique UNIQUE (invoice_number);

-- Create storage bucket for CRM invoice PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('crm-invoices', 'crm-invoices', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for crm-invoices bucket
CREATE POLICY "Authenticated users can upload CRM invoices"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'crm-invoices');

CREATE POLICY "Authenticated users can read CRM invoices"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'crm-invoices');
