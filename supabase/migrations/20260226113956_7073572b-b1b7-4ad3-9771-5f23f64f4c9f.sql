
-- GDPR Consent Log table
CREATE TABLE public.gdpr_consent_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('given', 'withdrawn')),
  method TEXT,
  recorded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gdpr_consent_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view consent logs"
  ON public.gdpr_consent_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert consent logs"
  ON public.gdpr_consent_log FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_gdpr_consent_log_contact ON public.gdpr_consent_log(contact_id);

-- Rate limiting table
CREATE TABLE public.edge_function_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  function_name TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_count INT NOT NULL DEFAULT 1
);

ALTER TABLE public.edge_function_rate_limits ENABLE ROW LEVEL SECURITY;

-- No direct client access needed - only used by edge functions via service role
CREATE UNIQUE INDEX idx_rate_limits_user_fn_window 
  ON public.edge_function_rate_limits(user_id, function_name, window_start);

CREATE INDEX idx_rate_limits_cleanup 
  ON public.edge_function_rate_limits(window_start);
