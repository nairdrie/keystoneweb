import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { isGoogleAdsConfigured } from '@/lib/marketing/google-ads';
import { isMetaAdsConfigured } from '@/lib/marketing/meta-ads';



import { assertOpsAdmin } from '@/lib/ops/access';
export async function GET() {
  if (!await assertOpsAdmin()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = createAdminClient();
  const { data: settings } = await db
    .from('marketing_settings')
    .select('*')
    .is('site_id', null)
    .single();

  return NextResponse.json({
    settings: settings || {
      monthly_budget_limit_cents: null,
      auto_suggest: true,
    },
    exists: !!settings,
    connections: {
      google_ads: isGoogleAdsConfigured(),
      meta_ads: isMetaAdsConfigured(),
      email: !!(process.env.RESEND_API_KEY),
    },
  });
}

export async function PUT(request: NextRequest) {
  if (!await assertOpsAdmin()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const db = createAdminClient();

  const { data: existing } = await db
    .from('marketing_settings')
    .select('id')
    .is('site_id', null)
    .single();

  const fields = {
    monthly_budget_limit_cents: body.monthly_budget_limit_cents ?? null,
    auto_suggest: body.auto_suggest ?? true,
    updated_at: new Date().toISOString(),
  };

  let result;
  if (existing) {
    result = await db
      .from('marketing_settings')
      .update(fields)
      .eq('id', existing.id)
      .select()
      .single();
  } else {
    result = await db
      .from('marketing_settings')
      .insert({ ...fields, site_id: null })
      .select()
      .single();
  }

  if (result.error) {
    console.error('[ops/marketing/settings] PUT error:', result.error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }

  return NextResponse.json({ settings: result.data });
}
