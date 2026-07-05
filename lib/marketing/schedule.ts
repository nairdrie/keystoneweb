/**
 * Campaign scheduling helpers — pure date math for the hard end date Google Ads
 * uses to stop a campaign.
 *
 * Why this matters: Google's daily budget is only an *average* (it can spend up
 * to ~2× on a busy day), and Keystone's spend-based auto-pause is a lagging
 * poller. The campaign `end_date` is the only instruction Google honours as a
 * hard, self-enforced stop — so every launch and every resume must carry one.
 * These helpers guarantee we always have a date to send.
 *
 * Pure module: no DB, no Google client. Safe to import anywhere and to exercise
 * directly from the verify scripts.
 */

import type { Campaign } from './types';

/**
 * Final backstop window (days) for a campaign that has neither an explicit end
 * date nor a budget-implied duration. Prevents an unbounded run when a customer
 * campaign somehow reaches launch without a schedule.
 */
export const DEFAULT_CAMPAIGN_DAYS = 30;

/** Reduce an ISO timestamp/date string to its YYYY-MM-DD calendar part. */
function toDateOnly(value: string): string {
  return value.slice(0, 10);
}

/** Today as YYYY-MM-DD (UTC). */
export function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Add whole days to a YYYY-MM-DD date, returning YYYY-MM-DD. */
export function addDays(startDateOnly: string, days: number): string {
  const d = new Date(`${startDateOnly}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

type SchedulableCampaign = Pick<
  Campaign,
  'start_date' | 'end_date' | 'daily_budget_cents' | 'total_budget_cents'
>;

/**
 * Resolve the calendar date (YYYY-MM-DD) Google should stop serving on.
 *
 * Preference order:
 *   1. An explicit `end_date` on the campaign — the schedule ops signed off on.
 *   2. The duration implied by the budget: floor(total ÷ daily) days from the
 *      start date (or today, if the campaign has no start date yet).
 *   3. `opts.fallbackDays` from the start date, when provided.
 *
 * Returns null only when none of the above apply (no end date, no budget-implied
 * duration, no fallback) — i.e. an intentionally open-ended internal campaign.
 * Customer launches pass `fallbackDays` so the result is always non-null.
 */
export function resolveCampaignEndDate(
  campaign: SchedulableCampaign,
  opts: { today?: string; fallbackDays?: number } = {},
): string | null {
  if (campaign.end_date) return toDateOnly(campaign.end_date);

  const start = campaign.start_date
    ? toDateOnly(campaign.start_date)
    : (opts.today ?? todayDateOnly());

  const daily = campaign.daily_budget_cents ?? 0;
  const total = campaign.total_budget_cents ?? 0;
  if (daily > 0 && total > 0) {
    return addDays(start, Math.max(1, Math.floor(total / daily)));
  }

  if (opts.fallbackDays && opts.fallbackDays > 0) {
    return addDays(start, opts.fallbackDays);
  }

  return null;
}

/**
 * Forward hard-stop date for a campaign being (re)started today: today plus the
 * whole days the remaining prepaid budget funds at the daily rate. Both inputs
 * are "bundled" cents (ad spend + service fee) so the ratio is unit-consistent.
 * Always at least one day ahead, so a freshly funded resume has runway.
 */
export function resumeEndDate(opts: {
  remainingBundledCents: number;
  dailyBundledCents: number;
  today?: string;
}): string {
  const days = opts.dailyBundledCents > 0
    ? Math.max(1, Math.floor(opts.remainingBundledCents / opts.dailyBundledCents))
    : 1;
  return addDays(opts.today ?? todayDateOnly(), days);
}
