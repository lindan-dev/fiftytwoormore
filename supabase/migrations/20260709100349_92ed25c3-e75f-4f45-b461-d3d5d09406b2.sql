
CREATE TABLE IF NOT EXISTS public.push_notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('weekly-digest', 'midweek-nudge')),
  channel text NOT NULL CHECK (channel IN ('push', 'email-fallback')),
  week_number integer NOT NULL,
  year integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.push_notification_log TO authenticated;
GRANT ALL ON public.push_notification_log TO service_role;

CREATE INDEX IF NOT EXISTS push_notification_log_lookup_idx
  ON public.push_notification_log (user_id, type, week_number, year);

ALTER TABLE public.push_notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superusers can view all push notification logs"
ON public.push_notification_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'superuser'));

SELECT cron.schedule(
  'weekly-digest-push-orchestrator',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/send-weekly-digest-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'midweek-nudge-push-orchestrator',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/send-midweek-nudge-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  );
  $$
);
