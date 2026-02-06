-- Workspace branding table for logo and colors
CREATE TABLE public.workspace_branding (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL UNIQUE REFERENCES public.teams(id) ON DELETE CASCADE,
  logo_path TEXT,
  primary_color TEXT DEFAULT '#2563eb',
  secondary_color TEXT DEFAULT '#64748b',
  company_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workspace_branding ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their workspace branding"
  ON public.workspace_branding FOR SELECT
  USING (
    workspace_id IN (
      SELECT team_id FROM public.user_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and managers can update workspace branding"
  ON public.workspace_branding FOR UPDATE
  USING (
    workspace_id IN (
      SELECT team_id FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins and managers can insert workspace branding"
  ON public.workspace_branding FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT team_id FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_workspace_branding_updated_at
  BEFORE UPDATE ON public.workspace_branding
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Generated exports table for tracking exported CVs
CREATE TABLE public.generated_exports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  job_spec_id UUID REFERENCES public.job_specs(id) ON DELETE SET NULL,
  template_style TEXT NOT NULL DEFAULT 'classic',
  storage_path TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'pdf',
  executive_summary TEXT,
  included_sections JSONB DEFAULT '["experience", "skills", "education"]'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.generated_exports ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their workspace exports"
  ON public.generated_exports FOR SELECT
  USING (
    workspace_id IN (
      SELECT team_id FROM public.user_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Contributors can create exports"
  ON public.generated_exports FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT team_id FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager', 'contributor')
    )
  );

CREATE POLICY "Admins can delete exports"
  ON public.generated_exports FOR DELETE
  USING (
    workspace_id IN (
      SELECT team_id FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- Create storage buckets for branding assets and generated exports
INSERT INTO storage.buckets (id, name, public)
VALUES ('workspace-branding', 'workspace-branding', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-exports', 'generated-exports', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for workspace-branding bucket
CREATE POLICY "Anyone can view workspace branding assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'workspace-branding');

CREATE POLICY "Workspace members can upload branding assets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'workspace-branding' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Workspace members can update branding assets"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'workspace-branding' AND
    auth.uid() IS NOT NULL
  );

-- Storage policies for generated-exports bucket
CREATE POLICY "Workspace members can view their exports"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'generated-exports' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Workspace members can upload exports"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'generated-exports' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Workspace members can delete exports"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'generated-exports' AND
    auth.uid() IS NOT NULL
  );