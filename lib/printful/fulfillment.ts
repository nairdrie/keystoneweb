/**
 * Automated Printful fulfillment for paid Keystone orders.
 *
 * - fulfillPaidOrder: called after any payment provider marks an order paid.
 *   Printful-linked lines become one Printful order (external_id = the
 *   Keystone order id without dashes), created as a draft unless the site
 *   turned on auto-confirm. Idempotent: printful_orders.order_id is unique.
 * - syncPrintfulOrder: re-reads the Printful order (webhooks only trigger it;
 *   their payload is never trusted) and saves status + tracking, emailing the
 *   customer for each new shipment.
 * - Failures are saved on printful_orders and emailed to the owner, and show in
 *   Admin → Ecommerce → Fulfillment and get_store_readiness.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { APP_URL } from '@/lib/env/domain';
import { sendComposedEmail, sendOrderShipped } from '@/lib/email';
import { buildSiteOrigin } from '@/lib/email/order-tracking-url';
import { parseProductOptions } from '@/lib/ecommerce/resolve-price';
import { REGIONS } from '@/lib/shipping-data';
import { escapeHtml } from '@/lib/v2/sanitize';
import {
  confirmPrintfulOrder,
  createPrintfulOrder,
  getPrintfulOrder,
  loadConnection,
  PrintfulError,
  type PfOrder,
  type PfShipment,
} from './client';
import { findVariantLink, lineSelection, type VariantLink } from './mapping';

type Db = SupabaseClient;

export interface PrintfulOrderRow {
  id: string;
  site_id: string;
  order_id: string;
  printful_order_id: number | null;
  status: string;
  confirmed: boolean;
  items: Array<{ productId: string; sync_variant_id: number; quantity: number }>;
  shipments: Array<{ id: number; carrier: string | null; tracking_number: string | null; tracking_url: string | null }>;
  error: string | null;
  attempts: number;
  created_at?: string;
  updated_at?: string;
}

const PROBLEM_STATUSES = new Set(['failed', 'canceled', 'onhold']);

export const printfulExternalId = (orderId: string) => orderId.replace(/-/g, '');
export const fulfillmentAdminUrl = (siteId: string) => `${APP_URL}/admin/ecommerce?siteId=${siteId}&tab=fulfillment`;

// ── Owner notifications ─────────────────────────────────────────────────────

async function ownerEmail(db: Db, siteId: string): Promise<string | null> {
  const { data: settings } = await db.from('ecommerce_settings').select('notification_email').eq('site_id', siteId).maybeSingle();
  if (settings?.notification_email) return settings.notification_email;
  const { data: site } = await db.from('sites').select('user_id').eq('id', siteId).maybeSingle();
  if (!site?.user_id) return null;
  const { data: user } = await db.from('users').select('email').eq('id', site.user_id).maybeSingle();
  return user?.email || null;
}

async function notifyOwner(db: Db, siteId: string, orderId: string, subject: string, message: string) {
  try {
    const to = await ownerEmail(db, siteId);
    if (!to) return;
    const ref = `ORDER-${orderId.slice(0, 8).toUpperCase()}`;
    const link = fulfillmentAdminUrl(siteId);
    await sendComposedEmail({
      from: 'Keystone Web <orders@keystoneweb.ca>',
      replyTo: 'hello@keystoneweb.ca',
      to: [to],
      subject: `${subject} — ${ref}`,
      html: `<p>${escapeHtml(message)}</p><p>Order: <strong>${ref}</strong></p><p><a href="${link}">Open Fulfillment in Keystone Admin</a> to retry or fix it.</p><p>— Keystone</p>`,
      plainText: `${message}\n\nOrder: ${ref}\nFix it in Keystone Admin: ${link}`,
    });
  } catch (e) {
    console.error('[printful] owner notification failed', e);
  }
}

async function fail(db: Db, record: PrintfulOrderRow, message: string, items: PrintfulOrderRow['items'] = []) {
  await db.from('printful_orders').update({ status: 'failed', error: message.slice(0, 1000), items, updated_at: new Date().toISOString() }).eq('id', record.id);
  await notifyOwner(db, record.site_id, record.order_id, 'A Printful order could not be sent', `Keystone could not send this order to Printful: ${message}`);
  return { ok: false as const, status: 'failed', error: message };
}

// ── Submit ─────────────────────────────────────────────────────────────────

interface OrderLine { productId?: string; name?: string; price_cents?: number; currency?: string; qty?: number; variants?: Record<string, string> | null; options?: Record<string, string> | null }
type Address = Record<string, string | undefined>;

interface OrderRow {
  id: string;
  site_id: string;
  items: OrderLine[];
  payment_status: string;
  status: string;
  shipping_address: Address | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  shipping_method?: string | null;
}

const ORDER_COLUMNS = 'id, site_id, items, payment_status, status, shipping_address, customer_name, customer_email, customer_phone';

async function printfulProducts(db: Db, order: OrderRow) {
  const ids = [...new Set((Array.isArray(order.items) ? order.items : []).map((i: OrderLine) => i?.productId).filter((v: unknown): v is string => typeof v === 'string'))];
  if (!ids.length) return [];
  const { data } = await db.from('products').select('id, name, options, fulfillment_provider').eq('site_id', order.site_id).in('id', ids);
  return (data || []).filter((p: { fulfillment_provider?: string | null }) => p.fulfillment_provider === 'printful') as Array<{ id: string; name: string; options: unknown }>;
}

function stateCode(country: string, region: string): { code?: string; name?: string } {
  const r = String(region || '').trim();
  if (!r) return {};
  const list = REGIONS[country] || [];
  const hit = list.find((x) => x.code.toUpperCase() === r.toUpperCase() || x.name.toLowerCase() === r.toLowerCase());
  if (hit) return { code: hit.code, name: hit.name };
  return /^[A-Za-z0-9]{1,3}$/.test(r) ? { code: r.toUpperCase() } : { name: r };
}

/** Called once an order is paid. Safe to call more than once. */
export async function fulfillPaidOrder(db: Db, orderId: string) {
  const { data: order } = await db.from('orders').select(ORDER_COLUMNS).eq('id', orderId).maybeSingle();
  if (!order || order.payment_status !== 'paid' || order.status === 'cancelled') return { ok: true as const, skipped: 'not a paid order' };
  const products = await printfulProducts(db, order as OrderRow);
  if (!products.length) return { ok: true as const, skipped: 'no Printful items' };

  const { data: record, error } = await db
    .from('printful_orders')
    .insert({ site_id: order.site_id, order_id: order.id, status: 'submitting', attempts: 1 })
    .select('*')
    .single();
  if (error || !record) return { ok: true as const, skipped: 'already sent to Printful' };
  return submitPrintfulOrder(db, record as PrintfulOrderRow, order as OrderRow, products);
}

