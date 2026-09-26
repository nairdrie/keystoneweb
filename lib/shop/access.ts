import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireSiteAccess, SiteAccessDeniedError } from '@/lib/auth/site-access';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { readTechSession } from './tech-session';

/**
 * Access control for /api/shop/* routes.
 *
 * The Shop tab is feature-flagged per site (sites.shop_enabled), like
 * Marketing. After ownership is verified, routes use the service-role client,
 * so every query MUST filter by `siteId`.
 */

export interface ShopAccess {
  db: SupabaseClient;
  siteId: string;
  /** Name recorded on timeline events and approvals. */
  actor: string;
  isTech: boolean;
  deviceId: string | null;
  /** Acting user (or the site owner, for a shop device); used for moderation reports. */
  userId: string | null;
}

/** A rule the shop can't break (estimate not sent, bill over 10%, …). Returned as 422. */
export class ShopRuleError extends Error {
  status: number;
  details?: string[];
  constructor(message: string, details?: string[], status = 422) {
    super(message);
    this.name = 'ShopRuleError';
    this.status = status;
    this.details = details;
  }
}

async function assertShopEnabled(db: SupabaseClient, siteId: string) {
  const { data: site } = await db.from('sites').select('shop_enabled').eq('id', siteId).single();
  if (!site?.shop_enabled) throw new SiteAccessDeniedError(403, 'The Shop tab is not enabled for this site');
}

export async function requireShopAccess(siteId: string | null | undefined, request: NextRequest): Promise<ShopAccess> {
  const access = await requireSiteAccess(siteId, request);
  const db = createAdminClient();
  await assertShopEnabled(db, access.siteId);
  return { db, siteId: access.siteId, actor: 'Service desk', isTech: false, deviceId: null, userId: access.user.id };
}

/**
 * For the tech view: a signed-in shop device (PIN) or the site owner.
 * The tech's name comes from the `x-shop-tech` header and must be on the staff list.
 */
export async function requireShopTechOrOwner(siteIdHint: string | null | undefined, request: NextRequest): Promise<ShopAccess> {
  const session = await readTechSession(request);
  if (session && (!siteIdHint || siteIdHint === session.siteId)) {
    const db = createAdminClient();
    const { data: device } = await db
      .from('shop_tech_devices')
      .select('id, label, revoked_at, site_id')
      .eq('id', session.deviceId)
      .single();
    if (!device || device.revoked_at || device.site_id !== session.siteId) {
      throw new SiteAccessDeniedError(401, 'This device was signed out. Enter the shop PIN again.');
    }
    await assertShopEnabled(db, session.siteId);
    const [{ data: settings }, { data: siteRow }] = await Promise.all([
      db.from('shop_settings').select('staff').eq('site_id', session.siteId).single(),
      db.from('sites').select('user_id').eq('id', session.siteId).single(),
    ]);
    const staff: { name: string }[] = Array.isArray(settings?.staff) ? settings!.staff : [];
    const requested = (request.headers.get('x-shop-tech') || '').trim();
    const actor = staff.find(s => s.name === requested)?.name || device.label || 'Tech';
    db.from('shop_tech_devices').update({ last_seen_at: new Date().toISOString() }).eq('id', device.id).then(() => {});
    return { db, siteId: session.siteId, actor, isTech: true, deviceId: device.id, userId: (siteRow?.user_id as string | undefined) ?? null };
  }
  const access = await requireShopAccess(siteIdHint, request);
  const requested = (request.headers.get('x-shop-tech') || '').trim();
  return requested ? { ...access, actor: requested.slice(0, 60) } : access;
}

export function shopErrorResponse(err: unknown): NextResponse {
  if (err instanceof SiteAccessDeniedError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof ShopRuleError) {
    return NextResponse.json({ error: err.message, details: err.details ?? [] }, { status: err.status });
  }
  if (err instanceof Error && err.name === 'ShopAiError') {
    return NextResponse.json({ error: err.message }, { status: (err as Error & { status?: number }).status ?? 502 });
  }
  console.error('[shop] unexpected error:', err);
  const message = err instanceof Error ? err.message : 'Something went wrong';
  return NextResponse.json({ error: message }, { status: 500 });
}

/** Read JSON and the siteId (body first, then query string). */
export async function readJson<T extends Record<string, unknown>>(request: NextRequest): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ShopRuleError('The request body must be JSON.', undefined, 400);
  }
}

export function siteIdFrom(request: NextRequest, body?: Record<string, unknown> | null): string | null {
  const fromBody = body && typeof body.siteId === 'string' ? body.siteId : null;
  return fromBody || request.nextUrl.searchParams.get('siteId');
}
