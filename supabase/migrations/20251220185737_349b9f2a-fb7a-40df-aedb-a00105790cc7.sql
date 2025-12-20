-- Add unique constraint for upsert to work
ALTER TABLE public.benchmark_cohorts 
ADD CONSTRAINT benchmark_cohorts_cohort_period_unique 
UNIQUE (cohort_key, period_type, period);