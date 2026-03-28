/**
 * Simple in-memory IP-based rate limiter for the contact form.
 * Limits: MAX_REQUESTS per WINDOW_MS per unique IP.
 *
 * Note: in-memory state resets on cold starts (serverless). This provides
 * basic protection — for stricter enforcement use Redis/Upstash.
 */

const MAX_REQUESTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();

/** Returns true if the IP is rate-limited (should be blocked). */
export function isContactRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count += 1;
  if (entry.count > MAX_REQUESTS) return true;

  return false;
}

/** Returns seconds until the rate limit resets for an IP. */
export function getRateLimitResetSecs(ip: string): number {
  const entry = store.get(ip);
  if (!entry) return 0;
  return Math.max(0, Math.ceil((entry.resetAt - Date.now()) / 1000));
}
