-- Add DELETE policy for couples table
CREATE POLICY "Users can delete their couple relationship"
ON public.couples
FOR DELETE
USING ((auth.uid() = user1_id) OR (auth.uid() = user2_id));