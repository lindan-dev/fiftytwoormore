-- Add resend_message_id column to email_digest_log for webhook matching
ALTER TABLE email_digest_log ADD COLUMN resend_message_id text;

-- Create index for efficient lookups by resend_message_id
CREATE INDEX idx_email_digest_log_resend_message_id ON email_digest_log(resend_message_id);