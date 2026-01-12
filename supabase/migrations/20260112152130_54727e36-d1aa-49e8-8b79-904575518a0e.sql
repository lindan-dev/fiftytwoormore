-- Create user_events table for analytics tracking
CREATE TABLE public.user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event_name TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  session_id TEXT
);

-- Indexes for efficient querying
CREATE INDEX idx_user_events_user_id ON public.user_events(user_id);
CREATE INDEX idx_user_events_event_name ON public.user_events(event_name);
CREATE INDEX idx_user_events_created_at ON public.user_events(created_at);

-- Enable RLS
ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;

-- Users can insert their own events
CREATE POLICY "Users can insert own events" 
  ON public.user_events 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Superusers can view all events
CREATE POLICY "Superusers can view all events" 
  ON public.user_events 
  FOR SELECT 
  USING (has_role(auth.uid(), 'superuser'));