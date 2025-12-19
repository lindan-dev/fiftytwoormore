-- Fix RLS policies for superuser access
-- These policies were incorrectly set as RESTRICTIVE, preventing superusers from viewing data
-- Recreating them as PERMISSIVE (default) so they grant access correctly

-- Fix couples table
DROP POLICY IF EXISTS "Superusers can view all couples" ON couples;
CREATE POLICY "Superusers can view all couples" 
ON couples FOR SELECT 
USING (has_role(auth.uid(), 'superuser'::app_role));

-- Fix profiles table
DROP POLICY IF EXISTS "Superusers can view all profiles" ON profiles;
CREATE POLICY "Superusers can view all profiles" 
ON profiles FOR SELECT 
USING (has_role(auth.uid(), 'superuser'::app_role));

-- Fix activities table
DROP POLICY IF EXISTS "Superusers can view all activities" ON activities;
CREATE POLICY "Superusers can view all activities" 
ON activities FOR SELECT 
USING (has_role(auth.uid(), 'superuser'::app_role));

-- Fix couple_invitations table
DROP POLICY IF EXISTS "Superusers can view all invitations" ON couple_invitations;
CREATE POLICY "Superusers can view all invitations" 
ON couple_invitations FOR SELECT 
USING (has_role(auth.uid(), 'superuser'::app_role));

-- Fix email_events table
DROP POLICY IF EXISTS "Superusers can view all email events" ON email_events;
CREATE POLICY "Superusers can view all email events" 
ON email_events FOR SELECT 
USING (has_role(auth.uid(), 'superuser'::app_role));

-- Fix email_digest_log table
DROP POLICY IF EXISTS "Superusers can view all digest logs" ON email_digest_log;
CREATE POLICY "Superusers can view all digest logs" 
ON email_digest_log FOR SELECT 
USING (has_role(auth.uid(), 'superuser'::app_role));

-- Fix user_roles table
DROP POLICY IF EXISTS "Superusers can view all roles" ON user_roles;
CREATE POLICY "Superusers can view all roles" 
ON user_roles FOR SELECT 
USING (has_role(auth.uid(), 'superuser'::app_role));