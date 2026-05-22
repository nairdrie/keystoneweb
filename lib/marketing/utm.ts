/**
 * UTM tagging for ad final URLs.
 *
 * Every click from a Keystone-managed campaign lands on the customer's site
 * with these query params so we can attribute conversions back to the campaign:
 *
 *   utm_source=keystone
 *   utm_medium=cpc | display | email | social
 *   utm_campaign=<marketing_campaigns.id>
 *
 * The site-side capture (lib/marketing/utm-capture.ts) reads these on landing,
 * persists them to sessionStorage, and merges them into form submissions so
 * the conversion can be attributed even after the visitor navigates around.
 */

import type { MarketingChannel, CampaignType } from './types';

export const UTM_SOURCE = 'keystone';

export function utmMediumFor(channel: MarketingChannel, campaignType: CampaignType): string {
  if (channel === 'google_ads') return campaignType === 'display' ? 'display' : 'cpc';
  if (channel === 'meta_ads') return 'social';
  if (channel === 'email') return 'email';
  return 'cpc';
}

export interface UtmParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

/** Append UTM params to a URL. Existing utm_* params on the URL win — we never overwrite. */
export function withUtm(rawUrl: string, params: UtmParams): string {
  if (!rawUrl) return rawUrl;
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    // Fall back to treating it as a relative or malformed URL — just return unchanged.
    return rawUrl;
  }
  for (const [k, v] of Object.entries(params)) {
    if (!v) continue;
    if (!u.searchParams.has(k)) {
      u.searchParams.set(k, v);
    }
  }
  return u.toString();
}

/** Build the canonical UTM-tagged URL for a given campaign. */
export function buildCampaignFinalUrl(
  finalUrl: string,
  campaignId: string,
  channel: MarketingChannel,
  campaignType: CampaignType,
): string {
  return withUtm(finalUrl, {
    utm_source: UTM_SOURCE,
    utm_medium: utmMediumFor(channel, campaignType),
    utm_campaign: campaignId,
  });
}
