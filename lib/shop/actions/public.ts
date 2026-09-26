/**
 * Customer-facing estimate and invoice pages (/shop-doc/<token>): view,
 * approve or decline online, download the PDF, and pay with the shop's own
 * Stripe or PayPal account. The token is the only credential, so everything
 * here is scoped to the one document it points at.
 */

import type { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { APP_URL } from '@/lib/env/domain';
import { captureOrder, createOrder, getSitePaypalCreds } from '@/lib/paypal';
import { ShopRuleError, type ShopAccess } from '../access';
import { addEvent, ensureSettings, loadSiteInfo, paidByInvoice, type SiteInfo } from '../data';
import { buildEstimateDoc, docLine, shopIdentity, type EstimateDoc, type ShopIdentity } from '../documents';
import { estimatePdf, invoicePdf } from '../pdf';
import { notifyOwner } from '../mail';
import { docUrl } from '../links';
import { formatCents, toInvoiceLine } from '../money';
import { formatDate, todayISO } from '../dates';
import { invoiceLabel, vehicleLabel } from '../board';
import type { Estimate, Invoice, InvoiceSnapshot, LineKind } from '../types';
import { authorizeEstimate, declineEstimate } from './estimates';
import { recordPayment } from './invoices';
import { requireJob, str } from './common';

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

export interface PublicEstimateLine {
  id: string;
  kind: LineKind;
  description: string;
  detail: string | null;
  amount_cents: number;
  decision: 'include' | 'declined';
  added: boolean;
}

export interface PublicDoc {
  kind: 'estimate' | 'invoice';
  shop: ShopIdentity & { logo_url: string | null };
  estimate?: {
    doc: EstimateDoc;
    status: Estimate['status'];
    version: number;
    is_revision: boolean;
    lines: PublicEstimateLine[];
    tax_rate_bps: number;
    expired: boolean;
    can_act: boolean;
    approved_at: string | null;
    declined_at: string | null;
    newer_token: string | null;
    customer_email: string | null;
  };
  invoice?: {
    snapshot: InvoiceSnapshot;
    status: Invoice['status'];
    void_reason: string | null;
    paid_cents: number;
    balance_cents: number;
    pay: { stripe: boolean; paypal: boolean; etransfer_email: string | null };
  };
}

type Found =
  | { kind: 'estimate'; access: ShopAccess; site: SiteInfo; estimateId: string; jobId: string }
  | { kind: 'invoice'; access: ShopAccess; site: SiteInfo; invoice: Invoice };

async function customerAccess(siteId: string): Promise<{ access: ShopAccess; site: SiteInfo }> {
  const db = createAdminClient();
  const { data: siteRow } = await db.from('sites').select('user_id, shop_enabled').eq('id', siteId).single();
  if (!siteRow?.shop_enabled) throw new ShopRuleError('This page isn’t available.', undefined, 404);
  const settings = await ensureSettings(db, siteId);
  const site = await loadSiteInfo(db, siteId, settings);
  return { access: { db, siteId, actor: 'Customer (online)', isTech: false, deviceId: null, userId: siteRow.user_id ?? null }, site };
}

async function find(token: string): Promise<Found> {
  if (!TOKEN_RE.test(token || '')) throw new ShopRuleError('This link isn’t valid.', undefined, 404);
  const db = createAdminClient();
  const { data: est } = await db.from('shop_estimates').select('id, job_id, site_id, status').eq('public_token', token).maybeSingle();
  if (est) {
    if (est.status === 'draft') throw new ShopRuleError('This link isn’t valid.', undefined, 404);
    const { access, site } = await customerAccess(est.site_id);
    return { kind: 'estimate', access, site, estimateId: est.id, jobId: est.job_id };
  }
  const { data: inv } = await db.from('shop_invoices').select('*').eq('public_token', token).maybeSingle();
  if (inv) {
    const { access, site } = await customerAccess(inv.site_id);
    return { kind: 'invoice', access, site, invoice: inv as Invoice };
  }
  throw new ShopRuleError('This link isn’t valid or has been replaced.', undefined, 404);
}

export async function loadPublicDoc(token: string): Promise<PublicDoc> {
  const f = await find(token);
  const settings = await ensureSettings(f.access.db, f.access.siteId);
  const shop = { ...shopIdentity(settings, f.site), logo_url: f.site.logo_url };
  if (f.kind === 'invoice') {
    const paid = (await paidByInvoice(f.access.db, f.access.siteId, [f.invoice.id])).get(f.invoice.id) ?? 0;
    return {
      kind: 'invoice',
      shop,
      invoice: {
        snapshot: f.invoice.snapshot,
        status: f.invoice.status,
        void_reason: f.invoice.status === 'void' ? f.invoice.void_reason : null,
        paid_cents: paid,
        balance_cents: f.invoice.status === 'issued' ? Math.max(0, f.invoice.total_cents - paid) : 0,
        pay: { stripe: f.site.stripe, paypal: f.site.paypal, etransfer_email: settings.etransfer_email },
      },
    };
  }
  const detail = await requireJob(f.access, f.jobId);
  const est = detail.estimates.find(e => e.id === f.estimateId)!;
  const doc = buildEstimateDoc({ estimate: est, job: detail.job, customer: detail.customer, vehicle: detail.vehicle, settings, site: f.site });
  const newer = detail.estimates.filter(e => e.version > est.version && (e.status === 'sent' || e.status === 'approved') && e.public_token).pop();
  const expired = !!est.valid_until && est.valid_until < todayISO();
  return {
    kind: 'estimate',
    shop,
    estimate: {
      doc,
      status: est.status,
      version: est.version,
      is_revision: est.is_revision,
      lines: est.lines.map(l => {
        const d = docLine(toInvoiceLine(l));
        return { id: l.id, kind: l.kind, description: l.description, detail: d.detail, amount_cents: d.amount_cents, decision: l.decision, added: l.is_added_work };
      }),
      tax_rate_bps: settings.tax_rate_bps,
      expired,
      can_act: est.status === 'sent' && !expired,
      approved_at: est.approved_at,
      declined_at: est.declined_at,
      newer_token: newer && newer.id !== est.id ? newer.public_token : null,
      customer_email: detail.customer.email,
    },
  };
}

export async function publicPdf(token: string): Promise<{ buffer: Buffer; filename: string }> {
  const f = await find(token);
  if (f.kind === 'invoice') {
    const paid = (await paidByInvoice(f.access.db, f.access.siteId, [f.invoice.id])).get(f.invoice.id) ?? 0;
    return {
      buffer: await invoicePdf(f.invoice.snapshot, { paid_cents: paid, void_reason: f.invoice.status === 'void' ? f.invoice.void_reason || 'Void' : null }),
      filename: `${invoiceLabel(f.invoice.invoice_number)}.pdf`,
    };
  }
  const detail = await requireJob(f.access, f.jobId);
  const est = detail.estimates.find(e => e.id === f.estimateId)!;
  const doc = buildEstimateDoc({ estimate: est, job: detail.job, customer: detail.customer, vehicle: detail.vehicle, settings: detail.settings, site: f.site });
  return { buffer: await estimatePdf(doc), filename: `${doc.number_label}.pdf` };
}

export async function approveOnline(token: string, input: { typed_name?: unknown; signature?: unknown; parts_back?: unknown; declined_line_ids?: unknown }, request: NextRequest) {
  const f = await find(token);
  if (f.kind !== 'estimate') throw new ShopRuleError('This isn’t an estimate.', undefined, 400);
  const detail = await requireJob(f.access, f.jobId);
  const est = detail.estimates.find(e => e.id === f.estimateId)!;
  if (est.status !== 'sent') throw new ShopRuleError(est.status === 'approved' ? 'You already approved this estimate. Thank you!' : 'This estimate can’t be approved anymore. Ask the shop for the current one.', undefined, 409);
  const declined = new Set(Array.isArray(input.declined_line_ids) ? input.declined_line_ids.filter(x => typeof x === 'string') : []);
  const decisions: Record<string, string> = {};
  for (const l of est.lines) {
    // Customers can say no to lines; they can't add back lines the shop marked declined.
    if (l.decision === 'include') decisions[l.id] = declined.has(l.id) ? 'declined' : 'include';
  }
  const typed = str(input.typed_name, 120);
  const result = await authorizeEstimate(f.access, est.id, {
    method: 'online',
    authorized_by: typed,
    typed_name: typed,
    contact: detail.customer.email || 'Approval link',
    parts_back: input.parts_back,
    signature: input.signature,
    decisions,
    taken_by: 'Online approval page',
  }, { request });
  const car = vehicleLabel(detail.vehicle);
  await notifyOwner(
    f.site.owner_email,
    f.site.name,
    `${detail.customer.name} approved the ${est.is_revision ? 'extra work' : 'estimate'} on the ${car}`,
    [
      `${typed} approved ${est.is_revision ? 'revised ' : ''}estimate v${est.version} online for ${formatCents(result.amount_cents)}.`,
      input.parts_back ? 'They want the replaced parts back.' : 'They don’t need the replaced parts back.',
      declined.size ? `They declined ${declined.size} line${declined.size === 1 ? '' : 's'}.` : 'They approved every line.',
    ],
    { label: 'Open the job', url: `${APP_URL}/admin/shop/jobs/${detail.job.id}` },
  );
  return result;
}

export async function declineOnline(token: string, input: { reason?: unknown }) {
  const f = await find(token);
  if (f.kind !== 'estimate') throw new ShopRuleError('This isn’t an estimate.', undefined, 400);
  const detail = await requireJob(f.access, f.jobId);
  const est = detail.estimates.find(e => e.id === f.estimateId)!;
  if (est.status !== 'sent') throw new ShopRuleError('This estimate can’t be changed anymore.', undefined, 409);
  await declineEstimate(f.access, est.id, { reason: input.reason, by: detail.customer.name });
  await notifyOwner(
    f.site.owner_email,
    f.site.name,
    `${detail.customer.name} declined the ${est.is_revision ? 'extra work' : 'estimate'} on the ${vehicleLabel(detail.vehicle)}`,
    [str(input.reason, 500) ? `They said: “${str(input.reason, 500)}”` : 'They didn’t give a reason.', 'Give them a call if you want to talk it through.'],
    { label: 'Open the job', url: `${APP_URL}/admin/shop/jobs/${detail.job.id}` },
  );
  return { ok: true };
}

// ── Payments ───────────────────────────────────────────────────────────────

function stripeClient(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new ShopRuleError('Card payments aren’t set up.', undefined, 503);
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' as Stripe.LatestApiVersion });
}

async function payableInvoice(token: string) {
  const f = await find(token);
  if (f.kind !== 'invoice') throw new ShopRuleError('This isn’t an invoice.', undefined, 400);
  if (f.invoice.status !== 'issued') throw new ShopRuleError('This invoice was voided.', undefined, 409);
  const paid = (await paidByInvoice(f.access.db, f.access.siteId, [f.invoice.id])).get(f.invoice.id) ?? 0;
  const balance = f.invoice.total_cents - paid;
  if (balance <= 0) throw new ShopRuleError('This invoice is paid. Thank you!', undefined, 409);
  return { ...f, balance };
}

/** Start an online payment for the balance. Returns the URL to send the customer to. */
export async function startPayment(token: string, provider: unknown): Promise<{ url: string }> {
  const f = await payableInvoice(token);
  const back = docUrl(f.site, token);
  const label = `${invoiceLabel(f.invoice.invoice_number)} · ${f.invoice.snapshot.vehicle.description}`;
  if (provider === 'stripe') {
    const { data: site } = await f.access.db.from('sites').select('stripe_account_id').eq('id', f.access.siteId).single();
    if (!site?.stripe_account_id) throw new ShopRuleError('Card payments aren’t set up for this shop.', undefined, 409);
    const session = await stripeClient().checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price_data: { currency: 'cad', product_data: { name: label, description: `${f.invoice.snapshot.shop.name}, RO-${f.invoice.snapshot.ro_number}` }, unit_amount: f.balance }, quantity: 1 }],
      customer_email: f.invoice.snapshot.customer.email || undefined,
      success_url: `${f.site.base_url}/api/shop/public/pay/stripe-return?doc=${encodeURIComponent(token)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: back,
      metadata: { shop_invoice_id: f.invoice.id, site_id: f.access.siteId },
      payment_intent_data: { metadata: { shop_invoice_id: f.invoice.id, site_id: f.access.siteId }, description: label },
    }, { stripeAccount: site.stripe_account_id });
    if (!session.url) throw new ShopRuleError('Couldn’t start the card payment. Try again.', undefined, 502);
    return { url: session.url };
  }
  if (provider === 'paypal') {
    const creds = await getSitePaypalCreds(f.access.siteId);
    if (!creds) throw new ShopRuleError('PayPal isn’t set up for this shop.', undefined, 409);
    const order = await createOrder(creds, {
      currency: 'CAD',
      items: [{ name: label.slice(0, 127), quantity: '1', unit_amount: { currency_code: 'CAD', value: (f.balance / 100).toFixed(2) } }],
      customId: f.invoice.id,
      description: `${f.invoice.snapshot.shop.name}, RO-${f.invoice.snapshot.ro_number}`.slice(0, 127),
      returnUrl: `${f.site.base_url}/api/shop/public/pay/paypal-return?doc=${encodeURIComponent(token)}`,
      cancelUrl: back,
      customerEmail: f.invoice.snapshot.customer.email || undefined,
    });
    const links = (order.raw?.links || []) as { rel: string; href: string }[];
    const approve = links.find(l => l.rel === 'payer-action' || l.rel === 'approve');
    if (!approve) throw new ShopRuleError('Couldn’t start the PayPal payment. Try again.', undefined, 502);
    return { url: approve.href };
  }
  throw new ShopRuleError('Pick a way to pay.', undefined, 400);
}

async function afterOnlinePayment(f: Awaited<ReturnType<typeof payableInvoice>> | (Found & { kind: 'invoice' }), amount: number, method: 'stripe' | 'paypal') {
  const { data: job } = await f.access.db.from('shop_jobs').select('id').eq('site_id', f.access.siteId).eq('id', f.invoice.job_id).single();
  if (job) await addEvent(f.access.db, f.access.siteId, job.id, 'system', { actor: 'Customer (online)', body: `Paid ${formatCents(amount)} online by ${method === 'stripe' ? 'card' : 'PayPal'}.` });
  await notifyOwner(
    f.site.owner_email,
    f.site.name,
    `${f.invoice.snapshot.customer.name} paid ${formatCents(amount)} online`,
    [`${invoiceLabel(f.invoice.invoice_number)} for the ${f.invoice.snapshot.vehicle.description}, paid by ${method === 'stripe' ? 'card through Stripe' : 'PayPal'} on ${formatDate(todayISO())}.`],
  );
}

/** Stripe success redirect: verify the session on the shop's account, then record it once. */
export async function finishStripe(token: string, sessionId: string): Promise<string> {
  const f = await find(token);
  if (f.kind !== 'invoice') throw new ShopRuleError('This isn’t an invoice.', undefined, 400);
  const back = docUrl(f.site, token);
  const { data: site } = await f.access.db.from('sites').select('stripe_account_id').eq('id', f.access.siteId).single();
  if (!site?.stripe_account_id || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return `${back}?payment=failed`;
  const session = await stripeClient().checkout.sessions.retrieve(sessionId, { stripeAccount: site.stripe_account_id });
  if (session.payment_status !== 'paid' || session.metadata?.shop_invoice_id !== f.invoice.id) return `${back}?payment=failed`;
  const amount = session.amount_total ?? 0;
  const res = await recordPayment(f.access, f.invoice.id, {
    amount_cents: amount,
    method: 'stripe',
    provider_ref: `stripe:${session.id}`,
    reference: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null,
  });
  if (!res.duplicate) await afterOnlinePayment(f, amount, 'stripe');
  return `${back}?payment=done`;
}

/** PayPal return: capture the approved order once, then record it. */
export async function finishPaypal(token: string, orderId: string): Promise<string> {
  const f = await find(token);
  if (f.kind !== 'invoice') throw new ShopRuleError('This isn’t an invoice.', undefined, 400);
  const back = docUrl(f.site, token);
  if (!/^[A-Z0-9]{8,40}$/.test(orderId)) return `${back}?payment=failed`;
  const ref = `paypal:${orderId}`;
  const { data: existing } = await f.access.db.from('shop_payments').select('id').eq('site_id', f.access.siteId).eq('provider_ref', ref).maybeSingle();
  if (existing) return `${back}?payment=done`;
  const creds = await getSitePaypalCreds(f.access.siteId);
  if (!creds) return `${back}?payment=failed`;
  let capture;
  try {
    capture = await captureOrder(creds, orderId);
  } catch (err) {
    console.error('[shop/public] PayPal capture failed:', err);
    return `${back}?payment=failed`;
  }
  const unit = capture.raw?.purchase_units?.[0];
  const customId = unit?.payments?.captures?.[0]?.custom_id ?? unit?.custom_id ?? null;
  if (capture.status !== 'COMPLETED' || (customId && customId !== f.invoice.id) || capture.currency !== 'CAD') return `${back}?payment=failed`;
  const res = await recordPayment(f.access, f.invoice.id, { amount_cents: capture.amountCents, method: 'paypal', provider_ref: ref, reference: capture.captureId });
  if (!res.duplicate) await afterOnlinePayment(f, capture.amountCents, 'paypal');
  return `${back}?payment=done`;
}
