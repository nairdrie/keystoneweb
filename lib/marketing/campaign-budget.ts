/**
 * Per-campaign prepaid budget tracking. Replaces the site-level wallet model.
 *
 * Customer pays for each campaign upfront via Stripe. We track how much they
 * paid (prepaid_cents) and how much Google has spent so far (× 1.05 markup).
 * When bundled spend >= prepaid, we auto-pause the campaign. Customer can top
 * up to resume or cancel to refund any unused balance.
 */

import { createAdminClient } from '@/lib/db/supabase-admin';
import { applyMarkup } from './pricing';

export interface CampaignPayment {
  id: string;
  campaign_id: string;
  site_id: string;
  kind: 'prepay' | 'topup' | 'refund';
  amount_cents: number;
  raw_ad_spend_cents: number;
  service_fee_cents: number;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_refund_id: string | null;
  status: 'pending' | 'succeeded' | 'failed';
  actor: string;
  description: string | null;
  created_at: string;
  succeeded_at: string | null;
}

export interface CampaignBudget {
  prepaidCents: number;          // Total successful payments - refunds
  refundedCents: number;
  spentRawCents: number;          // From Google (raw)
  spentBundledCents: number;      // raw × 1.05
  remainingCents: number;         // prepaid - bundled
  depleted: boolean;              // remaining <= 0
  pctUsed: number;                // 0..1
}

/**
 * Translate a customer-facing daily budget × duration into the prepay amount
 * we'll charge their card. The displayed daily budget is the RAW ad spend that
 * goes to Google. We add a 5% service fee on top for our margin.
 */
export function computePrepayAmount(opts: {
  dailyBudgetCents: number;
  durationDays: number;
}): { rawCents: number; serviceFeeCents: number; totalCents: number } {
  const rawCents = opts.dailyBudgetCents * opts.durationDays;
  const totalCents = applyMarkup(rawCents);
  return {
    rawCents,
    serviceFeeCents: totalCents - rawCents,
    totalCents,
  };
}

/**
 * Aggregate the budget state for a single campaign. Cheap — one query for
 * payments, one for campaign metrics.
 */
export async function getCampaignBudget(campaignId: string): Promise<CampaignBudget> {
  const db = createAdminClient();

  const [{ data: payments }, { data: campaign }] = await Promise.all([
    db.from('marketing_campaign_payments')
      .select('kind, amount_cents, status')
      .eq('campaign_id', campaignId)
      .eq('status', 'succeeded'),
    db.from('marketing_campaigns')
      .select('spent_cents')
      .eq('id', campaignId)
      .single(),
  ]);

  let prepaid = 0;
  let refunded = 0;
  for (const p of payments || []) {
    if (p.kind === 'prepay' || p.kind === 'topup') prepaid += p.amount_cents;
    else if (p.kind === 'refund') refunded += p.amount_cents;
  }

  const spentRaw = campaign?.spent_cents || 0;
  const spentBundled = applyMarkup(spentRaw);
  const effectivePrepaid = prepaid - refunded;
  const remaining = Math.max(0, effectivePrepaid - spentBundled);
  const pctUsed = effectivePrepaid > 0 ? Math.min(1, spentBundled / effectivePrepaid) : 0;

  return {
    prepaidCents: effectivePrepaid,
    refundedCents: refunded,
    spentRawCents: spentRaw,
    spentBundledCents: spentBundled,
    remainingCents: remaining,
    depleted: effectivePrepaid > 0 && remaining <= 0,
    pctUsed,
  };
}

/**
 * Record a successful Stripe payment for a campaign. Idempotent by
 * stripe_payment_intent_id. Updates the denormalized prepaid_cents on the
 * campaign row.
 */
