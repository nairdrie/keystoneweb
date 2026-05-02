import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';

const VERCEL_API_BASE = 'https://api.vercel.com';
const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;

// Shape of a DNS record returned by Resend's domain API
interface ResendDnsRecord {
  record: string;
  name: string;
  value: string;
  type: 'MX' | 'TXT' | 'CNAME';
  ttl: string;
  status: string;
  priority?: number;
}

/**
 * Add ALL required DNS records (SPF, DKIM, MX/Receiving) to a Vercel-managed
 * domain so that Resend can verify the domain and route inbound email.
 *
 * Takes the `records` array straight from Resend's domain create / get response.
 */
async function addVercelDnsRecords(
  domain: string,
  resendRecords: ResendDnsRecord[],
): Promise<{ success: boolean; errors: string[]; configured: number }> {
  if (!VERCEL_API_TOKEN) {
    return { success: false, errors: ['VERCEL_API_TOKEN not configured'], configured: 0 };
  }

  const teamParam = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : '';

  // Fetch existing records once so we can skip duplicates
  let existingRecords: any[] = [];
  try {
    const listRes = await fetch(
      `${VERCEL_API_BASE}/v4/domains/${encodeURIComponent(domain)}/records${teamParam}`,
      { headers: { Authorization: `Bearer ${VERCEL_API_TOKEN}` } },
    );
    if (listRes.ok) {
      const body = await listRes.json();
      existingRecords = body.records ?? [];
    }
  } catch {
    // Non-fatal — we'll try to add anyway
  }

  const errors: string[] = [];
  let configured = 0;

  for (const rec of resendRecords) {
    const recordName = rec.name; // subdomain part, e.g. "bounces", "resend._domainkey", or empty

    // Duplicate check — match type + name (+ value for MX to allow multiple priorities)
    const alreadyExists = existingRecords.some((existing: any) => {
      if (existing.type !== rec.type) return false;
      // Vercel stores root records with name="" or the domain itself
      const existingName = existing.name === domain ? '' : (existing.name ?? '');
      const targetName = recordName === domain ? '' : (recordName ?? '');
      if (existingName !== targetName) return false;
      if (rec.type === 'MX') {
        return existing.value?.toLowerCase() === rec.value?.toLowerCase();
      }
      return true;
    });

    if (alreadyExists) {
      console.log(`[inbox-email] DNS record already exists: ${rec.type} ${recordName || '@'} → ${rec.value}`);
      configured++;
      continue;
    }

    const body: Record<string, unknown> = {
      name: recordName,
      type: rec.type,
      value: rec.value,
      ttl: 300,
    };
    if (rec.type === 'MX' && rec.priority != null) {
      body.mxPriority = rec.priority;
    }

    try {
      const res = await fetch(
        `${VERCEL_API_BASE}/v4/domains/${encodeURIComponent(domain)}/records${teamParam}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${VERCEL_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      );

      if (res.ok) {
        console.log(`[inbox-email] Added DNS record: ${rec.type} ${recordName || '@'} → ${rec.value}`);
        configured++;
      } else {
        const resBody = await res.json().catch(() => ({}));
        if (res.status === 409 || resBody?.error?.code === 'record_already_exists') {
          configured++;
        } else {
          const msg = `Failed to add ${rec.type} record for ${recordName || '@'}: ${resBody?.error?.message || res.status}`;
          console.error(`[inbox-email] ${msg}`);
          errors.push(msg);
        }
      }
    } catch (err: any) {
      const msg = `Error adding ${rec.type} record for ${recordName || '@'}: ${err.message}`;
      console.error(`[inbox-email] ${msg}`);
      errors.push(msg);
    }
  }

  return { success: errors.length === 0, errors, configured };
}

/**
 * Register a domain with Resend for inbound email receiving.
 * Returns the domainId **and** the DNS records that must be configured.
 */
async function ensureResendDomain(domain: string): Promise<{
  success: boolean;
  domainId?: string;
  records?: ResendDnsRecord[];
  error?: string;
}> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { success: false, error: 'RESEND_API_KEY not configured' };

  const resend = new Resend(apiKey);

  try {
    const { data, error } = await resend.domains.create({
      name: domain,
      capabilities: { sending: 'enabled', receiving: 'enabled' },
    });

    if (error) {
      // Domain might already be registered — find it, ensure receiving is enabled
      const { data: list } = await resend.domains.list();
      const existing = (list?.data ?? []).find((d: any) => d.name === domain);
      if (existing) {
        console.log(`[inbox-email] Domain ${domain} already registered in Resend (id: ${existing.id})`);

        // Enable receiving if it wasn't already
        if (existing.capabilities?.receiving !== 'enabled') {
          try {
            await resend.domains.update({ id: existing.id, capabilities: { receiving: 'enabled' } });
            console.log(`[inbox-email] Enabled receiving capability for ${domain}`);
          } catch (err) {
            console.warn(`[inbox-email] Failed to enable receiving for ${domain}:`, err);
          }
        }

        // domains.list() doesn't include records — fetch them explicitly
        const { data: domainDetail } = await resend.domains.get(existing.id);
        return {
          success: true,
          domainId: existing.id,
          records: (domainDetail?.records ?? []) as ResendDnsRecord[],
        };
      }
      console.error(`[inbox-email] Resend domain create error for ${domain}:`, error);
      return { success: false, error: (error as any)?.message || 'Failed to register domain with Resend' };
    }

    console.log(`[inbox-email] Registered domain ${domain} in Resend (id: ${data?.id})`);
    return {
      success: true,
      domainId: data?.id,
      records: (data?.records ?? []) as ResendDnsRecord[],
    };
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

  // Step 1: Register/link the domain with Resend (returns required DNS records)
  const resendResult = await ensureResendDomain(domain);
  if (!resendResult.success) {
    return NextResponse.json(
      { error: `Failed to link domain with Resend: ${resendResult.error}` },
      { status: 500 }
    );
  }

  // Step 2: Auto-configure ALL Resend DNS records in Vercel (SPF, DKIM, MX)
  let dnsConfigured = false;
  let dnsError: string | null = null;

  const resendRecords = resendResult.records ?? [];

  if (VERCEL_API_TOKEN && resendRecords.length > 0) {
    const dnsResult = await addVercelDnsRecords(domain, resendRecords);
    dnsConfigured = dnsResult.success;
    if (!dnsResult.success) {
      dnsError = dnsResult.errors.join('; ');
      console.warn(`[inbox-email] Vercel DNS config partially failed for ${domain}: ${dnsError} (${dnsResult.configured}/${resendRecords.length} records configured)`);
      // Non-fatal — the domain may not be on Vercel DNS
    } else {
      console.log(`[inbox-email] All ${dnsResult.configured} DNS records configured for ${domain}`);
    }
  } else if (!VERCEL_API_TOKEN) {
    console.warn(`[inbox-email] VERCEL_API_TOKEN not set — skipping DNS auto-configuration for ${domain}`);
  }

  // Step 2b: Trigger Resend domain verification so it checks the newly added records
  if (resendResult.domainId) {
    try {
      const apiKey = process.env.RESEND_API_KEY;
      if (apiKey) {
        const resend = new Resend(apiKey);
        await resend.domains.verify(resendResult.domainId);
        console.log(`[inbox-email] Triggered domain verification for ${domain}`);
      }
    } catch (err) {
      // Non-fatal — verification can also happen automatically on Resend's side
      console.warn(`[inbox-email] Failed to trigger domain verification for ${domain}:`, err);
    }
  }

  // Step 3: Persist to sites table (legacy column) AND site_inbox_addresses
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

  // Mirror into the multi-address table; mark this as primary
  await admin.from('site_inbox_addresses').update({ is_primary: false }).eq('site_id', siteId);
  await admin
    .from('site_inbox_addresses')
    .upsert({
      site_id: siteId,
      address: fullEmail,
      kind: 'custom_domain',
      is_primary: true,
      resend_domain_id: resendResult.domainId ?? null,
    }, { onConflict: 'address' });

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
