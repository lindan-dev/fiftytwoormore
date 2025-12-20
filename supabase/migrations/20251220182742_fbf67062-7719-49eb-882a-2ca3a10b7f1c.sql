-- Add benchmark_opt_in column to profiles
ALTER TABLE public.profiles 
ADD COLUMN benchmark_opt_in BOOLEAN DEFAULT false;

-- Create benchmark_cohorts table for storing aggregated cohort statistics
CREATE TABLE public.benchmark_cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_key TEXT NOT NULL, -- e.g., "rel_0-1", "rel_1-3", "rel_3-7", "rel_7-15", "rel_15+"
  period TEXT NOT NULL,     -- e.g., "2025-01", "2025-W51"
  period_type TEXT NOT NULL, -- "month" | "week"
  couple_count INTEGER DEFAULT 0,
  median_monthly_count NUMERIC(5,2),
  median_rolling_4_weeks NUMERIC(5,2),
  median_consistency_score NUMERIC(5,2),
  median_streak_length NUMERIC(5,2),
  p25_monthly_count NUMERIC(5,2),
  p75_monthly_count NUMERIC(5,2),
  computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(cohort_key, period, period_type)
);

-- Enable RLS on benchmark_cohorts
ALTER TABLE public.benchmark_cohorts ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read benchmark cohorts (aggregated data is public)
CREATE POLICY "Anyone can view benchmark cohorts"
ON public.benchmark_cohorts
FOR SELECT
USING (true);

-- Policy: Only service role can insert/update (edge functions)
-- No user-facing insert/update policies needed as this is managed by backend jobs