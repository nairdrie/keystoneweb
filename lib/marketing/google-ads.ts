/**
 * Google Ads API Wrapper
 *
 * Reusable functions for creating/managing Google Ads campaigns.
 * Uses the google-ads-api npm package (wraps Google Ads API v17).
 *
 * Required env vars:
 *   GOOGLE_ADS_DEVELOPER_TOKEN
 *   GOOGLE_ADS_CLIENT_ID
 *   GOOGLE_ADS_CLIENT_SECRET
 *   GOOGLE_ADS_MANAGER_CUSTOMER_ID
 */

import type {
  Campaign,
  MarketingSettings,
  GoogleSearchContent,
  GoogleDisplayContent,
} from './types';

// ── Config ───────────────────────────────────────────────────────────────────

function getConfig() {
  return {
    developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
    clientId: process.env.GOOGLE_ADS_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET || '',
    managerCustomerId: process.env.GOOGLE_ADS_MANAGER_CUSTOMER_ID || '',
  };
}

function isConfigured(): boolean {
  const cfg = getConfig();
  return !!(cfg.developerToken && cfg.clientId && cfg.clientSecret);
}

// ── Lazy client factory ──────────────────────────────────────────────────────

let _GoogleAdsApi: any = null;

async function getClient(settings: MarketingSettings) {
  if (!isConfigured()) {
    throw new Error('Google Ads API is not configured. Set GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID, and GOOGLE_ADS_CLIENT_SECRET.');
  }
  if (!settings.google_ads_customer_id || !settings.google_ads_refresh_token) {
    throw new Error('Google Ads account not connected. Link an account in Marketing Settings.');
  }

  if (!_GoogleAdsApi) {
    try {
      const mod = await import('google-ads-api');
      _GoogleAdsApi = mod.GoogleAdsApi;
    } catch {
      throw new Error('google-ads-api package is not installed. Run: npm install google-ads-api');
    }
  }

  const cfg = getConfig();
  const api = new _GoogleAdsApi({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    developer_token: cfg.developerToken,
  });

  return api.Customer({
    customer_id: settings.google_ads_customer_id,
    refresh_token: settings.google_ads_refresh_token,
    login_customer_id: cfg.managerCustomerId || undefined,
  });
}

// ── Campaign Creation ────────────────────────────────────────────────────────

export interface GoogleCampaignResult {
  campaignId: string;
  adGroupId: string;
  adId: string;
}

/**
 * Create a search campaign with a responsive search ad.
 */
export async function createSearchCampaign(
  settings: MarketingSettings,
  campaign: Campaign,
): Promise<GoogleCampaignResult> {
  const customer = await getClient(settings);
  const content = campaign.content as GoogleSearchContent;

  // 1. Create campaign budget
  const budgetResult = await customer.campaignBudgets.create([{
    name: `${campaign.name} Budget`,
    amount_micros: (campaign.daily_budget_cents || 1000) * 10000, // cents → micros
    delivery_method: 'STANDARD',
  }]);
  const budgetResourceName = budgetResult.results[0].resource_name;

  // 2. Create campaign
  const campaignResult = await customer.campaigns.create([{
    name: campaign.name,
    campaign_budget: budgetResourceName,
    advertising_channel_type: 'SEARCH',
    status: 'PAUSED', // Start paused, enable after review
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

  // 3. Create ad group
  const adGroupResult = await customer.adGroups.create([{
    campaign: campaignResourceName,
    name: `${campaign.name} — Ad Group`,
    type: 'SEARCH_STANDARD',
    status: 'ENABLED',
    cpc_bid_micros: 1_000_000, // $1.00 default CPC bid
  }]);
  const adGroupResourceName = adGroupResult.results[0].resource_name;
  const adGroupId = adGroupResourceName.split('/').pop()!;

  // 4. Add keywords
  if (content.keywords.length > 0) {
    await customer.adGroupCriteria.create(
      content.keywords.slice(0, 20).map(kw => ({
        ad_group: adGroupResourceName,
        keyword: { text: kw, match_type: 'BROAD' },
        status: 'ENABLED',
      })),
    );
  }

  // 5. Add negative keywords
  if (content.negativeKeywords.length > 0) {
    await customer.adGroupCriteria.create(
      content.negativeKeywords.slice(0, 10).map(kw => ({
        ad_group: adGroupResourceName,
        keyword: { text: kw, match_type: 'BROAD' },
        negative: true,
      })),
    );
  }

  // 6. Create responsive search ad
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
      final_urls: [content.finalUrl || 'https://keystoneweb.ca'],
    },
    status: 'ENABLED',
  }]);
  const adId = adResult.results[0].resource_name.split('/').pop()!;

  // 7. Enable the campaign
  await customer.campaigns.update([{
    resource_name: campaignResourceName,
    status: 'ENABLED',
  }]);

  return { campaignId, adGroupId, adId };
}

/**
 * Create a display campaign.
 */
export async function createDisplayCampaign(
  settings: MarketingSettings,
  campaign: Campaign,
): Promise<GoogleCampaignResult> {
  const customer = await getClient(settings);
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

  const adResult = await customer.ads.create([{
    ad_group: adGroupResourceName,
    ad: {
      responsive_display_ad: {
        headlines: content.headlines.slice(0, 5).map(h => ({ text: h })),
        long_headline: { text: content.longHeadline || content.headlines[0] || '' },
        descriptions: content.descriptions.slice(0, 5).map(d => ({ text: d })),
        business_name: content.businessName,
      },
      final_urls: [content.finalUrl || 'https://keystoneweb.ca'],
    },
    status: 'ENABLED',
  }]);
  const adId = adResult.results[0].resource_name.split('/').pop()!;

  return { campaignId, adGroupId, adId };
}

// ── Campaign Management ──────────────────────────────────────────────────────

/**
 * Pause an active Google Ads campaign.
 */
export async function pauseCampaign(
  settings: MarketingSettings,
  externalCampaignId: string,
): Promise<void> {
  const customer = await getClient(settings);
  await customer.campaigns.update([{
    resource_name: `customers/${settings.google_ads_customer_id}/campaigns/${externalCampaignId}`,
    status: 'PAUSED',
  }]);
}

/**
 * Resume a paused Google Ads campaign.
 */
export async function resumeCampaign(
  settings: MarketingSettings,
  externalCampaignId: string,
): Promise<void> {
  const customer = await getClient(settings);
  await customer.campaigns.update([{
    resource_name: `customers/${settings.google_ads_customer_id}/campaigns/${externalCampaignId}`,
    status: 'ENABLED',
  }]);
}

// ── Performance Metrics ──────────────────────────────────────────────────────

export interface GooglePerformanceMetrics {
  impressions: number;
  clicks: number;
  conversions: number;
  costMicros: number;           // Total cost in micros
  costCents: number;            // Total cost in cents
  ctr: number;                  // Click-through rate (0-1)
  cpcCents: number;             // Average cost per click in cents
}

/**
 * Fetch performance metrics for a campaign over a date range.
 */
export async function getCampaignPerformance(
  settings: MarketingSettings,
  externalCampaignId: string,
  startDate: string,            // YYYY-MM-DD
  endDate: string,              // YYYY-MM-DD
): Promise<GooglePerformanceMetrics> {
  const customer = await getClient(settings);

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

  // Aggregate across date segments
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

/**
 * Check if the Google Ads API is configured and accessible.
 */
export function isGoogleAdsConfigured(): boolean {
  return isConfigured();
}
