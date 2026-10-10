CREATE OR REPLACE VIEW public.user_funnel AS
WITH base AS (
  SELECT u.id AS user_id, u.email, p.name, u.created_at, u.email_confirmed_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE NOT EXISTS (
          SELECT 1 FROM public.user_roles r
          WHERE r.user_id = u.id AND r.role IN ('superuser', 'test_user')
        )
    AND COALESCE(u.email, '') NOT IN ('demo1@fiftytwoormore.com', 'demo2@fiftytwoormore.com')
),
onboarding AS (
  SELECT
    u.id AS user_id,
    LEAST(
      (SELECT min(e.created_at) FROM public.user_events e WHERE e.user_id = u.id),
      CASE WHEN u.last_sign_in_at > u.email_confirmed_at + interval '2 minutes' THEN u.last_sign_in_at END
    ) AS at
  FROM auth.users u
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

REVOKE ALL ON public.user_funnel FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_funnel TO service_role;