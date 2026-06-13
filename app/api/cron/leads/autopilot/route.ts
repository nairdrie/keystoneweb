import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { runAutopilotTick } from '@/lib/leads/autopilot';

// Lead autopilot tick. Scheduled on weekday working hours (see vercel.json) so
// automated outreach lands when a small-business owner is actually at the
// counter, not at 3am. Each tick:
//   - flips enrollments with replies/interest to 'hooked' and emails admins
//   - lets Claude decide + execute the next touch for due enrollments

export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_ENROLLMENTS_PER_TICK = 10;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createAdminClient();
  const result = await runAutopilotTick(db, { limit: MAX_ENROLLMENTS_PER_TICK });
  console.log('[cron/leads/autopilot]', JSON.stringify(result));
  return NextResponse.json(result);
}
