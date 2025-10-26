-- Add emoji field to activities table
ALTER TABLE public.activities ADD COLUMN emoji TEXT;

-- Add comment explaining the emoji field
COMMENT ON COLUMN public.activities.emoji IS 'Emoji representing the type of activity';