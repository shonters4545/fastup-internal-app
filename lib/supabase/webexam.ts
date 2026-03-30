import { createClient } from '@supabase/supabase-js';

export function createWebExamClient() {
  return createClient(
    process.env.WEBEXAM_SUPABASE_URL!,
    process.env.WEBEXAM_SUPABASE_SERVICE_ROLE_KEY!
  );
}
