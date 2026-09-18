'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { recordNavEntry } from '@/lib/nav/history';

/**
 * Records every in-app page visit so back buttons can return to the page the
 * user actually came from rather than the previous browser-history entry, which
 * may be an external redirect (e.g. the Stripe billing portal).
 *
 * Reads the query string off `window` instead of `useSearchParams()` so mounting
 * this in the root layout doesn't opt the whole tree into client-side rendering.
 */
export default function NavHistoryTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    recordNavEntry(`${window.location.pathname}${window.location.search}`);
  }, [pathname]);

  return null;
}
