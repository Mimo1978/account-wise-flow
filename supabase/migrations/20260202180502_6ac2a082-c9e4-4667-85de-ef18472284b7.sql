-- Drop and recreate search_candidates to NOT return raw_cv_text (performance optimization)
-- raw_cv_text was being sent to client unnecessarily - only highlights are needed
DROP FUNCTION IF EXISTS public.search_candidates(text, uuid);

CREATE FUNCTION public.search_candidates(query_text text, workspace_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, name text, email text, headline text, current_title text, location text, skills jsonb, rank real, highlight_name text, highlight_headline text, highlight_cv text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.email,
    c.headline,
    c.current_title,
    c.location,
    c.skills,
    ts_rank_cd(c.search_vector, plainto_tsquery('english', query_text)) AS rank,
    ts_headline('english', COALESCE(c.name, ''), plainto_tsquery('english', query_text), 
      'MaxWords=10, MinWords=3, StartSel=<mark>, StopSel=</mark>') AS highlight_name,
    ts_headline('english', COALESCE(c.headline, ''), plainto_tsquery('english', query_text), 
      'MaxWords=30, MinWords=5, StartSel=<mark>, StopSel=</mark>') AS highlight_headline,
    ts_headline('english', COALESCE(c.raw_cv_text, ''), plainto_tsquery('english', query_text), 
      'MaxWords=50, MinWords=10, StartSel=<mark>, StopSel=</mark>') AS highlight_cv
  FROM public.candidates c
  WHERE c.search_vector @@ plainto_tsquery('english', query_text)
    AND (workspace_id IS NULL OR c.tenant_id = workspace_id)
  ORDER BY rank DESC
  LIMIT 100;
END;
$function$;