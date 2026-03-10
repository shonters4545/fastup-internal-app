import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// This endpoint can be called by Vercel Cron or used as a fallback.
// Primary execution should be via Supabase pg_cron for per-minute scheduling.
export async function GET(request: Request) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  try {
    // Call the PL/pgSQL function that handles survey distribution
    const { error } = await supabase.rpc('send_survey_on_class_end');

    if (error) {
      console.error('Error running send_survey_on_class_end:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cron error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
