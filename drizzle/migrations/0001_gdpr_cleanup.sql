DELETE FROM public.user_events           e WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = e.user_id);
DELETE FROM public.email_digest_log      e WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = e.user_id);
DELETE FROM public.email_events          e WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = e.user_id);
DELETE FROM public.push_notification_log e WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = e.user_id);
DELETE FROM public.push_tokens           e WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = e.user_id);

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['user_events', 'email_digest_log', 'email_events', 'push_notification_log'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = t || '_user_id_fkey'
        AND conrelid = ('public.' || t)::regclass
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE',
        t, t || '_user_id_fkey'
      );
    END IF;
  END LOOP;
END $$;