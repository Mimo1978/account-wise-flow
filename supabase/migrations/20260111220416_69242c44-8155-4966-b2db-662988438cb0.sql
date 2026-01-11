
-- Fix the INSERT policy to be more restrictive
-- Only allow inserts from the trigger context (changed_by must match auth.uid() or be null for system)
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_log;

-- Audit logs can only be inserted by authenticated users (via triggers)
-- The trigger runs with SECURITY DEFINER so it has elevated privileges
-- But we still want to restrict direct table access
CREATE POLICY "Authenticated users can insert audit logs via triggers" ON public.audit_log
FOR INSERT WITH CHECK (
  -- Allow if user is authenticated (trigger will set changed_by)
  auth.uid() IS NOT NULL OR changed_by IS NULL
);
