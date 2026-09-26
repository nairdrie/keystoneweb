import { randomBytes } from 'crypto';
import { APP_URL, PUBLISHED_ROOT } from '@/lib/env/domain';

export interface SiteUrlFields {
  custom_domain?: string | null;
  published_domain?: string | null;
  is_published?: boolean | null;
}

/**
 * Where customer-facing pages live: the shop's own domain when the site is
 * published, otherwise the main app domain. Every one of these hosts routes
 * /shop-doc/<token> to the same page.
 */
export function siteBaseUrl(site: SiteUrlFields): string {
  if (site.is_published && site.custom_domain) return `https://${site.custom_domain}`;
  if (site.is_published && site.published_domain) return `https://${site.published_domain}.${PUBLISHED_ROOT}`;
  return APP_URL;
}

export function docUrl(site: SiteUrlFields, token: string): string {
  return `${siteBaseUrl(site)}/shop-doc/${token}`;
}

export function newPublicToken(): string {
  return randomBytes(24).toString('base64url');
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newTechCode(): string {
  const bytes = randomBytes(6);
  return Array.from(bytes, b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}
