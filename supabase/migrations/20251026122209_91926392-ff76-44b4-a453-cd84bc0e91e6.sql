-- Add RLS policy to allow users to update their own activities
CREATE POLICY "Users can update own activities"
ON public.activities
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);