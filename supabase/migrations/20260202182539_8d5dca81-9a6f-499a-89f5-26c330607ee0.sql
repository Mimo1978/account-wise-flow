-- Create enum for search mode
DO $$ BEGIN
  CREATE TYPE public.search_mode AS ENUM ('simple', 'boolean');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create saved_searches table
CREATE TABLE public.saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  query_string text NOT NULL,
  mode public.search_mode NOT NULL DEFAULT 'boolean',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  last_run_at timestamp with time zone
);

-- Create index for fast lookups
CREATE INDEX idx_saved_searches_user_workspace ON public.saved_searches(user_id, workspace_id);

-- Enable RLS
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see/manage their own saved searches within their workspace
CREATE POLICY "saved_searches_select_policy"
ON public.saved_searches
FOR SELECT
USING (
  auth.uid() = user_id
  AND check_demo_isolation(workspace_id, auth.uid())
);

CREATE POLICY "saved_searches_insert_policy"
ON public.saved_searches
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND workspace_id = get_user_team_id(auth.uid())
  AND check_demo_isolation(workspace_id, auth.uid())
);

CREATE POLICY "saved_searches_update_policy"
ON public.saved_searches
FOR UPDATE
USING (
  auth.uid() = user_id
  AND check_demo_isolation(workspace_id, auth.uid())
);

CREATE POLICY "saved_searches_delete_policy"
ON public.saved_searches
FOR DELETE
USING (
  auth.uid() = user_id
  AND check_demo_isolation(workspace_id, auth.uid())
);

-- Trigger for updated_at
CREATE TRIGGER update_saved_searches_updated_at
  BEFORE UPDATE ON public.saved_searches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();