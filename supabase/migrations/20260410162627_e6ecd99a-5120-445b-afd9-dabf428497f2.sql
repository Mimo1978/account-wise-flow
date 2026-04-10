ALTER TABLE public.placements ADD COLUMN IF NOT EXISTS charge_rate numeric;

ALTER TABLE public.placements ADD COLUMN IF NOT EXISTS buy_rate numeric;

ALTER TABLE public.placements ADD COLUMN IF NOT EXISTS margin_rate numeric GENERATED ALWAYS AS (
  CASE WHEN charge_rate IS NOT NULL AND buy_rate IS NOT NULL AND charge_rate > 0
  THEN ROUND(((charge_rate - buy_rate) / charge_rate * 100)::numeric, 1)
  ELSE NULL END
) STORED;