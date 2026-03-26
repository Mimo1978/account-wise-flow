-- Delete linked records first, then test deals
DELETE FROM public.crm_invoice_line_items
WHERE invoice_id IN (
  SELECT id FROM public.crm_invoices 
  WHERE deal_id IN (
    SELECT id FROM public.crm_deals 
    WHERE title IN ('zzzzzz', 'zzzzzzz', 'bq', 'RECRUITMENT')
  )
);

DELETE FROM public.crm_invoices
WHERE deal_id IN (
  SELECT id FROM public.crm_deals 
  WHERE title IN ('zzzzzz', 'zzzzzzz', 'bq', 'RECRUITMENT')
);

DELETE FROM public.crm_documents
WHERE deal_id IN (
  SELECT id FROM public.crm_deals 
  WHERE title IN ('zzzzzz', 'zzzzzzz', 'bq', 'RECRUITMENT')
);

DELETE FROM public.crm_deals 
WHERE title IN ('zzzzzz', 'zzzzzzz', 'bq', 'RECRUITMENT');