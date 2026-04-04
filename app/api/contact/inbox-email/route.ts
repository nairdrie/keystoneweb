import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';

const VERCEL_API_BASE = 'https://api.vercel.com';
const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;

// MX record value for Resend inbound email receiving
const RESEND_INBOUND_MX = 'feedback.resend.com';

/**
 * Add an MX record to a Vercel-managed domain for Resend inbound email.
 * Returns { success, error?, alreadyExists? }.
 */
async function addVercelMxRecord(domain: string): Promise<{ success: boolean; error?: string; alreadyExists?: boolean }> {
  if (!VERCEL_API_TOKEN) {
    return { success: false, error: 'VERCEL_API_TOKEN not configured' };
  }

  const teamParam = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : '';

  // First, check if the MX record already exists to avoid duplicates
  try {
    const listRes = await fetch(
      `${VERCEL_API_BASE}/v4/domains/${encodeURIComponent(domain)}/records${teamParam}`,
      { headers: { Authorization: `Bearer ${VERCEL_API_TOKEN}` } }
    );

    if (listRes.ok) {
      const { records } = await listRes.json();
      const existing = (records ?? []).find(
        (r: any) => r.type === 'MX' && r.value?.toLowerCase().includes('resend')
      );
      if (existing) {
        console.log(`[inbox-email] MX record for ${domain} already points to Resend`);
        return { success: true, alreadyExists: true };
      }
    }
  } catch {
    // Non-fatal — proceed to add
  }

  const res = await fetch(
    `${VERCEL_API_BASE}/v2/domains/${encodeURIComponent(domain)}/dns${teamParam}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${VERCEL_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: '',                  // empty = root/@
        type: 'MX',
        value: RESEND_INBOUND_MX,
        mxPriority: 10,
        ttl: 300,
      }),
    }
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // Treat "already exists" responses as success
    if (res.status === 409 || body?.error?.code === 'record_already_exists') {
      return { success: true, alreadyExists: true };
    }
    console.error(`[inbox-email] Vercel DNS add MX failed for ${domain}:`, res.status, body);
    return { success: false, error: body?.error?.message || 'Failed to add MX record' };
  }

  console.log(`[inbox-email] Added Resend inbound MX record for ${domain}`);
  return { success: true };
}

/**
 * Register a domain with Resend for inbound email receiving.
 * Returns { success, domainId?, error? }.
 */
async function ensureResendDomain(domain: string): Promise<{ success: boolean; domainId?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { success: false, error: 'RESEND_API_KEY not configured' };

  const resend = new Resend(apiKey);

  // Try to create the domain; if it already exists we'll get a conflict
  try {
    const { data, error } = await resend.domains.create({ name: domain });

    if (error) {
      // Domain might already be registered — try to find it by listing
      const { data: list } = await resend.domains.list();
      const existing = (list?.data ?? []).find((d: any) => d.name === domain);
      if (existing) {
        console.log(`[inbox-email] Domain ${domain} already registered in Resend (id: ${existing.id})`);
        return { success: true, domainId: existing.id };
      }
      console.error(`[inbox-email] Resend domain create error for ${domain}:`, error);
      return { success: false, error: (error as any)?.message || 'Failed to register domain with Resend' };
    }

    console.log(`[inbox-email] Registered domain ${domain} in Resend (id: ${data?.id})`);
    return { success: true, domainId: data?.id };
  } catch (err: any) {
    console.error(`[inbox-email] Unexpected error registering ${domain} in Resend:`, err);
    return { success: false, error: err?.message || 'Unexpected error' };
  }
}

// ---------------------------------------------------------------------------
// POST /api/contact/inbox-email  — activate custom domain inbox email
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { siteId, localPart } = body as { siteId: string; localPart: string };

  if (!siteId || !localPart) {
    return NextResponse.json({ error: 'siteId and localPart are required' }, { status: 400 });
  }

  // Validate localPart (alphanumeric, dots, hyphens, underscores — no @ signs)
  if (!/^[a-zA-Z0-9._+-]+$/.test(localPart) || localPart.length > 64) {
    return NextResponse.json({ error: 'Invalid email local part' }, { status: 400 });
  }

  // Verify site ownership and check for active custom domain
  const { data: site } = await supabase
    .from('sites')
    .select('id, user_id, custom_domain, published_domain')
    .eq('id', siteId)
    .single();

  if (!site || site.user_id !== user.id) {
    return NextResponse.json({ error: 'Site not found or access denied' }, { status: 403 });
  }

  if (!site.custom_domain) {
    return NextResponse.json({ error: 'This site has no active custom domain' }, { status: 400 });
  }

  // Verify Pro subscription
  const admin = createAdminClient();
  const { data: subscription } = await admin
    .from('user_subscriptions')
    .select('subscription_status, subscription_plan')
    .eq('user_id', user.id)
    .maybeSingle();

  const isPro =
    subscription?.subscription_status === 'active' &&
    subscription?.subscription_plan?.toLowerCase().includes('pro');

  if (!isPro) {
    return NextResponse.json({ error: 'Pro plan required for custom domain inbox email' }, { status: 403 });
  }

  const domain = site.custom_domain;
  const fullEmail = `${localPart.toLowerCase()}@${domain}`;

  // Check uniqueness across all sites
  const { data: conflict } = await admin
    .from('sites')
    .select('id')
    .eq('inbox_custom_email', fullEmail)
    .neq('id', siteId)
    .maybeSingle();

  if (conflict) {
    return NextResponse.json({ error: 'That email address is already in use' }, { status: 409 });
  }

  // Step 1: Register/link the domain with Resend
  const resendResult = await ensureResendDomain(domain);
  if (!resendResult.success) {
    return NextResponse.json(
      { error: `Failed to link domain with Resend: ${resendResult.error}` },
      { status: 500 }
    );
  }

  // Step 2: Auto-configure Vercel DNS (MX record) if token is available
  let dnsConfigured = false;
  let dnsError: string | null = null;

  if (VERCEL_API_TOKEN) {
    const dnsResult = await addVercelMxRecord(domain);
    dnsConfigured = dnsResult.success;
    if (!dnsResult.success) {
      dnsError = dnsResult.error ?? null;
      console.warn(`[inbox-email] Vercel MX config failed for ${domain}: ${dnsError}`);
      // Non-fatal — the domain may not be on Vercel DNS, or may have records already
    }
  }

  // Step 3: Persist to sites table
  const { error: updateErr } = await admin
    .from('sites')
    .update({
      inbox_custom_email: fullEmail,
      inbox_resend_domain_id: resendResult.domainId ?? null,
    })
    .eq('id', siteId);

  if (updateErr) {
    console.error('[inbox-email] Failed to save inbox_custom_email:', updateErr);
    return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 });
  }

  console.log(`[inbox-email] Activated ${fullEmail} for site ${siteId}`);
  return NextResponse.json({
    success: true,
    inboxEmail: fullEmail,
    dnsConfigured,
    dnsError,
  });
}

// ---------------------------------------------------------------------------
// DELETE /api/contact/inbox-email  — deactivate custom domain inbox email
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const siteId = request.nextUrl.searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId is required' }, { status: 400 });

  // Verify ownership
  const { data: site } = await supabase
    .from('sites')
    .select('id, user_id, inbox_custom_email, inbox_resend_domain_id')
    .eq('id', siteId)
    .single();

  if (!site || site.user_id !== user.id) {
    return NextResponse.json({ error: 'Site not found or access denied' }, { status: 403 });
  }

  const admin = createAdminClient();

  // Clear the inbox email config (keep the Resend domain registered — other sites on the same
  // domain might use it, and removal from Resend is a separate concern)
  const { error: updateErr } = await admin
    .from('sites')
    .update({
      inbox_custom_email: null,
      inbox_resend_domain_id: null,
    })
    .eq('id', siteId);

  if (updateErr) {
    console.error('[inbox-email] Failed to clear inbox_custom_email:', updateErr);
    return NextResponse.json({ error: 'Failed to deactivate' }, { status: 500 });
  }

  console.log(`[inbox-email] Deactivated custom inbox email for site ${siteId}`);
  return NextResponse.json({ success: true });
}
