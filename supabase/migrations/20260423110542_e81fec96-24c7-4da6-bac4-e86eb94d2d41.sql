ALTER TABLE public.workspace_settings 
ADD COLUMN IF NOT EXISTS agency_name text,
ADD COLUMN IF NOT EXISTS agency_short_pitch text;

COMMENT ON COLUMN public.workspace_settings.agency_name IS 'Agency / firm name used in outreach scripts (e.g. "Bluebridge Data"). Resolves the {{agency.name}} variable.';
COMMENT ON COLUMN public.workspace_settings.agency_short_pitch IS 'One-line agency positioning statement, optional, used by AI script polish.';