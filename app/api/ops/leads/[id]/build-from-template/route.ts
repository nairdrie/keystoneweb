import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { requireOpsAccess } from '@/lib/ops/access';
import { duplicateSite } from '@/lib/sites/duplicate';

// POST /api/ops/leads/[id]/build-from-template
// Builds a site for a lead by duplicating one of the operator's existing sites
// (used as a template), branding it with the lead's business name, moving the
// lead into the "building" stage, and opening a linked launch service request
// with the new site attached.
//
// Body: { siteId: string } — the operator's source site to clone.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireOpsAccess();
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const sourceSiteId = body && typeof body.siteId === 'string' ? body.siteId : '';
  if (!sourceSiteId) {
    return NextResponse.json({ error: 'A template site is required' }, { status: 400 });
  }

  const db = createAdminClient();

  // ── Load the lead ─────────────────────────────────────────────────────────
  const { data: lead, error: leadErr } = await db
    .from('leads')
    .select('id, business_name, contact_name, email, phone, business_type')
    .eq('id', id)
    .single();

  if (leadErr || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }
  const businessName = lead.business_name?.trim();
  if (!businessName) {
    return NextResponse.json(
      { error: 'Add a business name to this lead before building a site.' },
      { status: 400 },
    );
  }

  // ── Guard against building twice ────────────────────────────────────────────
  const { data: existing } = await db
    .from('launch_requests')
    .select('id')
    .eq('lead_id', id)
    .limit(1)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: 'This lead already has a launch service request.' },
      { status: 409 },
    );
  }

  // ── Validate the template site belongs to the operator ──────────────────────
  const { data: site } = await db
    .from('sites')
    .select('id, user_id')
    .eq('id', sourceSiteId)
    .single();
  if (!site) {
    return NextResponse.json({ error: 'Template site not found' }, { status: 400 });
  }
  if (site.user_id !== access.userId) {
    return NextResponse.json({ error: 'You can only build from your own sites' }, { status: 403 });
  }

  // ── Duplicate the site, branding it with the lead's business name ───────────
  // The new slug and the header/footer site title both take the business name.
  const result = await duplicateSite(db, sourceSiteId, access.userId, {
    newSlug: businessName,
    siteTitle: businessName,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const newSiteId = result.siteId;

  // ── Move the lead into the building stage ───────────────────────────────────
  await db.from('leads').update({ status: 'building' }).eq('id', id);

  // ── Open a linked launch service request with the new site attached ─────────
  const { data: launchRequest, error: launchErr } = await db
    .from('launch_requests')
    .insert({
      name: lead.contact_name || businessName,
      email: lead.email || '',
      phone: lead.phone,
      business_name: businessName,
      business_type: lead.business_type,
      status: 'building',
      site_id: newSiteId,
      assignee_user_id: access.userId,
      lead_id: lead.id,
    })
    .select('id')
    .single();

  if (launchErr || !launchRequest) {
    console.error('[ops/leads] failed to create launch_request from build:', launchErr);
    // The site was created and the lead moved; surface a partial-success error so
    // the operator knows to link the launch request manually rather than rebuild.
    return NextResponse.json(
      { error: 'Site built, but creating the launch request failed.', siteId: newSiteId },
      { status: 500 },
    );
  }

  return NextResponse.json({ siteId: newSiteId, launchRequestId: launchRequest.id });
}
