/**
 * Compare a site's stored business profile against the live Google Business
 * Profile data (fetched via Places API by placeId). Each diff entry includes a
 * short, action-oriented set of step-by-step instructions for the owner to fix
 * the inconsistency directly on business.google.com.
 *
 * No Places API key? The endpoint returns a single "manual review" entry that
 * still walks the user through opening their GBP and verifying each field.
 */

import type { BusinessProfile } from '@/lib/types/sites';

export interface GbpData {
  displayName?: string;
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  primaryType?: string;
  businessStatus?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] } | null;
  /** Some listings expose appointmentLinks; not always present in v1 */
  appointmentLinks?: string[];
}

export type DiffSeverity = 'critical' | 'warning' | 'info';

export interface GbpDiffEntry {
  id: string;
  severity: DiffSeverity;
  title: string;
  detail: string;
  steps: string[];
}

interface BuildDiffInput {
  siteUrl: string;
  siteProfile: BusinessProfile | null;
  gbp: GbpData | null;
}

function normalizeUrl(u?: string | null): string {
  if (!u) return '';
  return u.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase().replace(/^www\./, '');
}

function normalizePhone(p?: string | null): string {
  return (p || '').replace(/\D/g, '');
}

export function buildGbpDiff({ siteUrl, siteProfile, gbp }: BuildDiffInput): GbpDiffEntry[] {
  const entries: GbpDiffEntry[] = [];

  if (!gbp) {
    entries.push({
      id: 'no-gbp',
      severity: 'info',
      title: 'No Google Business Profile linked',
      detail:
        'Without a verified Google Business Profile, you miss out on the Local Pack, Knowledge Panel, and Google Maps results — which is where most local customers find businesses.',
      steps: [
        'Open https://www.google.com/business and sign in with your business Google account.',
        'Click "Add your business to Google" and search for your business by name and address.',
        'If you find it, claim it. If you don\'t, create a new profile.',
        'Verify ownership (by postcard, phone, or video call depending on your category).',
        'Once verified, return to /admin/seo → Site, click "Find on Google", and link this site to that profile.',
      ],
    });
    return entries;
  }

  // ── Website mismatch ─────────────────────────────────────
  if (gbp.websiteUri && siteUrl) {
    const gbpUrl = normalizeUrl(gbp.websiteUri);
    const ourUrl = normalizeUrl(siteUrl);
    if (gbpUrl && ourUrl && gbpUrl !== ourUrl) {
      entries.push({
        id: 'website-mismatch',
        severity: 'critical',
        title: 'Google Business Profile website is wrong',
        detail: `Your GBP currently lists "${gbp.websiteUri}". This site is at ${siteUrl}. Visitors clicking "Website" from your Google listing are going somewhere else.`,
        steps: [
          'Open https://business.google.com and select your business.',
          'Click "Edit profile" → "Contact" → "Website".',
          `Replace the current value with: ${siteUrl}`,
          'Click Save. Google typically reviews edits within 1–3 days.',
        ],
      });
    }
  } else if (!gbp.websiteUri && siteUrl) {
    entries.push({
      id: 'website-missing',
      severity: 'critical',
      title: 'No website set on your Google Business Profile',
      detail: 'GBP has no Website field set. Most "Website" clicks on Google never reach you.',
      steps: [
        'Open https://business.google.com and select your business.',
        'Click "Edit profile" → "Contact" → "Website".',
        `Enter: ${siteUrl}`,
        'Save and wait for Google to review (1–3 days).',
      ],
    });
  }

  // ── Phone mismatch ────────────────────────────────────────
  if (siteProfile?.telephone && gbp.nationalPhoneNumber) {
    const sitePhone = normalizePhone(siteProfile.telephone);
    const gbpPhone = normalizePhone(gbp.nationalPhoneNumber);
    if (sitePhone && gbpPhone && sitePhone !== gbpPhone) {
      entries.push({
        id: 'phone-mismatch',
        severity: 'warning',
        title: 'Phone number differs between site and GBP',
        detail: `Your site lists ${siteProfile.telephone}. Your GBP lists ${gbp.nationalPhoneNumber}. NAP (Name, Address, Phone) consistency is a key local-SEO ranking signal.`,
        steps: [
          'Decide which is the correct primary number.',
          'On https://business.google.com, edit "Contact" → "Phone" if the GBP value is wrong.',
          'Or edit /admin/seo → Site → telephone if the site value is wrong.',
          'Re-publish your site after fixing.',
        ],
      });
    }
  }

  // ── Address mismatch ──────────────────────────────────────
  if (siteProfile?.streetAddress && gbp.formattedAddress) {
    const siteAddr = `${siteProfile.streetAddress} ${siteProfile.addressLocality}`.toLowerCase().replace(/\s+/g, ' ').trim();
    const gbpAddr = (gbp.formattedAddress || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!gbpAddr.includes(siteAddr.split(',')[0]) && !siteAddr.includes(gbpAddr.split(',')[0])) {
      entries.push({
        id: 'address-mismatch',
        severity: 'warning',
        title: 'Address may differ between site and GBP',
        detail: `Site: ${siteProfile.streetAddress}, ${siteProfile.addressLocality}. GBP: ${gbp.formattedAddress}.`,
        steps: [
          'Visit https://business.google.com → "Edit profile" → "Location".',
          'Confirm the pin is correct on the map.',
          'If your site address is correct, edit GBP to match.',
          'If GBP is correct, update /admin/seo → Site → address.',
        ],
      });
    }
  }

  // ── Appointment links (the original issue) ────────────────
  if (gbp.appointmentLinks?.length) {
    const hasOurUrl = gbp.appointmentLinks.some(l => normalizeUrl(l) === normalizeUrl(siteUrl));
    if (!hasOurUrl) {
      entries.push({
        id: 'appointment-link-elsewhere',
        severity: 'warning',
        title: 'Your "Book online" button points somewhere else',
        detail: `GBP has appointment links set, but none point to ${siteUrl}. If you want bookings to flow through your own site, update this.`,
        steps: [
          'Open https://business.google.com and select your business.',
          'Click "Bookings" or "Appointments" in the left sidebar.',
          'Remove the third-party link if appropriate.',
          `Add your booking page: ${siteUrl}/contact or ${siteUrl}/book`,
          'Save and wait for Google to re-index (a few hours).',
        ],
      });
    }
  }

  // ── Hours missing on GBP ─────────────────────────────────
  if (!gbp.regularOpeningHours?.weekdayDescriptions?.length) {
    entries.push({
      id: 'hours-missing-gbp',
      severity: 'warning',
      title: 'Hours not set on Google Business Profile',
      detail: 'Hours missing from GBP means Google may show "Hours unknown" — customers often skip past unknown-hours listings.',
      steps: [
        'Open https://business.google.com → "Edit profile" → "Hours".',
        'Enter open/close times for each day.',
        'Add any special holiday hours under "More hours".',
      ],
    });
  }

  // ── Business status ───────────────────────────────────────
  if (gbp.businessStatus && gbp.businessStatus !== 'OPERATIONAL') {
    entries.push({
      id: 'business-status',
      severity: 'critical',
      title: `Google has your status as "${gbp.businessStatus}"`,
      detail: 'Google has flagged your listing as not currently operational. This kills local discovery.',
      steps: [
        'Open https://business.google.com → "Edit profile".',
        'If you\'re open, switch the status to "Open" / "Operational".',
        'If permanently closed but reopened under new ownership, you may need to claim or re-verify.',
      ],
    });
  }

  if (entries.length === 0) {
    entries.push({
      id: 'all-clear',
      severity: 'info',
      title: 'Google Business Profile looks consistent',
      detail: 'All checks against the live GBP data passed. Re-run periodically — Google sometimes auto-edits listings based on user feedback.',
      steps: [
        'Add fresh photos to your GBP at least monthly (boosts engagement signals).',
        'Reply to new reviews within 48 hours.',
        'Post a weekly update through GBP\'s "Posts" feature for active-listing signals.',
      ],
    });
  }

  return entries;
}
