-- ============================================================
-- FAST-UP Migration: Firestore → Supabase PostgreSQL
-- 001_initial_schema.sql
-- ============================================================

-- ============================================================
-- 1. UPDATED_AT TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 2. TABLES
-- ============================================================

-- --- Master Data ---

CREATE TABLE public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  display_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.divisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id uuid NOT NULL REFERENCES public.divisions(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  name text NOT NULL,
  image_url text,
  display_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  display_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- --- Users ---

CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id text UNIQUE NOT NULL,
  display_name text NOT NULL,
  nickname text,
  email text NOT NULL,
  photo_url text,
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin', 'super')),
  target_college text,
  grade text,
  target_time int,
  phone_number text,
  high_school text,
  learning_location text DEFAULT 'classroom',
  profile_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.user_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, subject_id)
);

CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  parent_email text,
  payment_method text,
  status text DEFAULT 'active',
  current_period_start timestamptz NOT NULL,
  current_period_end timestamptz NOT NULL,
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text NOT NULL,
  role text DEFAULT 'student' CHECK (role IN ('student', 'admin', 'super')),
  status text DEFAULT 'pending',
  target_college text,
  grade text,
  target_time int,
  phone_number text,
  high_school text,
  learning_location text,
  subjects text[],
  levels jsonb,
  parent_email text,
  payment_method text,
  contract_start_date timestamptz,
  contract_end_date timestamptz,
  created_at timestamptz DEFAULT now()
);

-- --- Learning ---

CREATE TABLE public.levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  level int NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, subject_id)
);

CREATE TABLE public.level_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  level int NOT NULL,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, book_id)
);

CREATE TABLE public.user_curriculum (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  status text DEFAULT 'pending',
  display_order int DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.time_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  curriculum_id uuid NOT NULL REFERENCES public.user_curriculum(id) ON DELETE CASCADE,
  duration_seconds int NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  status text DEFAULT 'not_started',
  score int,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  curriculum_id uuid NOT NULL REFERENCES public.user_curriculum(id) ON DELETE CASCADE,
  review_date date NOT NULL,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- --- Classes & Attendance ---

CREATE TABLE public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  survey_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status text DEFAULT 'present',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.attendance_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  planned boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, date)
);

-- --- Surveys ---

CREATE TABLE public.survey_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  type text DEFAULT 'practice',
  form_fields jsonb NOT NULL,
  delivery_status text,
  delivery_time timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.survey_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  survey_model_id uuid NOT NULL REFERENCES public.survey_models(id) ON DELETE CASCADE,
  type text DEFAULT 'practice',
  status text DEFAULT 'pending',
  requested_at timestamptz DEFAULT now()
);

CREATE TABLE public.survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  class_id uuid,
  survey_model_id uuid NOT NULL REFERENCES public.survey_models(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.survey_requests(id) ON DELETE CASCADE,
  type text DEFAULT 'practice',
  responses jsonb NOT NULL,
  submitted_at timestamptz DEFAULT now()
);

-- --- Timeline ---

CREATE TABLE public.timeline_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  thumbnail_url text,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  author_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  published boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- --- Specials ---

CREATE TABLE public.specials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  capacity int,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  special_id uuid NOT NULL REFERENCES public.specials(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status text DEFAULT 'applied',
  created_at timestamptz DEFAULT now(),
  UNIQUE (special_id, user_id)
);

CREATE TABLE public.personal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  preferred_date timestamptz NOT NULL,
  notes text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- --- Admin Tools ---

CREATE TABLE public.memos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- --- Quizzes ---

CREATE TABLE public.quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  text text NOT NULL,
  display_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  text text NOT NULL,
  is_correct boolean DEFAULT false,
  display_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  score int NOT NULL,
  total int NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 3. INDEXES
-- ============================================================

