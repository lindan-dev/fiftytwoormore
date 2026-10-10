CREATE TABLE IF NOT EXISTS public.admin_alert_log (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule text NOT NULL CHECK (rule IN ('unconfirmed_24h', 'not_connected_3d', 'no_activity_7d', 'lapsed_14d')),
  alerted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, rule)
);

ALTER TABLE public.admin_alert_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE VIEW public.user_funnel AS
WITH base AS (
  SELECT
    u.id AS user_id,
    u.email,
    p.name,
    u.created_at,
    u.email_confirmed_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE NOT EXISTS (
          SELECT 1 FROM public.user_roles r
          WHERE r.user_id = u.id AND r.role IN ('superuser', 'test_user')
        )
    AND COALESCE(u.email, '') NOT IN ('demo1@fiftytwoormore.com', 'demo2@fiftytwoormore.com')
),
onboarding AS (
  SELECT user_id, min(created_at) AS at
  FROM public.user_events
  WHERE event_name IN ('onboarding_completed', 'onboarding_skipped')
  GROUP BY user_id
),
invites AS (
  SELECT sender_id AS user_id, min(created_at) AS at
  FROM public.couple_invitations
  GROUP BY sender_id
),
couple AS (
  SELECT user_id, min(created_at) AS at
  FROM (
    SELECT user1_id AS user_id, created_at FROM public.couples
    UNION ALL
    SELECT user2_id AS user_id, created_at FROM public.couples
  ) x
  GROUP BY user_id
),
acts AS (
  SELECT user_id, min(created_at) AS first_at, max(created_at) AS last_at, count(*) AS n
  FROM public.activities
  GROUP BY user_id
),
pushes AS (
  SELECT DISTINCT user_id FROM public.push_tokens
),
joined AS (
  SELECT
    b.user_id, b.email, b.name, b.created_at, b.email_confirmed_at,
    o.at       AS onboarded_at,
    i.at       AS invite_created_at,
    c.at       AS connected_at,
    a.first_at AS first_activity_at,
    a.last_at  AS last_activity_at,
    COALESCE(a.n, 0) AS activity_count,
    (a.last_at IS NOT NULL AND a.last_at >= a.first_at + interval '7 days') AS active_week2,
    (ps.user_id IS NOT NULL) AS has_push_token
  FROM base b
  LEFT JOIN onboarding o ON o.user_id = b.user_id
  LEFT JOIN invites i    ON i.user_id = b.user_id
  LEFT JOIN couple c     ON c.user_id = b.user_id
  LEFT JOIN acts a       ON a.user_id = b.user_id
  LEFT JOIN pushes ps    ON ps.user_id = b.user_id
)
SELECT
  j.*,
  GREATEST(
    1,
    CASE WHEN j.email_confirmed_at   IS NOT NULL THEN 2 ELSE 0 END,
    CASE WHEN j.onboarded_at         IS NOT NULL THEN 3 ELSE 0 END,
    CASE WHEN j.connected_at         IS NOT NULL THEN 4 ELSE 0 END,
    CASE WHEN j.first_activity_at    IS NOT NULL THEN 5 ELSE 0 END,
    CASE WHEN j.active_week2                    THEN 6 ELSE 0 END
  ) AS stage_rank,
  CASE GREATEST(
    1,
    CASE WHEN j.email_confirmed_at   IS NOT NULL THEN 2 ELSE 0 END,
    CASE WHEN j.onboarded_at         IS NOT NULL THEN 3 ELSE 0 END,
    CASE WHEN j.connected_at         IS NOT NULL THEN 4 ELSE 0 END,
    CASE WHEN j.first_activity_at    IS NOT NULL THEN 5 ELSE 0 END,
    CASE WHEN j.active_week2                    THEN 6 ELSE 0 END
  )
    WHEN 1 THEN 'created'
    WHEN 2 THEN 'confirmed'
    WHEN 3 THEN 'onboarded'
    WHEN 4 THEN 'connected'
    WHEN 5 THEN 'first_activity'
    ELSE 'active_week2'
  END AS stage
FROM joined j;

CREATE OR REPLACE VIEW public.funnel_summary AS
SELECT 1 AS rank, 'created'::text AS stage, count(*) AS users
FROM public.user_funnel
UNION ALL
SELECT 2, 'confirmed', count(*) FILTER (WHERE email_confirmed_at IS NOT NULL)
FROM public.user_funnel
UNION ALL
SELECT 3, 'onboarded', count(*) FILTER (WHERE onboarded_at IS NOT NULL OR connected_at IS NOT NULL OR first_activity_at IS NOT NULL)
FROM public.user_funnel
UNION ALL
SELECT 4, 'connected', count(*) FILTER (WHERE connected_at IS NOT NULL)
FROM public.user_funnel
UNION ALL
SELECT 5, 'first_activity', count(*) FILTER (WHERE first_activity_at IS NOT NULL)
FROM public.user_funnel
UNION ALL
SELECT 6, 'active_week2', count(*) FILTER (WHERE active_week2)
FROM public.user_funnel
ORDER BY rank;

CREATE OR REPLACE VIEW public.stuck_users AS
SELECT user_id, email, name, 'unconfirmed_24h'::text AS rule, created_at AS since
FROM public.user_funnel
WHERE email_confirmed_at IS NULL
  AND created_at < now() - interval '24 hours'
UNION ALL
SELECT user_id, email, name, 'not_connected_3d', email_confirmed_at
FROM public.user_funnel
WHERE email_confirmed_at IS NOT NULL
  AND email_confirmed_at < now() - interval '3 days'
  AND connected_at IS NULL
UNION ALL
SELECT user_id, email, name, 'no_activity_7d', connected_at
FROM public.user_funnel
WHERE connected_at IS NOT NULL
  AND connected_at < now() - interval '7 days'
  AND (last_activity_at IS NULL OR last_activity_at < connected_at)
UNION ALL
SELECT user_id, email, name, 'lapsed_14d', last_activity_at
FROM public.user_funnel
WHERE last_activity_at IS NOT NULL
  AND last_activity_at < now() - interval '14 days'
  AND (connected_at IS NULL OR last_activity_at >= connected_at);

REVOKE ALL ON public.user_funnel, public.funnel_summary, public.stuck_users FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_funnel, public.funnel_summary, public.stuck_users TO service_role;
REVOKE ALL ON public.admin_alert_log FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.admin_alert_log TO service_role;

INSERT INTO public.admin_alert_log (user_id, rule)
SELECT user_id, rule FROM public.stuck_users
ON CONFLICT DO NOTHING;