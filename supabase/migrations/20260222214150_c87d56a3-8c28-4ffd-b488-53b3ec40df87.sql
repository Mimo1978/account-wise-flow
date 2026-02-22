
-- Atomic RPC: log email sent event + touch target state
CREATE OR REPLACE FUNCTION public.log_email_sent_and_touch_target(
  p_workspace_id uuid,
  p_campaign_id uuid,
  p_target_id uuid,
  p_candidate_id uuid DEFAULT NULL,
  p_contact_id uuid DEFAULT NULL,
  p_performed_by uuid DEFAULT NULL,
  p_subject text DEFAULT NULL,
  p_body text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event_id uuid;
  v_old_state text;
  v_new_state text;
BEGIN
  -- Get current state
  SELECT state::text INTO v_old_state
  FROM public.outreach_targets
  WHERE id = p_target_id AND workspace_id = p_workspace_id;

  IF v_old_state IS NULL THEN
    RAISE EXCEPTION 'Target not found';
  END IF;

  -- Insert outreach event
  INSERT INTO public.outreach_events (
    workspace_id, campaign_id, target_id, candidate_id, contact_id,
    event_type, channel, subject, body, metadata, performed_by, performed_at
  ) VALUES (
    p_workspace_id, p_campaign_id, p_target_id, p_candidate_id, p_contact_id,
    'email_sent', 'email', p_subject, p_body, p_metadata, p_performed_by, now()
  )
  RETURNING id INTO v_event_id;

  -- Determine new state: only upgrade queued→contacted
  v_new_state := CASE
    WHEN v_old_state = 'queued' THEN 'contacted'
    ELSE v_old_state
  END;

  -- Update target
  UPDATE public.outreach_targets
  SET state = v_new_state::outreach_target_state,
      last_contacted_at = now(),
      updated_at = now()
  WHERE id = p_target_id AND workspace_id = p_workspace_id;

  RETURN jsonb_build_object(
    'event_id', v_event_id,
    'old_state', v_old_state,
    'new_state', v_new_state
  );
END;
$$;
