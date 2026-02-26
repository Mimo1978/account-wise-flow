
-- Table: integration_settings — stores per-user API keys
CREATE TABLE public.integration_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service text NOT NULL,
  key_name text NOT NULL,
  key_value text NOT NULL DEFAULT '',
  is_configured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, service, key_name)
);

ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own integration settings"
  ON public.integration_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own integration settings"
  ON public.integration_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own integration settings"
  ON public.integration_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own integration settings"
  ON public.integration_settings FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_integration_settings_updated_at
  BEFORE UPDATE ON public.integration_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table: email_templates — per-user email templates
CREATE TABLE public.email_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL DEFAULT '',
  body_html text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own email templates"
  ON public.email_templates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own email templates"
  ON public.email_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own email templates"
  ON public.email_templates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own email templates"
  ON public.email_templates FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- View: integration_status — checks if all required keys are present per service
CREATE OR REPLACE VIEW public.integration_status AS
WITH required_keys AS (
  SELECT 'resend' AS service, unnest(ARRAY['RESEND_API_KEY', 'FROM_EMAIL_ADDRESS']) AS key_name
  UNION ALL
  SELECT 'twilio', unnest(ARRAY['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'])
  UNION ALL
  SELECT 'elevenlabs', 'ELEVENLABS_API_KEY'
  UNION ALL
  SELECT 'anthropic', 'ANTHROPIC_API_KEY'
),
user_keys AS (
  SELECT user_id, service, key_name, key_value
  FROM public.integration_settings
  WHERE key_value IS NOT NULL AND key_value != ''
),
check_result AS (
  SELECT 
    uk.user_id,
    rk.service,
    COUNT(rk.key_name) AS required_count,
    COUNT(uk.key_value) AS configured_count
  FROM required_keys rk
  LEFT JOIN user_keys uk ON uk.service = rk.service AND uk.key_name = rk.key_name
  GROUP BY uk.user_id, rk.service
)
SELECT 
  user_id,
  service,
  (required_count = configured_count AND user_id IS NOT NULL) AS is_fully_configured
FROM check_result
WHERE user_id IS NOT NULL;

-- RLS on the view is inherited from the underlying table,
-- but we need to ensure security via the underlying table's RLS.
