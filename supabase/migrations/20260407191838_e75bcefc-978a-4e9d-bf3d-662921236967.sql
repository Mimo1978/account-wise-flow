
CREATE TABLE public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id uuid NOT NULL REFERENCES public.placements(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  days numeric NOT NULL DEFAULT 1 CHECK (days IN (0.5, 1)),
  week_start date NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','invoiced')),
  logged_by uuid REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(placement_id, work_date)
);

CREATE INDEX idx_time_entries_placement ON public.time_entries(placement_id);
CREATE INDEX idx_time_entries_week ON public.time_entries(placement_id, week_start);
CREATE INDEX idx_time_entries_status ON public.time_entries(status);

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage time entries"
  ON public.time_entries FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.placements p
    WHERE p.id = placement_id
    AND check_demo_isolation(p.workspace_id, auth.uid())
  ));

CREATE TRIGGER update_time_entries_updated_at
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
