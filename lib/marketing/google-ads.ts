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
  GoogleSearchContent,
  GoogleDisplayContent,
} from './types';
import { buildCampaignFinalUrl } from './utm';
import {
  planSearchBidding,
  planDisplayBidding,
  summarizeKeywordMetrics,
  type MarketCpcEstimate,
  type KeywordMetric,
} from './bidding';

// ── Mock mode ────────────────────────────────────────────────────────────────
// Set GOOGLE_ADS_MOCK=true in .env.local to skip all real Google API calls.
// Campaign IDs, metrics, and activity data are synthesised locally so the
// full app flow (wallet, DB writes, wizard, metrics panel) can be exercised
// without a Google Ads account or billing.

function isMockMode(): boolean {
  return process.env.GOOGLE_ADS_MOCK === 'true';
}

function mockCampaignResult(campaignId?: string): GoogleCampaignResult {
  const id = campaignId || `mock-${Date.now()}`;
  return { campaignId: id, adGroupId: `ag-${id}`, adId: `ad-${id}` };
}

// Generates metrics that slowly grow over time so the dashboard looks alive.
function mockPerformance(externalCampaignId: string, startDate: string, endDate: string): GooglePerformanceMetrics {
  const seed = externalCampaignId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const days = Math.max(1, (Date.parse(endDate) - Date.parse(startDate)) / 86_400_000 + 1);
  const impressions = Math.floor((seed % 300 + 100) * days);
  const clicks = Math.floor(impressions * (0.03 + (seed % 5) * 0.005));
  const costCents = clicks * (30 + seed % 40);
  const costMicros = costCents * 10_000;
  const ctr = impressions > 0 ? clicks / impressions : 0;
  const cpcCents = clicks > 0 ? Math.round(costCents / clicks) : 0;
  return { impressions, clicks, conversions: Math.floor(clicks * 0.08), costMicros, costCents, ctr, cpcCents };
}

function mockActivitySegments(externalCampaignId: string, startDate: string, endDate: string): ActivitySegmentRow[] {
  const seed = externalCampaignId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const cities = ['Toronto', 'Vancouver', 'Calgary', 'Ottawa', 'Montreal'];
  const regions = ['Ontario', 'British Columbia', 'Alberta', 'Ontario', 'Quebec'];
  const devices = ['MOBILE', 'DESKTOP', 'TABLET'];
  const rows: ActivitySegmentRow[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const date = d.toISOString().slice(0, 10);
    for (let h = 8; h <= 20; h += 3) {
      const i = (seed + h) % cities.length;
      const impressions = Math.floor((seed % 20 + 5) * (1 + h / 24));
      const clicks = Math.floor(impressions * 0.04);
      rows.push({
        date,
        hour: h,
        city: cities[i],
        region: regions[i],
        country: 'Canada',
        device: devices[(seed + h) % devices.length],
        impressions,
        clicks,
        costCents: clicks * (30 + seed % 20),
      });
    }
  }
  return rows;
}

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
  // customerId is intentionally NOT required: the operating account is supplied
  // per-launch from the campaign's site (site.google_ads_customer_id / the ops
  // launch box) and passed through as a customerId override. The env
  // GOOGLE_ADS_CUSTOMER_ID is only a fallback for callers that don't pass one.
  return !!(cfg.developerToken && cfg.clientId && cfg.clientSecret && cfg.refreshToken);
}

// ── Lazy client factory ──────────────────────────────────────────────────────

let _GoogleAdsApi: any = null;

