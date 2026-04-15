import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { checkBudgetExceeded } from '@/lib/marketing/spend';
import { pauseCampaign as pauseGoogleCampaign } from '@/lib/marketing/google-ads';
import { pauseCampaign as pauseMetaCampaign } from '@/lib/marketing/meta-ads';
import type { MarketingSettings } from '@/lib/marketing/types';

/**
 * GET /api/cron/marketing-budget-check
 *
 * Invoked every 2 hours by Vercel Cron.
 * Checks active campaigns for budget overruns and auto-pauses them.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createAdminClient();

  // Get all active campaigns with a total budget set
  const { data: campaigns, error } = await db
    .from('marketing_campaigns')
    .select('id, channel, external_campaign_id, total_budget_cents, spent_cents, name')
    .eq('status', 'active')
    .not('total_budget_cents', 'is', null);

  if (error) {
    console.error('[cron/marketing-budget-check] Query error:', error);
    return NextResponse.json({ error: 'DB query failed' }, { status: 500 });
  }

  if (!campaigns?.length) {
    return NextResponse.json({ success: true, checked: 0, paused: 0 });
  }

  // Fetch platform settings for pausing
  const { data: settings } = await db
    .from('marketing_settings')
    .select('*')
    .is('site_id', null)
    .single();

  let paused = 0;
  const errors: string[] = [];

  for (const campaign of campaigns) {
    const budget = await checkBudgetExceeded(campaign.id, db);

    if (budget.exceeded) {
      try {
        // Pause on the ad platform
        if (campaign.channel === 'google_ads' && campaign.external_campaign_id && settings) {
          await pauseGoogleCampaign(settings as MarketingSettings, campaign.external_campaign_id);
        } else if (campaign.channel === 'meta_ads' && campaign.external_campaign_id && settings) {
          await pauseMetaCampaign(settings as MarketingSettings, campaign.external_campaign_id);
        }

        // Update status in DB
        await db.from('marketing_campaigns').update({
          status: 'paused',
          updated_at: new Date().toISOString(),
        }).eq('id', campaign.id);

        // Log the event
        await db.from('marketing_campaign_log').insert({
          campaign_id: campaign.id,
          action: 'paused',
          actor: 'cron',
          details: {
            reason: 'budget_exceeded',
            spent: budget.spent,
            budget: budget.budget,
          },
        });

        console.log(`[cron/marketing-budget-check] Paused campaign "${campaign.name}" — spent ${budget.spent} / budget ${budget.budget}`);
        paused++;
      } catch (err: any) {
        console.error(`[cron/marketing-budget-check] Failed to pause campaign ${campaign.id}:`, err);
        errors.push(`Campaign ${campaign.id}: ${err.message}`);
      }
    }
  }

  return NextResponse.json({
    success: true,
    checked: campaigns.length,
    paused,
    errors: errors.length > 0 ? errors : undefined,
  });
}
