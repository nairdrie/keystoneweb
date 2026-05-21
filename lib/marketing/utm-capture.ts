/**
 * Client-side UTM capture for customer sites.
 *
 * Call `captureMarketingTracking()` once at page load on a published site. It
 * extracts utm_* params from the URL and persists them to sessionStorage so
 * later form/booking/order submissions can attribute the conversion back to
 * the campaign that drove the visit.
 *
 * Call `getMarketingTracking()` from any submit handler to read the merged
 * object (URL > sessionStorage). Pass the result to the server in the
 * submission payload as `tracking` — the API routes pick out
 * `tracking.utm_campaign` and store it as `marketing_campaign_id`.
 */

const KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;
type UtmKey = (typeof KEYS)[number];

export type MarketingTracking = Partial<Record<UtmKey, string>> & {
  landingPageUrl?: string;
  referrer?: string;
  currentPageUrl?: string;
};

const SS_PREFIX = 'ks_';
const LANDING_KEY = 'ks_landing_page';

export function captureMarketingTracking(): MarketingTracking {
  if (typeof window === 'undefined') return {};

  const url = new URL(window.location.href);
  const out: MarketingTracking = {};

  for (const key of KEYS) {
    const fromUrl = url.searchParams.get(key);
    if (fromUrl) {
      window.sessionStorage.setItem(SS_PREFIX + key, fromUrl);
      out[key] = fromUrl;
    } else {
      const stored = window.sessionStorage.getItem(SS_PREFIX + key);
      if (stored) out[key] = stored;
    }
  }

  const stored = window.sessionStorage.getItem(LANDING_KEY);
  const landing = stored || window.location.href;
  if (!stored) window.sessionStorage.setItem(LANDING_KEY, landing);
  out.landingPageUrl = landing;

  if (document.referrer && !document.referrer.includes(window.location.host)) {
    out.referrer = document.referrer;
  }
  out.currentPageUrl = window.location.href;
  return out;
}

export function getMarketingTracking(): MarketingTracking {
  if (typeof window === 'undefined') return {};
  const out: MarketingTracking = {};
  for (const key of KEYS) {
    const v = window.sessionStorage.getItem(SS_PREFIX + key);
    if (v) out[key] = v;
  }
  const landing = window.sessionStorage.getItem(LANDING_KEY);
  if (landing) out.landingPageUrl = landing;
  if (typeof document !== 'undefined' && document.referrer && !document.referrer.includes(window.location.host)) {
    out.referrer = document.referrer;
  }
  if (typeof window !== 'undefined') out.currentPageUrl = window.location.href;
  return out;
}

/** Extract the marketing campaign id from a tracking object (utm_campaign is a uuid). */
export function getMarketingCampaignIdFromTracking(t: MarketingTracking | undefined | null): string | null {
  const id = t?.utm_campaign;
  if (!id) return null;
  // Basic UUID v4-ish shape check so we don't store junk in our FK column.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  return id;
}
