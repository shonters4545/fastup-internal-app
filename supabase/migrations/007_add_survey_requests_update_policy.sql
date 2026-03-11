-- Allow students to update their own survey_requests status (pending → completed)
CREATE POLICY "Users can update own requests"
  ON public.survey_requests
  FOR UPDATE
  USING (user_id = get_user_id((auth.uid())::text))
  WITH CHECK (user_id = get_user_id((auth.uid())::text));
