import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { sendPaymentFailedEmail, sendPaymentFinalNoticeEmail } from '@/lib/email';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://keystoneweb.ca';
const BILLING_URL = `${APP_URL}/settings`;
const GRACE_PERIOD_DAYS = 14;
const FINAL_NOTICE_WINDOW_MS = 2 * 24 * 60 * 60 * 1000; // 48h before grace ends

const formatGraceDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });

/**
 * GET /api/cron/dunning-reminders
 *
 * Daily backstop for the failed-payment flow. The Stripe webhook is the primary
 * driver (failure + reminder emails), but webhooks can be missed and the final
 * notice is time-based rather than event-based. This cron:
 *
 *   1. Sends the FINAL notice (~48h before grace_period_ends_at) to past_due
 *      subscriptions that haven't received it yet.
 *   2. Backstops missed webhooks: any past_due row with no dunning email on
 *      record gets the first failure notice + a grace window opened.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = Date.now();

  const { data: pastDue, error } = await supabase
    .from('user_subscriptions')
    .select('user_id, subscription_plan, grace_period_ends_at, last_dunning_email_stage, payment_failed_at')
    .eq('subscription_status', 'past_due');

  if (error) {
    console.error('Cron dunning-reminders: query failed:', error);
    return NextResponse.json({ error: 'DB query failed' }, { status: 500 });
  }

  let finalSent = 0;
  let backstopSent = 0;
  let errors = 0;

  for (const sub of pastDue ?? []) {
    const stage = sub.last_dunning_email_stage || null;
    const graceIso = sub.grace_period_ends_at
      || new Date(now + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const graceMs = new Date(graceIso).getTime();
    const nearGraceEnd = graceMs - now <= FINAL_NOTICE_WINDOW_MS;

    // Decide what (if anything) to send this run.
    let toSend: 'failure' | 'final' | null = null;
    if (!stage) {
      toSend = 'failure'; // missed webhook backstop
    } else if (stage !== 'final' && nearGraceEnd) {
      toSend = 'final';
    }
    if (!toSend) continue;

    try {
      const { data: { user } } = await supabase.auth.admin.getUserById(sub.user_id);
      if (!user?.email) continue;

      const customerName = user.user_metadata?.full_name || user.user_metadata?.name || '';
      const planName = sub.subscription_plan || 'Pro';
      const graceEndsAt = formatGraceDate(graceIso);

      if (toSend === 'failure') {
        await sendPaymentFailedEmail({ customerEmail: user.email, customerName, planName, graceEndsAt, billingUrl: BILLING_URL });
        backstopSent++;
      } else {
        await sendPaymentFinalNoticeEmail({ customerEmail: user.email, customerName, planName, graceEndsAt, billingUrl: BILLING_URL });
        finalSent++;
      }

      await supabase
        .from('user_subscriptions')
        .update({
          last_dunning_email_stage: toSend,
          last_dunning_email_at: new Date(now).toISOString(),
          ...(sub.payment_failed_at ? {} : { payment_failed_at: new Date(now).toISOString() }),
          grace_period_ends_at: graceIso,
          updated_at: new Date(now).toISOString(),
        })
        .eq('user_id', sub.user_id);
    } catch (err) {
      console.error(`Cron dunning-reminders: failed for user ${sub.user_id}:`, err);
      errors++;
    }
  }

  return NextResponse.json({
    checked: pastDue?.length ?? 0,
    finalSent,
    backstopSent,
    errors,
  });
}
