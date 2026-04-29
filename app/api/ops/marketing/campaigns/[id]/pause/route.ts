import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { createClient } from '@/lib/db/supabase-server';
import { pauseCampaign as pauseGoogleCampaign } from '@/lib/marketing/google-ads';
import { pauseCampaign as pauseMetaCampaign } from '@/lib/marketing/meta-ads';

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
