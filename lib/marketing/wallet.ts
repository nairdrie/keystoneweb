/**
 * Marketing Wallet
 *
 * Per-site prepaid balance. Stripe top-ups credit the wallet, daily Google
 * spend (× 1.05 markup) debits it. Wallet hits zero -> all active campaigns
 * auto-pause + customer is emailed.
 *
 * Always use createAdminClient for writes — wallet mutations come from
 * webhooks and cron jobs where there's no user JWT in scope.
 */

import { createAdminClient } from '@/lib/db/supabase-admin';
import { applyMarkup } from './pricing';

const LOW_BALANCE_THRESHOLD_CENTS = 500; // $5

export interface WalletRow {
  id: string;
  site_id: string;
  balance_cents: number;
  lifetime_credited_cents: number;
  lifetime_debited_cents: number;
  low_balance_notified_at: string | null;
  empty_balance_notified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  site_id: string;
  wallet_id: string;
  kind: 'credit' | 'debit' | 'refund';
  amount_cents: number;
  balance_after_cents: number;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  campaign_id: string | null;
  spend_date: string | null;
  raw_ad_spend_cents: number | null;
  markup_cents: number | null;
  description: string | null;
  actor: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Get the wallet for a site, creating one if it doesn't exist. */
export async function getOrCreateWallet(siteId: string): Promise<WalletRow> {
  const db = createAdminClient();
  const { data: existing } = await db
    .from('marketing_wallet')
    .select('*')
    .eq('site_id', siteId)
    .maybeSingle();

  if (existing) return existing as WalletRow;

  const { data: created, error } = await db
    .from('marketing_wallet')
    .insert({ site_id: siteId, balance_cents: 0 })
    .select()
    .single();

  if (error || !created) throw new Error(`Failed to create wallet: ${error?.message}`);
  return created as WalletRow;
}

export async function getWallet(siteId: string): Promise<WalletRow | null> {
  const db = createAdminClient();
  const { data } = await db
    .from('marketing_wallet')
    .select('*')
    .eq('site_id', siteId)
    .maybeSingle();
  return (data as WalletRow) || null;
}

/**
 * Credit the wallet from a successful Stripe payment.
 * Idempotent by stripe_payment_intent_id — re-running this for the same PI is a no-op.
 */
export async function creditWallet(opts: {
  siteId: string;
  amountCents: number;
  stripePaymentIntentId?: string;
  stripeCheckoutSessionId?: string;
  description?: string;
  actor?: string;
}): Promise<{ wallet: WalletRow; transaction: WalletTransaction | null }> {
  if (opts.amountCents <= 0) {
    throw new Error('Credit amount must be positive');
  }

  const db = createAdminClient();

  // Idempotency: if a txn with this PI already exists, return existing wallet without crediting again.
  if (opts.stripePaymentIntentId) {
    const { data: existingTx } = await db
      .from('marketing_wallet_transactions')
      .select('*')
      .eq('stripe_payment_intent_id', opts.stripePaymentIntentId)
      .maybeSingle();
    if (existingTx) {
      const wallet = await getOrCreateWallet(opts.siteId);
      return { wallet, transaction: existingTx as WalletTransaction };
    }
  }

  const wallet = await getOrCreateWallet(opts.siteId);
  const newBalance = wallet.balance_cents + opts.amountCents;

  const { data: txn, error: txnErr } = await db
    .from('marketing_wallet_transactions')
    .insert({
      site_id: opts.siteId,
      wallet_id: wallet.id,
      kind: 'credit',
      amount_cents: opts.amountCents,
      balance_after_cents: newBalance,
      stripe_payment_intent_id: opts.stripePaymentIntentId || null,
      stripe_checkout_session_id: opts.stripeCheckoutSessionId || null,
      description: opts.description || 'Marketing wallet top-up',
      actor: opts.actor || 'system',
    })
    .select()
    .single();

  if (txnErr) throw new Error(`Failed to record credit txn: ${txnErr.message}`);

  const { data: updated, error: updErr } = await db
    .from('marketing_wallet')
    .update({
      balance_cents: newBalance,
      lifetime_credited_cents: wallet.lifetime_credited_cents + opts.amountCents,
      // Reset notifications since balance is now positive again
      low_balance_notified_at: null,
      empty_balance_notified_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', wallet.id)
    .select()
    .single();

  if (updErr || !updated) throw new Error(`Failed to update wallet balance: ${updErr?.message}`);
  return { wallet: updated as WalletRow, transaction: txn as WalletTransaction };
}

/**
 * Debit the wallet for a campaign's daily Google ad spend.
 * Idempotent per (campaign_id, spend_date). The debit amount = raw × 1.05.
 * Returns the new balance and whether the wallet just went to zero or below.
 */
export async function debitWalletForSpend(opts: {
  siteId: string;
  campaignId: string;
  spendDate: string;        // YYYY-MM-DD
  rawAdSpendCents: number;  // from Google Ads API
  actor?: string;
}): Promise<{ wallet: WalletRow; transaction: WalletTransaction | null; depleted: boolean; }> {
  const db = createAdminClient();

  // Idempotency: skip if we already have a debit for this (campaign, date).
  const { data: existingTx } = await db
    .from('marketing_wallet_transactions')
    .select('*')
    .eq('kind', 'debit')
    .eq('campaign_id', opts.campaignId)
    .eq('spend_date', opts.spendDate)
    .maybeSingle();

  if (existingTx) {
    const wallet = await getOrCreateWallet(opts.siteId);
    return { wallet, transaction: existingTx as WalletTransaction, depleted: wallet.balance_cents <= 0 };
  }

  if (opts.rawAdSpendCents <= 0) {
    const wallet = await getOrCreateWallet(opts.siteId);
    return { wallet, transaction: null, depleted: wallet.balance_cents <= 0 };
  }

  const bundled = applyMarkup(opts.rawAdSpendCents);
  const markup = bundled - opts.rawAdSpendCents;

  const wallet = await getOrCreateWallet(opts.siteId);
  const newBalance = wallet.balance_cents - bundled;

  const { data: txn, error: txnErr } = await db
    .from('marketing_wallet_transactions')
    .insert({
      site_id: opts.siteId,
      wallet_id: wallet.id,
      kind: 'debit',
      amount_cents: bundled,
      balance_after_cents: newBalance,
      campaign_id: opts.campaignId,
      spend_date: opts.spendDate,
      raw_ad_spend_cents: opts.rawAdSpendCents,
      markup_cents: markup,
      description: `Daily ad spend ${opts.spendDate}`,
      actor: opts.actor || 'cron',
    })
    .select()
    .single();

  if (txnErr) throw new Error(`Failed to record debit txn: ${txnErr.message}`);

  const { data: updated, error: updErr } = await db
    .from('marketing_wallet')
    .update({
      balance_cents: newBalance,
      lifetime_debited_cents: wallet.lifetime_debited_cents + bundled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', wallet.id)
    .select()
    .single();

  if (updErr || !updated) throw new Error(`Failed to update wallet balance: ${updErr?.message}`);
  return {
    wallet: updated as WalletRow,
    transaction: txn as WalletTransaction,
    depleted: newBalance <= 0,
  };
}

export function shouldNotifyLowBalance(wallet: WalletRow): boolean {
  return (
    wallet.balance_cents > 0 &&
    wallet.balance_cents <= LOW_BALANCE_THRESHOLD_CENTS &&
    !wallet.low_balance_notified_at
  );
}

export function shouldNotifyEmpty(wallet: WalletRow): boolean {
  return wallet.balance_cents <= 0 && !wallet.empty_balance_notified_at;
}

export async function markLowBalanceNotified(walletId: string) {
  const db = createAdminClient();
  await db
    .from('marketing_wallet')
    .update({ low_balance_notified_at: new Date().toISOString() })
    .eq('id', walletId);
}

export async function markEmptyNotified(walletId: string) {
  const db = createAdminClient();
  await db
    .from('marketing_wallet')
    .update({ empty_balance_notified_at: new Date().toISOString() })
    .eq('id', walletId);
}

export async function listTransactions(siteId: string, opts: { limit?: number; offset?: number } = {}): Promise<WalletTransaction[]> {
  const db = createAdminClient();
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;
  const { data } = await db
    .from('marketing_wallet_transactions')
    .select('*')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  return (data as WalletTransaction[]) || [];
}
