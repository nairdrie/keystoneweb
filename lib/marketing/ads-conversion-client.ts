/**
 * Browser-side Google Ads conversion firing.
 *
 * The published site injects the account's Google tag and stashes the per-site
 * conversion config on `window.__ksAdsConfig` (see SiteConversionTracking).
 * Any client component can then call `fireAdsConversion(type)` at the moment a
 * conversion happens (form submit success, tel: click, booking/order confirmed).
 *
 * All functions are no-ops off the browser or when the site has no conversion
 * config, so callers never need to guard.
 */

import type { ConversionEventType, SiteConversionConfig } from './conversions';
import { buildSendTo } from './conversions';

declare global {
  interface Window {
    __ksAdsConfig?: SiteConversionConfig;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** Load the Google tag (gtag.js) once and configure the account. Idempotent. */
export function ensureGoogleAdsTag(config: SiteConversionConfig): void {
  if (typeof window === 'undefined' || !config.conversionId) return;
  window.__ksAdsConfig = config;
  if (typeof window.gtag === 'function') return; // already loaded

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // gtag.js reads dataLayer entries as arguments objects — push it verbatim.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', config.conversionId);

  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(config.conversionId)}`;
  document.head.appendChild(s);
}

/**
 * Fire a Google Ads conversion for `type`. No-op unless the site has a
 * conversion id and a label for that event, so callers can fire unconditionally.
 * Pass `value`/`currency` for revenue-bearing conversions (orders, bookings).
 */
export function fireAdsConversion(
  type: ConversionEventType,
  opts?: { value?: number; currency?: string },
): void {
  if (typeof window === 'undefined') return;
  const cfg = window.__ksAdsConfig;
  const label = cfg?.labels?.[type];
  if (!cfg?.conversionId || !label || typeof window.gtag !== 'function') return;

  const params: Record<string, unknown> = { send_to: buildSendTo(cfg.conversionId, label) };
  if (opts?.value != null) {
    params.value = opts.value;
    params.currency = opts.currency || 'CAD';
  }
  window.gtag('event', 'conversion', params);
}
