-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Create policy for users to view their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT 
USING (auth.uid() = user_id);

-- Create policy for users to view their partner's profile
CREATE POLICY "Users can view partner profile" ON public.profiles
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.couples 
    WHERE (user1_id = auth.uid() AND user2_id = profiles.user_id)
       OR (user2_id = auth.uid() AND user1_id = profiles.user_id)
  )
);