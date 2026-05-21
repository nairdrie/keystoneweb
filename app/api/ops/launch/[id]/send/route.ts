import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getOpsAccessContext } from '@/lib/ops/access';
import { sendLaunchOnboardingEmail } from '@/lib/email';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getOpsAccessContext();
  if (!access?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const db = createAdminClient();

  const { data: req, error } = await db
    .from('launch_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !req) {
    return NextResponse.json({ error: 'Launch request not found' }, { status: 404 });
  }

  if (!req.site_id) {
    return NextResponse.json({ error: 'Attach a site before sending to the client' }, { status: 400 });
  }
  if (!req.launch_config) {
    return NextResponse.json({ error: 'Save launch configuration before sending' }, { status: 400 });
  }
  const cfg = req.launch_config as { domain?: { mode?: string; subdomain?: string; domainName?: string; externalVerified?: boolean; ownedPurchaseId?: string }; billingInterval?: string };
  const mode = cfg.domain?.mode;
  if (!mode) return NextResponse.json({ error: 'Domain mode is not configured' }, { status: 400 });
  if (mode === 'subdomain' && !cfg.domain?.subdomain)
    return NextResponse.json({ error: 'Subdomain is missing' }, { status: 400 });
  if ((mode === 'purchase' || mode === 'external') && !cfg.domain?.domainName)
    return NextResponse.json({ error: 'Domain name is missing' }, { status: 400 });
  if (mode === 'external' && !cfg.domain?.externalVerified)
    return NextResponse.json({ error: 'External domain DNS must be marked verified' }, { status: 400 });
  if (mode === 'owned' && !cfg.domain?.ownedPurchaseId)
    return NextResponse.json({ error: 'Owned domain selection is missing' }, { status: 400 });
  if (!cfg.billingInterval) return NextResponse.json({ error: 'Billing interval is missing' }, { status: 400 });

  // Idempotent: reuse existing token if already sent (e.g. operator re-clicking),
  // or treat re-send as a follow-up.
  const isFollowUp = req.onboarding_status === 'changes_requested';
  const token = req.onboarding_token ?? crypto.randomBytes(32).toString('hex');

  const update: Record<string, unknown> = {
    onboarding_token: token,
    onboarding_status: 'sent',
  };
  if (isFollowUp) {
    update.changes_requested_text = null;
  }

  const { error: updateError } = await db
    .from('launch_requests')
    .update(update)
    .eq('id', id);

  if (updateError) {
    console.error('Failed to update launch request before send:', updateError);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://keystoneweb.ca';
  const onboardingUrl = `${baseUrl}/onboarding/launch/${token}`;

  const emailResult = await sendLaunchOnboardingEmail({
    recipientEmail: req.email,
    recipientName: req.name,
    businessName: req.business_name,
    onboardingUrl,
    isFollowUp,
  });

  if (!emailResult.success) {
    return NextResponse.json({ error: 'Email failed to send' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, onboardingUrl, isFollowUp });
}
