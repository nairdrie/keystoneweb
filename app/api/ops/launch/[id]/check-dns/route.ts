import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getOpsAccessContext } from '@/lib/ops/access';
import { checkExternalDomainDns, buildDnsInstructions } from '@/lib/domains/dns-check';

/**
 * POST /api/ops/launch/[id]/check-dns
 *
 * Operator-triggered DNS resolution check for the external domain configured
 * on this launch_request. Reads the domain + site_id off the row so the
 * operator doesn't have to pass anything; returns per-record check results
 * + the expected values for display.
 *
 * On success, sets launch_config.domain.externalVerified=true so the
 * "Send to client" gate flips automatically.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getOpsAccessContext();
  if (!access?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const db = createAdminClient();
  const { data: req, error } = await db
    .from('launch_requests')
    .select('id, site_id, launch_config')
    .eq('id', id)
    .single();

  if (error || !req) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!req.site_id) return NextResponse.json({ error: 'No site attached' }, { status: 400 });

  const cfg = (req.launch_config ?? {}) as {
    domain?: { mode?: string; domainName?: string };
  };
  if (cfg.domain?.mode !== 'external') {
    return NextResponse.json({ error: 'Launch is not configured for an external domain' }, { status: 400 });
  }
  const domain = cfg.domain.domainName?.trim().toLowerCase();
  if (!domain) {
    return NextResponse.json({ error: 'No domain name in launch config' }, { status: 400 });
  }

  const result = await checkExternalDomainDns(domain, req.site_id);

  // Auto-flip the externalVerified flag in launch_config so the "Send to client"
  // button unblocks the moment the operator's records propagate.
  const updatedConfig = {
    ...(req.launch_config ?? {}),
    domain: {
      ...(req.launch_config?.domain ?? {}),
      externalVerified: result.verified,
    },
  };
  await db.from('launch_requests').update({ launch_config: updatedConfig }).eq('id', id);

  return NextResponse.json({
    ...result,
    instructions: buildDnsInstructions(req.site_id),
  });
}
