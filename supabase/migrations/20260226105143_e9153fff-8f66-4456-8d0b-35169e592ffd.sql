
-- Fix SECURITY DEFINER view by recreating with security_invoker = true
DROP VIEW IF EXISTS public.integration_status;

CREATE VIEW public.integration_status 
WITH (security_invoker = true)
AS
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
