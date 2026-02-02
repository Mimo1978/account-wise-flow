-- Add search_vector column to candidates for full-text search
ALTER TABLE public.candidates 
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_candidates_search_vector 
ON public.candidates USING GIN(search_vector);

-- Create function to update search vector
CREATE OR REPLACE FUNCTION public.update_candidate_search_vector()
RETURNS TRIGGER AS $$
DECLARE
  skills_text TEXT;
BEGIN
  -- Extract skills as text from JSONB
  SELECT COALESCE(
    string_agg(skill, ' '),
    ''
  ) INTO skills_text
  FROM (
    SELECT jsonb_array_elements_text(
      CASE 
        WHEN NEW.skills IS NULL THEN '[]'::jsonb
        WHEN jsonb_typeof(NEW.skills) = 'array' THEN NEW.skills
        WHEN jsonb_typeof(NEW.skills->'primary_skills') = 'array' THEN NEW.skills->'primary_skills'
        ELSE '[]'::jsonb
      END
    ) AS skill
  ) subq;

  -- Build composite search vector with weights
  -- A = most important (name, title)
  -- B = important (skills, headline)
  -- C = less important (location, company)
  -- D = least important (CV text)
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.current_title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.headline, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(skills_text, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.location, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.current_company, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.raw_cv_text, '')), 'D');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to auto-update search vector on insert/update
DROP TRIGGER IF EXISTS trigger_update_candidate_search_vector ON public.candidates;

CREATE TRIGGER trigger_update_candidate_search_vector
BEFORE INSERT OR UPDATE OF name, current_title, headline, skills, location, current_company, raw_cv_text
ON public.candidates
FOR EACH ROW
EXECUTE FUNCTION public.update_candidate_search_vector();

-- Backfill existing records
UPDATE public.candidates
SET search_vector = (
  setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(current_title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(headline, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(
    (SELECT string_agg(skill, ' ') FROM jsonb_array_elements_text(
      CASE 
        WHEN skills IS NULL THEN '[]'::jsonb
        WHEN jsonb_typeof(skills) = 'array' THEN skills
        WHEN jsonb_typeof(skills->'primary_skills') = 'array' THEN skills->'primary_skills'
        ELSE '[]'::jsonb
      END
    ) AS skill), ''
  )), 'B') ||
  setweight(to_tsvector('english', COALESCE(location, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(current_company, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(raw_cv_text, '')), 'D')
)
WHERE search_vector IS NULL;

-- Create helper function for Boolean search
CREATE OR REPLACE FUNCTION public.search_candidates(
  query_text TEXT,
  workspace_id UUID DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  email TEXT,
  headline TEXT,
  current_title TEXT,
  location TEXT,
  skills JSONB,
  raw_cv_text TEXT,
  rank REAL,
  highlight_name TEXT,
  highlight_headline TEXT,
  highlight_cv TEXT
) AS $$
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
    c.raw_cv_text,
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
  ORDER BY rank DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.search_candidates(TEXT, UUID) TO authenticated;