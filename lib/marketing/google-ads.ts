/**
 * Google Ads API Wrapper (Agency Model)
 *
 * All credentials come from env vars — Keystone runs ads on behalf of
 * customers from a single MCC account.
 *
 * Required env vars:
 *   GOOGLE_ADS_DEVELOPER_TOKEN
 *   GOOGLE_ADS_CLIENT_ID
 *   GOOGLE_ADS_CLIENT_SECRET
 *   GOOGLE_ADS_MANAGER_CUSTOMER_ID
 *   GOOGLE_ADS_CUSTOMER_ID
 *   GOOGLE_ADS_REFRESH_TOKEN
 */

import type {
  Campaign,
  CampaignTargeting,
  GoogleSearchContent,
  GoogleDisplayContent,
} from './types';
import { buildCampaignFinalUrl } from './utm';

// ── Config ───────────────────────────────────────────────────────────────────

function getConfig() {
  return {
    developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
    clientId: process.env.GOOGLE_ADS_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET || '',
    managerCustomerId: process.env.GOOGLE_ADS_MANAGER_CUSTOMER_ID || '',
    customerId: process.env.GOOGLE_ADS_CUSTOMER_ID || '',
    refreshToken: process.env.GOOGLE_ADS_REFRESH_TOKEN || '',
  };
}

function isConfigured(): boolean {
  const cfg = getConfig();
  return !!(cfg.developerToken && cfg.clientId && cfg.clientSecret && cfg.customerId && cfg.refreshToken);
}

// ── Lazy client factory ──────────────────────────────────────────────────────

let _GoogleAdsApi: any = null;

async function getClient() {
  const cfg = getConfig();
  if (!isConfigured()) {
    throw new Error('Google Ads API is not configured. Set GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_CUSTOMER_ID, and GOOGLE_ADS_REFRESH_TOKEN.');
  }

  if (!_GoogleAdsApi) {
    try {
      const mod = await import('google-ads-api');
      _GoogleAdsApi = mod.GoogleAdsApi;
    } catch {
      throw new Error('google-ads-api package is not installed. Run: npm install google-ads-api');
    }
  }

  const api = new _GoogleAdsApi({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    developer_token: cfg.developerToken,
  });

  return api.Customer({
    customer_id: cfg.customerId,
    refresh_token: cfg.refreshToken,
    login_customer_id: cfg.managerCustomerId || undefined,
  });
}

// ── Location Targeting ──────────────────────────────────────────────────────
//
// Google Ads accepts geo targeting as references to `geoTargetConstants/<id>`
// records. We resolve user-entered place names ("Toronto", "Ontario", "Canada")
// to those IDs at submit time. Names that don't resolve are skipped — the
// campaign still launches, just without that location constraint.

/** Sanitize a value for inline use in a GAQL query literal. */
function escapeGaql(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function resolveLocationResourceNames(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customer: any,
  names: string[],
): Promise<string[]> {
  const out: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    try {
      const rows = await customer.query(`
        SELECT geo_target_constant.id, geo_target_constant.name
        FROM geo_target_constant
        WHERE geo_target_constant.name = '${escapeGaql(name)}'
          AND geo_target_constant.status = 'ENABLED'
        LIMIT 1
      `);
      const id = rows?.[0]?.geo_target_constant?.id;
      if (id) out.push(`geoTargetConstants/${id}`);
    } catch (err) {
      console.warn(`[google-ads] geo lookup failed for "${name}":`, err);
    }
  }
  return out;
}

async function applyLocationTargeting(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customer: any,
  campaignResourceName: string,
  targeting: CampaignTargeting | undefined,
): Promise<void> {
  if (!targeting?.locations?.length) return;

  // Radius (proximity) targeting requires lat/lng — we don't have a geocoder
  // wired up yet, so for now we fall back to geo-name resolution.
  // TODO: when geocoding is available, emit a `proximity` criterion here.

  const resourceNames = await resolveLocationResourceNames(customer, targeting.locations);
  if (!resourceNames.length) return;

  await customer.campaignCriteria.create(
    resourceNames.map(rn => ({
      campaign: campaignResourceName,
      location: { geo_target_constant: rn },
    })),
  );
}

// ── Campaign Creation ────────────────────────────────────────────────────────

export interface GoogleCampaignResult {
  campaignId: string;
  adGroupId: string;
  adId: string;
}

