import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getOpsAccessContext } from '@/lib/ops/access';
import { pauseCampaign as pauseGoogleCampaign } from '@/lib/marketing/google-ads';
import { pauseCampaign as pauseMetaCampaign } from '@/lib/marketing/meta-ads';

async function assertAdmin(): Promise<{ userId: string; email: string } | null> {
  const access = await getOpsAccessContext();
  if (!access?.isAdmin) return null;
  return { userId: access.userId, email: access.userEmail ?? '' };
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await assertAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const db = createAdminClient();

  const { data: campaign } = await db
    .from('marketing_campaigns')
    .select('*')
    .eq('id', id)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  if (campaign.status !== 'active') {
    return NextResponse.json(
      { error: `Cannot pause campaign with status "${campaign.status}"` },
      { status: 400 },
    );
  }

  try {
    if (campaign.channel === 'google_ads' && campaign.external_campaign_id) {
      await pauseGoogleCampaign(campaign.external_campaign_id);
    } else if (campaign.channel === 'meta_ads' && campaign.external_campaign_id) {
      await pauseMetaCampaign(campaign.external_campaign_id);
    }

    await db.from('marketing_campaigns').update({
      status: 'paused',
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    await db.from('marketing_campaign_log').insert({
      campaign_id: id,
      action: 'paused',
      actor: `user:${admin.email}`,
    });

    return NextResponse.json({ success: true, status: 'paused' });
  } catch (err: any) {
    console.error(`[ops/marketing/pause] Failed to pause campaign ${id}:`, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
