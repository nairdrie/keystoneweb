// ── AI Builder Rate Limiting ───────────────────────────────────────────────
// All usage is tracked in the `ai_prompt_usage` DB table so limits survive
// server restarts and work correctly across serverless function instances.
//
// Limits:
//   free  → 4 total prompts (resets when user subscribes — old rows predate
//            subscription_started_at so they aren't counted)
//   basic → 10/day · 20/week · 30/month
//   pro   → 30/day · 50/week · 100/month
//
// "Quota resets on upgrade": counts only include rows where
//   used_at >= max(subscription_started_at, window_start)
// so upgrading your plan automatically excludes old usage.

export type UserPlan = 'free' | 'basic' | 'pro';

export interface UsageRemaining {
  total?: number; // free plan only
  day?: number;
  week?: number;
  month?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  message: string;
  upgradeRequired?: boolean;
  remaining: UsageRemaining;
}

const FREE_LIMIT = 4;

const BASE_LIMITS = {
  basic: { day: 10,  week: 20, month: 30  },
  pro:   { day: 30,  week: 50, month: 100 },
} as const;

/**
 * Get effective AI limits, applying add-on multiplier if provided.
 * multiplier=1 (default) means base limits; multiplier=2 doubles them, etc.
 */
function getEffectiveLimits(plan: 'basic' | 'pro', multiplier: number = 1) {
  const base = BASE_LIMITS[plan];
  return {
    day:   base.day   * multiplier,
    week:  base.week  * multiplier,
    month: base.month * multiplier,
  };
}

// ── Cancel anti-spam (in-memory only — this is intentionally lightweight) ──
const CANCEL_RATE_LIMIT_MAX = 5;
const CANCEL_RATE_LIMIT_MS  = 60_000;
const cancelRateLimitMap    = new Map<string, number[]>();

// ── Helpers ────────────────────────────────────────────────────────────────

// All windows are fixed-boundary Eastern Time:
//   day   → midnight ET today
//   week  → midnight ET on the most recent Sunday (Sunday–Saturday week)
//   month → midnight ET on the 1st of this month

/** Convert an ET date string ("YYYY-MM-DD") to the UTC Date at midnight ET, handling DST. */
function etMidnightAsUTC(etDateStr: string): Date {
  // Sample at noon UTC on that date — safely in the middle of the day so DST transitions
  // (which happen at 2am) don't cause off-by-one errors.
  const noonUTC = new Date(etDateStr + 'T12:00:00Z');
  const etHour = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      hour12: false,
    }).format(noonUTC),
    10
  );
  // etHour at UTC noon is 7 in EST (UTC−5) or 8 in EDT (UTC−4),
  // so the offset from UTC is (etHour − 12), e.g. −5 or −4.
  const offsetHours = etHour - 12;
  const utcMidnight = new Date(etDateStr + 'T00:00:00Z');
  return new Date(utcMidnight.getTime() - offsetHours * 3_600_000);
}

function windowStarts(): { day: Date; week: Date; month: Date } {
  const now = new Date();

  // Today's date in Eastern time as "YYYY-MM-DD"
  const todayET = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const [y, m, d] = todayET.split('-').map(Number);

  // Daily: today at midnight ET
  const day = etMidnightAsUTC(todayET);

  // Weekly: last Sunday (or today if it's Sunday) at midnight ET
  const etWeekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
  }).format(now);
  const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dowIndex = DOW.indexOf(etWeekday); // 0 = Sunday
  const sundayUTC = new Date(Date.UTC(y, m - 1, d - dowIndex));
  const sundayET = sundayUTC.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const week = etMidnightAsUTC(sundayET);

  // Monthly: 1st of this month at midnight ET
  const firstOfMonthET = `${todayET.slice(0, 7)}-01`;
  const month = etMidnightAsUTC(firstOfMonthET);

  return { day, week, month };
}

