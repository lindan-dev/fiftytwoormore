CREATE OR REPLACE FUNCTION public.admin_is_superuser()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'superuser');
$$;

CREATE OR REPLACE FUNCTION public.admin_user_funnel()
RETURNS SETOF public.user_funnel LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.admin_is_superuser() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.user_funnel;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_stuck_users()
RETURNS SETOF public.stuck_users LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.admin_is_superuser() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.stuck_users;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_all_users()
RETURNS TABLE (user_id uuid, email text, name text, created_at timestamptz, email_confirmed_at timestamptz, last_sign_in_at timestamptz, is_test boolean, is_superuser boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.admin_is_superuser() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT u.id, u.email::text, p.name, u.created_at, u.email_confirmed_at, u.last_sign_in_at,
    EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role = 'test_user'),
    EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role = 'superuser')
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_is_superuser(), public.admin_user_funnel(), public.admin_stuck_users(), public.admin_all_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_is_superuser(), public.admin_user_funnel(), public.admin_stuck_users(), public.admin_all_users() TO authenticated;