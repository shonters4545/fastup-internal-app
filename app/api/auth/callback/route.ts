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
      return NextResponse.redirect(
        `${origin}/login?error=exchange_failed&detail=${encodeURIComponent(error.message)}`
      );
    }

    {
      // Check if user exists in our users table, if not verify invite
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', user.id)
          .single<{ id: string }>();

        if (!existingUser) {
          // No match by auth_id — try matching by email (migrated users have Firebase UIDs)
          const { data: emailMatch } = await supabase
            .from('users')
            .select('id')
            .eq('email', user.email!)
            .single<{ id: string }>();

          if (emailMatch) {
            // Update auth_id to the new Supabase Auth UUID
            await (supabase.from('users') as any)
              .update({ auth_id: user.id })
              .eq('id', emailMatch.id);
            console.log('Linked Supabase auth to existing user:', user.email);
          } else {
            // Truly new user — verify invite
            return NextResponse.redirect(`${origin}/api/auth/verify-invite`);
          }
        } else {
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

  console.error('Auth failed - no code param. URL:', request.url);
  return NextResponse.redirect(`${origin}/login?error=no_code`);
}
