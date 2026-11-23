/**
 * Printful API client for one site's connection.
 *
 * Auth (developers.printful.com):
 * - OAuth "public app" (PRINTFUL_CLIENT_ID / PRINTFUL_CLIENT_SECRET): access
 *   tokens last ~1 hour; the refresh token rotates on every refresh.
 * - Private token pasted by the owner (store-level; account-level tokens need
 *   X-PF-Store-Id, which we send whenever the store id is known).
 *
 * Sync products are only in API v1 (/store/products); orders use v1 too so the
 * order and its shipments come back in one shape. Webhooks use v2 because v2
 * events are signed (HMAC-SHA256, header x-pf-webhook-signature).
 *
 * Tokens are decrypted only here and never leave the server.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptSecret, encryptSecret } from '@/lib/crypto/secret-box';

export const PRINTFUL_API = 'https://api.printful.com';
const OAUTH_TOKEN_URL = 'https://www.printful.com/oauth/token';
export const OAUTH_AUTHORIZE_URL = 'https://www.printful.com/oauth/authorize';

export interface PrintfulConnectionRow {
  site_id: string;
  auth_type: 'oauth' | 'token';
  store_id: number | null;
  store_name: string | null;
  access_token_enc: string;
  refresh_token_enc: string | null;
  token_expires_at: string | null;
  webhook_secret_enc: string | null;
  webhook_configured_at: string | null;
  auto_confirm: boolean;
  last_error: string | null;
  created_at?: string;
  updated_at?: string;
}

export class PrintfulError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = 'PrintfulError';
    this.status = status;
  }
}

export function oauthConfigured(): boolean {
  return !!(process.env.PRINTFUL_CLIENT_ID && process.env.PRINTFUL_CLIENT_SECRET);
}

/** Only what a browser or the MCP may see about a connection. */
export function publicConnection(row: PrintfulConnectionRow | null) {
  if (!row) return { connected: false as const };
  return {
    connected: true as const,
    auth_type: row.auth_type,
    store_id: row.store_id,
    store_name: row.store_name,
    auto_confirm: !!row.auto_confirm,
    webhook_configured: !!row.webhook_configured_at,
    last_error: row.last_error,
    connected_at: row.created_at || null,
  };
}

export async function loadConnection(db: SupabaseClient, siteId: string): Promise<PrintfulConnectionRow | null> {
  const { data } = await db.from('printful_connections').select('*').eq('site_id', siteId).maybeSingle();
  return (data as PrintfulConnectionRow) || null;
}

// ── OAuth ──────────────────────────────────────────────────────────────────

export interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at: string | number;
}

async function oauthTokenRequest(params: Record<string, string>): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    client_id: process.env.PRINTFUL_CLIENT_ID || '',
    client_secret: process.env.PRINTFUL_CLIENT_SECRET || '',
    ...params,
  });
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => null)) as Partial<OAuthTokens> & { error?: unknown } | null;
  if (!res.ok || !json?.access_token) {
    throw new PrintfulError(`Printful sign-in failed (HTTP ${res.status})`, res.status === 400 || res.status === 401 ? 401 : 502);
  }
  return json as OAuthTokens;
}

export function exchangeOAuthCode(code: string) {
  return oauthTokenRequest({ grant_type: 'authorization_code', code });
}

export function tokenExpiry(expiresAt: string | number | undefined): string | null {
  const n = Number(expiresAt);
  if (!Number.isFinite(n) || n <= 0) return new Date(Date.now() + 55 * 60_000).toISOString();
  return new Date(n * 1000).toISOString();
}