export async function recordCampaignPayment(opts: {
  campaignId: string;
  siteId: string;
  kind: 'prepay' | 'topup';
  amountCents: number;
  stripePaymentIntentId: string;
  stripeCheckoutSessionId?: string;
  actor?: string;
  description?: string;
}): Promise<CampaignPayment> {
  const db = createAdminClient();

  // Idempotency: if a payment with this PI already exists, return it.
  const { data: existing } = await db
    .from('marketing_campaign_payments')
    .select('*')
    .eq('stripe_payment_intent_id', opts.stripePaymentIntentId)
    .maybeSingle();
  if (existing) return existing as CampaignPayment;

  const raw = Math.round(opts.amountCents / 1.05);
  const fee = opts.amountCents - raw;

  const { data: created, error } = await db
    .from('marketing_campaign_payments')
    .insert({
      campaign_id: opts.campaignId,
      site_id: opts.siteId,
      kind: opts.kind,
      amount_cents: opts.amountCents,
      raw_ad_spend_cents: raw,
      service_fee_cents: fee,
      stripe_payment_intent_id: opts.stripePaymentIntentId,
      stripe_checkout_session_id: opts.stripeCheckoutSessionId || null,
      status: 'succeeded',
      actor: opts.actor || 'system',
      description: opts.description || (opts.kind === 'prepay' ? 'Initial prepay' : 'Budget top-up'),
      succeeded_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !created) throw new Error(`Failed to record campaign payment: ${error?.message}`);

  // Update denormalized total on campaign for fast read paths.
  await refreshCampaignPrepaidTotal(opts.campaignId);

  return created as CampaignPayment;
}

/**
 * Record a refund for a campaign. Idempotent by stripe_refund_id.
 */
export async function recordCampaignRefund(opts: {
  campaignId: string;
  siteId: string;
  amountCents: number;
  stripeRefundId: string;
  stripePaymentIntentId?: string;
  actor?: string;
  description?: string;
}): Promise<CampaignPayment> {
  const db = createAdminClient();

  const { data: existing } = await db
    .from('marketing_campaign_payments')
    .select('*')
    .eq('stripe_refund_id', opts.stripeRefundId)
    .maybeSingle();
  if (existing) return existing as CampaignPayment;

  const raw = Math.round(opts.amountCents / 1.05);
  const fee = opts.amountCents - raw;

  const { data: created, error } = await db
    .from('marketing_campaign_payments')
    .insert({
      campaign_id: opts.campaignId,
      site_id: opts.siteId,
      kind: 'refund',
      amount_cents: opts.amountCents,
      raw_ad_spend_cents: raw,
      service_fee_cents: fee,
      stripe_payment_intent_id: opts.stripePaymentIntentId || null,
      stripe_refund_id: opts.stripeRefundId,
      status: 'succeeded',
      actor: opts.actor || 'system',
      description: opts.description || 'Refund of unused budget',
      succeeded_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !created) throw new Error(`Failed to record campaign refund: ${error?.message}`);

  await refreshCampaignPrepaidTotal(opts.campaignId);

  return created as CampaignPayment;
}

/**
 * Recompute prepaid_cents / prepaid_refunded_cents on the campaign row from
 * the marketing_campaign_payments ledger.
 */
export async function refreshCampaignPrepaidTotal(campaignId: string): Promise<void> {
  const db = createAdminClient();
  const { data: payments } = await db
    .from('marketing_campaign_payments')
    .select('kind, amount_cents')
    .eq('campaign_id', campaignId)
    .eq('status', 'succeeded');

  let prepaid = 0;
  let refunded = 0;
  for (const p of payments || []) {
    if (p.kind === 'prepay' || p.kind === 'topup') prepaid += p.amount_cents;
    else if (p.kind === 'refund') refunded += p.amount_cents;
  }

  await db.from('marketing_campaigns')
    .update({
      prepaid_cents: prepaid,
      prepaid_refunded_cents: refunded,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId);
}

export async function listCampaignPayments(campaignId: string): Promise<CampaignPayment[]> {
  const db = createAdminClient();
  const { data } = await db
    .from('marketing_campaign_payments')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });
  return (data as CampaignPayment[]) || [];
}

/**
 * List all payments for all campaigns on a site (used for the billing-history
 * page that replaced the wallet view).
 */
export async function listSitePayments(siteId: string, opts: { limit?: number } = {}): Promise<Array<CampaignPayment & { campaign_name: string | null }>> {
  const db = createAdminClient();
  const limit = Math.min(opts.limit ?? 100, 500);
  const { data } = await db
    .from('marketing_campaign_payments')
    .select('*, marketing_campaigns!inner(name)')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data || []).map((row: Record<string, unknown> & { marketing_campaigns?: { name?: string } | { name?: string }[] }) => {
    const campaign = Array.isArray(row.marketing_campaigns) ? row.marketing_campaigns[0] : row.marketing_campaigns;
    return { ...row, campaign_name: campaign?.name ?? null } as CampaignPayment & { campaign_name: string | null };
  });
}
