-- Create talent_signals table for general talent signals (not job-specific)
CREATE TABLE public.talent_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  talent_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'med', 'high')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  dismissed_by UUID NULL,
  dismissed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for efficient lookups
CREATE INDEX idx_talent_signals_talent_id ON public.talent_signals(talent_id);
CREATE INDEX idx_talent_signals_workspace_id ON public.talent_signals(workspace_id);
CREATE INDEX idx_talent_signals_signal_type ON public.talent_signals(signal_type);

-- Enable RLS
ALTER TABLE public.talent_signals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "talent_signals_select_policy" ON public.talent_signals
  FOR SELECT USING (
    check_demo_isolation(workspace_id, auth.uid()) AND 
    (has_role(auth.uid(), 'admin'::app_role) OR workspace_id = get_user_team_id(auth.uid()))
  );

CREATE POLICY "talent_signals_insert_policy" ON public.talent_signals
  FOR INSERT WITH CHECK (
    check_demo_isolation(workspace_id, auth.uid()) AND
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'contributor'::app_role)) AND
    workspace_id = get_user_team_id(auth.uid())
  );

CREATE POLICY "talent_signals_update_policy" ON public.talent_signals
  FOR UPDATE USING (
    check_demo_isolation(workspace_id, auth.uid()) AND 
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  );

CREATE POLICY "talent_signals_delete_policy" ON public.talent_signals
  FOR DELETE USING (
    check_demo_isolation(workspace_id, auth.uid()) AND 
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  );

-- Add updated_at trigger
CREATE TRIGGER update_talent_signals_updated_at
  BEFORE UPDATE ON public.talent_signals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE public.talent_signals IS 'Neutral risk signals for talent records - advisory only, not blocking';
COMMENT ON COLUMN public.talent_signals.signal_type IS 'Signal type: short_tenure, unexplained_gap, role_mismatch, contract_hopping';
COMMENT ON COLUMN public.talent_signals.severity IS 'Severity level: low, med, high';
COMMENT ON COLUMN public.talent_signals.evidence IS 'Array of evidence snippets referencing CV text';