import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getOpsAccessContext } from '@/lib/ops/access';
import { createSearchCampaign, createDisplayCampaign } from '@/lib/marketing/google-ads';
import { createAdCampaign } from '@/lib/marketing/meta-ads';
import { sendEmailCampaign } from '@/lib/marketing/email-campaigns';
import type { Campaign } from '@/lib/marketing/types';

async function assertAdmin(): Promise<{ userId: string; email: string } | null> {
  const access = await getOpsAccessContext();
  if (!access?.isAdmin) return null;
  return { userId: access.userId, email: access.userEmail ?? '' };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const db = createAdminClient();

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

  try {
    let externalIds: { campaignId?: string; adGroupId?: string; adId?: string; adSetId?: string; warnings?: string[] } = {};
    const typedCampaign = campaign as unknown as Campaign;

    if (campaign.channel === 'google_ads') {
      if (campaign.campaign_type === 'search') {
        externalIds = await createSearchCampaign(typedCampaign);
      } else {
        externalIds = await createDisplayCampaign(typedCampaign);
      }
    } else if (campaign.channel === 'meta_ads') {
      externalIds = await createAdCampaign(typedCampaign);
    } else if (campaign.channel === 'email') {
      const body = await request.json().catch(() => ({}));
      const recipients = body.recipients || campaign.targeting?.recipientEmails || [];
      const recipientList = Array.isArray(recipients)
        ? recipients.map((e: string) => ({ email: e }))
        : [];

      if (recipientList.length === 0) {
        throw new Error('No recipients specified for email campaign');
      }

      const result = await sendEmailCampaign(typedCampaign, recipientList);

      if (result.failed > 0 && result.sent === 0) {
        throw new Error(`All emails failed: ${result.errors.join(', ')}`);
      }

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
      details: {
        external_ids: externalIds,
        channel: campaign.channel,
        // Bidding/budget calibration notes (ceiling applied, thin-budget flags).
        calibration_warnings: externalIds.warnings || [],
      },
    });

    return NextResponse.json({
      success: true,
      status: 'active',
      externalIds,
      warnings: externalIds.warnings || [],
    });
  } catch (err: any) {
    console.error(`[ops/marketing/approve] Failed to launch campaign ${id}:`, err);

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
