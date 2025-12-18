-- Add message_id to email_digest_log for Resend tracking
ALTER TABLE public.email_digest_log 
ADD COLUMN IF NOT EXISTS message_id text UNIQUE;

-- Create email_events table for tracking delivery and engagement
CREATE TABLE public.email_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id text NOT NULL,
  user_id uuid NOT NULL,
  type text NOT NULL,
  variant_key text,
  event text NOT NULL CHECK (event IN ('sent', 'delivered', 'bounced', 'complained', 'opened', 'clicked')),
  event_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(message_id, event)
);

-- Create indexes for efficient querying
CREATE INDEX idx_email_events_message_id ON public.email_events(message_id);
CREATE INDEX idx_email_events_event_at ON public.email_events(event_at);
CREATE INDEX idx_email_events_type_event ON public.email_events(type, event);
CREATE INDEX idx_email_events_user_id ON public.email_events(user_id);

-- Enable RLS
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

-- Only superusers can view email events
CREATE POLICY "Superusers can view all email events"
ON public.email_events
FOR SELECT
USING (has_role(auth.uid(), 'superuser'::app_role));

-- No direct insert/update/delete from client - only edge functions with service role