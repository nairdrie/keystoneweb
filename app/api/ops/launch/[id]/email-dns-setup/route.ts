import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getOpsAccessContext } from '@/lib/ops/access';
import { buildDnsInstructions } from '@/lib/domains/dns-check';
import { getRegistrar } from '@/lib/domains/registrar-guides';
import { sendDomainSetupInstructionsEmail } from '@/lib/email';

/**
 * POST /api/ops/launch/[id]/email-dns-setup
 *
 * Send the launch client an email containing the exact DNS records they
 * need to add, plus step-by-step instructions tailored to their registrar
 * (selected by the operator in the launch config form).
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
    .select('id, name, email, business_name, site_id, launch_config')
    .eq('id', id)
    .single();

  if (error || !req) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!req.site_id) return NextResponse.json({ error: 'No site attached' }, { status: 400 });

  const cfg = (req.launch_config ?? {}) as {
    domain?: { mode?: string; domainName?: string; registrar?: string };
  };
  if (cfg.domain?.mode !== 'external') {
    return NextResponse.json(
      { error: 'DNS setup email is only for external-domain launches' },
      { status: 400 },
    );
  }
  if (!cfg.domain.domainName) {
    return NextResponse.json({ error: 'Save the launch config with a domain name first' }, { status: 400 });
  }

  const registrar = getRegistrar(cfg.domain.registrar);
  const records = buildDnsInstructions(req.site_id);

  const result = await sendDomainSetupInstructionsEmail({
    recipientEmail: req.email,
    recipientName: req.name,
    businessName: req.business_name,
    domain: cfg.domain.domainName,
    registrarName: registrar.name,
    registrarSignInUrl: registrar.signInUrl,
    steps: registrar.steps,
    records,
  });

  if (!result.success) {
    return NextResponse.json({ error: 'Email failed to send' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
