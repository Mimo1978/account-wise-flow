-- CV Batch Import Tables for Phase 3.1
-- Supports batch processing of 100-20,000 CVs with async background jobs

-- Create enums for batch and item statuses
CREATE TYPE cv_batch_source AS ENUM ('ui_upload', 'background_import');
CREATE TYPE cv_batch_status AS ENUM ('queued', 'processing', 'completed', 'failed', 'partial');
CREATE TYPE cv_item_status AS ENUM ('queued', 'processing', 'parsed', 'dedupe_review', 'merged', 'failed');

-- Main batch tracking table
CREATE TABLE public.cv_import_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL,
  source cv_batch_source NOT NULL DEFAULT 'ui_upload',
  status cv_batch_status NOT NULL DEFAULT 'queued',
  total_files INTEGER NOT NULL DEFAULT 0,
  processed_files INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  error_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Index for efficient tenant queries
CREATE INDEX idx_cv_import_batches_tenant ON public.cv_import_batches(tenant_id);
CREATE INDEX idx_cv_import_batches_status ON public.cv_import_batches(status);
CREATE INDEX idx_cv_import_batches_created_by ON public.cv_import_batches(created_by_user_id);

-- Enable RLS
ALTER TABLE public.cv_import_batches ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cv_import_batches
CREATE POLICY "Users can view their team batches"
  ON public.cv_import_batches FOR SELECT
  USING (
    check_demo_isolation(tenant_id, auth.uid()) AND
    (
      tenant_id = get_user_team_id(auth.uid()) OR
      has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "Contributors can create batches"
  ON public.cv_import_batches FOR INSERT
  WITH CHECK (
    check_demo_isolation(tenant_id, auth.uid()) AND
    (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'manager'::app_role) OR
      has_role(auth.uid(), 'contributor'::app_role)
    ) AND
    created_by_user_id = auth.uid() AND
    tenant_id = get_user_team_id(auth.uid())
  );

CREATE POLICY "Batch owners and admins can update"
  ON public.cv_import_batches FOR UPDATE
  USING (
    check_demo_isolation(tenant_id, auth.uid()) AND
    (
      created_by_user_id = auth.uid() OR
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'manager'::app_role)
    )
  );

CREATE POLICY "Admins can delete batches"
  ON public.cv_import_batches FOR DELETE
  USING (
    check_demo_isolation(tenant_id, auth.uid()) AND
    has_role(auth.uid(), 'admin'::app_role)
  );

-- Individual CV item tracking table
CREATE TABLE public.cv_import_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.cv_import_batches(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  storage_path TEXT,
  checksum_sha256 TEXT,
  status cv_item_status NOT NULL DEFAULT 'queued',
  parse_confidence REAL,
  candidate_id UUID,
  dedupe_candidate_ids JSONB,
  error_message TEXT,
  extracted_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for efficient queries
CREATE INDEX idx_cv_import_items_tenant ON public.cv_import_items(tenant_id);
CREATE INDEX idx_cv_import_items_batch ON public.cv_import_items(batch_id);
CREATE INDEX idx_cv_import_items_status ON public.cv_import_items(status);
CREATE INDEX idx_cv_import_items_checksum ON public.cv_import_items(checksum_sha256);

-- Enable RLS
ALTER TABLE public.cv_import_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cv_import_items
CREATE POLICY "Users can view their team items"
  ON public.cv_import_items FOR SELECT
  USING (
    check_demo_isolation(tenant_id, auth.uid()) AND
    (
      tenant_id = get_user_team_id(auth.uid()) OR
      has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "Contributors can create items"
  ON public.cv_import_items FOR INSERT
  WITH CHECK (
    check_demo_isolation(tenant_id, auth.uid()) AND
    (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'manager'::app_role) OR
      has_role(auth.uid(), 'contributor'::app_role)
    ) AND
    tenant_id = get_user_team_id(auth.uid())
  );

CREATE POLICY "Batch owners and admins can update items"
  ON public.cv_import_items FOR UPDATE
  USING (
    check_demo_isolation(tenant_id, auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.cv_import_batches b
      WHERE b.id = cv_import_items.batch_id
      AND (
        b.created_by_user_id = auth.uid() OR
        has_role(auth.uid(), 'admin'::app_role) OR
        has_role(auth.uid(), 'manager'::app_role)
      )
    )
  );

CREATE POLICY "Admins can delete items"
  ON public.cv_import_items FOR DELETE
  USING (
    check_demo_isolation(tenant_id, auth.uid()) AND
    has_role(auth.uid(), 'admin'::app_role)
  );

-- Trigger to update batch counters when items change
CREATE OR REPLACE FUNCTION public.update_batch_counters()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.cv_import_batches
  SET
    processed_files = (
      SELECT COUNT(*) FROM public.cv_import_items
      WHERE batch_id = COALESCE(NEW.batch_id, OLD.batch_id)
      AND status NOT IN ('queued', 'processing')
    ),
    success_count = (
      SELECT COUNT(*) FROM public.cv_import_items
      WHERE batch_id = COALESCE(NEW.batch_id, OLD.batch_id)
      AND status IN ('parsed', 'merged')
    ),
    fail_count = (
      SELECT COUNT(*) FROM public.cv_import_items
      WHERE batch_id = COALESCE(NEW.batch_id, OLD.batch_id)
      AND status = 'failed'
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.batch_id, OLD.batch_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_batch_counters_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.cv_import_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_batch_counters();

-- Function to auto-update batch status based on items
CREATE OR REPLACE FUNCTION public.auto_update_batch_status()
RETURNS TRIGGER AS $$
DECLARE
  v_batch RECORD;
BEGIN
  SELECT * INTO v_batch FROM public.cv_import_batches WHERE id = COALESCE(NEW.batch_id, OLD.batch_id);
  
  IF v_batch IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Check if all items are processed
  IF v_batch.processed_files >= v_batch.total_files AND v_batch.total_files > 0 THEN
    IF v_batch.fail_count = 0 THEN
      UPDATE public.cv_import_batches
      SET status = 'completed', completed_at = now(), updated_at = now()
      WHERE id = v_batch.id AND status != 'completed';
    ELSIF v_batch.success_count > 0 THEN
      UPDATE public.cv_import_batches
      SET status = 'partial', completed_at = now(), updated_at = now()
      WHERE id = v_batch.id AND status NOT IN ('completed', 'partial');
    ELSE
      UPDATE public.cv_import_batches
      SET status = 'failed', completed_at = now(), updated_at = now()
      WHERE id = v_batch.id AND status != 'failed';
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER auto_update_batch_status_trigger
  AFTER UPDATE ON public.cv_import_batches
  FOR EACH ROW
  WHEN (OLD.processed_files IS DISTINCT FROM NEW.processed_files)
  EXECUTE FUNCTION public.auto_update_batch_status();

-- Create storage bucket for CV uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cv-uploads',
  'cv-uploads',
  false,
  20971520, -- 20MB limit per file
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for cv-uploads bucket
CREATE POLICY "Users can upload CVs to their tenant folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'cv-uploads' AND
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = (SELECT get_user_team_id(auth.uid())::text)
  );

CREATE POLICY "Users can view CVs from their tenant"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'cv-uploads' AND
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = (SELECT get_user_team_id(auth.uid())::text)
  );

CREATE POLICY "Admins can delete CVs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'cv-uploads' AND
    auth.uid() IS NOT NULL AND
    has_role(auth.uid(), 'admin'::app_role)
  );

-- Updated at trigger for items
CREATE TRIGGER update_cv_import_items_updated_at
  BEFORE UPDATE ON public.cv_import_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();