CREATE INDEX idx_users_auth_id ON public.users(auth_id);
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_user_subjects_user_id ON public.user_subjects(user_id);
CREATE INDEX idx_contracts_user_id ON public.contracts(user_id);
CREATE INDEX idx_invites_email_status ON public.invites(email, status);
CREATE INDEX idx_levels_user_id ON public.levels(user_id);
CREATE INDEX idx_unlocks_user_id ON public.unlocks(user_id);
CREATE INDEX idx_user_curriculum_user_id ON public.user_curriculum(user_id);
CREATE INDEX idx_user_curriculum_book_id ON public.user_curriculum(book_id);
CREATE INDEX idx_time_logs_user_id ON public.time_logs(user_id);
CREATE INDEX idx_time_logs_curriculum_id ON public.time_logs(curriculum_id);
CREATE INDEX idx_progress_user_id ON public.progress(user_id);
CREATE INDEX idx_reviews_user_id ON public.reviews(user_id);
CREATE INDEX idx_attendance_records_class_id ON public.attendance_records(class_id);
CREATE INDEX idx_attendance_records_user_id ON public.attendance_records(user_id);
CREATE INDEX idx_attendance_plans_user_id ON public.attendance_plans(user_id);
CREATE INDEX idx_survey_requests_user_status ON public.survey_requests(user_id, status);
CREATE INDEX idx_survey_responses_user_id ON public.survey_responses(user_id);
CREATE INDEX idx_timeline_posts_published ON public.timeline_posts(published, created_at DESC);
CREATE INDEX idx_entries_special_id ON public.entries(special_id);
CREATE INDEX idx_personal_entries_user_id ON public.personal_entries(user_id);
CREATE INDEX idx_memos_user_id ON public.memos(user_id);
CREATE INDEX idx_questions_quiz_id ON public.questions(quiz_id);
CREATE INDEX idx_options_question_id ON public.options(question_id);
CREATE INDEX idx_results_user_id ON public.results(user_id);
CREATE INDEX idx_divisions_subject_id ON public.divisions(subject_id);
CREATE INDEX idx_books_division_id ON public.books(division_id);
CREATE INDEX idx_tasks_book_id ON public.tasks(book_id);
CREATE INDEX idx_level_rules_subject_id ON public.level_rules(subject_id);
CREATE INDEX idx_classes_end_time ON public.classes(end_time);
CREATE INDEX idx_survey_models_type_status ON public.survey_models(type, delivery_status);

-- ============================================================
-- 4. UPDATED_AT TRIGGERS
-- ============================================================

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.levels
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.user_curriculum
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.progress
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.survey_models
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.timeline_posts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.specials
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.personal_entries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.memos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 5. RLS HELPER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_role(p_auth_id text)
RETURNS text AS $$
  SELECT role FROM public.users WHERE auth_id = p_auth_id LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: get user.id from auth.uid()
CREATE OR REPLACE FUNCTION public.get_user_id(p_auth_id text)
RETURNS uuid AS $$
  SELECT id FROM public.users WHERE auth_id = p_auth_id LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================

-- --- Master Data: authenticated SELECT, admin/super manage ---

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read subjects" ON public.subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage subjects" ON public.subjects FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()::text) IN ('admin', 'super'));

ALTER TABLE public.divisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read divisions" ON public.divisions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage divisions" ON public.divisions FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()::text) IN ('admin', 'super'));

ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read books" ON public.books FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage books" ON public.books FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()::text) IN ('admin', 'super'));

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read tasks" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage tasks" ON public.tasks FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()::text) IN ('admin', 'super'));

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read categories" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage categories" ON public.categories FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()::text) IN ('admin', 'super'));

ALTER TABLE public.level_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read level_rules" ON public.level_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage level_rules" ON public.level_rules FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()::text) IN ('admin', 'super'));

-- --- Users ---

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON public.users FOR SELECT TO authenticated
  USING (auth_id = auth.uid()::text OR public.get_user_role(auth.uid()::text) IN ('admin', 'super'));
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE TO authenticated
  USING (auth_id = auth.uid()::text OR public.get_user_role(auth.uid()::text) IN ('admin', 'super'));
CREATE POLICY "Admin can insert users" ON public.users FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()::text) IN ('admin', 'super'));
CREATE POLICY "Admin can delete users" ON public.users FOR DELETE TO authenticated
  USING (public.get_user_role(auth.uid()::text) IN ('admin', 'super'));

-- --- User Subjects ---

ALTER TABLE public.user_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own subjects" ON public.user_subjects FOR SELECT TO authenticated
  USING (user_id = public.get_user_id(auth.uid()::text) OR public.get_user_role(auth.uid()::text) IN ('admin', 'super'));
CREATE POLICY "Admin can manage user_subjects" ON public.user_subjects FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()::text) IN ('admin', 'super'));

-- --- Contracts ---

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own contract" ON public.contracts FOR SELECT TO authenticated
  USING (user_id = public.get_user_id(auth.uid()::text) OR public.get_user_role(auth.uid()::text) IN ('admin', 'super'));
CREATE POLICY "Admin can manage contracts" ON public.contracts FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()::text) IN ('admin', 'super'));

-- --- Invites (admin only) ---

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage invites" ON public.invites FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()::text) IN ('admin', 'super'));

