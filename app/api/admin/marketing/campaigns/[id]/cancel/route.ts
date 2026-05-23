import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { pauseCampaign as pauseGoogleCampaign } from '@/lib/marketing/google-ads';
import { getCampaignBudget, recordCampaignRefund, listCampaignPayments } from '@/lib/marketing/campaign-budget';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apiVersion: '2026-02-25.clover' as any,
});

/**
 * POST /api/admin/marketing/campaigns/[id]/cancel
 *
 * Cancels the campaign and refunds any unused prepaid budget back to the
 * customer's card via Stripe. Pauses in Google first to stop further spend,
 * then issues refund(s) against the original payment intents (most recent
 * first) until the unused amount is covered.
 */
export async function POST(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: campaign } = await supabase
    .from('marketing_campaigns')
    .select('*, sites!inner(id, user_id, marketing_enabled)')
    .eq('id', id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const site = (campaign as any)?.sites;
  if (!campaign || site?.user_id !== user.id) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }
  if (campaign.status === 'cancelled' || campaign.status === 'completed') {
    return NextResponse.json({ error: 'Campaign already finished' }, { status: 400 });
  }

  const db = createAdminClient();

  // 1. Pause in Google first so further spend stops.
  if (campaign.status === 'active' && campaign.channel === 'google_ads' && campaign.external_campaign_id) {
    try {
      await pauseGoogleCampaign(campaign.external_campaign_id);
    } catch (err) {
      console.error('[cancel] failed to pause in Google (continuing to refund):', err);
    }
  }

  // 2. Calculate unused budget and refund the most recent successful payments
  //    until covered.
  const budget = await getCampaignBudget(id);
  let toRefund = budget.remainingCents;
  const refundIds: string[] = [];

  if (toRefund > 0) {
    const payments = await listCampaignPayments(id);
    const fundingPayments = payments
      .filter(p => (p.kind === 'prepay' || p.kind === 'topup') && p.status === 'succeeded' && p.stripe_payment_intent_id)
      .sort((a, b) => (b.created_at > a.created_at ? 1 : -1));

    for (const p of fundingPayments) {
      if (toRefund <= 0) break;
      // How much of THIS payment is still refundable?
      const alreadyRefunded = payments
        .filter(r => r.kind === 'refund' && r.stripe_payment_intent_id === p.stripe_payment_intent_id)
        .reduce((sum, r) => sum + r.amount_cents, 0);
      const refundableHere = Math.max(0, p.amount_cents - alreadyRefunded);
      if (refundableHere <= 0) continue;

      const refundCents = Math.min(toRefund, refundableHere);
      try {
        const refund = await stripe.refunds.create({
          payment_intent: p.stripe_payment_intent_id!,
          amount: refundCents,
          metadata: { campaignId: id, kind: 'campaign_cancel_unused' },
        });
        await recordCampaignRefund({
          campaignId: id,
          siteId: campaign.site_id,
          amountCents: refundCents,
          stripeRefundId: refund.id,
          stripePaymentIntentId: p.stripe_payment_intent_id || undefined,
          actor: `user:${user.email || user.id}`,
          description: 'Refund of unused budget on cancel',
        });
        refundIds.push(refund.id);
        toRefund -= refundCents;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[cancel] refund failed:', msg);
        await db.from('marketing_campaign_log').insert({
          campaign_id: id,
          action: 'refund_failed',
          actor: `user:${user.email || user.id}`,
          details: { payment_intent: p.stripe_payment_intent_id, amount_cents: refundCents, error: msg },
        });
      }
    }
  }

  await db.from('marketing_campaigns')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id);

  await db.from('marketing_campaign_log').insert({
    campaign_id: id,
    action: 'cancelled',
    actor: `user:${user.email || user.id}`,
    details: { refund_ids: refundIds, refunded_cents: budget.remainingCents - toRefund },
  });

  return NextResponse.json({
    cancelled: true,
    refundedCents: budget.remainingCents - toRefund,
    refundIds,
  });
}
