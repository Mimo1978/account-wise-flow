-- Add search vectors and tags columns to cv_import_items for fast search
ALTER TABLE public.cv_import_items 
ADD COLUMN IF NOT EXISTS search_tags text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS search_vector tsvector,
ADD COLUMN IF NOT EXISTS field_confidence jsonb DEFAULT '{}';

-- Create GIN index for fast tag search
CREATE INDEX IF NOT EXISTS idx_cv_import_items_search_tags 
ON public.cv_import_items USING GIN (search_tags);

-- Create GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_cv_import_items_search_vector 
ON public.cv_import_items USING GIN (search_vector);

-- Create index for field confidence queries
CREATE INDEX IF NOT EXISTS idx_cv_import_items_field_confidence 
ON public.cv_import_items USING GIN (field_confidence);

-- Function to generate search vector from extracted data
CREATE OR REPLACE FUNCTION public.update_cv_item_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.extracted_data IS NOT NULL THEN
    NEW.search_vector := 
      setweight(to_tsvector('english', COALESCE(NEW.extracted_data->>'name', '')), 'A') ||
      setweight(to_tsvector('english', COALESCE(NEW.extracted_data->'personal'->>'full_name', '')), 'A') ||
      setweight(to_tsvector('english', COALESCE(NEW.extracted_data->'headline'->>'current_title', '')), 'A') ||
      setweight(to_tsvector('english', COALESCE(
        (SELECT string_agg(skill, ' ') FROM jsonb_array_elements_text(
          COALESCE(NEW.extracted_data->'skills'->'primary_skills', '[]'::jsonb)
        ) AS skill), ''
      )), 'B') ||
      setweight(to_tsvector('english', COALESCE(
        (SELECT string_agg(skill, ' ') FROM jsonb_array_elements_text(
          COALESCE(NEW.extracted_data->'skills'->'secondary_skills', '[]'::jsonb)
        ) AS skill), ''
      )), 'C') ||
      setweight(to_tsvector('english', COALESCE(
        (SELECT string_agg(keyword, ' ') FROM jsonb_array_elements_text(
          COALESCE(NEW.extracted_data->'skills'->'keywords', '[]'::jsonb)
        ) AS keyword), ''
      )), 'C');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger to auto-update search vector
DROP TRIGGER IF EXISTS cv_item_search_vector_trigger ON public.cv_import_items;
CREATE TRIGGER cv_item_search_vector_trigger
  BEFORE INSERT OR UPDATE OF extracted_data ON public.cv_import_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_cv_item_search_vector();