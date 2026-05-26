/**
 * Google Ads Sub-account Provisioning
 *
 * Each site gets its own Google Ads customer ID under our MCC. Provisioned
 * lazily — first campaign launch triggers `ensureGoogleAdsSubAccount(siteId)`.
 *
 * Implementation note: the google-ads-api package's `createCustomerClient` is
 * called against the MCC manager customer. The result is a new client customer
 * ID that inherits consolidated billing from the MCC payment profile.
 */

import { createAdminClient } from '@/lib/db/supabase-admin';

interface SiteRow {
  id: string;
  google_ads_customer_id: string | null;
  site_slug: string | null;
  design_data: { siteTitle?: string } | null;
}

function getConfig() {
  return {
    developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
    clientId: process.env.GOOGLE_ADS_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET || '',
    managerCustomerId: process.env.GOOGLE_ADS_MANAGER_CUSTOMER_ID || '',
    refreshToken: process.env.GOOGLE_ADS_REFRESH_TOKEN || '',
  };
}

function isConfigured(): boolean {
  const c = getConfig();
  return !!(c.developerToken && c.clientId && c.clientSecret && c.managerCustomerId && c.refreshToken);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _GoogleAdsApi: any = null;

async function getMccCustomer() {
  if (!isConfigured()) {
    throw new Error('Google Ads MCC is not configured (missing dev token, OAuth, manager customer id, or refresh token).');
  }
  const cfg = getConfig();
  if (!_GoogleAdsApi) {
    const mod = await import('google-ads-api');
    _GoogleAdsApi = mod.GoogleAdsApi;
  }
  const api = new _GoogleAdsApi({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    developer_token: cfg.developerToken,
  });
  return api.Customer({
    customer_id: cfg.managerCustomerId,
    refresh_token: cfg.refreshToken,
    login_customer_id: cfg.managerCustomerId,
  });
}

/**
 * Ensure this site has its own Google Ads sub-account under our MCC. Returns
 * the customer ID. Safe to call repeatedly — provisioning happens only once
 * per site.
 *
 * The sub-account inherits consolidated billing from the MCC payment profile,
 * so no per-customer Google billing setup is needed.
 */
export async function ensureGoogleAdsSubAccount(siteId: string): Promise<string> {
  const db = createAdminClient();
  const { data: site, error } = await db
    .from('sites')
    .select('id, google_ads_customer_id, site_slug, design_data')
    .eq('id', siteId)
    .single();

  if (error || !site) throw new Error(`Site not found: ${siteId}`);
  const s = site as SiteRow;

  if (s.google_ads_customer_id) return s.google_ads_customer_id;

  const businessName = (s.design_data?.siteTitle) || s.site_slug || `Site ${siteId.slice(0, 8)}`;
  const descriptiveName = `${businessName} — Keystone Web`.slice(0, 80);

  const mcc = await getMccCustomer();
  const cfg = getConfig();

  const result = await mcc.customers.createCustomerClient({
    customer_id: cfg.managerCustomerId,
    customer_client: {
      descriptive_name: descriptiveName,
      currency_code: 'CAD',
      time_zone: 'America/Toronto',
    },
  });

  const resourceName: string = result?.resource_name || '';
  const customerId = resourceName.split('/').pop();

  if (!customerId) {
    throw new Error('Google Ads sub-account creation returned no customer id');
  }

  await db
    .from('sites')
    .update({ google_ads_customer_id: customerId })
    .eq('id', siteId);

  return customerId;
}
