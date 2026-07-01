
-- 1. user_roles: remove client-side INSERT policy; only service_role should assign roles.
DROP POLICY IF EXISTS "Superusers can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Superusers can delete roles" ON public.user_roles;

-- Revoke direct write access from client roles; SELECT stays for authenticated (existing policies).
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon, authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- 2. user_events: let owners read their own events.
CREATE POLICY "Users can view their own events"
ON public.user_events
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 3. get_partner_id: only return data when caller is asking about themselves,
--    or when running as service_role / postgres (no auth.uid()).
CREATE OR REPLACE FUNCTION public.get_partner_id(user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN user1_id = get_partner_id.user_id THEN user2_id
    WHEN user2_id = get_partner_id.user_id THEN user1_id
  END
  FROM public.couples
  WHERE (user1_id = get_partner_id.user_id OR user2_id = get_partner_id.user_id)
    AND (
      auth.uid() IS NULL              -- server-side / service role
      OR auth.uid() = get_partner_id.user_id  -- user asking about themselves
    )
  LIMIT 1;
$$;

-- 4. Lock down SECURITY DEFINER function execution.
-- Trigger-only function: no client should ever call it.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Helper functions used by RLS policies: keep authenticated access, revoke from anon/public.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_partner_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_beta_user_or_partner(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_partner_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_beta_user_or_partner(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
