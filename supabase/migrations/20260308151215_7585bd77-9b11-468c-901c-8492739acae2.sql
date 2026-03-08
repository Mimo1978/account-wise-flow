-- Create diary_events table
CREATE TABLE public.diary_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.teams(id),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'call',
  contact_id UUID REFERENCES public.contacts(id),
  company_id UUID REFERENCES public.companies(id),
  job_id UUID,
  candidate_id UUID REFERENCES public.candidates(id),
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.diary_events ENABLE ROW LEVEL SECURITY;

-- RLS: Users can see their own events within their workspace
CREATE POLICY "Users can view own diary events"
  ON public.diary_events FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own diary events"
  ON public.diary_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own diary events"
  ON public.diary_events FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own diary events"
  ON public.diary_events FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Indexes
CREATE INDEX idx_diary_events_user_time ON public.diary_events(user_id, start_time);
CREATE INDEX idx_diary_events_workspace ON public.diary_events(workspace_id);
CREATE INDEX idx_diary_events_status ON public.diary_events(status) WHERE status = 'scheduled';

-- Updated_at trigger
CREATE TRIGGER update_diary_events_updated_at
  BEFORE UPDATE ON public.diary_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.diary_events;