async function getClient(customerIdOverride?: string) {
  const cfg = getConfig();
  if (!isConfigured()) {
    throw new Error('Google Ads API is not configured. Set GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, and GOOGLE_ADS_REFRESH_TOKEN (plus GOOGLE_ADS_MANAGER_CUSTOMER_ID when operating sub-accounts).');
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
    customer_id: (customerIdOverride || cfg.customerId).replace(/-/g, ''),
    refresh_token: cfg.refreshToken,
    login_customer_id: cfg.managerCustomerId ? cfg.managerCustomerId.replace(/-/g, '') : undefined,
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
  // Pre-resolved geoTargetConstants/<id> resource names. Resolved once by the
  // caller so the same lookup feeds both the keyword market estimate and the
  // campaign's location criteria.
  resourceNames: string[],
): Promise<void> {
  // Radius (proximity) targeting requires lat/lng — we don't have a geocoder
  // wired up yet, so for now we fall back to geo-name resolution.
  // TODO: when geocoding is available, emit a `proximity` criterion here.

  if (!resourceNames.length) return;

  await customer.campaignCriteria.create(
    resourceNames.map(rn => ({
      campaign: campaignResourceName,
      location: { geo_target_constant: rn },
    })),
  );
}

// ── Market data (Keyword Planner) ────────────────────────────────────────────

/** Google's language constant for English. */
const ENGLISH_LANGUAGE_CONSTANT = 'languageConstants/1000';

function normalizeCompetition(v: unknown): KeywordMetric['competition'] {
  const s = typeof v === 'string' ? v.toUpperCase() : '';
  return s === 'LOW' || s === 'MEDIUM' || s === 'HIGH' ? s : 'UNKNOWN';
}

/**
 * Best-effort fetch of market CPC data from Google's Keyword Planner so the
 * bidding plan can reference real "first page bid" estimates instead of guessing.
 *
 * Returns null on ANY failure (a brand-new sub-account without Keyword Plan
 * access, no resolvable geo target, an API error) — the caller then falls back
 * to the heuristic estimate. This never throws, so a missing estimate can never
 * block a launch. The lookup is scoped to GOOGLE_SEARCH only, matching the
 * network we actually deploy to (Search partners are excluded).
 */
async function fetchKeywordMarketEstimate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customer: any,
  customerId: string,
  keywords: string[],
  geoTargetConstants: string[],
): Promise<MarketCpcEstimate | null> {
  const terms = keywords.map(k => k.trim()).filter(Boolean).slice(0, 20);
  if (!terms.length) return null;
  try {
    const svc = customer?.keywordPlanIdeas;
    if (!svc || typeof svc.generateKeywordHistoricalMetrics !== 'function') return null;

    const res = await svc.generateKeywordHistoricalMetrics({
      customer_id: customerId.replace(/-/g, ''),
      keywords: terms,
      language: ENGLISH_LANGUAGE_CONSTANT,
      geo_target_constants: geoTargetConstants,
      keyword_plan_network: 'GOOGLE_SEARCH',
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : [];
    const toNum = (v: unknown) => (v == null ? null : Number(v));
    const metrics: KeywordMetric[] = rows.map((r) => {
      const km = r?.keyword_metrics || {};
      return {
        text: String(r?.text || ''),
        avgMonthlySearches: km.avg_monthly_searches != null ? Number(km.avg_monthly_searches) : null,
        competition: normalizeCompetition(km.competition),
        lowTopOfPageBidMicros: toNum(km.low_top_of_page_bid_micros),
        highTopOfPageBidMicros: toNum(km.high_top_of_page_bid_micros),
      };
    });
    return summarizeKeywordMetrics(metrics);
  } catch (err) {
    console.warn('[google-ads] keyword market estimate unavailable, falling back to heuristic:', err);
    return null;
  }
}

// ── Campaign Creation ────────────────────────────────────────────────────────

export interface GoogleCampaignResult {
  campaignId: string;
  adGroupId: string;
  adId: string;
  /** Calibration / deployment notes for ops (bidding ceiling, budget flags). */
  warnings?: string[];
}

/**
 * Build a campaign-budget name that's unique within the account. Budget names
 * must be unique, so a fixed `${name} Budget` collides with budgets left behind
 * by earlier failed launch attempts ("A campaign budget with this name already
 * exists."). Appending the campaign id + a timestamp keeps retries clean.
 */
function uniqueBudgetName(campaign: Campaign): string {
  const suffix = `${(campaign.id || '').slice(0, 8)}-${Date.now().toString(36)}`;
  return `${campaign.name} Budget ${suffix}`.slice(0, 250);
}

export async function createSearchCampaign(
  campaign: Campaign,
  customerId?: string,
): Promise<GoogleCampaignResult> {
  const content = campaign.content as GoogleSearchContent;
  const dailyBudgetCents = campaign.daily_budget_cents || 1000;

  if (isMockMode()) {
    console.log('[google-ads mock] createSearchCampaign', campaign.name);
    // Run the (pure) calibration even in mock so dev/ops can see the bidding
    // plan and budget flags without a live Google account.
    const mockPlan = planSearchBidding({ dailyBudgetCents, keywords: content.keywords, estimate: null });
    return { ...mockCampaignResult(`search-${campaign.id?.slice(0, 8)}`), warnings: mockPlan.warnings };
  }
  const customer = await getClient(customerId);

  // Resolve geo targets ONCE — reused for both the market estimate (so it's
  // scoped to the campaign's locations) and the campaign location criteria.
  const geoTargets = await resolveLocationResourceNames(customer, campaign.targeting?.locations || []);

  // Reference real market data ("first page bid" estimates) when we can; fall
  // back to a heuristic otherwise. This drives the bid ceiling, match type, and
  // keyword selection so we never push a config that can't run efficiently.
  const estimate = await fetchKeywordMarketEstimate(customer, customerId || getConfig().customerId, content.keywords, geoTargets);
  const plan = planSearchBidding({ dailyBudgetCents, keywords: content.keywords, estimate });

  const budgetResult = await customer.campaignBudgets.create([{
    name: uniqueBudgetName(campaign),
    amount_micros: dailyBudgetCents * 10000,
    delivery_method: 'STANDARD',
  }]);
  const budgetResourceName = budgetResult.results[0].resource_name;

  const campaignResult = await customer.campaigns.create([{
    name: campaign.name,
    campaign_budget: budgetResourceName,
    advertising_channel_type: 'SEARCH',
    // Maximize Clicks (TARGET_SPEND) — a volume-focused automated strategy that
    // bids dynamically against the live auction instead of a static manual bid.
    // The cpc_bid_ceiling caps any single click so one expensive auction can't
    // drain the whole daily budget. A flat Manual CPC was the original failure
    // mode: a hardcoded $1 bid sat below the first-page bid and won zero
    // impressions. Maximize Clicks needs no conversion tracking, so it's safe on
    // a fresh sub-account.
    target_spend: {
      cpc_bid_ceiling_micros: plan.cpcBidCeilingMicros,
    },
    // Required since the EU political advertising transparency rules (TTPA).
    // Keystone runs ads for small businesses, not political advertising.
    contains_eu_political_advertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING',
    status: 'PAUSED',
    start_date: campaign.start_date?.replace(/-/g, '') || undefined,
    end_date: campaign.end_date?.replace(/-/g, '') || undefined,
    network_settings: {
      target_google_search: true,
      // Search partners OFF: for local lead-gen on strict daily budgets every
      // dollar should go to high-intent Google Search traffic only.
      target_search_network: false,
      // Display network OFF for a search campaign.
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
    // No cpc_bid_micros: under Maximize Clicks the campaign-level strategy and
    // its ceiling control bids. A per-ad-group manual bid would be ignored.
  }]);
  const adGroupResourceName = adGroupResult.results[0].resource_name;
  const adGroupId = adGroupResourceName.split('/').pop()!;

  // Deploy the calibrated keyword set (long-tail prioritized, possibly trimmed)
  // with the calibrated match type (tighter than broad when the budget is thin).
  if (plan.keywords.length > 0) {
    await customer.adGroupCriteria.create(
      plan.keywords.slice(0, 20).map(kw => ({
        ad_group: adGroupResourceName,
        keyword: { text: kw, match_type: plan.matchType },
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

  const adResult = await customer.adGroupAds.create([{
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
  // AdGroupAd resource name is "customers/X/adGroupAds/{adGroupId}~{adId}".
  const adId = adResult.results[0].resource_name.split('~').pop()!;

  await applyLocationTargeting(customer, campaignResourceName, geoTargets);

  await customer.campaigns.update([{
    resource_name: campaignResourceName,
    status: 'ENABLED',
  }]);

  return { campaignId, adGroupId, adId, warnings: plan.warnings };
}

export async function createDisplayCampaign(
  campaign: Campaign,
  customerId?: string,
): Promise<GoogleCampaignResult> {
  const dailyBudgetCents = campaign.daily_budget_cents || 1000;
  const displayPlan = planDisplayBidding({ dailyBudgetCents });
  const displayWarnings = [
    `Bidding: Maximize Clicks with a Max-CPC ceiling of $${(displayPlan.cpcBidCeilingMicros / 1_000_000).toFixed(2)}.`,
  ];

  if (isMockMode()) {
    console.log('[google-ads mock] createDisplayCampaign', campaign.name);
    return { ...mockCampaignResult(`display-${campaign.id?.slice(0, 8)}`), warnings: displayWarnings };
  }
  const customer = await getClient(customerId);
  const content = campaign.content as GoogleDisplayContent;

  const budgetResult = await customer.campaignBudgets.create([{
    name: uniqueBudgetName(campaign),
    amount_micros: dailyBudgetCents * 10000,
    delivery_method: 'STANDARD',
  }]);
  const budgetResourceName = budgetResult.results[0].resource_name;

  const campaignResult = await customer.campaigns.create([{
    name: campaign.name,
    campaign_budget: budgetResourceName,
    advertising_channel_type: 'DISPLAY',
    // Maximize Clicks (TARGET_SPEND) with a Max-CPC ceiling, same rationale as
    // the search path: dynamic, volume-focused bidding that a single expensive
    // click can't blow through, instead of a static flat manual bid.
    target_spend: {
      cpc_bid_ceiling_micros: displayPlan.cpcBidCeilingMicros,
    },
    // Required since the EU political advertising transparency rules (TTPA).
    contains_eu_political_advertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING',
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
    // No cpc_bid_micros: bids are controlled by the Maximize Clicks ceiling.
  }]);
  const adGroupResourceName = adGroupResult.results[0].resource_name;
  const adGroupId = adGroupResourceName.split('/').pop()!;

  // Upload images as Google Ads Image Assets, then reference them in the RDA.
  const imageAssetResources = await uploadImageAssets(customer, content.images || []);

  const adResult = await customer.adGroupAds.create([{
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
  // AdGroupAd resource name is "customers/X/adGroupAds/{adGroupId}~{adId}".
  const adId = adResult.results[0].resource_name.split('~').pop()!;

  const geoTargets = await resolveLocationResourceNames(customer, campaign.targeting?.locations || []);
  await applyLocationTargeting(customer, campaignResourceName, geoTargets);

  return { campaignId, adGroupId, adId, warnings: displayWarnings };
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
  customerId?: string,
): Promise<void> {
  if (isMockMode()) {
    console.log('[google-ads mock] pauseCampaign', externalCampaignId);
    return;
  }
  const customer = await getClient(customerId);
  const acctId = (customerId || getConfig().customerId).replace(/-/g, '');
  await customer.campaigns.update([{
    resource_name: `customers/${acctId}/campaigns/${externalCampaignId}`,
    status: 'PAUSED',
  }]);
}

export async function resumeCampaign(
  externalCampaignId: string,
  customerId?: string,
): Promise<void> {
  if (isMockMode()) {
    console.log('[google-ads mock] resumeCampaign', externalCampaignId);
    return;
  }
  const customer = await getClient(customerId);
  const acctId = (customerId || getConfig().customerId).replace(/-/g, '');
  await customer.campaigns.update([{
    resource_name: `customers/${acctId}/campaigns/${externalCampaignId}`,
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
  customerId?: string,
): Promise<GooglePerformanceMetrics> {
  const customer = await getClient(customerId);

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
  customerId?: string,
): Promise<ActivitySegmentRow[]> {
  const customer = await getClient(customerId);
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
