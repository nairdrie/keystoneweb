import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import {
  ensureKswdInboxAddress,
  getCustomInboxAddressLimit,
  listSiteInboxAddresses,
} from '@/lib/email/inbox-addresses';

/**
 * GET /api/email/addresses?siteId=...
 *   List addresses configured for the site. Auto-creates the kswd row if missing.
 *
 * POST /api/email/addresses
 *   Body: { siteId, localPart }
 *   Adds a custom-domain inbox address. Subject to the user's
 *   custom_inbox_email allowance (1 + extra_inbox_email addon units).
 *
 * DELETE /api/email/addresses?siteId=...&addressId=...
 *   Removes a custom-domain inbox address. The kswd subdomain row cannot be deleted.
 */

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const siteId = request.nextUrl.searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId is required' }, { status: 400 });

  const { data: site } = await supabase
    .from('sites')
    .select('id, user_id, published_domain, custom_domain')
    .eq('id', siteId)
    .single();
  if (!site || site.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = createAdminClient();
  if (site.published_domain) {
    await ensureKswdInboxAddress(db, siteId, site.published_domain);
  }
  const addresses = await listSiteInboxAddresses(db, siteId);

  // How many *custom-domain* addresses can this user have across all their sites?
  const limit = await getCustomInboxAddressLimit(db, user.id);
  const { count: usedCount } = await db
    .from('site_inbox_addresses')
    .select('id, sites!inner(user_id)', { count: 'exact', head: true })
    .eq('kind', 'custom_domain')
    .eq('sites.user_id', user.id);

  return NextResponse.json({
    addresses,
    customDomain: site.custom_domain ?? null,
    customAddressUsage: { used: usedCount ?? 0, limit },
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { siteId, localPart } = body as { siteId: string; localPart: string };

  if (!siteId || !localPart) return NextResponse.json({ error: 'siteId and localPart are required' }, { status: 400 });
  if (!/^[a-z0-9._+-]+$/i.test(localPart) || localPart.length > 64) {
    return NextResponse.json({ error: 'Invalid email prefix' }, { status: 400 });
  }

  const { data: site } = await supabase
    .from('sites')
    .select('id, user_id, custom_domain, published_domain')
    .eq('id', siteId)
    .single();
  if (!site || site.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!site.custom_domain) {
    return NextResponse.json({ error: 'This site has no active custom domain' }, { status: 400 });
  }

  const db = createAdminClient();

  // Verify Pro
  const { data: subscription } = await db
    .from('user_subscriptions')
    .select('subscription_status, subscription_plan')
    .eq('user_id', user.id)
    .maybeSingle();
  const isPro = subscription?.subscription_status === 'active' &&
    subscription?.subscription_plan?.toLowerCase().includes('pro');
  if (!isPro) return NextResponse.json({ error: 'Pro plan required' }, { status: 403 });

  // Check addon-based limit across all the user's sites
  const limit = await getCustomInboxAddressLimit(db, user.id);
  const { count: usedCount } = await db
    .from('site_inbox_addresses')
    .select('id, sites!inner(user_id)', { count: 'exact', head: true })
    .eq('kind', 'custom_domain')
    .eq('sites.user_id', user.id);
  if ((usedCount ?? 0) >= limit) {
    return NextResponse.json({
      error: 'Inbox address limit reached',
      addonNeeded: 'extra_inbox_email',
      used: usedCount,
      limit,
    }, { status: 402 });
  }

  const fullAddress = `${localPart.toLowerCase()}@${site.custom_domain.toLowerCase()}`;

  // Uniqueness check
  const { data: conflict } = await db
    .from('site_inbox_addresses')
    .select('id')
    .ilike('address', fullAddress)
    .maybeSingle();
  if (conflict) return NextResponse.json({ error: 'That address is already in use' }, { status: 409 });

  // Reuse the existing Resend domain registration logic if the domain isn't set up yet
  let resendDomainId: string | null = null;
  const { data: siblingWithResend } = await db
    .from('site_inbox_addresses')
    .select('resend_domain_id')
    .eq('kind', 'custom_domain')
    .ilike('address', `%@${site.custom_domain.toLowerCase()}`)
    .not('resend_domain_id', 'is', null)
    .limit(1)
    .maybeSingle();
  resendDomainId = siblingWithResend?.resend_domain_id ?? null;

  if (!resendDomainId && process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { data: list } = await resend.domains.list();
      const existing = (list?.data ?? []).find((d: { name: string }) => d.name === site.custom_domain);
      if (existing) {
        resendDomainId = existing.id;
      } else {
        const { data: created } = await resend.domains.create({
          name: site.custom_domain,
          capabilities: { sending: 'enabled', receiving: 'enabled' },
        });
        resendDomainId = created?.id ?? null;
      }
    } catch (err) {
      console.warn('[email/addresses] resend domain lookup failed:', err);
    }
  }

  // Insert. If this is the first custom address on the site, mark it primary.
  const { data: existingPrimary } = await db
    .from('site_inbox_addresses')
    .select('id')
    .eq('site_id', siteId)
    .eq('is_primary', true)
    .maybeSingle();

  const { data: row, error } = await db
    .from('site_inbox_addresses')
    .insert({
      site_id: siteId,
      address: fullAddress,
      kind: 'custom_domain',
      is_primary: !existingPrimary,
      resend_domain_id: resendDomainId,
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to add address', detail: error.message }, { status: 500 });
  }

  // Mirror primary into the legacy sites.inbox_custom_email column so older
  // callers (and the inbound webhook fallback) keep working.
  if (row.is_primary) {
    await db
      .from('sites')
      .update({ inbox_custom_email: fullAddress, inbox_resend_domain_id: resendDomainId })
      .eq('id', siteId);
  }

  return NextResponse.json({ address: row });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const siteId = request.nextUrl.searchParams.get('siteId');
  const addressId = request.nextUrl.searchParams.get('addressId');
  if (!siteId || !addressId) {
    return NextResponse.json({ error: 'siteId and addressId are required' }, { status: 400 });
  }

  const { data: site } = await supabase
    .from('sites')
    .select('id, user_id')
    .eq('id', siteId)
    .single();
  if (!site || site.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = createAdminClient();
  const { data: row } = await db
    .from('site_inbox_addresses')
    .select('*')
    .eq('id', addressId)
    .eq('site_id', siteId)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (row.kind === 'kswd_subdomain') {
    return NextResponse.json({ error: 'The kswd.ca address cannot be removed' }, { status: 400 });
  }

  await db.from('site_inbox_addresses').delete().eq('id', addressId);

  // If we removed the primary, promote another one (prefer kswd, then earliest custom)
  if (row.is_primary) {
    const { data: candidates } = await db
      .from('site_inbox_addresses')
      .select('id, kind, created_at')
      .eq('site_id', siteId)
      .order('kind', { ascending: false })  // 'kswd_subdomain' < 'custom_domain' alphabetically; using desc here is fine — both are valid
      .order('created_at', { ascending: true });
    const next = candidates?.[0];
    if (next) await db.from('site_inbox_addresses').update({ is_primary: true }).eq('id', next.id);
  }

  // Clear legacy sites.inbox_custom_email if this address was mirrored there
  await db.from('sites').update({ inbox_custom_email: null, inbox_resend_domain_id: null })
    .eq('id', siteId)
    .eq('inbox_custom_email', row.address);

  return NextResponse.json({ success: true });
}

/**
 * PATCH /api/email/addresses
 *   Body: { siteId, addressId } — set the given address as the site's primary.
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { siteId, addressId } = body as { siteId: string; addressId: string };
  if (!siteId || !addressId) {
    return NextResponse.json({ error: 'siteId and addressId are required' }, { status: 400 });
  }

  const { data: site } = await supabase
    .from('sites')
    .select('id, user_id')
    .eq('id', siteId)
    .single();
  if (!site || site.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = createAdminClient();
  await db.from('site_inbox_addresses').update({ is_primary: false }).eq('site_id', siteId);
  const { data: updated, error } = await db
    .from('site_inbox_addresses')
    .update({ is_primary: true })
    .eq('id', addressId)
    .eq('site_id', siteId)
    .select('*')
    .single();
  if (error || !updated) return NextResponse.json({ error: 'Failed to set primary' }, { status: 500 });

  // Mirror to legacy column if it's a custom-domain primary
  if (updated.kind === 'custom_domain') {
    await db.from('sites').update({
      inbox_custom_email: updated.address,
      inbox_resend_domain_id: updated.resend_domain_id,
    }).eq('id', siteId);
  } else {
    await db.from('sites').update({
      inbox_custom_email: null,
      inbox_resend_domain_id: null,
    }).eq('id', siteId);
  }

  return NextResponse.json({ address: updated });
}