-- --- Levels ---

ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own levels" ON public.levels FOR SELECT TO authenticated
  USING (user_id = public.get_user_id(auth.uid()::text) OR public.get_user_role(auth.uid()::text) IN ('admin', 'super'));
CREATE POLICY "Admin can manage levels" ON public.levels FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()::text) IN ('admin', 'super'));

-- --- Unlocks ---

ALTER TABLE public.unlocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own unlocks" ON public.unlocks FOR SELECT TO authenticated
  USING (user_id = public.get_user_id(auth.uid()::text) OR public.get_user_role(auth.uid()::text) IN ('admin', 'super'));
CREATE POLICY "Admin can manage unlocks" ON public.unlocks FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()::text) IN ('admin', 'super'));

-- --- User Curriculum ---

ALTER TABLE public.user_curriculum ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own curriculum" ON public.user_curriculum FOR SELECT TO authenticated
  USING (user_id = public.get_user_id(auth.uid()::text) OR public.get_user_role(auth.uid()::text) IN ('admin', 'super'));
CREATE POLICY "Users can update own curriculum" ON public.user_curriculum FOR UPDATE TO authenticated
  USING (user_id = public.get_user_id(auth.uid()::text) OR public.get_user_role(auth.uid()::text) IN ('admin', 'super'));
CREATE POLICY "Admin can insert curriculum" ON public.user_curriculum FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()::text) IN ('admin', 'super'));
CREATE POLICY "Admin can delete curriculum" ON public.user_curriculum FOR DELETE TO authenticated
  USING (public.get_user_role(auth.uid()::text) IN ('admin', 'super'));

-- --- Time Logs ---

ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own time_logs" ON public.time_logs FOR SELECT TO authenticated
  USING (user_id = public.get_user_id(auth.uid()::text) OR public.get_user_role(auth.uid()::text) IN ('admin', 'super'));
CREATE POLICY "Users can insert own time_logs" ON public.time_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_user_id(auth.uid()::text));
CREATE POLICY "Admin can manage time_logs" ON public.time_logs FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()::text) IN ('admin', 'super'));

-- --- Progress ---

ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own progress" ON public.progress FOR SELECT TO authenticated
  USING (user_id = public.get_user_id(auth.uid()::text) OR public.get_user_role(auth.uid()::text) IN ('admin', 'super'));
CREATE POLICY "Users can manage own progress" ON public.progress FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_user_id(auth.uid()::text));
CREATE POLICY "Users can update own progress" ON public.progress FOR UPDATE TO authenticated
  USING (user_id = public.get_user_id(auth.uid()::text) OR public.get_user_role(auth.uid()::text) IN ('admin', 'super'));

-- --- Reviews ---

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own reviews" ON public.reviews FOR SELECT TO authenticated
  USING (user_id = public.get_user_id(auth.uid()::text) OR public.get_user_role(auth.uid()::text) IN ('admin', 'super'));
CREATE POLICY "Admin can manage reviews" ON public.reviews FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()::text) IN ('admin', 'super'));

-- --- Classes ---

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read classes" ON public.classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage classes" ON public.classes FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()::text) IN ('admin', 'super'));

-- --- Attendance Records ---

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read attendance" ON public.attendance_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage attendance" ON public.attendance_records FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()::text) IN ('admin', 'super'));

-- --- Attendance Plans ---

ALTER TABLE public.attendance_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own plans" ON public.attendance_plans FOR SELECT TO authenticated
  USING (user_id = public.get_user_id(auth.uid()::text) OR public.get_user_role(auth.uid()::text) IN ('admin', 'super'));
CREATE POLICY "Users can manage own plans" ON public.attendance_plans FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_user_id(auth.uid()::text));
CREATE POLICY "Users can update own plans" ON public.attendance_plans FOR UPDATE TO authenticated
  USING (user_id = public.get_user_id(auth.uid()::text));
CREATE POLICY "Users can delete own plans" ON public.attendance_plans FOR DELETE TO authenticated
  USING (user_id = public.get_user_id(auth.uid()::text));
CREATE POLICY "Admin can manage all plans" ON public.attendance_plans FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()::text) IN ('admin', 'super'));

-- --- Survey Models ---

ALTER TABLE public.survey_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read survey_models" ON public.survey_models FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage survey_models" ON public.survey_models FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()::text) IN ('admin', 'super'));

-- --- Survey Requests ---

ALTER TABLE public.survey_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own requests" ON public.survey_requests FOR SELECT TO authenticated
  USING (user_id = public.get_user_id(auth.uid()::text) OR public.get_user_role(auth.uid()::text) IN ('admin', 'super'));
