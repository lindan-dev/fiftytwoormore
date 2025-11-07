-- Add beta user tracking columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_beta_user BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS beta_signup_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS beta_partner_name TEXT;

-- Add index for beta user lookups
CREATE INDEX IF NOT EXISTS idx_profiles_is_beta_user ON public.profiles(is_beta_user) WHERE is_beta_user = true;