-- 1. users テーブルに stream (理系/文系) カラム追加
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS stream text;

-- 2. class_rooms テーブル: 特訓ごとのルーム情報
CREATE TABLE IF NOT EXISTS public.class_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  label text NOT NULL,
  room_type text NOT NULL DEFAULT 'humanities',
  instructor_id uuid REFERENCES public.users(id),
  instructor_name text,
  capacity integer NOT NULL DEFAULT 10,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_class_rooms_class_id ON public.class_rooms(class_id);

-- 3. attendance_records に新カラム追加
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id),
  ADD COLUMN IF NOT EXISTS book_id uuid REFERENCES public.books(id),
  ADD COLUMN IF NOT EXISTS room_id uuid REFERENCES public.class_rooms(id),
  ADD COLUMN IF NOT EXISTS is_trial boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS round_checks jsonb NOT NULL DEFAULT '[false, false, false]';

-- 4. RLS for class_rooms
ALTER TABLE public.class_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class_rooms_select_authenticated" ON public.class_rooms
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "class_rooms_insert_admin" ON public.class_rooms
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid()::text AND role IN ('admin', 'super'))
  );

CREATE POLICY "class_rooms_update_admin" ON public.class_rooms
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid()::text AND role IN ('admin', 'super'))
  );

CREATE POLICY "class_rooms_delete_admin" ON public.class_rooms
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid()::text AND role IN ('admin', 'super'))
  );

-- 5. 既存ユーザーの stream 自動判定
WITH science_subject_ids AS (
  SELECT id FROM subjects WHERE name IN ('数学', '物理', '化学', '生物')
),
science_users AS (
  SELECT DISTINCT us.user_id
  FROM user_subjects us
  JOIN science_subject_ids s ON us.subject_id = s.id
)
UPDATE users
SET stream = CASE
  WHEN id IN (SELECT user_id FROM science_users) THEN 'science'
  ELSE 'humanities'
END
WHERE role = 'student' AND stream IS NULL;
