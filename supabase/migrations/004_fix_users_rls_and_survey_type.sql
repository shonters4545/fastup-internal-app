-- Allow all authenticated users to read admin/super users (for instructor dropdowns etc.)
CREATE POLICY "Authenticated users can read instructors"
ON public.users
FOR SELECT
TO authenticated
USING (role IN ('admin', 'super'));

-- Note: survey_responses and survey_models type values from Firebase migration
-- are 'class_feedback' (not 'practice'). Code updated to match.

-- Fix: Allow admins to insert progress records for any user (was restricted to own user only)
DROP POLICY IF EXISTS "Users can insert own progress" ON public.progress;
CREATE POLICY "Users can insert own progress" ON public.progress FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_user_id(auth.uid()::text) OR public.get_user_role(auth.uid()::text) IN ('admin', 'super'));
