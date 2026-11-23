/**
 * Save a site's Printful connection (OAuth or private token) and point the
 * store's webhooks at Keystone. Server-only: credentials are encrypted before
 * they are stored and are never returned.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { APP_URL } from '@/lib/env/domain';
import { encryptSecret, encryptionConfigured } from '@/lib/crypto/secret-box';
import {
  configureWebhooks,
  listStoresWithToken,
  loadConnection,
  PrintfulError,
  removeWebhooks,
  type PfStore,
  type PrintfulConnectionRow,
} from './client';

export const webhookUrl = (siteId: string) => `${APP_URL}/api/printful/webhook?site=${encodeURIComponent(siteId)}`;

export async function saveConnection(db: SupabaseClient, input: {
  siteId: string;
  userId: string;
  authType: 'oauth' | 'token';
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiresAt?: string | null;
  storeId?: number | null;
}): Promise<PrintfulConnectionRow> {
  if (!encryptionConfigured()) throw new PrintfulError('CREDENTIALS_ENCRYPTION_KEY is not set on this server, so Printful credentials cannot be stored safely', 500);

  // Which store does this token reach? A store-level token sees exactly one.
  const stores: PfStore[] = await listStoresWithToken(input.accessToken);
  let store: PfStore | undefined = input.storeId ? stores.find((s) => Number(s.id) === Number(input.storeId)) : undefined;
  if (!store) {
    if (input.storeId) throw new PrintfulError(`This token cannot reach Printful store ${input.storeId}`, 400);
    if (stores.length !== 1) {
      throw new PrintfulError(stores.length
        ? `This token reaches ${stores.length} Printful stores (${stores.map((s) => `${s.name} = ${s.id}`).join(', ')}). Enter the store id, or create a token for one store.`
        : 'This token cannot see any Printful store', 400);
    }
    store = stores[0];
  }

  const now = new Date().toISOString();
  const previous = await loadConnection(db, input.siteId);
  const row = {
    site_id: input.siteId,
    auth_type: input.authType,
    store_id: Number(store.id),
    store_name: store.name || null,
    access_token_enc: encryptSecret(input.accessToken),
    refresh_token_enc: input.refreshToken ? encryptSecret(input.refreshToken) : null,
    token_expires_at: input.tokenExpiresAt || null,
    webhook_secret_enc: null,
    webhook_configured_at: null,
    auto_confirm: previous?.auto_confirm ?? false,
    last_error: null,
    connected_by: input.userId,
    updated_at: now,
  };
  const { error } = await db.from('printful_connections').upsert(row, { onConflict: 'site_id' });
  if (error) throw new PrintfulError(`Could not save the Printful connection: ${error.message}`, 500);
  const conn = (await loadConnection(db, input.siteId))!;

  // Shipping updates. A failure here leaves the connection usable (orders
  // still go out) and is shown to the owner.
  try {
    const secret = await configureWebhooks(db, conn, webhookUrl(input.siteId));
    const update = {
      webhook_secret_enc: secret ? encryptSecret(secret) : null,
      webhook_configured_at: new Date().toISOString(),
      last_error: secret ? null : 'Printful did not return a webhook secret; shipping updates cannot be verified.',
    };
    await db.from('printful_connections').update(update).eq('site_id', input.siteId);
    Object.assign(conn, update);
  } catch (e) {
    const msg = `Shipping updates could not be set up: ${e instanceof Error ? e.message : 'error'}. Reconnect to try again.`;
    await db.from('printful_connections').update({ last_error: msg }).eq('site_id', input.siteId);
    conn.last_error = msg;
  }
  return conn;
}

export async function disconnect(db: SupabaseClient, siteId: string) {
  const conn = await loadConnection(db, siteId);
  if (!conn) return;
  await removeWebhooks(db, conn);
  await db.from('printful_connections').delete().eq('site_id', siteId);
}
