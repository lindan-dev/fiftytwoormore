-- Normalize existing couples data to ensure user1_id < user2_id
UPDATE public.couples
SET user1_id = user2_id, user2_id = user1_id
WHERE user1_id > user2_id;

-- Add uniqueness constraints to couples table to prevent duplicate relationships
-- Ensure each user appears in only one couple relationship
ALTER TABLE public.couples ADD CONSTRAINT one_couple_per_user_1 UNIQUE (user1_id);
ALTER TABLE public.couples ADD CONSTRAINT one_couple_per_user_2 UNIQUE (user2_id);

-- Prevent reverse duplicates by enforcing user1_id < user2_id
ALTER TABLE public.couples ADD CONSTRAINT ordered_couple_ids CHECK (user1_id < user2_id);