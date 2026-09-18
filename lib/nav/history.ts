/**
 * A small in-app breadcrumb of the pages the user has visited this tab.
 *
 * `router.back()` walks the browser's history, which includes off-site
 * round-trips: after Settings → Stripe portal → Settings, going "back" lands on
 * the portal, which immediately bounces the user to Settings again. This trail
 * records only our own pages, so a back button can return to the page the user
 * was actually on before (the admin panel, say) instead of the last history
 * entry.
 *
 * Stored in sessionStorage: per-tab, survives the full page load that Stripe's
 * return_url triggers, and gone when the tab closes.
 */

const STORAGE_KEY = 'ks:nav:trail';
const MAX_ENTRIES = 12;

function readTrail(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === 'string') : [];
  } catch {
    // Private browsing / storage disabled — the trail is a convenience, not a requirement.
    return [];
  }
}

function pathOf(entry: string): string {
  const queryStart = entry.search(/[?#]/);
  return queryStart === -1 ? entry : entry.slice(0, queryStart);
}

/** Append a page to the trail. Consecutive visits to the same path collapse into one. */
export function recordNavEntry(entry: string): void {
  if (typeof window === 'undefined' || !entry.startsWith('/')) return;
  const trail = readTrail();
  if (trail.length && pathOf(trail[trail.length - 1]) === pathOf(entry)) {
    trail[trail.length - 1] = entry;
  } else {
    trail.push(entry);
  }
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(trail.slice(-MAX_ENTRIES)));
  } catch {
    // Ignore quota / disabled storage.
  }
}

/**
 * The most recent page that isn't `currentPath`, or `fallback` when the user
 * arrived here directly.
 */
export function previousNavEntry(currentPath: string, fallback: string): string {
  const trail = readTrail();
  for (let i = trail.length - 1; i >= 0; i -= 1) {
    if (pathOf(trail[i]) !== currentPath) return trail[i];
  }
  return fallback;
}
