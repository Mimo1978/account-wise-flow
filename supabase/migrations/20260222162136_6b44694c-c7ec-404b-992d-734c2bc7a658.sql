ALTER TABLE public.workspace_settings
ADD COLUMN data_quality_rules jsonb NOT NULL DEFAULT '{"require_manager_approval_for_merge": false}'::jsonb;