/** A usable access token, refreshing (and storing the rotated refresh token) when needed. */
async function accessToken(db: SupabaseClient, conn: PrintfulConnectionRow, force = false): Promise<string> {
  if (conn.auth_type !== 'oauth') return decryptSecret(conn.access_token_enc);
  const expires = conn.token_expires_at ? Date.parse(conn.token_expires_at) : 0;
  if (!force && expires - Date.now() > 2 * 60_000) return decryptSecret(conn.access_token_enc);
  if (!conn.refresh_token_enc) throw new PrintfulError('Printful needs to be reconnected (no refresh token)', 401);
  if (!oauthConfigured()) throw new PrintfulError('Printful OAuth is not configured on this server', 500);

  let tokens: OAuthTokens;
  try {
    tokens = await oauthTokenRequest({ grant_type: 'refresh_token', refresh_token: decryptSecret(conn.refresh_token_enc) });
  } catch (e) {
    // Another request may have refreshed (and rotated) the token first.
    const fresh = await loadConnection(db, conn.site_id);
    if (fresh && fresh.refresh_token_enc !== conn.refresh_token_enc && fresh.access_token_enc) {
      Object.assign(conn, fresh);
      return decryptSecret(fresh.access_token_enc);
    }
    await db.from('printful_connections').update({ last_error: 'Printful sign-in expired: reconnect Printful in Admin → Ecommerce → Fulfillment.', updated_at: new Date().toISOString() }).eq('site_id', conn.site_id);
    throw e;
  }
  const update = {
    access_token_enc: encryptSecret(tokens.access_token),
    refresh_token_enc: encryptSecret(tokens.refresh_token),
    token_expires_at: tokenExpiry(tokens.expires_at),
    last_error: null,
    updated_at: new Date().toISOString(),
  };
  await db.from('printful_connections').update(update).eq('site_id', conn.site_id);
  Object.assign(conn, update);
  return tokens.access_token;
}

// ── HTTP ──────────────────────────────────────────────────────────────────

interface RequestOpts {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
}

/** Raw call with a plain token (used while connecting, before a row exists). */
export async function printfulRequestWithToken<T = unknown>(token: string, storeId: number | null, path: string, opts: RequestOpts = {}): Promise<T> {
  const url = new URL(path, PRINTFUL_API);
  for (const [k, v] of Object.entries(opts.query || {})) if (v !== undefined) url.searchParams.set(k, String(v));
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  if (storeId) headers['X-PF-Store-Id'] = String(storeId);
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method: opts.method || 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 429 && attempt === 0) {
      const wait = Math.min(5, Number(res.headers.get('retry-after')) || 2);
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    const json = await res.json().catch(() => null) as { error?: { message?: string }; detail?: string; title?: string; result?: unknown } | null;
    if (!res.ok) {
      const message = json?.error?.message || json?.detail || json?.title || (typeof json?.result === 'string' ? json.result : '') || `HTTP ${res.status}`;
      throw new PrintfulError(`Printful: ${String(message).slice(0, 300)}`, res.status === 401 || res.status === 403 ? 401 : res.status === 404 ? 404 : res.status >= 500 ? 502 : 400);
    }
    return json as T;
  }
}

export async function printfulRequest<T = unknown>(db: SupabaseClient, conn: PrintfulConnectionRow, path: string, opts: RequestOpts = {}): Promise<T> {
  const token = await accessToken(db, conn);
  try {
    return await printfulRequestWithToken<T>(token, conn.store_id, path, opts);
  } catch (e) {
    if (e instanceof PrintfulError && e.status === 401 && conn.auth_type === 'oauth') {
      return printfulRequestWithToken<T>(await accessToken(db, conn, true), conn.store_id, path, opts);
    }
    if (e instanceof PrintfulError && e.status === 401) {
      await db.from('printful_connections').update({ last_error: 'Printful rejected the token: it may have expired. Reconnect Printful in Admin → Ecommerce → Fulfillment.', updated_at: new Date().toISOString() }).eq('site_id', conn.site_id);
    }
    throw e;
  }
}

// ── Typed reads / writes ──────────────────────────────────────────────────

