-- Fix send_survey_on_class_end: 'practice' → 'class_feedback' (2026-03-11)
-- The function was querying survey_models with type='practice' but DB has 'class_feedback'

CREATE OR REPLACE FUNCTION public.send_survey_on_class_end()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_class RECORD;
  v_model RECORD;
  v_attendee RECORD;
BEGIN
  FOR v_class IN
    SELECT id, title FROM public.classes
    WHERE survey_sent = false
      AND end_time <= now()
      AND end_time >= now() - interval '2 minutes'
  LOOP
    SELECT * INTO v_model FROM public.survey_models
    WHERE type = 'class_feedback' LIMIT 1;

    IF v_model IS NULL THEN
      CONTINUE;
    END IF;

    FOR v_attendee IN
      SELECT user_id FROM public.attendance_records WHERE class_id = v_class.id
    LOOP
      INSERT INTO public.survey_requests (user_id, class_id, survey_model_id, type, status)
      VALUES (v_attendee.user_id, v_class.id, v_model.id, 'class_feedback', 'pending');
    END LOOP;

    UPDATE public.classes SET survey_sent = true WHERE id = v_class.id;
  END LOOP;
END;
$$;
