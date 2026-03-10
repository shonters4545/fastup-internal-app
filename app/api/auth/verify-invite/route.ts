import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  const serviceClient = createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.redirect(`${origin}/login?error=no_user`);
  }

  // Call the PL/pgSQL function to atomically process the invite
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (serviceClient.rpc as any)('process_new_user_invite', {
    p_auth_id: user.id,
    p_email: user.email,
    p_display_name: user.user_metadata?.full_name ?? user.email,
    p_photo_url: user.user_metadata?.avatar_url ?? null,
  });

  if (error) {
    console.error('Error processing invite:', error);
    // No invite found or processing failed - sign out
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=no_invite`);
  }

  return NextResponse.redirect(`${origin}/mypage`);
}
