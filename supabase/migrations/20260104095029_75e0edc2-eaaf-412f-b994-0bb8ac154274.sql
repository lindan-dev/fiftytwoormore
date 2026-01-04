-- Drop existing RESTRICTIVE policies on user_roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Superusers can view all roles" ON public.user_roles;

-- Recreate as PERMISSIVE policies with explicit authentication requirement
-- Users can view their own roles (requires authentication)
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Superusers can view all roles (requires authentication via has_role check)
CREATE POLICY "Superusers can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'superuser'::app_role));