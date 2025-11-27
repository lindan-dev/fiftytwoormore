-- Add digest-related fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Europe/Stockholm',
ADD COLUMN IF NOT EXISTS email_digest_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS signup_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS last_log_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS streak_weeks integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS year_total integer DEFAULT 0;

-- Create email digest log table
CREATE TABLE IF NOT EXISTS public.email_digest_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  sent_at timestamp with time zone DEFAULT now(),
  type text NOT NULL CHECK (type IN ('digest', 'digest-nystart')),
  week_number integer NOT NULL,
  year integer NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_digest_log ENABLE ROW LEVEL SECURITY;

-- Only superusers can view logs
CREATE POLICY "Superusers can view all digest logs"
ON public.email_digest_log
FOR SELECT
USING (has_role(auth.uid(), 'superuser'::app_role));