CREATE POLICY "Admin can manage requests" ON public.survey_requests FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()::text) IN ('admin', 'super'));

-- --- Survey Responses ---

ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own responses" ON public.survey_responses FOR SELECT TO authenticated
  USING (user_id = public.get_user_id(auth.uid()::text) OR public.get_user_role(auth.uid()::text) IN ('admin', 'super'));
CREATE POLICY "Users can insert own responses" ON public.survey_responses FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_user_id(auth.uid()::text));
CREATE POLICY "Admin can manage responses" ON public.survey_responses FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()::text) IN ('admin', 'super'));

-- --- Timeline Posts ---

ALTER TABLE public.timeline_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read published posts" ON public.timeline_posts FOR SELECT TO authenticated
  USING (published = true OR public.get_user_role(auth.uid()::text) IN ('admin', 'super'));
CREATE POLICY "Admin can manage posts" ON public.timeline_posts FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()::text) IN ('admin', 'super'));

-- --- Specials ---

ALTER TABLE public.specials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read specials" ON public.specials FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage specials" ON public.specials FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()::text) IN ('admin', 'super'));

-- --- Entries ---

ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own entries" ON public.entries FOR SELECT TO authenticated
  USING (user_id = public.get_user_id(auth.uid()::text) OR public.get_user_role(auth.uid()::text) IN ('admin', 'super'));
CREATE POLICY "Users can insert own entries" ON public.entries FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_user_id(auth.uid()::text));
CREATE POLICY "Users can delete own entries" ON public.entries FOR DELETE TO authenticated
  USING (user_id = public.get_user_id(auth.uid()::text));
CREATE POLICY "Admin can manage entries" ON public.entries FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()::text) IN ('admin', 'super'));

-- --- Personal Entries ---

ALTER TABLE public.personal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own personal_entries" ON public.personal_entries FOR SELECT TO authenticated
  USING (user_id = public.get_user_id(auth.uid()::text) OR public.get_user_role(auth.uid()::text) IN ('admin', 'super'));
CREATE POLICY "Users can insert own personal_entries" ON public.personal_entries FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_user_id(auth.uid()::text));
CREATE POLICY "Users can update own personal_entries" ON public.personal_entries FOR UPDATE TO authenticated
  USING (user_id = public.get_user_id(auth.uid()::text));
CREATE POLICY "Admin can manage personal_entries" ON public.personal_entries FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()::text) IN ('admin', 'super'));

-- --- Memos ---

ALTER TABLE public.memos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own memos" ON public.memos FOR SELECT TO authenticated
  USING (user_id = public.get_user_id(auth.uid()::text) OR public.get_user_role(auth.uid()::text) IN ('admin', 'super'));
CREATE POLICY "Admin can manage memos" ON public.memos FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()::text) IN ('admin', 'super'));

-- --- Quizzes ---

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read quizzes" ON public.quizzes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage quizzes" ON public.quizzes FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()::text) IN ('admin', 'super'));

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read questions" ON public.questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage questions" ON public.questions FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()::text) IN ('admin', 'super'));

ALTER TABLE public.options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read options" ON public.options FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage options" ON public.options FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()::text) IN ('admin', 'super'));

-- --- Results ---

ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own results" ON public.results FOR SELECT TO authenticated
  USING (user_id = public.get_user_id(auth.uid()::text) OR public.get_user_role(auth.uid()::text) IN ('admin', 'super'));
CREATE POLICY "Users can insert own results" ON public.results FOR INSERT TO authenticated
  WITH CHECK (user_id = public.get_user_id(auth.uid()::text));
CREATE POLICY "Admin can manage results" ON public.results FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()::text) IN ('admin', 'super'));

-- ============================================================
-- 7. PL/pgSQL FUNCTIONS
-- ============================================================

