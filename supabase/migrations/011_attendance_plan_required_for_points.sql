-- ============================================================
-- 011: Attendance Plan Required for Points
-- 出席申請済みの場合のみポイントを付与する
-- ============================================================

CREATE OR REPLACE FUNCTION public.award_attendance_point()
RETURNS TRIGGER AS $$
BEGIN
  -- 体験参加でない かつ 当日の出席予定が登録済みの場合のみポイント付与
  IF NEW.is_trial = false
     AND EXISTS (
       SELECT 1 FROM public.attendance_plans
       WHERE user_id = NEW.user_id
         AND date = CURRENT_DATE
         AND planned = true
     )
  THEN
    INSERT INTO public.point_transactions (user_id, amount, reason, reference_type, reference_id)
    VALUES (NEW.user_id, 1, '特訓参加', 'attendance', NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
