-- Create couples table
CREATE TABLE public.couples (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT different_users CHECK (user1_id != user2_id),
  CONSTRAINT unique_couple UNIQUE (user1_id, user2_id)
);

-- Create couple invitations table
CREATE TABLE public.couple_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_pending_invitation UNIQUE (sender_id, receiver_email)
);

-- Enable RLS
ALTER TABLE public.couples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couple_invitations ENABLE ROW LEVEL SECURITY;

-- Couples policies: users can view their own couple relationship
CREATE POLICY "Users can view their couple relationship"
ON public.couples
FOR SELECT
USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Couples policies: users can create a couple (for accepting invitations)
CREATE POLICY "Users can create couple relationship"
ON public.couples
FOR INSERT
WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Invitations policies: users can view invitations they sent or received
CREATE POLICY "Users can view their invitations"
ON public.couple_invitations
FOR SELECT
USING (auth.uid() = sender_id OR auth.email() = receiver_email);

-- Invitations policies: authenticated users can send invitations
CREATE POLICY "Users can send invitations"
ON public.couple_invitations
FOR INSERT
WITH CHECK (auth.uid() = sender_id);

-- Invitations policies: users can update invitations they received
CREATE POLICY "Users can update received invitations"
ON public.couple_invitations
FOR UPDATE
USING (auth.email() = receiver_email);

-- Create helper function to get user's partner
CREATE OR REPLACE FUNCTION public.get_partner_id(user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN user1_id = user_id THEN user2_id
    WHEN user2_id = user_id THEN user1_id
  END
  FROM public.couples
  WHERE user1_id = user_id OR user2_id = user_id
  LIMIT 1;
$$;

-- Update activities RLS policies to only show activities within the couple
DROP POLICY IF EXISTS "Users can view all activities" ON public.activities;

CREATE POLICY "Coupled users can view their activities"
ON public.activities
FOR SELECT
USING (
  user_id = auth.uid() 
  OR user_id = public.get_partner_id(auth.uid())
);

-- Only allow inserting activities if user has a partner
DROP POLICY IF EXISTS "Users can insert activities" ON public.activities;

CREATE POLICY "Coupled users can insert activities"
ON public.activities
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND public.get_partner_id(auth.uid()) IS NOT NULL
);

-- Create indexes
CREATE INDEX idx_couples_user1 ON public.couples(user1_id);
CREATE INDEX idx_couples_user2 ON public.couples(user2_id);
CREATE INDEX idx_invitations_sender ON public.couple_invitations(sender_id);
CREATE INDEX idx_invitations_receiver ON public.couple_invitations(receiver_email);
CREATE INDEX idx_invitations_status ON public.couple_invitations(status);