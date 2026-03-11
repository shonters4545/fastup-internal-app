-- Allow all authenticated users to read admin/super users (for instructor dropdowns etc.)
CREATE POLICY "Authenticated users can read instructors"
ON public.users
FOR SELECT
TO authenticated
USING (role IN ('admin', 'super'));

-- Note: survey_responses and survey_models type values from Firebase migration
-- are 'class_feedback' (not 'practice'). Code updated to match.
