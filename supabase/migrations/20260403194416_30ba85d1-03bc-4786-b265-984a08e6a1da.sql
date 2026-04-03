-- Remove ghost companies from crm_companies that have already been
-- soft-deleted or hard-deleted from the main companies table

-- Soft-delete crm_companies that match a deleted company by name
UPDATE public.crm_companies cc
SET 
  deleted_at = now(),
  deleted_by = NULL,
  deletion_reason = 'Sync cleanup - matching company was deleted'
WHERE
  cc.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.companies c
    WHERE lower(trim(c.name)) = lower(trim(cc.name))
    AND c.deleted_at IS NOT NULL
  );

-- Soft-delete crm_companies where the matching company no longer exists
-- (was hard-deleted/purged from companies table)
UPDATE public.crm_companies cc
SET
  deleted_at = now(),
  deleted_by = NULL,
  deletion_reason = 'Sync cleanup - matching company no longer exists'
WHERE
  cc.deleted_at IS NULL
  AND cc.team_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.companies c
    WHERE lower(trim(c.name)) = lower(trim(cc.name))
    AND c.team_id = cc.team_id
    AND c.deleted_at IS NULL
  );