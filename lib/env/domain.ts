/**
 * Single source of truth for environment-specific domain config.
 *
 * Production deploy:
 *   app          → keystoneweb.ca
 *   ops          → ops.keystoneweb.ca
 *   published    → *.kswd.ca
 *   custom CNAME → sites.kswd.ca
 *
 * Staging deploy:
 *   app          → staging.keystoneweb.ca
 *   ops          → ops.staging.keystoneweb.ca
 *   published    → *.staging.kswd.ca
 *   custom CNAME → sites.staging.kswd.ca
 *
 * Set DEPLOY_ENV=staging on the staging Vercel project (or point
 * NEXT_PUBLIC_APP_URL at https://staging.keystoneweb.ca).
 */

const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

export const IS_STAGING =
  process.env.DEPLOY_ENV === 'staging' ||
  appUrl.includes('staging.keystoneweb.ca');

export const IS_PRODUCTION_DEPLOY = process.env.NODE_ENV === 'production';

export const BASE_DOMAIN = IS_STAGING ? 'staging.keystoneweb.ca' : 'keystoneweb.ca';
export const OPS_DOMAIN = `ops.${BASE_DOMAIN}`;
export const PUBLISHED_ROOT = IS_STAGING ? 'staging.kswd.ca' : 'kswd.ca';
export const CUSTOM_DOMAIN_CNAME_TARGET = `sites.${PUBLISHED_ROOT}`;

// Cookies scope to this domain in production so that auth is shared across
// BASE_DOMAIN + its subdomains (ops.*, etc.) but NOT across prod and staging.
export const COOKIE_DOMAIN = IS_PRODUCTION_DEPLOY ? `.${BASE_DOMAIN}` : undefined;

export const APP_URL = appUrl || `https://${BASE_DOMAIN}`;
export const OPS_URL = `https://${OPS_DOMAIN}`;

export interface ParsedHost {
  kind: 'app' | 'ops' | 'published' | 'custom';
  /** Published-site subdomain (e.g. 'akdesigns' from 'akdesigns.kswd.ca'). */
  subdomain?: string;
  /** Custom-domain with www. stripped. */
  cleanDomain?: string;
}

/**
 * Classify an incoming Host header into the routing role it should take,
 * scoped to the current deploy environment.
 */
export function parseHost(hostname: string): ParsedHost {
  const host = hostname.split(':')[0].toLowerCase();

  if (host === OPS_DOMAIN) {
    return { kind: 'ops' };
  }

  const publishedSuffix = `.${PUBLISHED_ROOT}`;
  if (host.endsWith(publishedSuffix) && !host.startsWith('www.')) {
    const subdomain = host.slice(0, -publishedSuffix.length);
    // Reject multi-level subdomains so a prod deploy receiving
    // 'foo.staging.kswd.ca' doesn't treat 'foo.staging' as a site slug.
    if (subdomain && !subdomain.includes('.')) {
      return { kind: 'published', subdomain };
    }
  }

  if (
    host === BASE_DOMAIN ||
    host === `www.${BASE_DOMAIN}` ||
    host === 'keystoneweb.com' ||
    host.includes('localhost') ||
    host.endsWith('.vercel.app') ||
    host.startsWith('app.') ||
    host.startsWith('127.0.0.1')
  ) {
    return { kind: 'app' };
  }

  const cleanDomain = host.startsWith('www.') ? host.slice(4) : host;
  return { kind: 'custom', cleanDomain };
}
