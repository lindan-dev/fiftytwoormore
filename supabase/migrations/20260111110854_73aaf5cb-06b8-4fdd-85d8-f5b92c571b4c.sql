-- Drop the existing INSERT policy that requires a partner
DROP POLICY IF EXISTS "Coupled users can insert activities" ON public.activities;

-- Create new INSERT policy that allows any authenticated user to insert their own activities
CREATE POLICY "Users can insert own activities"
ON public.activities
FOR INSERT
WITH CHECK (auth.uid() = user_id);