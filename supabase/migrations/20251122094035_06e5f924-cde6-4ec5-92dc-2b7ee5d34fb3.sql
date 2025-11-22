-- Create notification preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  push_token text,
  weekly_nudges boolean NOT NULL DEFAULT false,
  streak_celebrations boolean NOT NULL DEFAULT true,
  milestones boolean NOT NULL DEFAULT true,
  monthly_recap boolean NOT NULL DEFAULT false,
  comeback_boosts boolean NOT NULL DEFAULT true,
  quiet_hours_start time NOT NULL DEFAULT '21:00:00',
  quiet_hours_end time NOT NULL DEFAULT '08:00:00',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create notification schedule table (for weekly nudge times)
CREATE TABLE IF NOT EXISTS public.notification_schedule (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
  time time NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, day_of_week)
);

-- Create notification logs table (for tracking and enforcing caps)
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  clicked boolean NOT NULL DEFAULT false,
  message text NOT NULL
);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notification_preferences
CREATE POLICY "Users can view own preferences"
  ON public.notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON public.notification_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for notification_schedule
CREATE POLICY "Users can view own schedule"
  ON public.notification_schedule FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own schedule"
  ON public.notification_schedule FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own schedule"
  ON public.notification_schedule FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own schedule"
  ON public.notification_schedule FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for notification_logs
CREATE POLICY "Users can view own logs"
  ON public.notification_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_notification_logs_user_sent ON public.notification_logs(user_id, sent_at DESC);
CREATE INDEX idx_notification_schedule_user_day ON public.notification_schedule(user_id, day_of_week);

-- Trigger for updated_at
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();