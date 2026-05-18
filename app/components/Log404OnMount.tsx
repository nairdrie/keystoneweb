'use client';

import { useEffect } from 'react';

/**
 * Fires a one-shot 404 log to /api/seo/log-404 on mount. Client component so
 * we can pull window.location reliably; the server can't see the rewritten
 * path after Next.js routes to the not-found boundary.
 */
export default function Log404OnMount() {
  useEffect(() => {
    try {
      const body = JSON.stringify({
        host: window.location.host,
        path: window.location.pathname,
        referrer: document.referrer || '',
      });
      const url = '/api/seo/log-404';
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      } else {
        fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
      }
    } catch {
      // Logging failure is never user-visible.
    }
  }, []);
  return null;
}