async function submitPrintfulOrder(db: Db, record: PrintfulOrderRow, order: OrderRow, products: Array<{ id: string; name: string; options: unknown }>) {
  const conn = await loadConnection(db, order.site_id);
  if (!conn) return fail(db, record, 'Printful is not connected for this site. Connect it in Admin → Ecommerce → Fulfillment, then retry.');

  const productById = new Map(products.map((p) => [p.id, p]));
  const { data: linkRows } = await db.from('printful_product_links').select('product_id, variants').eq('site_id', order.site_id).in('product_id', products.map((p) => p.id));
  const linkByProduct = new Map((linkRows || []).map((l: { product_id: string; variants: VariantLink[] | null }) => [l.product_id, l.variants || []]));

  const lines: Array<{ sync_variant_id: number; quantity: number; retail_price: string; name: string }> = [];
  const saved: PrintfulOrderRow['items'] = [];
  let subtotal = 0;
  let currency = 'USD';
  for (const item of order.items || []) {
    const product = item?.productId ? productById.get(item.productId) : undefined;
    if (!product) continue;
    const links = linkByProduct.get(product.id);
    if (!links?.length) return fail(db, record, `"${product.name}" is marked as Printful but is not linked to a Printful product.`);
    const sel = lineSelection(item, parseProductOptions(product.options));
    const link = findVariantLink(links, sel);
    if (!link) {
      return fail(db, record, `No Printful variant matches "${product.name}" (${Object.values(sel).join(', ') || 'no choices'}). Re-link the product, then retry.`);
    }
    const qty = Math.max(1, Math.floor(Number(item.qty) || 1));
    lines.push({ sync_variant_id: link.sync_variant_id, quantity: qty, retail_price: ((Number(item.price_cents) || 0) / 100).toFixed(2), name: String(item.name || product.name).slice(0, 200) });
    saved.push({ productId: product.id, sync_variant_id: link.sync_variant_id, quantity: qty });
    subtotal += (Number(item.price_cents) || 0) * qty;
    if (item.currency) currency = String(item.currency).toUpperCase();
  }
  if (!lines.length) return fail(db, record, 'The order has no Printful items.');

  const addr = order.shipping_address || {};
  const country = String(addr.country || '').toUpperCase();
  if (!addr.line1 || !addr.city || !country) {
    return fail(db, record, 'The order has no complete shipping address, so Printful cannot ship it. Turn on "shipping required" in Admin → Ecommerce → Shipping.', saved);
  }
  const state = stateCode(country, addr.region || addr.province || '');
  const body = {
    external_id: printfulExternalId(order.id),
    shipping: 'STANDARD',
    recipient: {
      name: String(order.customer_name || '').slice(0, 100),
      address1: String(addr.line1),
      address2: addr.line2 ? String(addr.line2) : undefined,
      city: String(addr.city),
      state_code: state.code,
      state_name: state.name,
      country_code: country,
      zip: String(addr.postal || addr.zip || ''),
      email: order.customer_email || undefined,
      phone: order.customer_phone || undefined,
    },
    items: lines,
    retail_costs: { currency, subtotal: (subtotal / 100).toFixed(2) },
  };

  let pf: PfOrder;
  try {
    pf = await createPrintfulOrder(db, conn, body, !!conn.auto_confirm);
  } catch (e) {
    // A retry after a timeout may find the order already created.
    const existing = await getPrintfulOrder(db, conn, `@${body.external_id}`).catch(() => null);
    if (!existing) return fail(db, record, e instanceof Error ? e.message : 'Printful rejected the order', saved);
    pf = existing;
  }

  const status = pf.status || 'draft';
  await db.from('printful_orders').update({
    printful_order_id: pf.id,
    status,
    confirmed: status !== 'draft',
    items: saved,
    error: null,
    updated_at: new Date().toISOString(),
  }).eq('id', record.id);
  return { ok: true as const, status, printful_order_id: pf.id, confirmed: status !== 'draft' };
}

