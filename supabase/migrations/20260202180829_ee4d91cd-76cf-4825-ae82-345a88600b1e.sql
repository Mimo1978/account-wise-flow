-- Update search_candidates to accept raw tsquery string for Boolean search support
-- Also add a simple mode that uses plainto_tsquery for basic searches
DROP FUNCTION IF EXISTS public.search_candidates(text, uuid);

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
BEGIN
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
    AND (workspace_id IS NULL OR c.tenant_id = workspace_id)
  ORDER BY rank DESC
  LIMIT 100;
END;
$function$;