-- Process new user invite (atomic user creation)
CREATE OR REPLACE FUNCTION public.process_new_user_invite(
  p_auth_id text,
  p_email text,
  p_display_name text,
  p_photo_url text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_invite RECORD;
  v_user_id uuid;
  v_subject_id text;
  v_level int;
BEGIN
  -- Find pending invite
  SELECT * INTO v_invite FROM public.invites
  WHERE lower(email) = lower(p_email) AND status = 'pending'
  LIMIT 1;

  IF v_invite IS NULL THEN
    RAISE EXCEPTION 'No pending invite found for %', p_email;
  END IF;

  v_user_id := gen_random_uuid();

  -- Create user
  INSERT INTO public.users (id, auth_id, display_name, nickname, email, photo_url, role,
    target_college, grade, target_time, phone_number, high_school, learning_location, profile_completed)
  VALUES (v_user_id, p_auth_id, v_invite.name, v_invite.name, p_email, p_photo_url, v_invite.role,
    v_invite.target_college, v_invite.grade, v_invite.target_time, v_invite.phone_number,
    v_invite.high_school, v_invite.learning_location, true);

  -- Create user_subjects and levels from invite
  IF v_invite.subjects IS NOT NULL THEN
    FOREACH v_subject_id IN ARRAY v_invite.subjects LOOP
      INSERT INTO public.user_subjects (user_id, subject_id)
      VALUES (v_user_id, v_subject_id::uuid);

      IF v_invite.levels IS NOT NULL AND v_invite.levels ? v_subject_id THEN
        v_level := (v_invite.levels ->> v_subject_id)::int;
        INSERT INTO public.levels (user_id, subject_id, level)
        VALUES (v_user_id, v_subject_id::uuid, v_level);
      END IF;
    END LOOP;
  END IF;

  -- Create contract
  INSERT INTO public.contracts (user_id, parent_email, payment_method, status,
    current_period_start, current_period_end, cancel_at_period_end)
  VALUES (v_user_id, v_invite.parent_email, v_invite.payment_method, 'active',
    v_invite.contract_start_date, v_invite.contract_end_date, false);

  -- Delete used invite
  DELETE FROM public.invites WHERE id = v_invite.id;

  RETURN jsonb_build_object('user_id', v_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Send survey on class end (pg_cron target)
CREATE OR REPLACE FUNCTION public.send_survey_on_class_end()
RETURNS void AS $$
DECLARE
  v_class RECORD;
  v_model RECORD;
  v_attendee RECORD;
BEGIN
  -- Find classes that ended in the last 2 minutes and haven't sent surveys
  FOR v_class IN
    SELECT id, title FROM public.classes
    WHERE survey_sent = false
      AND end_time <= now()
      AND end_time >= now() - interval '2 minutes'
  LOOP
    -- Get default practice survey model
    SELECT * INTO v_model FROM public.survey_models
    WHERE id = (SELECT id FROM public.survey_models WHERE type = 'practice' LIMIT 1);

    IF v_model IS NULL THEN
      CONTINUE;
    END IF;

    -- Create survey requests for each attendee
    FOR v_attendee IN
      SELECT user_id FROM public.attendance_records WHERE class_id = v_class.id
    LOOP
      INSERT INTO public.survey_requests (user_id, class_id, survey_model_id, type, status)
      VALUES (v_attendee.user_id, v_class.id, v_model.id, 'practice', 'pending');
    END LOOP;

    -- Mark class as survey sent
    UPDATE public.classes SET survey_sent = true WHERE id = v_class.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Distribute scheduled surveys (pg_cron target)
CREATE OR REPLACE FUNCTION public.distribute_scheduled_surveys()
RETURNS void AS $$
DECLARE
  v_survey RECORD;
  v_student RECORD;
BEGIN
  -- Find general surveys ready for delivery
  FOR v_survey IN
    SELECT id FROM public.survey_models
    WHERE type = 'general'
      AND delivery_status = 'scheduled'
      AND delivery_time <= now()
  LOOP
    -- Create survey requests for all students
    FOR v_student IN
      SELECT id FROM public.users WHERE role = 'student'
    LOOP
      INSERT INTO public.survey_requests (user_id, survey_model_id, type, status)
      VALUES (v_student.id, v_survey.id, 'general', 'pending');
    END LOOP;

    -- Update delivery status
    UPDATE public.survey_models SET delivery_status = 'sent' WHERE id = v_survey.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 8. pg_cron SETUP (run in Supabase SQL Editor after enabling pg_cron)
-- ============================================================
-- NOTE: Execute these manually in Supabase Dashboard > SQL Editor
-- after enabling the pg_cron extension.
--
-- SELECT cron.schedule('survey-on-class-end', '* * * * *', 'SELECT public.send_survey_on_class_end()');
-- SELECT cron.schedule('distribute-surveys', '* * * * *', 'SELECT public.distribute_scheduled_surveys()');

-- ============================================================
-- 9. STORAGE BUCKETS (run via Supabase Dashboard)
-- ============================================================
-- Create these buckets in Supabase Dashboard > Storage:
-- 1. book-images (public)
-- 2. post-thumbnails (public)
-- 3. custom-content (private, RLS-protected)
