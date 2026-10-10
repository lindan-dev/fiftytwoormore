CREATE OR REPLACE FUNCTION public.recent_signup_exists(_email text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(_email) AND created_at > now() - interval '15 minutes');
$$;

REVOKE ALL ON FUNCTION public.recent_signup_exists(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recent_signup_exists(text) TO service_role;