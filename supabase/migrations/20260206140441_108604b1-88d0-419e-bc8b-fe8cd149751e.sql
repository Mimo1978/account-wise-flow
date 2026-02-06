
-- Create workspace_settings table
CREATE TABLE IF NOT EXISTS public.workspace_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL UNIQUE,
  -- Signal thresholds
  short_tenure_threshold_months INTEGER NOT NULL DEFAULT 9,
  gap_threshold_months INTEGER NOT NULL DEFAULT 6,
  contract_hop_min_stints INTEGER NOT NULL DEFAULT 3,
  contract_hop_lookback_months INTEGER NOT NULL DEFAULT 24,
  -- Top tier companies by sector (JSON: { "banking": [...], "tech": [...] })
  top_tier_companies JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT fk_workspace FOREIGN KEY (workspace_id) REFERENCES public.teams(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;

-- Admins and managers can view and update workspace settings
CREATE POLICY "workspace_settings_admin_manage"
  ON public.workspace_settings
  FOR ALL
  USING (
    check_demo_isolation(workspace_id, auth.uid()) 
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
    AND (workspace_id = get_user_team_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  )
  WITH CHECK (
    check_demo_isolation(workspace_id, auth.uid()) 
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
    AND (workspace_id = get_user_team_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  );

-- All authenticated users can view their workspace settings (read-only)
CREATE POLICY "workspace_settings_user_view"
  ON public.workspace_settings
  FOR SELECT
  USING (
    check_demo_isolation(workspace_id, auth.uid())
    AND (workspace_id = get_user_team_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  );

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_workspace_settings_updated_at
  BEFORE UPDATE ON public.workspace_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for workspace_id lookups
CREATE INDEX idx_workspace_settings_workspace_id ON public.workspace_settings(workspace_id);
