/**
 * POST /api/printful/webhook?site=<siteId>  — Printful v2 webhook events.
 *
 * Verified with the HMAC secret Printful gave when Keystone registered the
 * webhook (header x-pf-webhook-signature, hex HMAC-SHA256 of the raw body).
 * The payload is only a trigger: the order is re-read from Printful with the
 * site's own credentials before anything is saved or emailed.
 *
 * Handles shipment_sent (and v1's package_shipped), order_failed,
 * order_canceled, order_put_hold and order_updated.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { decryptSecret } from '@/lib/crypto/secret-box';
import { loadConnection } from '@/lib/printful/client';
import { printfulExternalId, syncPrintfulOrder, verifyWebhookSignature, type PrintfulOrderRow } from '@/lib/printful/fulfillment';

export const dynamic = 'force-dynamic';

const HANDLED = new Set(['shipment_sent', 'package_shipped', 'order_failed', 'order_canceled', 'order_put_hold', 'order_updated']);

export async function POST(request: NextRequest) {
  const siteId = request.nextUrl.searchParams.get('site') || '';
  if (!/^[0-9a-f-]{36}$/i.test(siteId)) return NextResponse.json({ error: 'unknown site' }, { status: 404 });

  const raw = await request.text();
  const db = createAdminClient();
  const conn = await loadConnection(db, siteId);
  if (!conn?.webhook_secret_enc) return NextResponse.json({ error: 'not connected' }, { status: 404 });

  let secret: string;
  try {
    secret = decryptSecret(conn.webhook_secret_enc);
  } catch {
    return NextResponse.json({ error: 'not configured' }, { status: 500 });
  }
  if (!verifyWebhookSignature(raw, request.headers.get('x-pf-webhook-signature'), secret)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let event: { type?: string; store_id?: number; store?: number; data?: { order?: { id?: number; external_id?: string } } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (!event.type || !HANDLED.has(event.type)) return NextResponse.json({ ok: true, ignored: event.type || null });
  const store = Number(event.store_id ?? event.store);
  if (conn.store_id && store && store !== Number(conn.store_id)) return NextResponse.json({ ok: true, ignored: 'other store' });

  const pfOrderId = Number(event.data?.order?.id);
  const externalId = String(event.data?.order?.external_id || '');
  let record: PrintfulOrderRow | null = null;
  if (pfOrderId) {
    const { data } = await db.from('printful_orders').select('*').eq('site_id', siteId).eq('printful_order_id', pfOrderId).maybeSingle();
    record = data as PrintfulOrderRow | null;
  }
  if (!record && /^[0-9a-f]{32}$/i.test(externalId)) {
    const id = `${externalId.slice(0, 8)}-${externalId.slice(8, 12)}-${externalId.slice(12, 16)}-${externalId.slice(16, 20)}-${externalId.slice(20)}`.toLowerCase();
    const { data } = await db.from('printful_orders').select('*').eq('site_id', siteId).eq('order_id', id).maybeSingle();
    if (data && printfulExternalId(data.order_id) === externalId.toLowerCase()) record = data as PrintfulOrderRow;
  }
  // Not one of ours (e.g. an order the owner made in Printful directly).
  if (!record) return NextResponse.json({ ok: true, ignored: 'unknown order' });

  try {
    const result = await syncPrintfulOrder(db, record);
    return NextResponse.json(result);
  } catch (e) {
    console.error('[printful/webhook] sync failed', e);
    // 5xx makes Printful retry later.
    return NextResponse.json({ error: 'sync failed' }, { status: 502 });
  }
}
