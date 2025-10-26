-- Create activities table
CREATE TABLE public.activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Create policies for activities
-- Users can view all activities (both partners can see)
CREATE POLICY "Users can view all activities" 
ON public.activities 
FOR SELECT 
USING (true);

-- Users can insert activities
CREATE POLICY "Users can insert activities" 
ON public.activities 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own activities
CREATE POLICY "Users can delete own activities" 
ON public.activities 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX idx_activities_date ON public.activities(activity_date DESC);
CREATE INDEX idx_activities_user ON public.activities(user_id);