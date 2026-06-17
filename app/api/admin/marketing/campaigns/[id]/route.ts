import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { createClient } from '@/lib/db/supabase-server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apiVersion: '2026-02-25.clover' as any,
});

async function authForCampaign(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const { data: campaign } = await supabase
    .from('marketing_campaigns')
    .select('*, sites!inner(id, user_id, marketing_enabled, google_ads_customer_id)')
    .eq('id', id)
    .single();

  if (!campaign || campaign.sites.user_id !== user.id) {
    return { error: NextResponse.json({ error: 'Campaign not found' }, { status: 404 }) };
  }
  if (!campaign.sites.marketing_enabled) {
    return { error: NextResponse.json({ error: 'Marketing not enabled' }, { status: 403 }) };
  }

  return { campaign, user };
}

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await authForCampaign(id);
  if ('error' in auth) return auth.error;
  return NextResponse.json({ campaign: auth.campaign });
}

/**
 * PATCH — edit a campaign. Live edits to active campaigns are allowed; budget
 * increases require client-side confirmation, which we trust (the UI shows
 * the new daily burn rate before submitting).
 */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await authForCampaign(id);
  if ('error' in auth) return auth.error;

  const body = await request.json();
  const allowed: Record<string, unknown> = {};
  const fields = ['name', 'content', 'targeting', 'daily_budget_cents', 'total_budget_cents', 'start_date', 'end_date'];
  for (const f of fields) {
    if (f in body) allowed[f] = body[f];
  }
  allowed.updated_at = new Date().toISOString();

  const db = createAdminClient();
  const { data: updated, error } = await db
    .from('marketing_campaigns')
    .update(allowed)
    .eq('id', id)
    .select()
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 });
  }

  await db.from('marketing_campaign_log').insert({
    campaign_id: id,
    action: 'edited',
    actor: `user:${auth.user.email || ''}`,
    details: { fields: Object.keys(allowed).filter(k => k !== 'updated_at') },
  });

  return NextResponse.json({ campaign: updated });
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await authForCampaign(id);
  if ('error' in auth) return auth.error;

  const db = createAdminClient();
  const status = auth.campaign.status;

  // Deactivate any outstanding Stripe Payment Link first, so a stale link can't
  // be paid after cancellation (which would otherwise revive the campaign via
  // the webhook flipping it to pending_launch).
  if (auth.campaign.payment_link_id) {
    try {
      await stripe.paymentLinks.update(auth.campaign.payment_link_id, { active: false });
    } catch (err) {
      console.error('[campaign delete] failed to deactivate payment link:', err);
    }
  }

  // If never launched, hard delete. If launched, mark cancelled to preserve history.
  if (status === 'draft' || status === 'suggested' || status === 'failed') {
    await db.from('marketing_campaigns').delete().eq('id', id);
    return NextResponse.json({ deleted: true });
  }

  const { data: updated } = await db
    .from('marketing_campaigns')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  await db.from('marketing_campaign_log').insert({
    campaign_id: id,
    action: 'cancelled',
    actor: `user:${auth.user.email || ''}`,
  });

  return NextResponse.json({ campaign: updated });
}
