-- Fix column mismatches found in code audit (2026-03-11)

-- books: add custom book support columns
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS is_custom boolean DEFAULT false;
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS max_laps int DEFAULT 1;
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS drive_url text;
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS remarks text;

-- progress: add book_id and lap for multi-lap tracking
ALTER TABLE public.progress ADD COLUMN IF NOT EXISTS book_id uuid REFERENCES public.books(id) ON DELETE CASCADE;
ALTER TABLE public.progress ADD COLUMN IF NOT EXISTS lap int DEFAULT 1;

-- time_logs: add subject_name (denormalized)
ALTER TABLE public.time_logs ADD COLUMN IF NOT EXISTS subject_name text;

-- contracts: add notes column
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS notes text;

-- users: add parent_email
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS parent_email text;

-- user_subjects: add level
ALTER TABLE public.user_subjects ADD COLUMN IF NOT EXISTS level int;

-- personal_entries: make subject and preferred_date nullable
ALTER TABLE public.personal_entries ALTER COLUMN subject DROP NOT NULL;
ALTER TABLE public.personal_entries ALTER COLUMN preferred_date DROP NOT NULL;
