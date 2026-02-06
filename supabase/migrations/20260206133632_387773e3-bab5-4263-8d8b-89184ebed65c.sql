-- Drop existing function overloads and create enhanced version
DROP FUNCTION IF EXISTS public.search_candidates(text, uuid, boolean);
DROP FUNCTION IF EXISTS public.search_candidates(text, uuid, boolean, boolean);

-- Create enhanced search_candidates with ATS-style ranking
CREATE OR REPLACE FUNCTION public.search_candidates(
  query_text text,
  workspace_id uuid DEFAULT NULL,
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
AS $$
DECLARE
  search_query tsquery;
  plain_query tsquery;
  user_id uuid;
  user_team_id uuid;
  effective_workspace_id uuid;
  -- Scoring weights (ATS-style): higher weight = more important
  weight_title float := 6.0;
  weight_skills float := 5.0;
  weight_headline float := 4.0;
  weight_experience float := 3.0;
  weight_location float := 2.0;
  weight_cv float := 1.0;
  -- Phrase match multiplier
  phrase_multiplier float := 3.0;
  term_multiplier float := 2.0;
BEGIN
  user_id := auth.uid();
  
  IF user_id IS NULL THEN
    RETURN;
  END IF;
  
  user_team_id := public.get_user_team_id(user_id);
  
  IF workspace_id IS NOT NULL THEN
    IF workspace_id != user_team_id AND NOT public.has_role(user_id, 'admin') THEN
      RETURN;
    END IF;
    IF NOT public.check_demo_isolation(workspace_id, user_id) THEN
      RETURN;
    END IF;
    effective_workspace_id := workspace_id;
  ELSE
    effective_workspace_id := user_team_id;
  END IF;
  
  IF use_tsquery THEN
    BEGIN
      search_query := to_tsquery('english', query_text);
    EXCEPTION WHEN OTHERS THEN
      search_query := plainto_tsquery('english', query_text);
    END;
  ELSE
    search_query := plainto_tsquery('english', query_text);
  END IF;
  
  plain_query := plainto_tsquery('english', query_text);

  RETURN QUERY
  WITH candidate_matches AS (
    SELECT 
      c.id,
      c.name,
      c.email,
      c.headline,
      c.current_title,
      c.location,
      c.skills,
      c.raw_cv_text,
      c.experience,
      c.updated_at,
      -- Basic rank from ts_rank_cd
      ts_rank_cd(c.search_vector, search_query) AS base_rank,
      -- Title match score (weight 6)
      CASE 
        WHEN to_tsvector('english', COALESCE(c.current_title, '')) @@ search_query 
        THEN weight_title * (
          CASE WHEN COALESCE(c.current_title, '') ~* query_text THEN phrase_multiplier ELSE term_multiplier END
        )
        ELSE 0.0
      END AS title_score,
      -- Skills match score (weight 5)
      CASE 
        WHEN to_tsvector('english', COALESCE(
          (SELECT string_agg(skill, ' ') FROM jsonb_array_elements_text(
            CASE 
              WHEN jsonb_typeof(c.skills) = 'array' THEN c.skills
              WHEN c.skills->'primary_skills' IS NOT NULL THEN c.skills->'primary_skills'
              ELSE '[]'::jsonb
            END
          ) AS skill), ''
        )) @@ search_query 
        THEN weight_skills * term_multiplier
        ELSE 0.0
      END AS skills_score,
      -- Headline/overview match score (weight 4)
      CASE 
        WHEN to_tsvector('english', COALESCE(c.headline, '')) @@ search_query 
        THEN weight_headline * (
          CASE WHEN COALESCE(c.headline, '') ~* query_text THEN phrase_multiplier ELSE term_multiplier END
        )
        ELSE 0.0
      END AS headline_score,
      -- Location match score (weight 2)
      CASE 
        WHEN to_tsvector('english', COALESCE(c.location, '')) @@ search_query 
        THEN weight_location * term_multiplier
        ELSE 0.0
      END AS location_score,
      -- CV match score (weight 1) - only if include_cv is true
      CASE 
        WHEN include_cv AND to_tsvector('english', COALESCE(c.raw_cv_text, '')) @@ search_query 
        THEN weight_cv * (
          CASE WHEN COALESCE(c.raw_cv_text, '') ~* query_text THEN phrase_multiplier ELSE term_multiplier END
        )
        ELSE 0.0
      END AS cv_score,
      -- Recency boost: candidates updated in last 2 years get boost
      CASE 
        WHEN c.updated_at > NOW() - INTERVAL '2 years' THEN 1.2
        WHEN c.updated_at > NOW() - INTERVAL '3 years' THEN 1.1
        ELSE 1.0
      END AS recency_multiplier
    FROM public.candidates c
    WHERE c.search_vector @@ search_query
      AND c.tenant_id = effective_workspace_id
      AND public.check_demo_isolation(c.tenant_id, user_id)
  ),
  scored_candidates AS (
    SELECT 
      cm.*,
      -- Calculate weighted score (0-100 scale)
      LEAST(100, GREATEST(0, 
        (cm.title_score + cm.skills_score + cm.headline_score + cm.location_score + cm.cv_score) 
        * cm.recency_multiplier
        * (1 + cm.base_rank)
      )) AS calculated_score
    FROM candidate_matches cm
  )
  SELECT 
    sc.id,
    sc.name,
    sc.email,
    sc.headline,
    sc.current_title,
    sc.location,
    sc.skills,
    sc.base_rank AS rank,
    sc.calculated_score AS match_score,
    jsonb_build_object(
      'title', sc.title_score > 0,
      'skills', sc.skills_score > 0,
      'overview', sc.headline_score > 0,
      'location', sc.location_score > 0,
      'cv', sc.cv_score > 0,
      'title_score', ROUND(sc.title_score::numeric, 1),
      'skills_score', ROUND(sc.skills_score::numeric, 1),
      'overview_score', ROUND(sc.headline_score::numeric, 1),
      'location_score', ROUND(sc.location_score::numeric, 1),
      'cv_score', ROUND(sc.cv_score::numeric, 1),
      'recency_boost', sc.recency_multiplier,
      'matched_phrases', (
        SELECT jsonb_agg(phrase) FROM (
          SELECT DISTINCT unnest(ARRAY[
            CASE WHEN sc.title_score > 0 THEN 'Title: ' || COALESCE(sc.current_title, '') ELSE NULL END,
            CASE WHEN sc.skills_score > 0 THEN 'Skills match' ELSE NULL END,
            CASE WHEN sc.headline_score > 0 THEN 'Overview match' ELSE NULL END
          ]) AS phrase
          WHERE phrase IS NOT NULL
          LIMIT 3
        ) sub
      )
    ) AS match_breakdown,
    ts_headline('english', COALESCE(sc.name, ''), plain_query, 
      'MaxWords=10, MinWords=3, StartSel=<mark>, StopSel=</mark>') AS highlight_name,
    ts_headline('english', COALESCE(sc.headline, ''), plain_query, 
      'MaxWords=30, MinWords=5, StartSel=<mark>, StopSel=</mark>') AS highlight_headline,
    CASE 
      WHEN include_cv THEN 
        ts_headline('english', COALESCE(sc.raw_cv_text, ''), plain_query, 
          'MaxWords=50, MinWords=10, StartSel=<mark>, StopSel=</mark>')
      ELSE NULL
    END AS highlight_cv
  FROM scored_candidates sc
  ORDER BY sc.calculated_score DESC, sc.base_rank DESC, sc.updated_at DESC
  LIMIT 100;
END;
$$;