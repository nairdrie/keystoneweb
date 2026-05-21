import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_DOMAIN } from '@/lib/env/domain';
import { assertOpsAdmin, getOpsAccessContext } from '@/lib/ops/access';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { ADMIN_SITE_COOKIE } from '@/lib/auth/site-access';

const IMPERSONATE_COOKIE = 'ksw_impersonate';

/**
 * POST /api/ops/manage-site
 * Body: { siteId: string }
 *
 * Enters Admin Manage-Site mode for the given site. Clears any active
 * impersonation cookie so the two modes are mutually exclusive.
 */
export async function POST(request: NextRequest) {
  if (!(await assertOpsAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { siteId } = await request.json();
  if (!siteId || typeof siteId !== 'string') {
    return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: site, error } = await db
    .from('sites')
    .select('id')
    .eq('id', siteId)
    .single();

  if (error || !site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_SITE_COOKIE, siteId, {
    path: '/',
    domain: COOKIE_DOMAIN,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 2,
  });
  // Clear any active impersonation so the two flows never combine.
  response.cookies.set(IMPERSONATE_COOKIE, '', {
    path: '/',
    domain: COOKIE_DOMAIN,
    maxAge: 0,
  });

  return response;
}

/**
 * DELETE /api/ops/manage-site
 * Exits manage-mode.
 */
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_SITE_COOKIE, '', {
    path: '/',
    domain: COOKIE_DOMAIN,
    maxAge: 0,
  });
  return response;
}

/**
 * GET /api/ops/manage-site
 * Returns the current manage-mode context for the banner, or { active: false }.
 */
export async function GET(request: NextRequest) {
  const ctx = await getOpsAccessContext();
  if (!ctx?.isAdmin) {
    return NextResponse.json({ active: false });
  }

  const siteId = request.cookies.get(ADMIN_SITE_COOKIE)?.value;
  if (!siteId) {
    return NextResponse.json({ active: false });
  }

  const db = createAdminClient();
  const { data: site } = await db
    .from('sites')
    .select('id, site_slug, business_type, user_id')
    .eq('id', siteId)
    .single();

  if (!site) {
    return NextResponse.json({ active: false });
  }

  const { data: owner } = await db
    .from('users')
    .select('email, business_name')
    .eq('id', site.user_id)
    .single();

  return NextResponse.json({
    active: true,
    siteId: site.id,
    siteSlug: site.site_slug,
    businessType: site.business_type,
    ownerEmail: owner?.email ?? null,
    ownerBusinessName: owner?.business_name ?? null,
  });
}
