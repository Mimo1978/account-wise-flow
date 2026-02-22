
CREATE OR REPLACE FUNCTION public.increment_campaign_target_count(p_campaign_id uuid, p_count integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.outreach_campaigns
  SET target_count = target_count + p_count,
      updated_at = now()
  WHERE id = p_campaign_id;
END;
$$;
