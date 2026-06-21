import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { requireOpsAccess } from '@/lib/ops/access';
import { industryForNiche } from '@/lib/ops/leads';

// PATCH /api/ops/lead-prospects/[id]
// Two operations encoded via { action }:
//   { action: 'dismiss', reason? } — flag as not worth pursuing
//   { action: 'undismiss' }        — un-flag
//   { action: 'promote' }          — copy into the leads table
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireOpsAccess();
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const action = (body && typeof body === 'object' && 'action' in body ? body.action : null) as
    | 'dismiss'
    | 'undismiss'
    | 'promote'
    | null;

  if (!action) {
    return NextResponse.json({ error: 'Missing action' }, { status: 400 });
  }

  const db = createAdminClient();

  if (action === 'dismiss') {
    const reason =
      body && typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : null;
    const { data, error } = await db
      .from('lead_prospects')
      .update({
        dismissed_at: new Date().toISOString(),
        dismissed_reason: reason,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (action === 'undismiss') {
    const { data, error } = await db
      .from('lead_prospects')
      .update({ dismissed_at: null, dismissed_reason: null })
      .eq('id', id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (action === 'promote') {
    const { data: prospect, error: pErr } = await db
      .from('lead_prospects')
      .select('*')
      .eq('id', id)
      .single();
    if (pErr || !prospect) {
      return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
    }
    if (prospect.promoted_lead_id) {
      return NextResponse.json(
        { error: 'Already promoted', lead_id: prospect.promoted_lead_id },
        { status: 409 },
      );
    }

    // Pull the discovery query for source_detail context.
    let sourceDetail = 'auto-discovery';
    if (prospect.discovered_via_query_id) {
      const { data: q } = await db
        .from('lead_discovery_queries')
        .select('niche, city')
        .eq('id', prospect.discovered_via_query_id)
        .single();
      if (q) sourceDetail = `auto-discovery: ${q.niche} in ${q.city}`;
    }

    // Build a "research notes" seed from the audit data so the lead detail
    // page has the pitch context immediately visible without a separate join.
    const notesParts: string[] = [];
    if (prospect.pitch_angles?.length > 0) {
      notesParts.push('Pitch angles:\n' + prospect.pitch_angles.map((a: string) => `- ${a}`).join('\n'));
    }
    if (prospect.cms && prospect.cms !== 'unknown') {
      notesParts.push(`CMS: ${prospect.cms} (${prospect.cms_confidence ?? 'unknown'} confidence)`);
    }
    if (prospect.perf_score !== null) {
      notesParts.push(
        `Lighthouse mobile — Perf ${prospect.perf_score}, SEO ${prospect.seo_score}, ` +
          `Best Practices ${prospect.best_practices_score}, A11y ${prospect.accessibility_score}` +
          (prospect.mobile_load_seconds ? ` · LCP ${prospect.mobile_load_seconds}s` : ''),
      );
    }

    // Prefer the clean discovery niche (e.g. "landscaper") over Google's noisy
    // business_types, and map it onto the leads industry filter so the promoted
    // lead is findable by category in the pipeline.
    const niche = prospect.niche ?? prospect.business_types?.[0]?.replace(/_/g, ' ') ?? null;

    const leadInsert = {
      contact_name: null,
      business_name: prospect.name,
      email: null,
      phone: prospect.phone,
      website: prospect.website,
      has_existing_website: Boolean(prospect.website),
      business_type: niche,
      industry: industryForNiche(niche),
      address: prospect.formatted_address,
      city: prospect.city,
      region: prospect.region === 'toronto_core' ? 'Ontario' : 'Ontario', // placeholder
      country: 'Canada',
      source: 'organic_search',
      source_detail: sourceDetail,
      status: 'new',
      notes: notesParts.join('\n\n') || null,
      assignee_user_id: access.userId,
    };

    const { data: lead, error: leadErr } = await db
      .from('leads')
      .insert(leadInsert)
      .select()
      .single();
    if (leadErr || !lead) {
      return NextResponse.json({ error: leadErr?.message ?? 'Lead create failed' }, { status: 500 });
    }

    await db
      .from('lead_prospects')
      .update({ promoted_lead_id: lead.id, promoted_at: new Date().toISOString() })
      .eq('id', prospect.id);

    return NextResponse.json({ prospect_id: prospect.id, lead_id: lead.id });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