export async function createSearchCampaign(
  campaign: Campaign,
): Promise<GoogleCampaignResult> {
  const customer = await getClient();
  const content = campaign.content as GoogleSearchContent;

  const budgetResult = await customer.campaignBudgets.create([{
    name: `${campaign.name} Budget`,
    amount_micros: (campaign.daily_budget_cents || 1000) * 10000,
    delivery_method: 'STANDARD',
  }]);
  const budgetResourceName = budgetResult.results[0].resource_name;

  const campaignResult = await customer.campaigns.create([{
    name: campaign.name,
    campaign_budget: budgetResourceName,
    advertising_channel_type: 'SEARCH',
    status: 'PAUSED',
    start_date: campaign.start_date?.replace(/-/g, '') || undefined,
    end_date: campaign.end_date?.replace(/-/g, '') || undefined,
    network_settings: {
      target_google_search: true,
      target_search_network: true,
      target_content_network: false,
    },
  }]);
  const campaignResourceName = campaignResult.results[0].resource_name;
  const campaignId = campaignResourceName.split('/').pop()!;

  const adGroupResult = await customer.adGroups.create([{
    campaign: campaignResourceName,
    name: `${campaign.name} — Ad Group`,
    type: 'SEARCH_STANDARD',
    status: 'ENABLED',
    cpc_bid_micros: 1_000_000,
  }]);
  const adGroupResourceName = adGroupResult.results[0].resource_name;
  const adGroupId = adGroupResourceName.split('/').pop()!;

  if (content.keywords.length > 0) {
    await customer.adGroupCriteria.create(
      content.keywords.slice(0, 20).map(kw => ({
        ad_group: adGroupResourceName,
        keyword: { text: kw, match_type: 'BROAD' },
        status: 'ENABLED',
      })),
    );
  }

  if (content.negativeKeywords.length > 0) {
    await customer.adGroupCriteria.create(
      content.negativeKeywords.slice(0, 10).map(kw => ({
        ad_group: adGroupResourceName,
        keyword: { text: kw, match_type: 'BROAD' },
        negative: true,
      })),
    );
  }

  const adResult = await customer.ads.create([{
    ad_group: adGroupResourceName,
    ad: {
      responsive_search_ad: {
        headlines: content.headlines.slice(0, 15).map((h, i) => ({
          text: h,
          pinned_field: i < 3 ? `HEADLINE_${i + 1}` : undefined,
        })),
        descriptions: content.descriptions.slice(0, 4).map(d => ({ text: d })),
      },
      final_urls: [buildCampaignFinalUrl(content.finalUrl || 'https://keystoneweb.ca', campaign.id, 'google_ads', 'search')],
    },
    status: 'ENABLED',
  }]);
  const adId = adResult.results[0].resource_name.split('/').pop()!;

  await applyLocationTargeting(customer, campaignResourceName, campaign.targeting);

  await customer.campaigns.update([{
    resource_name: campaignResourceName,
    status: 'ENABLED',
  }]);

  return { campaignId, adGroupId, adId };
}

export async function createDisplayCampaign(
  campaign: Campaign,
): Promise<GoogleCampaignResult> {
  const customer = await getClient();
  const content = campaign.content as GoogleDisplayContent;

  const budgetResult = await customer.campaignBudgets.create([{
    name: `${campaign.name} Budget`,
    amount_micros: (campaign.daily_budget_cents || 1000) * 10000,
    delivery_method: 'STANDARD',
  }]);
  const budgetResourceName = budgetResult.results[0].resource_name;

  const campaignResult = await customer.campaigns.create([{
    name: campaign.name,
    campaign_budget: budgetResourceName,
    advertising_channel_type: 'DISPLAY',
    status: 'ENABLED',
    start_date: campaign.start_date?.replace(/-/g, '') || undefined,
    end_date: campaign.end_date?.replace(/-/g, '') || undefined,
  }]);
  const campaignResourceName = campaignResult.results[0].resource_name;
  const campaignId = campaignResourceName.split('/').pop()!;

  const adGroupResult = await customer.adGroups.create([{
    campaign: campaignResourceName,
    name: `${campaign.name} — Ad Group`,
    type: 'DISPLAY_STANDARD',
    status: 'ENABLED',
  }]);
  const adGroupResourceName = adGroupResult.results[0].resource_name;
  const adGroupId = adGroupResourceName.split('/').pop()!;

  // Upload images as Google Ads Image Assets, then reference them in the RDA.
  const imageAssetResources = await uploadImageAssets(customer, content.images || []);

  const adResult = await customer.ads.create([{
    ad_group: adGroupResourceName,
    ad: {
      responsive_display_ad: {
        headlines: content.headlines.slice(0, 5).map(h => ({ text: h })),
        long_headline: { text: content.longHeadline || content.headlines[0] || '' },
        descriptions: content.descriptions.slice(0, 5).map(d => ({ text: d })),
        business_name: content.businessName,
        marketing_images: imageAssetResources.map(asset => ({ asset })),
      },
      final_urls: [buildCampaignFinalUrl(content.finalUrl || 'https://keystoneweb.ca', campaign.id, 'google_ads', 'display')],
    },
    status: 'ENABLED',
  }]);
  const adId = adResult.results[0].resource_name.split('/').pop()!;

  await applyLocationTargeting(customer, campaignResourceName, campaign.targeting);

  return { campaignId, adGroupId, adId };
}

