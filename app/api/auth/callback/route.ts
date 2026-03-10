import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Auth callback error:', error.message, error);
    }

    if (!error) {
      // Check if user exists in our users table, if not verify invite
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', user.id)
          .single<{ id: string }>();

        if (!existingUser) {
          // TODO: Re-enable after data migration
          // For now, skip invite verification since users table is empty
          // return NextResponse.redirect(`${origin}/api/auth/verify-invite`);
          console.log('New user detected, skipping invite check (pre-migration):', user.email);
        }

        // Existing user - check contract
        const { data: contract } = await supabase
          .from('contracts')
          .select('current_period_end, cancel_at_period_end')
          .eq('user_id', existingUser.id)
          .single<{ current_period_end: string; cancel_at_period_end: boolean }>();

        if (contract?.cancel_at_period_end && new Date(contract.current_period_end) < new Date()) {
          await supabase.auth.signOut();
          return NextResponse.redirect(`${origin}/login?error=contract_expired`);
        }
      }

      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocalEnv = process.env.NODE_ENV === 'development';
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  console.error('Auth failed - no code or exchange failed. URL:', request.url);
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
