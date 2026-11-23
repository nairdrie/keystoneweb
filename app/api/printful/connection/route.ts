/**
 * Admin → Ecommerce → Fulfillment: the site's Printful connection.
 *
 * GET    ?siteId=          status (never credentials), linked products, recent Printful orders
 * POST   { siteId, token, storeId? }   connect with a Printful private token
 * PATCH  { siteId, auto_confirm }      per-site setting
 * DELETE ?siteId=          disconnect
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireSiteAccess, siteAccessErrorResponse, SiteAccessDeniedError } from '@/lib/auth/site-access';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { loadConnection, oauthConfigured, PrintfulError, publicConnection } from '@/lib/printful/client';
import { disconnect, saveConnection } from '@/lib/printful/connect';

export const dynamic = 'force-dynamic';

function errorResponse(e: unknown) {
  if (e instanceof SiteAccessDeniedError) return siteAccessErrorResponse(e);
  if (e instanceof PrintfulError) return NextResponse.json({ error: e.message }, { status: e.status === 401 ? 400 : e.status });
  console.error('[printful/connection]', e);
  return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const access = await requireSiteAccess(request.nextUrl.searchParams.get('siteId'), request);
    const db = createAdminClient();
    const siteId = access.siteId;
    const [conn, { data: products }, { data: links }, { data: pfOrders }] = await Promise.all([
      loadConnection(db, siteId),
      db.from('products').select('id, name, status, images, fulfillment_provider').eq('site_id', siteId).eq('fulfillment_provider', 'printful').eq('is_archived', false).limit(500),
      db.from('printful_product_links').select('product_id, sync_product_id, variants, synced_at').eq('site_id', siteId),
      db.from('printful_orders').select('order_id, printful_order_id, status, confirmed, error, shipments, attempts, created_at, updated_at').eq('site_id', siteId).order('created_at', { ascending: false }).limit(30),
    ]);
    const orderIds = (pfOrders || []).map((o) => o.order_id);
    const { data: orders } = orderIds.length
      ? await db.from('orders').select('id, customer_name, created_at, status').in('id', orderIds)
      : { data: [] as Array<{ id: string; customer_name: string; created_at: string; status: string }> };
    const orderById = new Map((orders || []).map((o) => [o.id, o]));
    const linkByProduct = new Map((links || []).map((l) => [l.product_id, l]));

    return NextResponse.json({
      ...publicConnection(conn),
      oauth_available: oauthConfigured(),
      products: (products || []).map((p) => {
        const link = linkByProduct.get(p.id);
        const variants = (link?.variants || []) as Array<{ available?: boolean }>;
        return {
          id: p.id,
          name: p.name,
          status: p.status,
          image: Array.isArray(p.images) ? p.images[0] || null : null,
          printful_product_id: link?.sync_product_id ?? null,
          variant_count: variants.length,
          unavailable_variants: variants.filter((v) => v.available === false).length,
          synced_at: link?.synced_at || null,
        };
      }),
      orders: (pfOrders || []).map((o) => ({
        ...o,
        customer_name: orderById.get(o.order_id)?.customer_name || null,
        order_status: orderById.get(o.order_id)?.status || null,
      })),
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const access = await requireSiteAccess(body.siteId, request);
    const token = String(body.token || '').trim();
    if (!token || token.length < 20 || /\s/.test(token)) return NextResponse.json({ error: 'Paste the Printful private token' }, { status: 400 });
    const storeId = body.storeId ? Number(body.storeId) : null;
    if (storeId !== null && (!Number.isInteger(storeId) || storeId <= 0)) return NextResponse.json({ error: 'Store id must be a number' }, { status: 400 });
    const conn = await saveConnection(createAdminClient(), { siteId: access.siteId, userId: access.user.id, authType: 'token', accessToken: token, storeId });
    return NextResponse.json(publicConnection(conn));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const access = await requireSiteAccess(body.siteId, request);
    if (typeof body.auto_confirm !== 'boolean') return NextResponse.json({ error: 'auto_confirm must be true or false' }, { status: 400 });
    const db = createAdminClient();
    const { data, error } = await db.from('printful_connections')
      .update({ auto_confirm: body.auto_confirm, updated_at: new Date().toISOString() })
      .eq('site_id', access.siteId).select('*').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Printful is not connected' }, { status: 404 });
    return NextResponse.json(publicConnection(data));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const access = await requireSiteAccess(request.nextUrl.searchParams.get('siteId'), request);
    await disconnect(createAdminClient(), access.siteId);
    return NextResponse.json({ connected: false });
  } catch (e) {
    return errorResponse(e);
  }
}
