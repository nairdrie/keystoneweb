'use client';

import { useEffect, useRef } from 'react';

/**
 * Client component injected into published sites.
 * Sends page view events to /api/sites/analytics/track.
 * Generates a session ID that resets after 30 min of inactivity.
 */
export default function SiteAnalyticsTracker({ siteId }: { siteId: string }) {
  const startTime = useRef(Date.now());

  useEffect(() => {
    // Get or create a session ID
    const SESSION_KEY = `ks_session_${siteId}`;
    const SESSION_TTL = 30 * 60 * 1000; // 30 minutes

    function getSessionId(): string {
      try {
        const stored = sessionStorage.getItem(SESSION_KEY);
        if (stored) {
          const { id, ts } = JSON.parse(stored);
          if (Date.now() - ts < SESSION_TTL) {
            // Refresh the timestamp
            sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id, ts: Date.now() }));
            return id;
          }
        }
      } catch { /* ignore */ }
      const id = crypto.randomUUID();
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id, ts: Date.now() }));
      } catch { /* ignore */ }
      return id;
    }

    const sessionId = getSessionId();

    // Fire the page view
    const payload = {
      siteId,
      pagePath: window.location.pathname,
      referrer: document.referrer || null,
      sessionId,
    };

    fetch('/api/sites/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {}); // fire-and-forget

    // Send duration on page unload via beacon
    const sendDuration = () => {
      const durationMs = Date.now() - startTime.current;
      if (durationMs < 500) return; // Ignore bounces under 500ms

      const data = JSON.stringify({
        siteId,
        pagePath: window.location.pathname,
        sessionId,
        durationMs,
      });

      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          '/api/sites/analytics/track',
          new Blob([data], { type: 'application/json' })
        );
      }
    };

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') sendDuration();
    });

    return () => {
      document.removeEventListener('visibilitychange', sendDuration);
    };
  }, [siteId]);

  return null;
}
