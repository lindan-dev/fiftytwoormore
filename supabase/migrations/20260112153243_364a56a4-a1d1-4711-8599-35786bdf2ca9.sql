-- Allow superusers to insert and delete user_roles (for managing test users)
CREATE POLICY "Superusers can insert roles" 
  ON public.user_roles 
  FOR INSERT 
  WITH CHECK (has_role(auth.uid(), 'superuser'));

CREATE POLICY "Superusers can delete roles" 
  ON public.user_roles 
  FOR DELETE 
  USING (has_role(auth.uid(), 'superuser'));