/**
 * Upload the supplied image URLs to Google Ads as `IMAGE` assets and return
 * their resource names. Bad/unreachable URLs are skipped so the campaign can
 * still launch even if one image fails.
 */
async function uploadImageAssets(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customer: any,
  urls: string[],
): Promise<string[]> {
  const resources: string[] = [];
  for (const url of urls.slice(0, 15)) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const result = await customer.assets.create([{
        type: 'IMAGE',
        image_asset: { data: buf.toString('base64') },
      }]);
      const rn = result?.results?.[0]?.resource_name;
      if (rn) resources.push(rn);
    } catch (err) {
      console.warn(`[google-ads] image asset upload failed for ${url}:`, err);
    }
  }
  return resources;
}

// ── Campaign Management ──────────────────────────────────────────────────────

export async function pauseCampaign(
  externalCampaignId: string,
): Promise<void> {
  const customer = await getClient();
  const customerId = getConfig().customerId;
  await customer.campaigns.update([{
    resource_name: `customers/${customerId}/campaigns/${externalCampaignId}`,
    status: 'PAUSED',
  }]);
}

export async function resumeCampaign(
  externalCampaignId: string,
): Promise<void> {
  const customer = await getClient();
  const customerId = getConfig().customerId;
  await customer.campaigns.update([{
    resource_name: `customers/${customerId}/campaigns/${externalCampaignId}`,
    status: 'ENABLED',
  }]);
}

// ── Performance Metrics ──────────────────────────────────────────────────────

export interface GooglePerformanceMetrics {
  impressions: number;
  clicks: number;
  conversions: number;
  costMicros: number;
  costCents: number;
  ctr: number;
  cpcCents: number;
}

export async function getCampaignPerformance(
  externalCampaignId: string,
  startDate: string,
  endDate: string,
): Promise<GooglePerformanceMetrics> {
  const customer = await getClient();

  const results = await customer.query(`
    SELECT
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros,
      metrics.ctr,
      metrics.average_cpc
    FROM campaign
    WHERE campaign.id = ${externalCampaignId}
      AND segments.date BETWEEN '${startDate}' AND '${endDate}'
  `);

  if (!results.length) {
    return { impressions: 0, clicks: 0, conversions: 0, costMicros: 0, costCents: 0, ctr: 0, cpcCents: 0 };
  }

  let impressions = 0, clicks = 0, conversions = 0, costMicros = 0;
  for (const row of results) {
    impressions += Number(row.metrics?.impressions || 0);
    clicks += Number(row.metrics?.clicks || 0);
    conversions += Number(row.metrics?.conversions || 0);
    costMicros += Number(row.metrics?.cost_micros || 0);
  }

  const costCents = Math.round(costMicros / 10000);
  const ctr = impressions > 0 ? clicks / impressions : 0;
  const cpcCents = clicks > 0 ? Math.round(costCents / clicks) : 0;

  return { impressions, clicks, conversions, costMicros, costCents, ctr, cpcCents };
}

export function isGoogleAdsConfigured(): boolean {
  return isConfigured();
}

// ── Hourly geo + device segments (for the live activity feed) ───────────────

export interface ActivitySegmentRow {
  date: string;        // YYYY-MM-DD
  hour: number;        // 0–23
  city: string | null;
  region: string | null;
  country: string | null;
  device: string | null;
  impressions: number;
  clicks: number;
  costCents: number;
}

/**
 * Pull hourly performance broken down by geo + device for the activity feed.
 * Google's reporting API supports this in one query.
 */
export async function getCampaignActivitySegments(
  externalCampaignId: string,
  startDate: string,
  endDate: string,
): Promise<ActivitySegmentRow[]> {
  const customer = await getClient();
  const rows = await customer.query(`
    SELECT
      segments.date,
      segments.hour,
      segments.geo_target_city,
      segments.geo_target_region,
      segments.geo_target_country,
      segments.device,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros
    FROM campaign
    WHERE campaign.id = ${externalCampaignId}
      AND segments.date BETWEEN '${startDate}' AND '${endDate}'
  `);

  return (rows || []).map((r: Record<string, Record<string, unknown>>) => {
    const seg = r.segments || {};
    const m = r.metrics || {};
    return {
      date: String(seg.date || ''),
      hour: Number(seg.hour || 0),
      city: seg.geo_target_city ? String(seg.geo_target_city) : null,
      region: seg.geo_target_region ? String(seg.geo_target_region) : null,
      country: seg.geo_target_country ? String(seg.geo_target_country) : null,
      device: seg.device ? String(seg.device) : null,
      impressions: Number(m.impressions || 0),
      clicks: Number(m.clicks || 0),
      costCents: Math.round(Number(m.cost_micros || 0) / 10000),
    };
  });
}
