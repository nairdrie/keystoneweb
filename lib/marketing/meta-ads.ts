/**
 * Meta Marketing API Wrapper — Agency Model (Facebook + Instagram)
 *
 * All credentials come from env vars — Keystone runs ads on behalf of
 * customers from a single Business Manager account.
 *
 * Required env vars:
 *   META_APP_ID
 *   META_APP_SECRET
 *   META_ACCESS_TOKEN
 *   META_AD_ACCOUNT_ID
 *   META_PAGE_ID
 *   META_INSTAGRAM_ACTOR_ID  (optional)
 */

import type { Campaign as AppCampaign, MetaAdContent } from './types';

// ── Config ───────────────────────────────────────────────────────────────────

function getConfig() {
  return {
    appId: process.env.META_APP_ID || '',
    appSecret: process.env.META_APP_SECRET || '',
    accessToken: process.env.META_ACCESS_TOKEN || '',
    adAccountId: process.env.META_AD_ACCOUNT_ID || '',
    pageId: process.env.META_PAGE_ID || '',
    instagramActorId: process.env.META_INSTAGRAM_ACTOR_ID || '',
  };
}

function isConfigured(): boolean {
  const cfg = getConfig();
  return !!(cfg.appId && cfg.appSecret && cfg.accessToken && cfg.adAccountId);
}

// ── Lazy SDK init ────────────────────────────────────────────────────────────

let _sdk: any = null;

async function initSdk() {
  const cfg = getConfig();
  if (!cfg.accessToken) {
    throw new Error('META_ACCESS_TOKEN env var is not set.');
  }
  if (!_sdk) {
    try {
      _sdk = await import('facebook-nodejs-business-sdk');
    } catch {
      throw new Error('facebook-nodejs-business-sdk package is not installed. Run: npm install facebook-nodejs-business-sdk');
    }
  }
  _sdk.FacebookAdsApi.init(cfg.accessToken);
  return _sdk;
}

// ── Campaign Creation ────────────────────────────────────────────────────────

export interface MetaCampaignResult {
  campaignId: string;
  adSetId: string;
  adId: string;
}

export async function createAdCampaign(
  campaign: AppCampaign,
): Promise<MetaCampaignResult> {
  const cfg = getConfig();
  if (!isConfigured()) {
    throw new Error('Meta Ads not configured. Set META_APP_ID, META_APP_SECRET, META_ACCESS_TOKEN, and META_AD_ACCOUNT_ID.');
  }

  const sdk = await initSdk();
  const { AdAccount, Campaign: MetaCampaign } = sdk;
  const content = campaign.content as MetaAdContent;
  const adAccountId = cfg.adAccountId.startsWith('act_')
    ? cfg.adAccountId
    : `act_${cfg.adAccountId}`;
  const account = new AdAccount(adAccountId);

  const objectiveMap: Record<string, string> = {
    feed: 'OUTCOME_TRAFFIC',
    stories: 'OUTCOME_AWARENESS',
    reels: 'OUTCOME_AWARENESS',
    catalog: 'OUTCOME_SALES',
  };
  const objective = objectiveMap[campaign.campaign_type] || 'OUTCOME_TRAFFIC';

  // 1. Create Campaign
  const metaCampaign = await account.createCampaign([], {
    name: campaign.name,
    objective,
    status: MetaCampaign.Status.active,
    special_ad_categories: [],
  });
  const campaignId = metaCampaign.id;

  // 2. Create Ad Set
  const targeting: any = {};

  if (campaign.targeting?.locations?.length) {
    targeting.geo_locations = {
      countries: campaign.targeting.locations.filter(l => l.length === 2),
      cities: campaign.targeting.locations
        .filter(l => l.length > 2)
        .map(l => ({ key: l })),
    };
  } else {
    targeting.geo_locations = { countries: ['CA'] };
  }

  if (campaign.targeting?.ageMin) targeting.age_min = campaign.targeting.ageMin;
  if (campaign.targeting?.ageMax) targeting.age_max = campaign.targeting.ageMax;
  if (campaign.targeting?.interests?.length) {
    targeting.flexible_spec = [{
      interests: campaign.targeting.interests.map(i => ({ name: i })),
    }];
  }

  const publisherPlatforms: string[] = [];
  const facebookPositions: string[] = [];
  const instagramPositions: string[] = [];

  for (const placement of content.placements) {
    if (placement.startsWith('facebook_')) {
      if (!publisherPlatforms.includes('facebook')) publisherPlatforms.push('facebook');
      facebookPositions.push(placement.replace('facebook_', ''));
    } else if (placement.startsWith('instagram_')) {
      if (!publisherPlatforms.includes('instagram')) publisherPlatforms.push('instagram');
      instagramPositions.push(placement.replace('instagram_', ''));
    }
  }

  const adSet = await account.createAdSet([], {
    name: `${campaign.name} — Ad Set`,
    campaign_id: campaignId,
    daily_budget: (campaign.daily_budget_cents || 1000),
    billing_event: 'IMPRESSIONS',
    optimization_goal: objective === 'OUTCOME_TRAFFIC' ? 'LINK_CLICKS' : 'REACH',
    targeting,
    status: 'ACTIVE',
    start_time: campaign.start_date || undefined,
    end_time: campaign.end_date || undefined,
    publisher_platforms: publisherPlatforms.length > 0 ? publisherPlatforms : undefined,
    facebook_positions: facebookPositions.length > 0 ? facebookPositions : undefined,
    instagram_positions: instagramPositions.length > 0 ? instagramPositions : undefined,
  });
  const adSetId = adSet.id;

  // 3. Create Ad Creative
  const creativeData: any = {
    name: `${campaign.name} — Creative`,
    object_story_spec: {
      page_id: cfg.pageId,
      link_data: {
        message: content.primaryText,
        name: content.headline,
        description: content.description || undefined,
        link: campaign.content && 'finalUrl' in campaign.content
          ? (campaign.content as any).finalUrl
          : 'https://keystoneweb.ca',
        call_to_action: { type: content.callToAction },
        image_url: content.imageUrl || undefined,
      },
    },
  };

  if (cfg.instagramActorId) {
    creativeData.object_story_spec.instagram_actor_id = cfg.instagramActorId;
  }

  const creative = await account.createAdCreative([], creativeData);

  // 4. Create Ad
  const ad = await account.createAd([], {
    name: `${campaign.name} — Ad`,
    adset_id: adSetId,
    creative: { creative_id: creative.id },
    status: 'ACTIVE',
  });
  const adId = ad.id;

  return { campaignId, adSetId, adId };
}

