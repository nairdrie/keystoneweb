/**
 * Resolves a UCP siteId param into the merchant context the endpoints need:
 *   - Supabase row for the site
 *   - public site URL (custom domain or subdomain)
 *   - business profile (for Merchant of Record disclosure)
 *
 * Centralized so each UCP endpoint stays focused on protocol behavior.
 */

import { createAdminClient } from '@/lib/db/supabase-admin';

export interface UcpSiteContext {
  siteId: string;
  siteUrl: string;
  storefrontUrl: string;
  currency: string;
  businessName: string;
  legalEntity: string | null;
  isPublished: boolean;
}

export async function loadUcpSiteContext(siteId: string): Promise<UcpSiteContext | null> {
  const admin = createAdminClient();
  const [{ data: site, error }, { data: settings }] = await Promise.all([
    admin
      .from('sites')
      .select('id, custom_domain, subdomain, is_published, business_profile, published_data')
      .eq('id', siteId)
      .maybeSingle(),
    admin
      .from('ecommerce_settings')
      .select('site_id, tax_enabled, tax_rate_bps')
      .eq('site_id', siteId)
      .maybeSingle(),
  ]);

  if (error || !site) return null;

  const domain = site.custom_domain || null;
  const subdomain = site.subdomain || null;
  const storefrontUrl = domain
    ? `https://${domain.replace(/^www\./, '')}`
    : subdomain
      ? `https://${subdomain}.${process.env.NEXT_PUBLIC_APP_DOMAIN || 'localhost'}`
      : '';

  const businessProfile = (site.business_profile || {}) as { legalName?: string; tradeName?: string };
  const designData = (site.published_data || {}) as { siteTitle?: string };
  // Currency is stored on individual products; settings only carries tax config.
  void settings;

  return {
    siteId: site.id,
    siteUrl: storefrontUrl,
    storefrontUrl,
    currency: 'USD',
    businessName: businessProfile.tradeName || businessProfile.legalName || designData.siteTitle || (domain ?? 'Merchant'),
    legalEntity: businessProfile.legalName ?? null,
    isPublished: !!site.is_published,
  };
}
