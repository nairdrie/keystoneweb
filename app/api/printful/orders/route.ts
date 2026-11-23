/**
 * POST /api/printful/orders { siteId, orderId, action: 'retry' | 'confirm' | 'sync' }
 * Owner actions on the Printful side of a Keystone order.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireSiteAccess, siteAccessErrorResponse, SiteAccessDeniedError } from '@/lib/auth/site-access';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { PrintfulError } from '@/lib/printful/client';
import { confirmDraftPrintfulOrder, retryPrintfulOrder, syncPrintfulOrder, type PrintfulOrderRow } from '@/lib/printful/fulfillment';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const access = await requireSiteAccess(body.siteId, request);
    const orderId = String(body.orderId || '');
    if (!/^[0-9a-f-]{36}$/i.test(orderId)) return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    const db = createAdminClient();
    const { data: order } = await db.from('orders').select('id').eq('id', orderId).eq('site_id', access.siteId).maybeSingle();
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    if (body.action === 'retry') return NextResponse.json(await retryPrintfulOrder(db, access.siteId, orderId));
    if (body.action === 'confirm') return NextResponse.json(await confirmDraftPrintfulOrder(db, access.siteId, orderId));
    if (body.action === 'sync') {
      const { data: record } = await db.from('printful_orders').select('*').eq('site_id', access.siteId).eq('order_id', orderId).maybeSingle();
      if (!record) return NextResponse.json({ error: 'This order was not sent to Printful' }, { status: 404 });
      return NextResponse.json(await syncPrintfulOrder(db, record as PrintfulOrderRow));
    }
    return NextResponse.json({ error: 'action must be retry, confirm or sync' }, { status: 400 });
  } catch (e) {
    if (e instanceof SiteAccessDeniedError) return siteAccessErrorResponse(e);
    if (e instanceof PrintfulError) return NextResponse.json({ error: e.message }, { status: e.status === 401 ? 400 : e.status });
    console.error('[printful/orders]', e);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
