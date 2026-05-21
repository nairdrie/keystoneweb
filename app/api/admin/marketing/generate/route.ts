import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { generateCampaign, assembleContextFromSite } from '@/lib/marketing/generate';
import { getMarketingAccess } from '@/lib/marketing/admin-auth';
import type { MarketingChannel, CampaignType, CampaignGenerationContext } from '@/lib/marketing/types';

/**
 * POST /api/admin/marketing/generate
 *
 * AI-generate campaign content from the site's stored business data. Does NOT
 * persist — returns the content for the wizard to review and edit.
 *
 * Body: { siteId, channel, campaignType, contextOverrides? }
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await getMarketingAccess(request, { siteIdFromBody: body });
  if ('error' in result) return result.error;
  const { access } = result;

  const { channel, campaignType, contextOverrides } = body as {
    channel: MarketingChannel;
    campaignType: CampaignType;
    contextOverrides?: Partial<CampaignGenerationContext>;
  };

  if (!channel || !campaignType) {
    return NextResponse.json({ error: 'Missing channel or campaignType' }, { status: 400 });
  }

  try {
    const db = createAdminClient();
    const baseContext = await assembleContextFromSite(access.siteId, db);
    const context: CampaignGenerationContext = { ...baseContext, ...(contextOverrides || {}) };

    if (!context.businessName) {
      return NextResponse.json({ error: 'Could not determine business name from site' }, { status: 400 });
    }

    const generated = await generateCampaign(context, channel, campaignType);
    return NextResponse.json({ result: generated, context });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI generation failed';
    console.error('[admin/marketing/generate] error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
