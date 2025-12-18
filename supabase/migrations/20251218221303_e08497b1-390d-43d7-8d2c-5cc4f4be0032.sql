-- Add variant_key and subject columns to email_digest_log for tracking nudge variants
ALTER TABLE public.email_digest_log 
ADD COLUMN IF NOT EXISTS variant_key text,
ADD COLUMN IF NOT EXISTS subject text;