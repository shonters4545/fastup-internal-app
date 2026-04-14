import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

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
        // Use service role client to bypass RLS for user lookup/update
        const serviceClient = createServiceClient();

        const { data: existingUser } = await (serviceClient.from('users') as any)
          .select('id')
          .eq('auth_id', user.id)
          .single();

        if (!existingUser) {
          // No match by auth_id — try matching by email (migrated users or email change)
          const { data: emailMatch } = await (serviceClient.from('users') as any)
            .select('id, auth_id')
            .eq('email', user.email!)
            .single();

          if (emailMatch) {
            const oldAuthId = emailMatch.auth_id;
            // Update auth_id to the new Supabase Auth UUID
            const { error: updateError } = await (serviceClient.from('users') as any)
              .update({ auth_id: user.id })
              .eq('id', emailMatch.id);
            if (updateError) {
              console.error('Failed to update auth_id:', updateError);
            } else {
              console.log('Linked Supabase auth to existing user:', user.email);
              // Clean up old auth user to prevent stale login
              if (oldAuthId && oldAuthId !== user.id) {
                const { error: deleteError } = await serviceClient.auth.admin.deleteUser(oldAuthId);
                if (deleteError) {
                  console.error('Failed to delete old auth user:', deleteError);
                } else {
                  console.log('Deleted old auth user:', oldAuthId);
                }
              }
            }
          } else {
            // Truly new user — process invite directly (no redirect to avoid cookie issues)
            console.log('New user, processing invite for:', user.email);
            const { error: inviteError } = await (serviceClient.rpc as any)('process_new_user_invite', {
              p_auth_id: user.id,
              p_email: user.email,
              p_display_name: user.user_metadata?.full_name ?? user.email,
              p_photo_url: user.user_metadata?.avatar_url ?? null,
            });

            if (inviteError) {
              console.error('Error processing invite:', inviteError);
              await supabase.auth.signOut();
              return NextResponse.redirect(`${origin}/login?error=no_invite`);
            }
          }
        } else {
          // Existing user - check contract
          const { data: contract } = await (serviceClient.from('contracts') as any)
            .select('current_period_end, cancel_at_period_end')
            .eq('user_id', existingUser.id)
            .single();

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
