-- Create candidate_notes table for the notes system
CREATE TABLE public.candidate_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  title TEXT,
  body TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  visibility public.note_visibility DEFAULT 'team',
  is_deleted BOOLEAN DEFAULT false,
  deletion_requested_by UUID,
  deletion_requested_at TIMESTAMPTZ,
  owner_id UUID,
  team_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on candidate_notes
ALTER TABLE public.candidate_notes ENABLE ROW LEVEL SECURITY;

-- Create interview stage enum
CREATE TYPE public.interview_stage AS ENUM ('screening', 'first', 'second', 'final', 'offer', 'rejected', 'withdrawn');

-- Create interview outcome enum  
CREATE TYPE public.interview_outcome AS ENUM ('pending', 'passed', 'failed', 'hold', 'cancelled');

-- Create candidate_interviews table for pipeline tracking
CREATE TABLE public.candidate_interviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  stage public.interview_stage NOT NULL,
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  interviewer TEXT,
  interviewer_user_id UUID,
  outcome public.interview_outcome DEFAULT 'pending',
  next_action TEXT,
  notes TEXT,
  company_id UUID REFERENCES public.companies(id),
  opportunity_id UUID,
  owner_id UUID,
  team_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on candidate_interviews
ALTER TABLE public.candidate_interviews ENABLE ROW LEVEL SECURITY;

-- Create opportunity status enum
CREATE TYPE public.opportunity_status AS ENUM ('submitted', 'shortlisted', 'interviewing', 'offered', 'placed', 'dropped', 'rejected');

-- Create candidate_opportunities table for project/opportunity tracking
CREATE TABLE public.candidate_opportunities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id),
  project_name TEXT,
  role_name TEXT NOT NULL,
  status public.opportunity_status DEFAULT 'submitted',
  rate TEXT,
  start_date DATE,
  end_date DATE,
  notes TEXT,
  owner_id UUID,
  team_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on candidate_opportunities
ALTER TABLE public.candidate_opportunities ENABLE ROW LEVEL SECURITY;

-- Add foreign key for opportunity_id in interviews
ALTER TABLE public.candidate_interviews 
ADD CONSTRAINT candidate_interviews_opportunity_id_fkey 
FOREIGN KEY (opportunity_id) REFERENCES public.candidate_opportunities(id) ON DELETE SET NULL;

-- Create RLS policies for candidate_notes

-- Select policy: can view if part of team
CREATE POLICY "candidate_notes_select" ON public.candidate_notes
FOR SELECT USING (
  check_demo_isolation(team_id, auth.uid()) AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    (has_role(auth.uid(), 'manager'::app_role) AND (team_id IS NULL OR team_id = get_user_team_id(auth.uid()))) OR
    (has_role(auth.uid(), 'contributor'::app_role) AND (
      owner_id = auth.uid() OR 
      visibility = 'public' OR 
      (visibility = 'team' AND (team_id IS NULL OR team_id = get_user_team_id(auth.uid())))
    ))
  )
);

-- Insert policy
CREATE POLICY "candidate_notes_insert" ON public.candidate_notes
FOR INSERT WITH CHECK (
  check_demo_isolation(team_id, auth.uid()) AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'contributor'::app_role)) AND
  owner_id = auth.uid()
);

-- Update policy
CREATE POLICY "candidate_notes_update" ON public.candidate_notes
FOR UPDATE USING (
  check_demo_isolation(team_id, auth.uid()) AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    (has_role(auth.uid(), 'manager'::app_role) AND (team_id IS NULL OR team_id = get_user_team_id(auth.uid()))) OR
    (has_role(auth.uid(), 'contributor'::app_role) AND owner_id = auth.uid())
  )
);

-- Delete policy: admin/manager can hard delete, contributors can request deletion
CREATE POLICY "candidate_notes_delete" ON public.candidate_notes
FOR DELETE USING (
  check_demo_isolation(team_id, auth.uid()) AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    (has_role(auth.uid(), 'manager'::app_role) AND (team_id IS NULL OR team_id = get_user_team_id(auth.uid())))
  )
);

-- Create RLS policies for candidate_interviews

CREATE POLICY "candidate_interviews_select" ON public.candidate_interviews
FOR SELECT USING (
  check_demo_isolation(team_id, auth.uid()) AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    (team_id IS NULL OR team_id = get_user_team_id(auth.uid()))
  )
);

CREATE POLICY "candidate_interviews_insert" ON public.candidate_interviews
FOR INSERT WITH CHECK (
  check_demo_isolation(team_id, auth.uid()) AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'contributor'::app_role)) AND
  (team_id IS NULL OR team_id = get_user_team_id(auth.uid()))
);

CREATE POLICY "candidate_interviews_update" ON public.candidate_interviews
FOR UPDATE USING (
  check_demo_isolation(team_id, auth.uid()) AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    (has_role(auth.uid(), 'manager'::app_role) AND (team_id IS NULL OR team_id = get_user_team_id(auth.uid()))) OR
    (has_role(auth.uid(), 'contributor'::app_role) AND owner_id = auth.uid())
  )
);

CREATE POLICY "candidate_interviews_delete" ON public.candidate_interviews
FOR DELETE USING (
  check_demo_isolation(team_id, auth.uid()) AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    (has_role(auth.uid(), 'manager'::app_role) AND (team_id IS NULL OR team_id = get_user_team_id(auth.uid())))
  )
);

-- Create RLS policies for candidate_opportunities

CREATE POLICY "candidate_opportunities_select" ON public.candidate_opportunities
FOR SELECT USING (
  check_demo_isolation(team_id, auth.uid()) AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    (team_id IS NULL OR team_id = get_user_team_id(auth.uid()))
  )
);

CREATE POLICY "candidate_opportunities_insert" ON public.candidate_opportunities
FOR INSERT WITH CHECK (
  check_demo_isolation(team_id, auth.uid()) AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'contributor'::app_role)) AND
  (team_id IS NULL OR team_id = get_user_team_id(auth.uid()))
);

CREATE POLICY "candidate_opportunities_update" ON public.candidate_opportunities
FOR UPDATE USING (
  check_demo_isolation(team_id, auth.uid()) AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    (has_role(auth.uid(), 'manager'::app_role) AND (team_id IS NULL OR team_id = get_user_team_id(auth.uid()))) OR
    (has_role(auth.uid(), 'contributor'::app_role) AND owner_id = auth.uid())
  )
);

CREATE POLICY "candidate_opportunities_delete" ON public.candidate_opportunities
FOR DELETE USING (
  check_demo_isolation(team_id, auth.uid()) AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    (has_role(auth.uid(), 'manager'::app_role) AND (team_id IS NULL OR team_id = get_user_team_id(auth.uid())))
  )
);

-- Create trigger for updated_at on all new tables
CREATE TRIGGER update_candidate_notes_updated_at
  BEFORE UPDATE ON public.candidate_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_candidate_interviews_updated_at
  BEFORE UPDATE ON public.candidate_interviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_candidate_opportunities_updated_at
  BEFORE UPDATE ON public.candidate_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_candidate_notes_candidate_id ON public.candidate_notes(candidate_id);
CREATE INDEX idx_candidate_notes_team_id ON public.candidate_notes(team_id);
CREATE INDEX idx_candidate_interviews_candidate_id ON public.candidate_interviews(candidate_id);
CREATE INDEX idx_candidate_interviews_team_id ON public.candidate_interviews(team_id);
CREATE INDEX idx_candidate_opportunities_candidate_id ON public.candidate_opportunities(candidate_id);
CREATE INDEX idx_candidate_opportunities_team_id ON public.candidate_opportunities(team_id);