export interface PfFile { type?: string; preview_url?: string | null; thumbnail_url?: string | null; visible?: boolean }
export interface PfSyncVariant {
  id: number;
  external_id?: string | null;
  name: string;
  synced?: boolean;
  variant_id?: number;
  retail_price?: string | null;
  currency?: string | null;
  is_ignored?: boolean;
  sku?: string | null;
  size?: string | null;
  color?: string | null;
  availability_status?: string | null;
  product?: { variant_id?: number; product_id?: number; image?: string | null; name?: string | null };
  files?: PfFile[];
}
export interface PfSyncProductSummary {
  id: number;
  external_id?: string | null;
  name: string;
  variants?: number;
  synced?: number;
  thumbnail_url?: string | null;
  is_ignored?: boolean;
}
export interface PfSyncProduct {
  sync_product: PfSyncProductSummary;
  sync_variants: PfSyncVariant[];
}

export interface PfStore { id: number; name: string; type?: string }

/** Stores the token can see (v2). A store-level token sees exactly one. */
export async function listStoresWithToken(token: string): Promise<PfStore[]> {
  const json = await printfulRequestWithToken<{ data?: PfStore[] }>(token, null, '/v2/stores');
  return Array.isArray(json?.data) ? json.data : [];
}

export async function listSyncProducts(db: SupabaseClient, conn: PrintfulConnectionRow, offset = 0, limit = 20) {
  const json = await printfulRequest<{ result: PfSyncProductSummary[]; paging?: { total: number; offset: number; limit: number } }>(
    db, conn, '/store/products', { query: { offset, limit: Math.max(1, Math.min(100, limit)) } },
  );
  return { products: json.result || [], total: json.paging?.total ?? (json.result || []).length };
}

export async function getSyncProduct(db: SupabaseClient, conn: PrintfulConnectionRow, id: number): Promise<PfSyncProduct> {
  const json = await printfulRequest<{ result: PfSyncProduct }>(db, conn, `/store/products/${encodeURIComponent(String(id))}`);
  if (!json?.result?.sync_product) throw new PrintfulError('Printful product not found', 404);
  return json.result;
}

export interface PfShipment {
  id: number;
  carrier?: string | null;
  service?: string | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
  ship_date?: string | null;
  shipped_at?: number | string | null;
}
export interface PfOrder {
  id: number;
  external_id?: string | null;
  status: string;
  shipments?: PfShipment[];
  dashboard_url?: string | null;
}

export async function createPrintfulOrder(db: SupabaseClient, conn: PrintfulConnectionRow, body: unknown, confirm: boolean): Promise<PfOrder> {
  const json = await printfulRequest<{ result: PfOrder }>(db, conn, '/orders', { method: 'POST', body, query: { confirm } });
  return json.result;
}

export async function getPrintfulOrder(db: SupabaseClient, conn: PrintfulConnectionRow, id: number | string): Promise<PfOrder> {
  const json = await printfulRequest<{ result: PfOrder }>(db, conn, `/orders/${encodeURIComponent(String(id))}`);
  return json.result;
}

export async function confirmPrintfulOrder(db: SupabaseClient, conn: PrintfulConnectionRow, id: number): Promise<PfOrder> {
  const json = await printfulRequest<{ result: PfOrder }>(db, conn, `/orders/${id}/confirm`, { method: 'POST' });
  return json.result;
}

export const WEBHOOK_EVENTS = ['shipment_sent', 'order_failed', 'order_canceled', 'order_put_hold', 'order_updated'];

/** Point the store's (v2, signed) webhooks at Keystone. Returns the HMAC secret (hex). */
export async function configureWebhooks(db: SupabaseClient, conn: PrintfulConnectionRow, url: string): Promise<string | null> {
  type Cfg = { secret_key?: unknown };
  const json = await printfulRequest<Cfg & { data?: Cfg; result?: Cfg }>(db, conn, '/v2/webhooks', {
    method: 'POST',
    body: { default_url: url, expires_at: null, events: WEBHOOK_EVENTS.map((type) => ({ type })) },
  });
  const cfg = json?.data ?? json?.result ?? json;
  return typeof cfg?.secret_key === 'string' ? cfg.secret_key : null;
}

export async function removeWebhooks(db: SupabaseClient, conn: PrintfulConnectionRow): Promise<void> {
  await printfulRequest(db, conn, '/v2/webhooks', { method: 'DELETE' }).catch(() => {});
}
