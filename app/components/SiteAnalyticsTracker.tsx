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
    const pagePath = window.location.pathname;

    // Throttle: skip the page-view call if this exact page was tracked
    // within the last 5 seconds (prevents double-fires from React Strict
    // Mode, fast navigations, and re-renders).
    const THROTTLE_KEY = `ks_track_${siteId}`;
    const THROTTLE_MS = 5000;
    let shouldTrack = true;
    try {
      const prev = sessionStorage.getItem(THROTTLE_KEY);
      if (prev) {
        const { path, ts } = JSON.parse(prev);
        if (path === pagePath && Date.now() - ts < THROTTLE_MS) {
          shouldTrack = false;
        }
      }
    } catch { /* ignore */ }

    let idleHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    if (shouldTrack) {
      try {
        sessionStorage.setItem(THROTTLE_KEY, JSON.stringify({ path: pagePath, ts: Date.now() }));
      } catch { /* ignore */ }

      // Fire the page view, but defer it so it doesn't compete with LCP
      // fetches (fonts, hero image, etc.). requestIdleCallback runs after
      // the browser is done with critical work; the setTimeout fallback
      // covers Safari, which still doesn't ship rIC.
      const sendPageView = () => {
        const payload = {
          siteId,
          pagePath,
          referrer: document.referrer || null,
          sessionId,
        };
        fetch('/api/sites/analytics/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(() => {}); // fire-and-forget
      };

      const ric = (window as any).requestIdleCallback as
        | ((cb: () => void, opts?: { timeout: number }) => number)
        | undefined;
      if (typeof ric === 'function') {
        idleHandle = ric(sendPageView, { timeout: 3000 });
      } else {
        timeoutHandle = setTimeout(sendPageView, 1500);
      }
    }

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
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (idleHandle != null && typeof (window as any).cancelIdleCallback === 'function') {
        (window as any).cancelIdleCallback(idleHandle);
      }
    };
  }, [siteId]);

  return null;
}
