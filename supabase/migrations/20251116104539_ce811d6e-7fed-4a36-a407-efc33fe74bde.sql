-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('superuser', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create table to track last stats check for notifications
CREATE TABLE public.superuser_last_check (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_check_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.superuser_last_check ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Superusers can view all roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'superuser'));

-- RLS Policies for superuser_last_check
CREATE POLICY "Superusers can manage their last check"
  ON public.superuser_last_check
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'superuser'))
  WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'superuser'));

-- Grant superusers read access to all tables for stats
CREATE POLICY "Superusers can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'superuser'));

CREATE POLICY "Superusers can view all activities"
  ON public.activities
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'superuser'));

CREATE POLICY "Superusers can view all couples"
  ON public.couples
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'superuser'));

CREATE POLICY "Superusers can view all invitations"
  ON public.couple_invitations
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'superuser'));

-- Create trigger to update updated_at on superuser_last_check
CREATE TRIGGER update_superuser_last_check_updated_at
  BEFORE UPDATE ON public.superuser_last_check
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();