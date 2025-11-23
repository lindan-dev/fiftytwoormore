-- Remove quiet hours columns from notification_preferences
ALTER TABLE public.notification_preferences 
DROP COLUMN IF EXISTS quiet_hours_start,
DROP COLUMN IF EXISTS quiet_hours_end;