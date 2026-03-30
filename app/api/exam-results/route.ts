import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createWebExamClient } from '@/lib/supabase/webexam';
import type { WebExamResult } from '@/lib/types/webexam';

export async function GET(request: NextRequest) {
  // 1. Authenticate caller
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Determine target userId
  const targetUserId = request.nextUrl.searchParams.get('userId');

  // 3. Get caller's profile
  const serviceClient = createServiceClient();
  const { data: callerProfile } = await serviceClient
    .from('users')
    .select('id, role, email')
    .eq('auth_id', user.id)
    .single<{ id: string; role: string; email: string }>();

  if (!callerProfile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  // 4. Authorization: if viewing another user, must be admin/super
  let targetEmail = callerProfile.email;

  if (targetUserId && targetUserId !== callerProfile.id) {
    if (callerProfile.role !== 'admin' && callerProfile.role !== 'super') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    // Get target user's email
    const { data: targetUser } = await serviceClient
      .from('users')
      .select('email')
      .eq('id', targetUserId)
      .single<{ email: string }>();

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    targetEmail = targetUser.email;
  }

  // 5. Look up email in web-exam profiles
  if (!process.env.WEBEXAM_SUPABASE_URL || !process.env.WEBEXAM_SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ results: [] });
  }

  const webExam = createWebExamClient();
  const { data: webProfile } = await webExam
    .from('profiles')
    .select('id')
    .eq('email', targetEmail)
    .maybeSingle();

  if (!webProfile) {
    return NextResponse.json({ results: [] });
  }

  // 6. Fetch exam results
  const { data: results, error } = await webExam
    .from('results')
    .select('id, exam_title, score, deviation_value, judge, subject_name, created_at')
    .eq('user_id', webProfile.id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ results: [] });
  }

  return NextResponse.json({ results: (results || []) as WebExamResult[] });
}
