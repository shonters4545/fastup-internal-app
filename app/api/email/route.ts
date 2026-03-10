import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@/lib/supabase/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  // Verify the user is authenticated and is an admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('auth_id', user.id)
    .single();

  if (!profile || (profile.role !== 'admin' && profile.role !== 'super')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { to, subject, html } = await request.json();

    const recipients = Array.isArray(to) ? to : [to];

    const { data, error } = await resend.emails.send({
      from: 'FAST-UP逆転塾 <no-reply@fast-up.jp>',
      to: recipients,
      subject,
      html,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Email send error:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
