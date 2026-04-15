import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { createClient } from '@/lib/db/supabase-server';

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
 * GET /api/ops/marketing/settings
 * Get platform-level marketing settings.
 */
export async function GET() {
  if (!await assertAdmin()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = createAdminClient();
  const { data: settings } = await db
    .from('marketing_settings')
    .select('*')
    .is('site_id', null)
    .single();

  // Return empty settings if none exist yet
  return NextResponse.json({
    settings: settings || {
      google_ads_customer_id: null,
      meta_ad_account_id: null,
      meta_page_id: null,
      meta_instagram_actor_id: null,
      monthly_budget_limit_cents: null,
      auto_suggest: true,
    },
    exists: !!settings,
  });
}

/**
 * PUT /api/ops/marketing/settings
 * Create or update platform-level marketing settings.
 */
export async function PUT(request: NextRequest) {
  if (!await assertAdmin()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const db = createAdminClient();

  // Check if settings exist
  const { data: existing } = await db
    .from('marketing_settings')
    .select('id')
    .is('site_id', null)
    .single();

  const fields = {
    google_ads_customer_id: body.google_ads_customer_id ?? null,
    google_ads_refresh_token: body.google_ads_refresh_token ?? null,
    meta_ad_account_id: body.meta_ad_account_id ?? null,
    meta_access_token: body.meta_access_token ?? null,
    meta_page_id: body.meta_page_id ?? null,
    meta_instagram_actor_id: body.meta_instagram_actor_id ?? null,
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
