-- Drop the old check constraint
ALTER TABLE public.email_digest_log DROP CONSTRAINT email_digest_log_type_check;

-- Add new check constraint with more flexible types
ALTER TABLE public.email_digest_log ADD CONSTRAINT email_digest_log_type_check 
CHECK (type = ANY (ARRAY['digest', 'digest-nystart', 'digest-manual', 'midweek-nudge', 'midweek-nudge-manual']::text[]));