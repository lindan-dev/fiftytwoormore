-- Add DELETE policy for couple_invitations
-- Users can delete their own pending invitations
CREATE POLICY "Users can delete their own pending invitations"
ON public.couple_invitations
FOR DELETE
USING (auth.uid() = sender_id AND status = 'pending');