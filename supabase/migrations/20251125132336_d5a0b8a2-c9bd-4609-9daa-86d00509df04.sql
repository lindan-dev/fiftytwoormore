-- Add timezone column to notification_preferences
ALTER TABLE notification_preferences
ADD COLUMN timezone TEXT DEFAULT 'UTC';