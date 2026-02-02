-- Drop and recreate search_candidates with enhanced ranking
-- Field weights: Title=6, Skills=5, Overview/Summary=4, Experience=3, Location=2, CV=1

CREATE OR REPLACE FUNCTION public.search_candidates(
  query_text text, 
  workspace_id uuid DEFAULT NULL::uuid, 
  use_tsquery boolean DEFAULT false,
  include_cv boolean DEFAULT false
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
  match_score real,
  match_breakdown jsonb,
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
  WITH scored_candidates AS (
    SELECT 
      c.id,
      c.name,
      c.email,
      c.headline,
      c.current_title,
      c.location,
      c.skills,
      c.raw_cv_text,
      c.updated_at,
      c.status,
      ts_rank_cd(c.search_vector, search_query) AS base_rank,
      -- Calculate weighted field scores
      -- Title / Role: weight 6
      CASE WHEN c.current_title IS NOT NULL AND to_tsvector('english', c.current_title) @@ search_query 
           THEN 6.0 ELSE 0.0 END AS title_score,
      -- Skills: weight 5
      CASE WHEN c.skills IS NOT NULL AND to_tsvector('english', 
        COALESCE(
          (SELECT string_agg(s, ' ') FROM jsonb_array_elements_text(
            CASE WHEN jsonb_typeof(c.skills) = 'array' THEN c.skills
                 WHEN jsonb_typeof(c.skills->'primary_skills') = 'array' THEN c.skills->'primary_skills'
                 ELSE '[]'::jsonb END
          ) s), ''
        )
      ) @@ search_query THEN 5.0 ELSE 0.0 END AS skills_score,
      -- Headline / Summary: weight 4
      CASE WHEN c.headline IS NOT NULL AND to_tsvector('english', c.headline) @@ search_query 
           THEN 4.0 ELSE 0.0 END AS overview_score,
      -- Location: weight 2
      CASE WHEN c.location IS NOT NULL AND to_tsvector('english', c.location) @@ search_query 
           THEN 2.0 ELSE 0.0 END AS location_score,
      -- CV text: weight 1 (only if include_cv is true)
      CASE WHEN include_cv AND c.raw_cv_text IS NOT NULL AND to_tsvector('english', c.raw_cv_text) @@ search_query 
           THEN 1.0 ELSE 0.0 END AS cv_score
    FROM public.candidates c
    WHERE c.search_vector @@ search_query
      -- CRITICAL: Always filter by workspace for security
      AND c.tenant_id = effective_workspace_id
      -- Double-check demo isolation at row level
      AND public.check_demo_isolation(c.tenant_id, user_id)
      -- If not including CV, filter out candidates that only match on CV
      AND (include_cv OR (
        c.current_title IS NOT NULL AND to_tsvector('english', COALESCE(c.current_title, '')) @@ search_query
        OR c.headline IS NOT NULL AND to_tsvector('english', COALESCE(c.headline, '')) @@ search_query
        OR c.skills IS NOT NULL AND to_tsvector('english', 
          COALESCE(
            (SELECT string_agg(s, ' ') FROM jsonb_array_elements_text(
              CASE WHEN jsonb_typeof(c.skills) = 'array' THEN c.skills
                   WHEN jsonb_typeof(c.skills->'primary_skills') = 'array' THEN c.skills->'primary_skills'
                   ELSE '[]'::jsonb END
            ) s), ''
          )
        ) @@ search_query
        OR c.location IS NOT NULL AND to_tsvector('english', COALESCE(c.location, '')) @@ search_query
        OR c.name IS NOT NULL AND to_tsvector('english', COALESCE(c.name, '')) @@ search_query
      ))
  ),
  final_scored AS (
    SELECT 
      sc.*,
      -- Compute total weighted score (normalize to 0-100 range)
      LEAST(100.0, (
        sc.base_rank * 10.0 + 
        sc.title_score * 3.0 + 
        sc.skills_score * 2.5 + 
        sc.overview_score * 2.0 + 
        sc.location_score * 1.0 + 
        sc.cv_score * 0.5
      )) AS computed_score,
      -- Build match breakdown
      jsonb_build_object(
        'title', sc.title_score > 0,
        'skills', sc.skills_score > 0,
        'overview', sc.overview_score > 0,
        'location', sc.location_score > 0,
        'cv', sc.cv_score > 0,
        'title_score', sc.title_score,
        'skills_score', sc.skills_score,
        'overview_score', sc.overview_score,
        'location_score', sc.location_score,
        'cv_score', sc.cv_score
      ) AS breakdown
    FROM scored_candidates sc
  )
  SELECT 
    fs.id,
    fs.name,
    fs.email,
    fs.headline,
    fs.current_title,
    fs.location,
    fs.skills,
    fs.base_rank AS rank,
    fs.computed_score AS match_score,
    fs.breakdown AS match_breakdown,
    ts_headline('english', COALESCE(fs.name, ''), plain_query, 
      'MaxWords=10, MinWords=3, StartSel=<mark>, StopSel=</mark>') AS highlight_name,
    ts_headline('english', COALESCE(fs.headline, ''), plain_query, 
      'MaxWords=30, MinWords=5, StartSel=<mark>, StopSel=</mark>') AS highlight_headline,
    CASE WHEN include_cv THEN
      ts_headline('english', COALESCE(fs.raw_cv_text, ''), plain_query, 
        'MaxWords=50, MinWords=10, StartSel=<mark>, StopSel=</mark>')
    ELSE NULL END AS highlight_cv
  FROM final_scored fs
  ORDER BY 
    fs.computed_score DESC,
    fs.updated_at DESC NULLS LAST,
    fs.status = 'active' DESC,
    fs.name ASC
  LIMIT 100;
END;
$function$;