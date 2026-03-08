-- Add confidential flag to jobs table
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS is_confidential boolean NOT NULL DEFAULT false;

-- Seed default board format rules for reference (workspace_id will be set per workspace)
-- These are the default rules for each board that Jarvis uses
COMMENT ON TABLE public.job_board_formats IS 'Stores per-workspace format preferences for each job board. Used by AI advert generation to respect board-specific rules.';