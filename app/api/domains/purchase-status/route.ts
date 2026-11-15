import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

/**
 * GET /api/domains/purchase-status?sessionId=cs_...
 *
 * Lets the domain page report the outcome of a paid purchase after the user
 * returns from Stripe (the actual registration happens in the webhook).
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sessionId = request.nextUrl.searchParams.get('sessionId');
  if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });

  const { data } = await supabase
    .from('domain_purchases')
    .select('domain, status, failure_reason, refunded_at')
    .eq('user_id', user.id)
    .eq('stripe_checkout_session_id', sessionId)
    .maybeSingle();

  if (!data) return NextResponse.json({ status: 'unknown' });

  return NextResponse.json({
    domain: data.domain,
    status: data.status,
    error: data.status === 'failed' ? data.failure_reason : null,
    refunded: !!data.refunded_at,
  });
}
