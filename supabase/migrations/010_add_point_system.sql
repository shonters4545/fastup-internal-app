-- ============================================================
-- 010: Point System (ポイント制度)
-- ============================================================

-- 1. point_transactions table
CREATE TABLE public.point_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  reason text NOT NULL,
  reference_type text,
  reference_id uuid,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_point_transactions_user_id ON public.point_transactions(user_id);
CREATE INDEX idx_point_transactions_reference ON public.point_transactions(reference_type, reference_id);

-- 2. Trigger: auto-award 1 point on attendance insert
CREATE OR REPLACE FUNCTION public.award_attendance_point()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_trial = false THEN
    INSERT INTO public.point_transactions (user_id, amount, reason, reference_type, reference_id)
    VALUES (NEW.user_id, 1, '特訓参加', 'attendance', NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_attendance_point
  AFTER INSERT ON public.attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION public.award_attendance_point();

-- 3. RLS
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own points" ON public.point_transactions
  FOR SELECT TO authenticated
  USING (
    user_id = public.get_user_id(auth.uid()::text)
    OR public.get_user_role(auth.uid()::text) IN ('admin', 'super')
  );

CREATE POLICY "Admin can manage points" ON public.point_transactions
  FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()::text) IN ('admin', 'super'))
  WITH CHECK (public.get_user_role(auth.uid()::text) IN ('admin', 'super'));

-- 4. Helper function for balance
CREATE OR REPLACE FUNCTION public.get_point_balance(p_user_id uuid)
RETURNS integer AS $$
  SELECT COALESCE(SUM(amount), 0)::integer
  FROM public.point_transactions
  WHERE user_id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 5. Backfill: award points for existing attendance records
INSERT INTO public.point_transactions (user_id, amount, reason, reference_type, reference_id)
SELECT user_id, 1, '特訓参加（過去分）', 'attendance', id
FROM public.attendance_records
WHERE is_trial = false;