async function countSince(userId: string, since: Date, supabase: any): Promise<number> {
  const { count } = await supabase
    .from('ai_prompt_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('used_at', since.toISOString());
  return count ?? 0;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Read-only: return how many prompts the user has left in each window.
 * Does NOT record any usage. Used by the GET /api/ai/builder endpoint.
 */
export async function getUsageRemaining(
  userId: string,
  plan: UserPlan,
  subscriptionStartedAt: string | null,
  supabase: any,
  aiMultiplier: number = 1,
): Promise<UsageRemaining> {
  const startedAt = subscriptionStartedAt ? new Date(subscriptionStartedAt) : new Date(0);

  if (plan === 'free') {
    const used = await countSince(userId, startedAt, supabase);
    return { total: Math.max(0, FREE_LIMIT - used) };
  }

  const limits = getEffectiveLimits(plan, aiMultiplier);
  const { day, week, month } = windowStarts();

  const effectiveDay   = new Date(Math.max(startedAt.getTime(), day.getTime()));
  const effectiveWeek  = new Date(Math.max(startedAt.getTime(), week.getTime()));
  const effectiveMonth = new Date(Math.max(startedAt.getTime(), month.getTime()));

  const [usedDay, usedWeek, usedMonth] = await Promise.all([
    countSince(userId, effectiveDay,   supabase),
    countSince(userId, effectiveWeek,  supabase),
    countSince(userId, effectiveMonth, supabase),
  ]);

  return {
    day:   Math.max(0, limits.day   - usedDay),
    week:  Math.max(0, limits.week  - usedWeek),
    month: Math.max(0, limits.month - usedMonth),
  };
}

/**
 * Check limits then record usage if allowed.
 * Returns remaining counts AFTER this request (so the UI always stays in sync).
 */
export async function checkAndRecordUsage(
  userId: string,
  plan: UserPlan,
  subscriptionStartedAt: string | null,
  supabase: any,
  aiMultiplier: number = 1,
): Promise<RateLimitResult> {
  const startedAt = subscriptionStartedAt ? new Date(subscriptionStartedAt) : new Date(0);

  // ── Free plan ────────────────────────────────────────────────────────────
  if (plan === 'free') {
    const used = await countSince(userId, startedAt, supabase);

    if (used >= FREE_LIMIT) {
      return {
        allowed: false,
        message: `You've used all ${FREE_LIMIT} free AI Builder prompts. Subscribe to keep building!`,
        upgradeRequired: true,
        remaining: { total: 0 },
      };
    }

    await supabase.from('ai_prompt_usage').insert({ user_id: userId });
    return {
      allowed: true,
      message: '',
      remaining: { total: FREE_LIMIT - used - 1 },
    };
  }

  // ── Basic / Pro plans ────────────────────────────────────────────────────
  const limits = getEffectiveLimits(plan, aiMultiplier);
  const { day, week, month } = windowStarts();

  const effectiveDay   = new Date(Math.max(startedAt.getTime(), day.getTime()));
  const effectiveWeek  = new Date(Math.max(startedAt.getTime(), week.getTime()));
  const effectiveMonth = new Date(Math.max(startedAt.getTime(), month.getTime()));

  const [usedDay, usedWeek, usedMonth] = await Promise.all([
    countSince(userId, effectiveDay,   supabase),
    countSince(userId, effectiveWeek,  supabase),
    countSince(userId, effectiveMonth, supabase),
  ]);

  const remaining: UsageRemaining = {
    day:   Math.max(0, limits.day   - usedDay),
    week:  Math.max(0, limits.week  - usedWeek),
    month: Math.max(0, limits.month - usedMonth),
  };

  if (usedDay >= limits.day) {
    return {
      allowed: false,
      message: `You've reached your daily limit of ${limits.day} prompts. Try again tomorrow!`,
      remaining,
    };
  }
  if (usedWeek >= limits.week) {
    return {
      allowed: false,
      message: `You've reached your weekly limit of ${limits.week} prompts. Try again in a few days!`,
      remaining,
    };
  }
  if (usedMonth >= limits.month) {
    return {
      allowed: false,
      message: `You've reached your monthly limit of ${limits.month} prompts. Try again next month!`,
      remaining,
    };
  }

  await supabase.from('ai_prompt_usage').insert({ user_id: userId });

  return {
    allowed: true,
    message: '',
    remaining: {
      day:   remaining.day!   - 1,
      week:  remaining.week!  - 1,
      month: remaining.month! - 1,
    },
  };
}

/**
 * Delete the most recent usage row (called when the user cancels a request).
 */
export async function refundLastUsage(userId: string, supabase: any): Promise<void> {
  const { data } = await supabase
    .from('ai_prompt_usage')
    .select('id')
    .eq('user_id', userId)
    .order('used_at', { ascending: false })
    .limit(1)
    .single();

  if (data?.id) {
    await supabase.from('ai_prompt_usage').delete().eq('id', data.id);
  }
}

/** Anti-spam rate limit for cancel requests (5 per minute, in-memory). */
export function checkCancelRateLimit(userId: string): boolean {
  const now = Date.now();
  const timestamps = cancelRateLimitMap.get(userId) || [];
  const recent = timestamps.filter(t => now - t < CANCEL_RATE_LIMIT_MS);

  if (recent.length >= CANCEL_RATE_LIMIT_MAX) return false;

  recent.push(now);
  cancelRateLimitMap.set(userId, recent);
  return true;
}
