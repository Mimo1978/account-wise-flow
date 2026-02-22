
-- Security definer function to return schema inventory (admin only)
CREATE OR REPLACE FUNCTION public.execute_schema_inventory()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Verify caller is admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT jsonb_build_object(
    'tables', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'table_name', t.table_name,
          'columns', (
            SELECT jsonb_agg(
              jsonb_build_object(
                'column_name', c.column_name,
                'data_type', c.udt_name,
                'is_nullable', c.is_nullable,
                'column_default', c.column_default,
                'ordinal_position', c.ordinal_position
              ) ORDER BY c.ordinal_position
            )
            FROM information_schema.columns c
            WHERE c.table_schema = 'public' AND c.table_name = t.table_name
          ),
          'primary_keys', (
            SELECT jsonb_agg(kcu.column_name)
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
              ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
            WHERE tc.table_schema = 'public' AND tc.table_name = t.table_name AND tc.constraint_type = 'PRIMARY KEY'
          ),
          'foreign_keys', (
            SELECT jsonb_agg(
              jsonb_build_object(
                'column', kcu.column_name,
                'references_table', ccu.table_name,
                'references_column', ccu.column_name,
                'constraint_name', tc.constraint_name
              )
            )
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
              ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage ccu 
              ON tc.constraint_name = ccu.constraint_name AND tc.constraint_schema = ccu.constraint_schema
            WHERE tc.table_schema = 'public' AND tc.table_name = t.table_name AND tc.constraint_type = 'FOREIGN KEY'
          ),
          'unique_constraints', (
            SELECT jsonb_agg(
              jsonb_build_object(
                'constraint_name', tc.constraint_name,
                'columns', (
                  SELECT jsonb_agg(kcu2.column_name)
                  FROM information_schema.key_column_usage kcu2
                  WHERE kcu2.constraint_name = tc.constraint_name AND kcu2.table_schema = 'public'
                )
              )
            )
            FROM information_schema.table_constraints tc
            WHERE tc.table_schema = 'public' AND tc.table_name = t.table_name AND tc.constraint_type = 'UNIQUE'
          ),
          'indexes', (
            SELECT jsonb_agg(
              jsonb_build_object(
                'index_name', indexname,
                'index_def', indexdef
              )
            )
            FROM pg_indexes
            WHERE schemaname = 'public' AND tablename = t.table_name
          )
        )
      )
      FROM (
        SELECT DISTINCT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$$;
