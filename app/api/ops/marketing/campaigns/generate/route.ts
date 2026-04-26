import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { generateCampaign } from '@/lib/marketing/generate';
import type { MarketingChannel, CampaignType, CampaignGenerationContext } from '@/lib/marketing/types';

async function assertAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const adminEmails = (process.env.OPS_ADMIN_EMAILS || '')
      .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    return adminEmails.includes(user.email?.toLowerCase() ?? '');
  } catch { return false; }
}

/**
 * POST /api/ops/marketing/campaigns/generate
 * AI-generate campaign content. Does NOT save — returns content for review.
 */
export async function POST(request: NextRequest) {
  if (!await assertAdmin()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { channel, campaignType, context } = body as {
    channel: MarketingChannel;
    campaignType: CampaignType;
    context: CampaignGenerationContext;
  };

  if (!channel || !campaignType || !context?.businessName) {
    return NextResponse.json(
      { error: 'Missing required fields: channel, campaignType, context.businessName' },
      { status: 400 },
    );
  }

  try {
    const result = await generateCampaign(context, channel, campaignType);
    return NextResponse.json({ result });
  } catch (err: any) {
    console.error('[ops/marketing/generate] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
