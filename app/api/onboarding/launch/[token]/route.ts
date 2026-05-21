import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { createClient } from '@/lib/db/supabase-server';

/**
 * GET /api/onboarding/launch/[token]
 *
 * Public — returns onboarding state for the client.
 * No auth required; the token is the credential.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: req, error } = await db
    .from('launch_requests')
    .select(
      'id, name, email, business_name, site_id, launch_config, launch_service_price_cents, onboarding_status, onboarding_user_id, launched_at',
    )
    .eq('onboarding_token', token)
    .maybeSingle();

  if (error || !req) {
    return NextResponse.json({ error: 'Onboarding link not found' }, { status: 404 });
  }

  let site: { id: string; site_slug: string | null; published_domain: string | null; custom_domain: string | null } | null = null;
  if (req.site_id) {
    const { data: s } = await db
      .from('sites')
      .select('id, site_slug, published_domain, custom_domain')
      .eq('id', req.site_id)
      .single();
    site = s ?? null;
  }

  return NextResponse.json({
    id: req.id,
    name: req.name,
    email: req.email,
    businessName: req.business_name,
    launchConfig: req.launch_config,
    launchServicePriceCents: req.launch_service_price_cents,
    onboardingStatus: req.onboarding_status,
    onboardingUserId: req.onboarding_user_id,
    launchedAt: req.launched_at,
    site,
  });
}

/**
 * PATCH /api/onboarding/launch/[token]
 * Body: { action: 'advance-to-payment' }
 *
 * Authenticated client (the onboarding_user_id user) advances the state machine.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  let body: { action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

  const db = createAdminClient();
  const { data: req, error } = await db
    .from('launch_requests')
    .select('id, onboarding_user_id, onboarding_status')
    .eq('onboarding_token', token)
    .single();
  if (error || !req) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (req.onboarding_user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (body.action === 'advance-to-payment') {
    const allowedFrom = ['previewing', 'editing', 'set_password', 'changes_requested'];
    if (!allowedFrom.includes(req.onboarding_status)) {
      return NextResponse.json(
        { error: 'Cannot advance from current state' },
        { status: 400 },
      );
    }
    const { error: updErr } = await db
      .from('launch_requests')
      .update({ onboarding_status: 'awaiting_payment' })
      .eq('id', req.id);
    if (updErr) return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
