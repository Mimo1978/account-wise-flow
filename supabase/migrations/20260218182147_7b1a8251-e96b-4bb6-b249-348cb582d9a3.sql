-- Add entity_type enum for outreach targets
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'outreach_entity_type') THEN
    CREATE TYPE public.outreach_entity_type AS ENUM ('candidate', 'contact');
  END IF;
END $$;

-- Add entity_type column to outreach_targets
ALTER TABLE public.outreach_targets
  ADD COLUMN IF NOT EXISTS entity_type public.outreach_entity_type;

-- Backfill existing rows: if candidate_id set → candidate, else if contact_id set → contact, else default candidate
UPDATE public.outreach_targets
SET entity_type = CASE
  WHEN candidate_id IS NOT NULL THEN 'candidate'::public.outreach_entity_type
  WHEN contact_id IS NOT NULL THEN 'contact'::public.outreach_entity_type
  ELSE 'candidate'::public.outreach_entity_type
END
WHERE entity_type IS NULL;

-- Make entity_type NOT NULL now that it's populated
ALTER TABLE public.outreach_targets
  ALTER COLUMN entity_type SET NOT NULL,
  ALTER COLUMN entity_type SET DEFAULT 'candidate';

-- Drop old unique index if it exists (to recreate with entity_type)
DROP INDEX IF EXISTS public.outreach_targets_campaign_entity_unique;

-- Create unique constraint: one entity per campaign (either candidate or contact, not both)
-- Uses a partial approach: unique on (campaign_id, candidate_id) for candidates
CREATE UNIQUE INDEX IF NOT EXISTS outreach_targets_campaign_candidate_unique
  ON public.outreach_targets (campaign_id, candidate_id)
  WHERE candidate_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS outreach_targets_campaign_contact_unique
  ON public.outreach_targets (campaign_id, contact_id)
  WHERE contact_id IS NOT NULL;

-- Add check constraint: exactly one of candidate_id/contact_id must be set
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'outreach_targets_exactly_one_entity'
    AND conrelid = 'public.outreach_targets'::regclass
  ) THEN
    ALTER TABLE public.outreach_targets
      ADD CONSTRAINT outreach_targets_exactly_one_entity
      CHECK (
        (candidate_id IS NOT NULL AND contact_id IS NULL)
        OR (contact_id IS NOT NULL AND candidate_id IS NULL)
      );
  END IF;
END $$;