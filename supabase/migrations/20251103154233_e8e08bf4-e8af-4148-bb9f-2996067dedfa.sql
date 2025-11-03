-- Add UPDATE policy for couples table so users can update their couple relationship
CREATE POLICY "Users can update their couple relationship"
ON public.couples
FOR UPDATE
USING ((auth.uid() = user1_id) OR (auth.uid() = user2_id))
WITH CHECK ((auth.uid() = user1_id) OR (auth.uid() = user2_id));