// ── Campaign Management ──────────────────────────────────────────────────────

export async function pauseCampaign(
  externalCampaignId: string,
): Promise<void> {
  const sdk = await initSdk();
  const { Campaign: MetaCampaign } = sdk;
  const campaign = new MetaCampaign(externalCampaignId);
  await campaign.update([], { status: MetaCampaign.Status.paused });
}

export async function resumeCampaign(
  externalCampaignId: string,
): Promise<void> {
  const sdk = await initSdk();
  const { Campaign: MetaCampaign } = sdk;
  const campaign = new MetaCampaign(externalCampaignId);
  await campaign.update([], { status: MetaCampaign.Status.active });
}

// ── Performance Metrics ──────────────────────────────────────────────────────

export interface MetaPerformanceMetrics {
  impressions: number;
  clicks: number;
  conversions: number;
  spendCents: number;
  ctr: number;
  cpcCents: number;
}

export async function getCampaignPerformance(
  externalCampaignId: string,
  startDate: string,
  endDate: string,
): Promise<MetaPerformanceMetrics> {
  const sdk = await initSdk();
  const { Campaign: MetaCampaign } = sdk;
  const campaign = new MetaCampaign(externalCampaignId);

  const insights = await campaign.getInsights(
    ['impressions', 'clicks', 'conversions', 'spend', 'ctr', 'cpc'],
    {
      time_range: { since: startDate, until: endDate },
      level: 'campaign',
    },
  );

  if (!insights || insights.length === 0) {
    return { impressions: 0, clicks: 0, conversions: 0, spendCents: 0, ctr: 0, cpcCents: 0 };
  }

  const data = insights[0];
  const spendCents = Math.round(parseFloat(data.spend || '0') * 100);
  const cpcCents = Math.round(parseFloat(data.cpc || '0') * 100);

  return {
    impressions: parseInt(data.impressions || '0', 10),
    clicks: parseInt(data.clicks || '0', 10),
    conversions: parseInt(data.conversions || '0', 10),
    spendCents,
    ctr: parseFloat(data.ctr || '0'),
    cpcCents,
  };
}

export function isMetaAdsConfigured(): boolean {
  return isConfigured();
}
