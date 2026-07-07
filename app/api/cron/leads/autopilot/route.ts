import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { runAutopilotTick } from '@/lib/leads/autopilot';

// Lead autopilot tick. Scheduled once per weekday morning (see vercel.json) so
// automated outreach lands when a small-business owner is actually at the
// counter, not at 3am. Each tick:
//   - flips enrollments with replies/interest to 'hooked' and emails admins
//   - lets Claude decide + execute the next touch for due enrollments
//
// On Vercel Pro this ran 4x/weekday (14/16/18/20h). Hobby caps crons at once/day,
// so a single daily run must now cover the whole day's due queue. Because each
// enrollment only advances once per min_hours_between_touches (default 72h), a
// batch only ever touches distinct due leads — so we drain in batches until the
// queue empties (a short batch) or we approach the function-duration cap, rather
// than processing one fixed batch of 10 and leaving the rest until tomorrow.

export const runtime = 'nodejs';
export const maxDuration = 300;

const BATCH_LIMIT = 10;
const DRAIN_BUDGET_MS = 240_000; // stay clear of the 300s (Fluid) Hobby maxDuration

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createAdminClient();
  const startedAt = Date.now();

  const totals = {
    processed: 0, emailsSent: 0, smsSent: 0, hooked: 0, stopped: 0, waited: 0, errors: 0,
  };
  let batches = 0;

  // Keep draining due enrollments until a batch comes back short (queue empty)
  // or we run out of time budget. Processed rows get next_action_at pushed
  // forward, so they don't reappear in the next batch.
  while (Date.now() - startedAt < DRAIN_BUDGET_MS) {
    const r = await runAutopilotTick(db, { limit: BATCH_LIMIT });
    batches++;
    totals.processed += r.processed;
    totals.emailsSent += r.emailsSent;
    totals.smsSent += r.smsSent;
    totals.hooked += r.hooked;
    totals.stopped += r.stopped;
    totals.waited += r.waited;
    totals.errors += r.errors;
    if (r.processed < BATCH_LIMIT) break; // nothing left due
  }

  const summary = { ...totals, batches };
  console.log('[cron/leads/autopilot]', JSON.stringify(summary));
  return NextResponse.json(summary);
}
