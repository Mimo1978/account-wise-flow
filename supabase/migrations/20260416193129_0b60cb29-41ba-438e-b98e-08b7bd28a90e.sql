CREATE OR REPLACE FUNCTION public.auto_update_batch_status()
RETURNS TRIGGER AS $$
DECLARE
  v_batch RECORD;
  v_batch_id UUID := COALESCE(NEW.id, OLD.id);
BEGIN
  SELECT *
  INTO v_batch
  FROM public.cv_import_batches
  WHERE id = v_batch_id;

  IF v_batch IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_batch.status = 'paused' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_batch.total_files > 0 AND v_batch.processed_files >= v_batch.total_files THEN
    IF v_batch.fail_count = 0 THEN
      UPDATE public.cv_import_batches
      SET status = 'completed',
          completed_at = COALESCE(completed_at, now()),
          updated_at = now()
      WHERE id = v_batch.id
        AND status <> 'completed';
    ELSIF v_batch.success_count > 0 THEN
      UPDATE public.cv_import_batches
      SET status = 'partial',
          completed_at = COALESCE(completed_at, now()),
          updated_at = now()
      WHERE id = v_batch.id
        AND status NOT IN ('completed', 'partial');
    ELSE
      UPDATE public.cv_import_batches
      SET status = 'failed',
          completed_at = COALESCE(completed_at, now()),
          updated_at = now()
      WHERE id = v_batch.id
        AND status <> 'failed';
    END IF;
  ELSIF v_batch.status IN ('queued', 'processing') THEN
    UPDATE public.cv_import_batches
    SET completed_at = NULL,
        updated_at = now()
    WHERE id = v_batch.id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;