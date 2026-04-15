import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { createClient } from '@/lib/db/supabase-server';
import { createSearchCampaign, createDisplayCampaign } from '@/lib/marketing/google-ads';
import { createAdCampaign } from '@/lib/marketing/meta-ads';
import { sendEmailCampaign } from '@/lib/marketing/email-campaigns';
import type { Campaign, MarketingSettings, EmailContent } from '@/lib/marketing/types';

async function assertAdmin(): Promise<{ userId: string; email: string } | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const adminEmails = (process.env.OPS_ADMIN_EMAILS || '')
      .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    if (!adminEmails.includes(user.email?.toLowerCase() ?? '')) return null;
    return { userId: user.id, email: user.email ?? '' };
  } catch { return null; }
}

/**
 * POST /api/ops/marketing/campaigns/[id]/approve
 * Approve a campaign and submit it to the ad platform.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const db = createAdminClient();

  // Fetch campaign
  const { data: campaign, error: fetchErr } = await db
    .from('marketing_campaigns')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  if (!['draft', 'suggested', 'failed'].includes(campaign.status)) {
    return NextResponse.json(
      { error: `Cannot approve campaign with status "${campaign.status}"` },
      { status: 400 },
    );
  }

  // Mark as approved + submitting
  await db.from('marketing_campaigns').update({
    status: 'submitting',
    approved_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', id);

  await db.from('marketing_campaign_log').insert({
    campaign_id: id,
    action: 'approved',
    actor: `user:${admin.email}`,
  });

  // Fetch platform settings
  const { data: settings } = await db
    .from('marketing_settings')
    .select('*')
    .is('site_id', null)
    .single();

  try {
    let externalIds: { campaignId?: string; adGroupId?: string; adId?: string; adSetId?: string } = {};

    if (campaign.channel === 'google_ads') {
      if (!settings?.google_ads_customer_id) {
        throw new Error('Google Ads account not connected');
      }
      const typedCampaign = campaign as unknown as Campaign;
      if (campaign.campaign_type === 'search') {
        externalIds = await createSearchCampaign(settings as MarketingSettings, typedCampaign);
      } else {
        externalIds = await createDisplayCampaign(settings as MarketingSettings, typedCampaign);
      }
    } else if (campaign.channel === 'meta_ads') {
      if (!settings?.meta_ad_account_id) {
        throw new Error('Meta ad account not connected');
      }
      const typedCampaign = campaign as unknown as Campaign;
      externalIds = await createAdCampaign(settings as MarketingSettings, typedCampaign);
    } else if (campaign.channel === 'email') {
      // For email campaigns, parse recipients from targeting
      const body = await request.json().catch(() => ({}));
      const recipients = body.recipients || campaign.targeting?.recipientEmails || [];
      const recipientList = Array.isArray(recipients)
        ? recipients.map((e: string) => ({ email: e }))
        : [];

      if (recipientList.length === 0) {
        throw new Error('No recipients specified for email campaign');
      }

      const typedCampaign = campaign as unknown as Campaign;
      const result = await sendEmailCampaign(typedCampaign, recipientList);

      if (result.failed > 0 && result.sent === 0) {
        throw new Error(`All emails failed: ${result.errors.join(', ')}`);
      }

      // Email campaigns complete immediately
      await db.from('marketing_campaigns').update({
        status: 'completed',
        launched_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', id);

      await db.from('marketing_campaign_log').insert({
        campaign_id: id,
        action: 'launched',
        actor: 'system',
        details: { sent: result.sent, failed: result.failed, channel: 'email' },
      });

      return NextResponse.json({
        success: true,
        status: 'completed',
        details: { sent: result.sent, failed: result.failed },
      });
    }

    // Update campaign with external IDs and mark as active
    await db.from('marketing_campaigns').update({
      status: 'active',
      launched_at: new Date().toISOString(),
      external_campaign_id: externalIds.campaignId || null,
      external_ad_group_id: externalIds.adGroupId || externalIds.adSetId || null,
      external_ad_id: externalIds.adId || null,
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    await db.from('marketing_campaign_log').insert({
      campaign_id: id,
      action: 'launched',
      actor: 'system',
      details: { external_ids: externalIds, channel: campaign.channel },
    });

    return NextResponse.json({
      success: true,
      status: 'active',
      externalIds,
    });
  } catch (err: any) {
    console.error(`[ops/marketing/approve] Failed to launch campaign ${id}:`, err);

    // Mark as failed
    await db.from('marketing_campaigns').update({
      status: 'failed',
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    await db.from('marketing_campaign_log').insert({
      campaign_id: id,
      action: 'failed',
      actor: 'system',
      details: { error: err.message },
    });

    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
