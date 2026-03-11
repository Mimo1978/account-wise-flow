
-- Add unique constraint to job_adverts: one record per job per board
ALTER TABLE public.job_adverts ADD COLUMN IF NOT EXISTS user_edits text;
ALTER TABLE public.job_adverts ADD COLUMN IF NOT EXISTS generated_at timestamptz DEFAULT now();
ALTER TABLE public.job_adverts ADD COLUMN IF NOT EXISTS last_posted_at timestamptz;

-- Remove duplicates before adding unique constraint (keep the newest per job+board)
DELETE FROM public.job_adverts a
USING public.job_adverts b
WHERE a.job_id = b.job_id
  AND a.board = b.board
  AND a.created_at < b.created_at;

-- Add unique constraint
ALTER TABLE public.job_adverts ADD CONSTRAINT job_adverts_job_board_unique UNIQUE (job_id, board);
