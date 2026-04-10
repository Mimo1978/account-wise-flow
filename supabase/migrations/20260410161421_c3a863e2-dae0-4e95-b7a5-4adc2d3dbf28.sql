
-- Delete 6 duplicate placements for deal d6611491, keeping only the newest (801250ec)
DELETE FROM public.placements 
WHERE deal_id = 'd6611491-6274-4d8b-8be4-facbdcf4f057' 
AND id != '801250ec-445b-4485-a950-c51673c871eb';

-- Add unique constraint to prevent future duplicates: one active placement per deal
CREATE UNIQUE INDEX idx_placements_unique_active_deal 
ON public.placements (deal_id) 
WHERE status = 'active';
