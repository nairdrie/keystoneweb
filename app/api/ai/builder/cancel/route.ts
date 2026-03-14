import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { refundLastRateLimitEntry, checkCancelRateLimit } from '../rate-limit';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Anti-spam: limit cancel requests to prevent abuse (5 per minute)
    if (!checkCancelRateLimit(user.id)) {
      return NextResponse.json({ error: 'Too many cancel requests.' }, { status: 429 });
    }

    // Refund the last rate limit entry for this user
    refundLastRateLimitEntry(user.id);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
