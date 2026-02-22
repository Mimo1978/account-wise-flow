ALTER TABLE public.workspace_settings
ADD COLUMN outreach_rules jsonb NOT NULL DEFAULT '{
  "prevent_state_downgrade": true,
  "lock_opted_out": true,
  "manager_can_reopen": false,
  "treat_wrong_number_as_opt_out": true,
  "auto_snooze_on_max_attempts": true
}'::jsonb;