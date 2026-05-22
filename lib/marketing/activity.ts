/**
 * Activity event ingestion.
 *
 * The performance sync cron calls this to upsert hourly geo/device segments
 * into marketing_activity_events. The detail page reads from that table to
 * render the "what's happening right now" feed.
 *
 * Geo target city/region/country values come from Google's reporting API as
 * `geoTargetConstants/<id>` strings. Resolving them to human names requires
 * an extra GAQL query — for v1 we store the raw values so the feed has
 * something to render; a follow-up can resolve them to display names.
 */

import { createAdminClient } from '@/lib/db/supabase-admin';
import { getCampaignActivitySegments, type ActivitySegmentRow } from './google-ads';
import type { Campaign } from './types';

export interface ActivityEvent {
  id: string;
  campaign_id: string;
  site_id: string | null;
  occurred_date: string;
  occurred_hour: number;
  geo_city: string | null;
  geo_region: string | null;
  geo_country: string | null;
  device: string | null;
  impressions: number;
  clicks: number;
  cost_cents: number;
  created_at: string;
}

export async function syncActivityForCampaign(campaign: Campaign): Promise<void> {
  if (!campaign.external_campaign_id || campaign.channel !== 'google_ads') return;
  if (!campaign.site_id) return; // platform campaigns don't need activity feed

  const today = new Date().toISOString().split('T')[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  let segments: ActivitySegmentRow[];
  try {
    segments = await getCampaignActivitySegments(campaign.external_campaign_id, sevenDaysAgo, today);
  } catch (err) {
    console.warn(`[activity] segment fetch failed for ${campaign.id}:`, err);
    return;
  }

  if (!segments.length) return;

  const db = createAdminClient();
  const rows = segments
    .filter(s => s.impressions > 0 || s.clicks > 0)
    .map(s => ({
      campaign_id: campaign.id,
      site_id: campaign.site_id,
      occurred_date: s.date,
      occurred_hour: s.hour,
      geo_city: s.city,
      geo_region: s.region,
      geo_country: s.country,
      device: s.device,
      impressions: s.impressions,
      clicks: s.clicks,
      cost_cents: s.costCents,
    }));

  if (!rows.length) return;

  // Upsert by the unique key (campaign_id, occurred_date, occurred_hour, geo_city, geo_region, device)
  const { error } = await db
    .from('marketing_activity_events')
    .upsert(rows, { onConflict: 'campaign_id,occurred_date,occurred_hour,geo_city,geo_region,device' });

  if (error) {
    console.error('[activity] upsert failed:', error);
  }
}

export interface ActivityFeedItem {
  occurred_at: string;       // ISO string built from date + hour
  city: string | null;
  region: string | null;
  device: string | null;
  clicks: number;
  impressions: number;
  cost_cents: number;
}

/** Pull the last `limit` rows for the activity feed, newest first. */
export async function getActivityFeed(campaignId: string, limit = 25): Promise<ActivityFeedItem[]> {
  const db = createAdminClient();
  const { data } = await db
    .from('marketing_activity_events')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('occurred_date', { ascending: false })
    .order('occurred_hour', { ascending: false })
    .limit(limit);

  return ((data as ActivityEvent[]) || []).map(r => ({
    occurred_at: `${r.occurred_date}T${String(r.occurred_hour).padStart(2, '0')}:00:00Z`,
    city: r.geo_city,
    region: r.geo_region,
    device: r.device,
    clicks: r.clicks,
    impressions: r.impressions,
    cost_cents: r.cost_cents,
  }));
}
