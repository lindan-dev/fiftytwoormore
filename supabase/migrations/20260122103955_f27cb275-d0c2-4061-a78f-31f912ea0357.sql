-- Drop the old constraint and add a new one that includes activation email types
ALTER TABLE email_digest_log DROP CONSTRAINT email_digest_log_type_check;

ALTER TABLE email_digest_log ADD CONSTRAINT email_digest_log_type_check 
CHECK (type = ANY (ARRAY[
  'digest', 
  'digest-nystart', 
  'digest-manual', 
  'midweek-nudge', 
  'midweek-nudge-manual',
  'yearly-review',
  'activation-uncoupled-1',
  'activation-uncoupled-2',
  'activation-uncoupled-3',
  'activation-coupled-1',
  'activation-coupled-2',
  'reengagement-1'
]::text[]));