/** Owner action: send a failed order again. */
export async function retryPrintfulOrder(db: Db, siteId: string, orderId: string) {
  const { data: record } = await db.from('printful_orders').select('*').eq('site_id', siteId).eq('order_id', orderId).maybeSingle();
  if (!record) return fulfillPaidOrder(db, orderId);
  if (record.status !== 'failed') throw new PrintfulError('Only failed Printful orders can be retried', 409);
  const { data: claimed } = await db.from('printful_orders')
    .update({ status: 'submitting', attempts: (record.attempts || 0) + 1, updated_at: new Date().toISOString() })
    .eq('id', record.id).eq('status', 'failed').select('*').maybeSingle();
  if (!claimed) throw new PrintfulError('This order is already being retried', 409);
  const { data: order } = await db.from('orders').select(ORDER_COLUMNS).eq('id', orderId).maybeSingle();
  if (!order) throw new PrintfulError('Order not found', 404);
  return submitPrintfulOrder(db, claimed as PrintfulOrderRow, order as OrderRow, await printfulProducts(db, order as OrderRow));
}

/** Owner action: confirm a draft so Printful starts production (and charges the owner). */
export async function confirmDraftPrintfulOrder(db: Db, siteId: string, orderId: string) {
  const { data: record } = await db.from('printful_orders').select('*').eq('site_id', siteId).eq('order_id', orderId).maybeSingle();
  if (!record?.printful_order_id) throw new PrintfulError('This order has not been sent to Printful', 404);
  if (record.status !== 'draft') throw new PrintfulError(`This Printful order is "${record.status}", not a draft`, 409);
  const conn = await loadConnection(db, siteId);
  if (!conn) throw new PrintfulError('Printful is not connected', 409);
  const pf = await confirmPrintfulOrder(db, conn, record.printful_order_id);
  await db.from('printful_orders').update({ status: pf.status || 'pending', confirmed: true, updated_at: new Date().toISOString() }).eq('id', record.id);
  return { ok: true as const, status: pf.status || 'pending' };
}

// ── Sync (webhook-triggered or manual) ─────────────────────────────────────

