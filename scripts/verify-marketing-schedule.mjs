/**
 * Verifies lib/marketing/schedule.ts — the campaign hard-end-date derivation
 * used to guarantee Google always receives a self-enforced stop on launch and
 * resume. Runs the real TypeScript via Node's built-in type stripping
 * (Node >= 22.6), so it exercises the actual exported functions.
 *
 * Run: node scripts/verify-marketing-schedule.mjs
 */

import path from 'node:path';

const root = process.cwd();
const failures = [];

function check(name, cond, detail) {
  if (!cond) failures.push(`${name}${detail ? `: ${detail}` : ''}`);
}

const schedule = await import(path.join(root, 'lib/marketing/schedule.ts'));
const { resolveCampaignEndDate, resumeEndDate, addDays, DEFAULT_CAMPAIGN_DAYS } = schedule;

// ── addDays: plain + month rollover ──────────────────────────────────────────
check('addDays same month', addDays('2026-06-22', 7) === '2026-06-29', addDays('2026-06-22', 7));
check('addDays month rollover', addDays('2026-07-05', 30) === '2026-08-04', addDays('2026-07-05', 30));

// ── resolveCampaignEndDate ───────────────────────────────────────────────────

// 1. Explicit end_date wins over any budget-implied duration.
check(
  'explicit end_date wins',
  resolveCampaignEndDate({ end_date: '2026-07-12', start_date: '2026-07-05', daily_budget_cents: 1500, total_budget_cents: 10500 }) === '2026-07-12',
);

// 2. A timestamped end_date is reduced to its calendar day.
check(
  'end_date timestamp trimmed',
  resolveCampaignEndDate({ end_date: '2026-07-12T00:00:00.000Z', start_date: null, daily_budget_cents: null, total_budget_cents: null }) === '2026-07-12',
);

// 3. Budget-implied duration: floor(total / daily) days from start.
//    $105 total / $15 daily = 7 days → Jun 22 + 7 = Jun 29 (the Aman case).
check(
  'budget-implied duration',
  resolveCampaignEndDate({ end_date: null, start_date: '2026-06-22', daily_budget_cents: 1500, total_budget_cents: 10500 }) === '2026-06-29',
  resolveCampaignEndDate({ end_date: null, start_date: '2026-06-22', daily_budget_cents: 1500, total_budget_cents: 10500 }),
);

// 4. No end date, no derivable duration, no fallback → null (open-ended internal).
check(
  'null when nothing to derive',
  resolveCampaignEndDate({ end_date: null, start_date: null, daily_budget_cents: null, total_budget_cents: null }) === null,
);

// 5. Fallback used when duration can't be derived (customer-launch guarantee).
check(
  'fallbackDays applied',
  resolveCampaignEndDate(
    { end_date: null, start_date: null, daily_budget_cents: null, total_budget_cents: null },
    { today: '2026-07-05', fallbackDays: DEFAULT_CAMPAIGN_DAYS },
  ) === '2026-08-04',
);

// 6. Budget-implied duration always beats fallback when both are available.
check(
  'budget-implied beats fallback',
  resolveCampaignEndDate(
    { end_date: null, start_date: '2026-07-05', daily_budget_cents: 1000, total_budget_cents: 5000 },
    { fallbackDays: 30 },
  ) === '2026-07-10',
);

// ── resumeEndDate ────────────────────────────────────────────────────────────

// 7. today + whole days the remaining bundled budget funds.
//    $50 remaining / ($15 * 1.05 = $15.75/day) = 3 days → Jul 5 + 3 = Jul 8.
check(
  'resume runway',
  resumeEndDate({ remainingBundledCents: 5000, dailyBundledCents: 1575, today: '2026-07-05' }) === '2026-07-08',
  resumeEndDate({ remainingBundledCents: 5000, dailyBundledCents: 1575, today: '2026-07-05' }),
);

// 8. Never resumes into the past: at least one day of runway even on a thin balance.
check(
  'resume min one day',
  resumeEndDate({ remainingBundledCents: 100, dailyBundledCents: 1575, today: '2026-07-05' }) === '2026-07-06',
);

// 9. Guards divide-by-zero on a missing daily rate.
check(
  'resume zero daily → one day',
  resumeEndDate({ remainingBundledCents: 5000, dailyBundledCents: 0, today: '2026-07-05' }) === '2026-07-06',
);

if (failures.length) {
  console.error(`\n✗ verify-marketing-schedule: ${failures.length} failure(s)`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('✓ verify-marketing-schedule: all checks passed');
