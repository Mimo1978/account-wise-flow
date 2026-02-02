-- Update search_candidates to enforce workspace security
-- The function must validate that the user can only search within their allowed workspace
-- This prevents unauthorized access even though SECURITY DEFINER bypasses RLS

DROP FUNCTION IF EXISTS public.search_candidates(text, uuid, boolean);

CREATE FUNCTION public.search_candidates(
  query_text text, 
  workspace_id uuid DEFAULT NULL::uuid,
  use_tsquery boolean DEFAULT false
)
RETURNS TABLE(
  id uuid, 
  name text, 
  email text, 
  headline text, 
  current_title text, 
  location text, 
  skills jsonb, 
  rank real, 
  highlight_name text, 
  highlight_headline text, 
  highlight_cv text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  search_query tsquery;
  plain_query tsquery;
  user_id uuid;
  user_team_id uuid;
  effective_workspace_id uuid;
BEGIN
  -- Get the current user
  user_id := auth.uid();
  
  -- If no authenticated user, return empty (security: anonymous users get nothing)
  IF user_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Get user's team/workspace
  user_team_id := public.get_user_team_id(user_id);
  
  -- Determine effective workspace: use provided workspace_id only if it matches user's team
  -- This prevents users from searching other workspaces
  IF workspace_id IS NOT NULL THEN
    -- Verify user has access to the requested workspace
    IF workspace_id != user_team_id AND NOT public.has_role(user_id, 'admin') THEN
      -- User trying to access a workspace they don't belong to
      RETURN;
    END IF;
    -- Also check demo isolation
    IF NOT public.check_demo_isolation(workspace_id, user_id) THEN
      RETURN;
    END IF;
    effective_workspace_id := workspace_id;
  ELSE
    -- Use user's own workspace
    effective_workspace_id := user_team_id;
  END IF;
  
  -- Build the search query based on mode
  IF use_tsquery THEN
    -- Boolean mode: use to_tsquery with the pre-parsed tsquery string
    -- Wrap in exception handler for invalid tsquery syntax
    BEGIN
      search_query := to_tsquery('english', query_text);
    EXCEPTION WHEN OTHERS THEN
      -- Fallback to plain text search if tsquery is invalid
      search_query := plainto_tsquery('english', query_text);
    END;
  ELSE
    -- Simple mode: use plainto_tsquery
    search_query := plainto_tsquery('english', query_text);
  END IF;
  
  -- Also create plain query for headline generation (simpler highlighting)
  plain_query := plainto_tsquery('english', query_text);

  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.email,
    c.headline,
    c.current_title,
    c.location,
    c.skills,
    ts_rank_cd(c.search_vector, search_query) AS rank,
    ts_headline('english', COALESCE(c.name, ''), plain_query, 
      'MaxWords=10, MinWords=3, StartSel=<mark>, StopSel=</mark>') AS highlight_name,
    ts_headline('english', COALESCE(c.headline, ''), plain_query, 
      'MaxWords=30, MinWords=5, StartSel=<mark>, StopSel=</mark>') AS highlight_headline,
    ts_headline('english', COALESCE(c.raw_cv_text, ''), plain_query, 
      'MaxWords=50, MinWords=10, StartSel=<mark>, StopSel=</mark>') AS highlight_cv
  FROM public.candidates c
  WHERE c.search_vector @@ search_query
    -- CRITICAL: Always filter by workspace for security
    AND c.tenant_id = effective_workspace_id
    -- Double-check demo isolation at row level
    AND public.check_demo_isolation(c.tenant_id, user_id)
  ORDER BY rank DESC
  LIMIT 100;
END;
$function$;