'use client';

import { useEffect } from 'react';
import {
  captureMarketingTracking,
  getMarketingTracking,
  getMarketingCampaignIdFromTracking,
} from '@/lib/marketing/utm-capture';
import { ensureGoogleAdsTag, fireAdsConversion } from '@/lib/marketing/ads-conversion-client';
import { isConversionTrackingActive, type SiteConversionConfig } from '@/lib/marketing/conversions';

/**
 * Mounted once per published site (in the site layout). Three jobs:
 *
 *  1. Capture utm_* on landing so every downstream conversion can be attributed.
 *     (This capture was previously never invoked, so attribution silently broke.)
 *  2. Load the Google Ads tag when the site has conversion tracking configured.
 *  3. Delegate tel: link clicks to a "call" conversion — fired to Google Ads and
 *     recorded in Keystone (only when the visit is attributed to a campaign).
 */
export default function SiteConversionTracking({
  siteId,
  config,
}: {
  siteId: string;
  config: SiteConversionConfig | null;
}) {
  useEffect(() => {
    // 1. Persist marketing tracking from the landing URL.
    captureMarketingTracking();

    // 2. Google tag, only when the site has been set up.
    const active = isConversionTrackingActive(config);
    if (active && config) ensureGoogleAdsTag(config);

    // 3. Delegated tel: click → call conversion.
    const onClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      const anchor = el?.closest?.('a[href^="tel:"]') as HTMLAnchorElement | null;
      if (!anchor) return;

      if (active) fireAdsConversion('call');

      // Record for Keystone-side counting — only for ad-attributed visits.
      const campaignId = getMarketingCampaignIdFromTracking(getMarketingTracking());
      if (campaignId && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const payload = JSON.stringify({
          siteId,
          type: 'call',
          campaignId,
          href: anchor.getAttribute('href'),
        });
        navigator.sendBeacon(
          '/api/sites/conversions/track',
          new Blob([payload], { type: 'application/json' }),
        );
      }
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [siteId, config]);

  return null;
}
