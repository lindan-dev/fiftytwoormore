CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_audit_log FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.admin_audit_log TO service_role;

CREATE OR REPLACE FUNCTION public.admin_delete_preview(_user_id uuid)
RETURNS TABLE (
  user_id uuid, email text, name text, created_at timestamptz, is_superuser boolean, is_self boolean,
  own_activities bigint, partner_user_id uuid, partner_name text, partner_email text,
  partner_activities bigint, invitations bigint, push_tokens bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  partner uuid;
BEGIN
  IF NOT public.admin_is_superuser() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT CASE WHEN c.user1_id = _user_id THEN c.user2_id ELSE c.user1_id END
    INTO partner
    FROM public.couples c
   WHERE _user_id IN (c.user1_id, c.user2_id)
   LIMIT 1;

  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    pr.name,
    u.created_at,
    EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role = 'superuser'),
    (u.id = auth.uid()),
    (SELECT count(*) FROM public.activities a WHERE a.user_id = u.id),
    partner,
    (SELECT pp.name FROM public.profiles pp WHERE pp.user_id = partner),
    (SELECT pu.email::text FROM auth.users pu WHERE pu.id = partner),
    CASE WHEN partner IS NULL THEN 0::bigint
         ELSE (SELECT count(*) FROM public.activities a2 WHERE a2.user_id = partner) END,
    (SELECT count(*) FROM public.couple_invitations i WHERE i.sender_id = u.id),
    (SELECT count(*) FROM public.push_tokens t WHERE t.user_id = u.id)
  FROM auth.users u
  LEFT JOIN public.profiles pr ON pr.user_id = u.id
  WHERE u.id = _user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_audit_recent()
RETURNS TABLE (created_at timestamptz, action text, actor_email text, target_user_id uuid, details jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.admin_is_superuser() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT l.created_at, l.action, au.email::text, l.target_user_id, l.details
    FROM public.admin_audit_log l
    LEFT JOIN auth.users au ON au.id = l.actor_user_id
   ORDER BY l.created_at DESC
   LIMIT 30;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_preview(uuid), public.admin_audit_recent() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_preview(uuid), public.admin_audit_recent() TO authenticated;