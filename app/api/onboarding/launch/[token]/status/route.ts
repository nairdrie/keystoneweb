import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';

/**
 * GET /api/onboarding/launch/[token]/status
 *
 * Lightweight polling endpoint used by the launching loader.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: req, error } = await db
    .from('launch_requests')
    .select('onboarding_status, launched_at, site_id')
    .eq('onboarding_token', token)
    .single();

  if (error || !req) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let site = null;
  if (req.site_id) {
    const { data: s } = await db
      .from('sites')
      .select('id, published_domain, custom_domain, is_published')
      .eq('id', req.site_id)
      .single();
    site = s ?? null;
  }

  return NextResponse.json({
    onboardingStatus: req.onboarding_status,
    launchedAt: req.launched_at,
    site,
  });
}
