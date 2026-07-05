/**
 * Google Ads conversion tracking — shared, pure definitions.
 *
 * Keystone auto-provisions a set of conversion actions in each customer's Google
 * Ads sub-account and injects the account's Google tag into the site. Site events
 * (a tel: click, a quote-form submit, a booking, an order, a signup) then fire the
 * matching conversion so they show up in BOTH the Google Ads dashboard and the
 * Keystone campaign page.
 *
 * This module holds only pure data/logic (the event catalogue + snippet parsing)
 * so it can be shared by the server (google-ads.ts creates the actions) and the
 * client (fires the events), and unit-tested without a live Google account.
 */

/** The site actions we treat as conversions, in priority order. */
export type ConversionEventType = 'call' | 'lead_form' | 'booking' | 'order' | 'signup';

export const CONVERSION_EVENT_TYPES: ConversionEventType[] = [
  'call', 'lead_form', 'booking', 'order', 'signup',
];

export interface ConversionActionSpec {
  /** Stable display name in Google Ads. Also our dedupe key when provisioning. */
  name: string;
  /** Google Ads ConversionActionCategory. */
  category: string;
  /** ONE_PER_CLICK for leads (one call/form per visit); MANY_PER_CLICK for sales. */
  countingType: 'ONE_PER_CLICK' | 'MANY_PER_CLICK';
  /** Whether this action carries monetary value (order/booking revenue). */
  hasValue: boolean;
}

/**
 * The canonical conversion action per event type. Names are prefixed so they're
 * recognizable (and dedupe-able) inside a customer's account, which may also hold
 * conversion actions the customer created themselves.
 */
export const CONVERSION_ACTION_SPECS: Record<ConversionEventType, ConversionActionSpec> = {
  call:      { name: 'Keystone – Phone call click', category: 'PHONE_CALL_LEAD',  countingType: 'ONE_PER_CLICK',  hasValue: false },
  lead_form: { name: 'Keystone – Lead form',        category: 'SUBMIT_LEAD_FORM', countingType: 'ONE_PER_CLICK',  hasValue: false },
  booking:   { name: 'Keystone – Booking',          category: 'BOOK_APPOINTMENT', countingType: 'ONE_PER_CLICK',  hasValue: true  },
  order:     { name: 'Keystone – Purchase',         category: 'PURCHASE',         countingType: 'MANY_PER_CLICK', hasValue: true  },
  signup:    { name: 'Keystone – Signup',           category: 'SIGNUP',           countingType: 'ONE_PER_CLICK',  hasValue: false },
};

/**
 * Per-site conversion config we persist (sites.google_ads_conversion_id +
 * sites.google_ads_conversion_labels) and hand to the browser so gtag can fire.
 */
export interface SiteConversionConfig {
  /** Account-level Google tag id, e.g. "AW-18264425836". */
  conversionId: string;
  /** event type → conversion label (the part after the slash in send_to). */
  labels: Partial<Record<ConversionEventType, string>>;
}

/** Normalize a raw account id to the "AW-1234567890" form gtag expects. */
export function normalizeConversionId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).match(/(\d{6,})/);
  return digits ? `AW-${digits[1]}` : null;
}

/** Build the gtag `send_to` target for an event: "AW-123456789/AbCdEf". */
export function buildSendTo(conversionId: string, label: string): string {
  return `${conversionId}/${label}`;
}

/**
 * Extract the conversion label from a Google Ads event snippet (the block
 * `conversion_action.tag_snippets[].event_snippet` returns). The snippet embeds
 * `'send_to': 'AW-123456789/AbC-D_efGhIj'` — we want the label after the slash.
 */
export function parseConversionLabelFromSnippet(snippet: string | null | undefined): string | null {
  if (!snippet) return null;
  const m = snippet.match(/send_to['"]?\s*:\s*['"]AW-\d+\/([A-Za-z0-9_-]+)['"]/);
  return m ? m[1] : null;
}

/** True when a site has enough config to fire at least one conversion. */
export function isConversionTrackingActive(config: SiteConversionConfig | null | undefined): boolean {
  return !!config?.conversionId && !!config.labels && Object.keys(config.labels).length > 0;
}

/**
 * Build the client-facing conversion config from a raw `sites` row. Returns null
 * when the site has no (valid) conversion id, so callers render nothing.
 */
export function buildSiteConversionConfig(row: {
  google_ads_conversion_id?: string | null;
  google_ads_conversion_labels?: Record<string, string> | null;
} | null | undefined): SiteConversionConfig | null {
  const conversionId = normalizeConversionId(row?.google_ads_conversion_id);
  if (!conversionId) return null;
  return {
    conversionId,
    labels: (row?.google_ads_conversion_labels || {}) as SiteConversionConfig['labels'],
  };
}
