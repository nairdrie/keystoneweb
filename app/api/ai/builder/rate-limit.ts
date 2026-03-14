// ---- In-memory rate limiter ----
// Tracks per-user request timestamps. Automatically cleans up old entries.
// Pro limits: 1 request per 10 seconds, 20 per hour, 30 per day.
// Basic limits: 3 requests per day.

const RATE_LIMIT_COOLDOWN_MS = 10_000;   // 10 seconds between requests
const RATE_LIMIT_HOURLY_MAX = 20;
const RATE_LIMIT_HOUR_MS = 60 * 60 * 1000;
const RATE_LIMIT_DAY_MAX = 30;
const RATE_LIMIT_BASIC_DAY_MAX = 3;
const RATE_LIMIT_DAY_MS = 24 * 60 * 60 * 1000;

const rateLimitMap = new Map<string, number[]>();

// Anti-spam for cancel requests: max 5 cancels per minute
const CANCEL_RATE_LIMIT_MAX = 5;
const CANCEL_RATE_LIMIT_MS = 60 * 1000;
const cancelRateLimitMap = new Map<string, number[]>();

export function checkRateLimit(userId: string, isBasicPlan: boolean): { allowed: boolean; message: string; upgradeRequired?: boolean } {
  const now = Date.now();
  const timestamps = rateLimitMap.get(userId) || [];

  // prune entries older than 1 day
  const requestsInDay = timestamps.filter(t => now - t < RATE_LIMIT_DAY_MS);

  // Basic plan: 3 requests per day
  if (isBasicPlan) {
    if (requestsInDay.length >= RATE_LIMIT_BASIC_DAY_MAX) {
      return {
        allowed: false,
        message: `You've used all ${RATE_LIMIT_BASIC_DAY_MAX} daily AI Builder prompts on the Basic plan. Upgrade to Pro for increased limits!`,
        upgradeRequired: true,
      };
    }

    // Record and allow
    requestsInDay.push(now);
    rateLimitMap.set(userId, requestsInDay);
    return { allowed: true, message: '' };
  }

  // Pro plan limits below
  // Check daily cap
  if (requestsInDay.length >= RATE_LIMIT_DAY_MAX) {
    return { allowed: false, message: `You've reached the daily limit (${RATE_LIMIT_DAY_MAX} requests). Please try again later.` };
  }

  // Prune entries older than 1 hour
  const requestsInHour = timestamps.filter(t => now - t < RATE_LIMIT_HOUR_MS);

  // Check cooldown (last request within 10s)
  if (requestsInHour.length > 0 && now - requestsInHour[requestsInHour.length - 1] < RATE_LIMIT_COOLDOWN_MS) {
    return { allowed: false, message: 'Please wait a few seconds before sending another request.' };
  }

  // Check hourly cap
  if (requestsInHour.length >= RATE_LIMIT_HOURLY_MAX) {
    return { allowed: false, message: `You've reached the hourly limit (${RATE_LIMIT_HOURLY_MAX} requests). Please try again later.` };
  }

  // Record this request
  requestsInHour.push(now);
  rateLimitMap.set(userId, requestsInHour);

  // Periodic cleanup: remove users with no recent activity (every ~100 requests)
  if (Math.random() < 0.01) {
    for (const [uid, ts] of rateLimitMap) {
      if (ts.every(t => now - t >= RATE_LIMIT_HOUR_MS)) {
        rateLimitMap.delete(uid);
      }
    }
  }

  return { allowed: true, message: '' };
}

/** Remove the most recent rate limit entry for a user (used when they cancel a request) */
export function refundLastRateLimitEntry(userId: string): void {
  const timestamps = rateLimitMap.get(userId);
  if (!timestamps || timestamps.length === 0) return;

  // Remove the last (most recent) entry
  timestamps.pop();
  if (timestamps.length === 0) {
    rateLimitMap.delete(userId);
  } else {
    rateLimitMap.set(userId, timestamps);
  }
}

/** Anti-spam rate limit for cancel requests (5 per minute) */
export function checkCancelRateLimit(userId: string): boolean {
  const now = Date.now();
  const timestamps = cancelRateLimitMap.get(userId) || [];
  const recent = timestamps.filter(t => now - t < CANCEL_RATE_LIMIT_MS);

  if (recent.length >= CANCEL_RATE_LIMIT_MAX) {
    return false;
  }

  recent.push(now);
  cancelRateLimitMap.set(userId, recent);
  return true;
}
