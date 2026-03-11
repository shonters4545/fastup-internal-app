import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { authId, email, displayName, photoUrl } = await request.json();

    if (!authId || !email) {
      return NextResponse.json({ error: 'Missing authId or email' }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    const { data, error } = await (serviceClient.rpc as any)('process_new_user_invite', {
      p_auth_id: authId,
      p_email: email,
      p_display_name: displayName || email,
      p_photo_url: photoUrl || null,
    });

    if (error) {
      console.error('process-invite error:', error);
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ success: true, userId: data?.user_id });
  } catch (err) {
    console.error('process-invite exception:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
