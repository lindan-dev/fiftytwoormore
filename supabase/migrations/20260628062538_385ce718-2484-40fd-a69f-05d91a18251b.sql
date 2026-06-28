ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS location_label TEXT,
  ADD COLUMN IF NOT EXISTS location_country TEXT,
  ADD COLUMN IF NOT EXISTS location_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS location_lng NUMERIC;