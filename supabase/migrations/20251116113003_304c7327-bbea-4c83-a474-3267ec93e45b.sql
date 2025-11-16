-- Migrate existing beta users to user_roles table
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'beta_user'::app_role
FROM public.profiles
WHERE is_beta_user = true
ON CONFLICT (user_id, role) DO NOTHING;

-- Create function to check if user or their partner is a beta user
CREATE OR REPLACE FUNCTION public.is_beta_user_or_partner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Check if user is beta
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'beta_user'
  )
  OR 
  -- Check if partner is beta
  EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    WHERE ur.user_id = public.get_partner_id(_user_id)
      AND ur.role = 'beta_user'
  )
$$;