export async function syncPrintfulOrder(db: Db, record: PrintfulOrderRow) {
  if (!record.printful_order_id) return { ok: false as const, error: 'not sent to Printful yet' };
  const conn = await loadConnection(db, record.site_id);
  if (!conn) return { ok: false as const, error: 'Printful is not connected' };
  const pf = await getPrintfulOrder(db, conn, record.printful_order_id);
  if (pf.external_id && pf.external_id !== printfulExternalId(record.order_id)) {
    return { ok: false as const, error: 'Printful order does not belong to this Keystone order' };
  }

  const known = new Set((record.shipments || []).map((s) => s.id));
  const fresh = (pf.shipments || []).filter((s: PfShipment) => s?.id && !known.has(s.id) && s.tracking_number);
  const shipments = [
    ...(record.shipments || []),
    ...fresh.map((s) => ({ id: s.id, carrier: s.carrier || null, tracking_number: s.tracking_number || null, tracking_url: s.tracking_url || null })),
  ];
  const status = pf.status || record.status;
  const statusChanged = status !== record.status;

  const { data: updated } = await db.from('printful_orders')
    .update({ status, confirmed: status !== 'draft', shipments, error: PROBLEM_STATUSES.has(status) ? `Printful marked this order "${status}". Check it in your Printful dashboard.` : null, updated_at: new Date().toISOString() })
    .eq('id', record.id)
    .select('id')
    .maybeSingle();
  if (!updated) return { ok: false as const, error: 'could not save' };

  if (statusChanged && PROBLEM_STATUSES.has(status)) {
    const what = status === 'onhold' ? 'is on hold' : status === 'canceled' ? 'was cancelled' : 'failed';
    await notifyOwner(db, record.site_id, record.order_id, `A Printful order ${what}`, `Printful reports that this order ${what}. Open your Printful dashboard to see why; the customer has already paid you.`);
  }

  if (fresh.length) await recordShipments(db, record, fresh);
  return { ok: true as const, status, new_shipments: fresh.length };
}

async function recordShipments(db: Db, record: PrintfulOrderRow, fresh: PfShipment[]) {
  const { data: order } = await db.from('orders')
    .select('id, site_id, items, subtotal_cents, shipping_cents, shipping_method, customer_name, customer_email, payment_method, shipping_address, status')
    .eq('id', record.order_id).maybeSingle();
  if (!order) return;
  const products = await printfulProducts(db, order as unknown as OrderRow);
  const printfulIds = new Set(products.map((p) => p.id));
  const allPrintful = (order.items || []).every((i: OrderLine) => !!i?.productId && printfulIds.has(i.productId));
  const latest = fresh[fresh.length - 1];

  await db.from('orders').update({
    tracking_number: fresh.map((s) => s.tracking_number).filter(Boolean).join(', ').slice(0, 500) || null,
    tracking_carrier: latest.carrier || null,
    ...(allPrintful && order.status !== 'cancelled' ? { status: 'shipped' } : {}),
    updated_at: new Date().toISOString(),
  }).eq('id', order.id);

  const { data: site } = await db.from('sites').select('site_slug, design_data, published_domain, custom_domain').eq('id', order.site_id).maybeSingle();
  const { data: custom } = await db.from('email_customizations').select('overrides').eq('site_id', order.site_id).eq('email_key', 'order_shipped').maybeSingle();
  const design = (site?.design_data || {}) as Record<string, string | undefined>;
  const overrides = { ...((custom?.overrides as Record<string, string>) || {}) };
  if (!allPrintful && !overrides.heading) overrides.heading = 'Part of your order has shipped';

  for (const s of fresh) {
    await sendOrderShipped({
      orderId: order.id,
      items: order.items,
      subtotalCents: order.subtotal_cents,
      shippingCents: order.shipping_cents || 0,
      shippingMethod: order.shipping_method || undefined,
      currency: order.items?.[0]?.currency || 'CAD',
      customerName: order.customer_name,
      customerEmail: order.customer_email,
      paymentMethod: order.payment_method,
      siteName: site?.site_slug || undefined,
      siteOrigin: buildSiteOrigin({ customDomain: site?.custom_domain, publishedDomain: site?.published_domain }),
      logoUrl: design.headerLogo || design.siteLogo || undefined,
      overrides,
      shippingAddress: order.shipping_address || undefined,
      trackingNumber: s.tracking_number || undefined,
      trackingCarrier: s.carrier || undefined,
    }).catch((e: unknown) => console.error('[printful] shipped email failed', e));
  }
}

// ── Webhook verification ───────────────────────────────────────────────────

/** v2 webhooks: hex HMAC-SHA256 of the raw body, keyed with the hex-decoded secret. */
export function verifyWebhookSignature(rawBody: string, signature: string | null, secretHex: string): boolean {
  if (!signature || !secretHex) return false;
  const expected = createHmac('sha256', Buffer.from(secretHex, /^[0-9a-f]+$/i.test(secretHex) ? 'hex' : 'utf8')).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature.trim().toLowerCase(), 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
