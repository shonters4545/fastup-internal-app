-- ============================================================
-- 003: Add missing columns for timeline_posts, specials,
--      personal_entries, and entries
-- ============================================================

-- timeline_posts: add author_name (denormalized) and excerpt
ALTER TABLE public.timeline_posts ADD COLUMN IF NOT EXISTS author_name text;
ALTER TABLE public.timeline_posts ADD COLUMN IF NOT EXISTS excerpt text;

-- specials: add thumbnail_url and form_fields for custom entry forms
ALTER TABLE public.specials ADD COLUMN IF NOT EXISTS thumbnail_url text;
ALTER TABLE public.specials ADD COLUMN IF NOT EXISTS form_fields jsonb DEFAULT '[]'::jsonb;

-- personal_entries: add columns for personal entry workflow
ALTER TABLE public.personal_entries ADD COLUMN IF NOT EXISTS contracted_subjects text[];
ALTER TABLE public.personal_entries ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE public.personal_entries ADD COLUMN IF NOT EXISTS desired_subjects text[];
ALTER TABLE public.personal_entries ADD COLUMN IF NOT EXISTS additional_desired_subject text;

-- entries: add form_data for special course entry details and updated_at
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS form_data jsonb;
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
