-- ============================================================
-- 002: Add missing columns for classes and attendance_records
-- ============================================================

-- Classes: add instructor tracking and passcode
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS instructor_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS instructor_name text;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS passcode text;

-- Attendance records: add denormalized fields for display
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS instructor_name text;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS student_name text;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS study_material text;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS attended_at timestamptz DEFAULT now();
