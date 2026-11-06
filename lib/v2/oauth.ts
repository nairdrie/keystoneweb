/**
 * OAuth 2.1 sign-in for the Keystone MCP server (MCP authorization spec).
 *
 *   /.well-known/oauth-protected-resource[/api/mcp]   RFC 9728 — where to sign in
 *   /.well-known/oauth-authorization-server            RFC 8414 — endpoints
 *   /api/oauth/register                                RFC 7591 — automatic client registration
 *   /oauth/authorize                                   sign in + approve (browser)
 *   /api/oauth/token                                   code (+PKCE S256) / refresh → tokens
 *
 * Clients are public (PKCE, no secret). A client may also identify itself
 * with an https URL to a client ID metadata document (Claude's "published
 * identity"). Access tokens are short-lived rows in api_tokens; refresh tokens
 * rotate on every use.
 */
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import type { NextRequest } from 'next/server';
import { hashToken, TOKEN_SCOPES, type TokenScope } from './api-tokens';
import type { Db } from './store';

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 24 * 3600; // 60 days (sliding)
export const CODE_TTL_SECONDS = 10 * 60;
export const DEFAULT_SCOPES: TokenScope[] = ['sites:read', 'sites:write'];

export class OAuthError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
    this.name = 'OAuthError';
  }
}

// ── URLs ────────────────────────────────────────────────────────────────────

/** Public origin of this request (works behind Vercel's proxy and locally). */
export function requestOrigin(request: NextRequest | Request): string {
  const headers = request.headers;
  const host = headers.get('x-forwarded-host') || headers.get('host') || new URL(request.url).host;
  const forwardedProto = headers.get('x-forwarded-proto');
  const proto = forwardedProto ? forwardedProto.split(',')[0].trim() : /^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? 'http' : 'https';
  return `${proto}://${host}`;
}

export function mcpResourceUrl(origin: string) {
  return `${origin}/api/mcp`;
}

export function protectedResourceMetadata(origin: string) {
  return {
    resource: mcpResourceUrl(origin),
    authorization_servers: [origin],
    scopes_supported: [...TOKEN_SCOPES],
    bearer_methods_supported: ['header'],
    resource_name: 'Keystone Web',
    resource_documentation: `${origin}/settings`,
  };
}

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    revocation_endpoint: `${origin}/api/oauth/revoke`,
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    revocation_endpoint_auth_methods_supported: ['none'],
    scopes_supported: [...TOKEN_SCOPES],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
  };
}

// ── Clients ─────────────────────────────────────────────────────────────────

export interface OAuthClient {
  client_id: string;
  client_name: string | null;
  redirect_uris: string[];
}

const METADATA_CACHE_MS = 24 * 3600 * 1000;

function isUrlClientId(clientId: string) {
  return /^https:\/\//i.test(clientId);
}

function assertSafeHttpsUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new OAuthError('invalid_client', 'client_id is not a valid URL');
  }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) {
    throw new OAuthError('invalid_client', 'client_id must be a public https URL');
  }
  return url;
}

/** Fetch (and cache) a client ID metadata document. */
async function fetchClientMetadata(db: Db, clientId: string): Promise<OAuthClient> {
  const url = assertSafeHttpsUrl(clientId);
  const res = await fetch(url, { headers: { Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(5000) }).catch(() => null);
  if (!res || !res.ok) throw new OAuthError('invalid_client', 'Could not load the client metadata document');
  const text = await res.text();
  if (text.length > 64 * 1024) throw new OAuthError('invalid_client', 'Client metadata document is too large');
  let doc: Record<string, unknown>;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new OAuthError('invalid_client', 'Client metadata document is not JSON');
  }
  if (doc.client_id !== clientId) throw new OAuthError('invalid_client', 'Client metadata client_id does not match its URL');
  const redirectUris = Array.isArray(doc.redirect_uris) ? doc.redirect_uris.filter((u): u is string => typeof u === 'string').slice(0, 20) : [];
  if (!redirectUris.length) throw new OAuthError('invalid_client', 'Client metadata has no redirect_uris');
  const client: OAuthClient = {
    client_id: clientId,
    client_name: typeof doc.client_name === 'string' ? doc.client_name.slice(0, 100) : url.hostname,
    redirect_uris: redirectUris,
  };
  await db.from('oauth_clients').upsert(
    { ...client, metadata_url: clientId, refreshed_at: new Date().toISOString() },
    { onConflict: 'client_id' },
  );
  return client;
}

export async function getClient(db: Db, clientId: string | null | undefined): Promise<OAuthClient> {
  if (!clientId || clientId.length > 500) throw new OAuthError('invalid_client', 'Missing or invalid client_id');
  const { data } = await db.from('oauth_clients').select('client_id, client_name, redirect_uris, metadata_url, refreshed_at').eq('client_id', clientId).maybeSingle();
  if (isUrlClientId(clientId)) {
    const fresh = data && Date.now() - new Date(String(data.refreshed_at)).getTime() < METADATA_CACHE_MS;
    if (fresh) return data as OAuthClient;
    return fetchClientMetadata(db, clientId);
  }
  if (!data) throw new OAuthError('invalid_client', 'Unknown client. Register it first.', 401);
  return data as OAuthClient;
}

/** Automatic client registration (RFC 7591). Public clients only. */
export async function registerClient(db: Db, body: Record<string, unknown>) {
  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((u): u is string => typeof u === 'string') : [];
  if (!redirectUris.length || redirectUris.length > 20) throw new OAuthError('invalid_redirect_uri', 'redirect_uris is required');
  for (const uri of redirectUris) {
    let u: URL;
    try {
      u = new URL(uri);
    } catch {
      throw new OAuthError('invalid_redirect_uri', `Invalid redirect URI: ${uri}`);
    }
    // https, http on loopback (native apps, RFC 8252) or a private-use app scheme.
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
    if (u.protocol === 'http:' && !loopback) throw new OAuthError('invalid_redirect_uri', `Redirect URI must be https or loopback: ${uri}`);
    if (/^(javascript|data|file|vbscript|blob|about):$/i.test(u.protocol)) throw new OAuthError('invalid_redirect_uri', `Unsupported redirect URI: ${uri}`);
  }
  const clientId = `ksc_${randomBytes(16).toString('hex')}`;
  const clientName = typeof body.client_name === 'string' ? body.client_name.slice(0, 100) : 'AI app';
  const { error } = await db.from('oauth_clients').insert({ client_id: clientId, client_name: clientName, redirect_uris: redirectUris });
  if (error) throw new OAuthError('server_error', 'Could not register the client', 500);
  return {
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_name: clientName,
    redirect_uris: redirectUris,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  };
}

/** Exact match, except loopback redirect URIs may use any port (RFC 8252 §7.3). */
export function redirectUriAllowed(client: OAuthClient, redirectUri: string): boolean {
  if (client.redirect_uris.includes(redirectUri)) return true;
  let target: URL;
  try {
    target = new URL(redirectUri);
  } catch {
    return false;
  }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || target.protocol !== 'http:') return false;
  return client.redirect_uris.some((registered) => {
    try {
      const r = new URL(registered);
      return r.protocol === target.protocol && r.hostname === target.hostname && r.pathname === target.pathname;
    } catch {
      return false;
    }
  });
}

// ── Authorization requests ──────────────────────────────────────────────────

export interface AuthorizeRequest {
  client: OAuthClient;
  redirectUri: string;
  state: string | null;
  codeChallenge: string;
  scopes: TokenScope[];
  resource: string | null;
}

export function parseScopes(raw: string | null | undefined): TokenScope[] {
  if (!raw) return [...DEFAULT_SCOPES];
  const requested = raw.split(/[\s+]+/).filter((s): s is TokenScope => (TOKEN_SCOPES as readonly string[]).includes(s));
  const scopes = new Set<TokenScope>(requested.length ? requested : DEFAULT_SCOPES);
  scopes.add('sites:read');
  return [...scopes];
}

/** Validate an /oauth/authorize request. Errors before the redirect URI is trusted are shown, not redirected. */
export async function validateAuthorizeRequest(db: Db, params: URLSearchParams): Promise<AuthorizeRequest> {
  const client = await getClient(db, params.get('client_id'));
  const redirectUri = params.get('redirect_uri') || (client.redirect_uris.length === 1 ? client.redirect_uris[0] : '');
  if (!redirectUri || !redirectUriAllowed(client, redirectUri)) {
    throw new OAuthError('invalid_request', 'The redirect URI is not registered for this app.');
  }
  if (params.get('response_type') !== 'code') throw new OAuthError('unsupported_response_type', 'Only response_type=code is supported.');
  const codeChallenge = params.get('code_challenge') || '';
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(codeChallenge)) throw new OAuthError('invalid_request', 'A PKCE code_challenge is required.');
  if ((params.get('code_challenge_method') || 'plain') !== 'S256') throw new OAuthError('invalid_request', 'code_challenge_method must be S256.');
  const resource = params.get('resource');
  if (resource) {
    let path = '';
    try {
      path = new URL(resource).pathname.replace(/\/+$/, '');
    } catch {
      throw new OAuthError('invalid_target', 'Invalid resource.');
    }
    if (path !== '/api/mcp') throw new OAuthError('invalid_target', 'This server only issues tokens for /api/mcp.');
  }
  return { client, redirectUri, state: params.get('state'), codeChallenge, scopes: parseScopes(params.get('scope')), resource };
}

export function randomToken(prefix: string): string {
  return `${prefix}${randomBytes(32).toString('base64url')}`;
}

export async function createAuthorizationCode(db: Db, req: AuthorizeRequest, userId: string, scopes: TokenScope[]): Promise<string> {
  const code = randomToken('ksac_');
  const { error } = await db.from('oauth_codes').insert({
    code_hash: hashToken(code),
    client_id: req.client.client_id,
    user_id: userId,
    redirect_uri: req.redirectUri,
    code_challenge: req.codeChallenge,
    scopes,
    resource: req.resource,
    expires_at: new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString(),
  });
  if (error) throw new OAuthError('server_error', 'Could not create the authorization code', 500);
  return code;
}

export function redirectWith(redirectUri: string, params: Record<string, string | null | undefined>): string {
  const url = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined) url.searchParams.set(k, v);
  return url.toString();
}

// ── Tokens ──────────────────────────────────────────────────────────────────

function verifyPkce(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  const computed = Buffer.from(createHash('sha256').update(verifier).digest('base64url'));
  const expected = Buffer.from(challenge);
  return computed.length === expected.length && timingSafeEqual(computed, expected);
}

async function issueTokens(db: Db, clientId: string, clientName: string | null, userId: string, scopes: TokenScope[]) {
  const accessToken = randomToken('ks_oat_');
  const refreshToken = randomToken('ks_ort_');
  const now = Date.now();
  const { error: accessErr } = await db.from('api_tokens').insert({
    user_id: userId,
    name: clientName || 'AI app',
    token_prefix: accessToken.slice(0, 14),
    token_hash: hashToken(accessToken),
    scopes,
    client_id: clientId,
    expires_at: new Date(now + ACCESS_TOKEN_TTL_SECONDS * 1000).toISOString(),
  });
  if (accessErr) throw new OAuthError('server_error', 'Could not issue an access token', 500);
  const { error: refreshErr } = await db.from('oauth_refresh_tokens').insert({
    token_hash: hashToken(refreshToken),
    client_id: clientId,
    user_id: userId,
    scopes,
    expires_at: new Date(now + REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString(),
  });
  if (refreshErr) throw new OAuthError('server_error', 'Could not issue a refresh token', 500);
  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
    scope: scopes.join(' '),
  };
}

export async function exchangeToken(db: Db, form: URLSearchParams) {
  const grantType = form.get('grant_type');
  const clientId = form.get('client_id');

  if (grantType === 'authorization_code') {
    const code = form.get('code') || '';
    const { data: row } = await db.from('oauth_codes').select('*').eq('code_hash', hashToken(code)).maybeSingle();
    if (!row || row.used_at || new Date(String(row.expires_at)).getTime() < Date.now()) {
      throw new OAuthError('invalid_grant', 'The authorization code is invalid or expired.');
    }
    if (clientId && clientId !== row.client_id) throw new OAuthError('invalid_grant', 'The code was issued to a different client.');
    const redirectUri = form.get('redirect_uri');
    if (redirectUri && redirectUri !== row.redirect_uri) throw new OAuthError('invalid_grant', 'redirect_uri does not match.');
    if (!verifyPkce(form.get('code_verifier') || '', String(row.code_challenge))) throw new OAuthError('invalid_grant', 'PKCE verification failed.');
    // Single use: claim the code before issuing tokens.
    const { data: claimed } = await db.from('oauth_codes').update({ used_at: new Date().toISOString() }).eq('code_hash', row.code_hash).is('used_at', null).select('code_hash');
    if (!claimed?.length) throw new OAuthError('invalid_grant', 'The authorization code was already used.');
    const client = await getClient(db, String(row.client_id)).catch(() => ({ client_name: null }) as unknown as OAuthClient);
    return issueTokens(db, String(row.client_id), client.client_name, String(row.user_id), row.scopes as TokenScope[]);
  }

  if (grantType === 'refresh_token') {
    const refresh = form.get('refresh_token') || '';
    const { data: row } = await db.from('oauth_refresh_tokens').select('*').eq('token_hash', hashToken(refresh)).maybeSingle();
    if (!row || row.revoked_at || new Date(String(row.expires_at)).getTime() < Date.now()) {
      throw new OAuthError('invalid_grant', 'The refresh token is invalid or expired.');
    }
    if (clientId && clientId !== row.client_id) throw new OAuthError('invalid_grant', 'The refresh token was issued to a different client.');
    const { data: revoked } = await db.from('oauth_refresh_tokens').update({ revoked_at: new Date().toISOString() }).eq('token_hash', row.token_hash).is('revoked_at', null).select('token_hash');
    if (!revoked?.length) throw new OAuthError('invalid_grant', 'The refresh token was already used.');
    const { data: user } = await db.from('users').select('is_banned').eq('id', row.user_id).maybeSingle();
    if (user?.is_banned) throw new OAuthError('invalid_grant', 'Account unavailable.');
    const client = await getClient(db, String(row.client_id)).catch(() => ({ client_name: null }) as unknown as OAuthClient);
    return issueTokens(db, String(row.client_id), client.client_name, String(row.user_id), row.scopes as TokenScope[]);
  }

  throw new OAuthError('unsupported_grant_type', 'Use authorization_code or refresh_token.');
}

/** Revoke a refresh or access token (RFC 7009). Unknown tokens are not an error. */
export async function revokeToken(db: Db, token: string) {
  const hash = hashToken(token);
  const now = new Date().toISOString();
  await db.from('oauth_refresh_tokens').update({ revoked_at: now }).eq('token_hash', hash).is('revoked_at', null);
  await db.from('api_tokens').update({ revoked_at: now }).eq('token_hash', hash).is('revoked_at', null);
}

/** Disconnect an app: revoke all of the user's tokens for that client. */
export async function disconnectClient(db: Db, userId: string, clientId: string) {
  const now = new Date().toISOString();
  await db.from('oauth_refresh_tokens').update({ revoked_at: now }).eq('user_id', userId).eq('client_id', clientId).is('revoked_at', null);
  await db.from('api_tokens').update({ revoked_at: now }).eq('user_id', userId).eq('client_id', clientId).is('revoked_at', null);
}

/** The apps a user has connected (active refresh tokens), newest first. */
export async function listConnectedApps(db: Db, userId: string) {
  const { data } = await db
    .from('oauth_refresh_tokens')
    .select('client_id, scopes, created_at, expires_at, revoked_at')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });
  const active = (data || []).filter((r) => new Date(String(r.expires_at)).getTime() > Date.now());
  const byClient = new Map<string, { client_id: string; scopes: string[]; last_connected: string }>();
  for (const r of active) {
    if (!byClient.has(r.client_id)) byClient.set(r.client_id, { client_id: r.client_id, scopes: r.scopes, last_connected: r.created_at });
  }
  const ids = [...byClient.keys()];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: clients } = await db.from('oauth_clients').select('client_id, client_name').in('client_id', ids);
    for (const c of clients || []) names.set(c.client_id, c.client_name || c.client_id);
  }
  return [...byClient.values()].map((c) => ({ ...c, name: names.get(c.client_id) || 'AI app' }));
}

// ── Consent tickets ─────────────────────────────────────────────────────────
// The approval form carries a short-lived signed ticket binding the signed-in
// user to the exact authorization request, so the POST can't be forged or
// replayed for another user or app.
function consentKey(): Uint8Array {
  const secret = process.env.KS_V2_PREVIEW_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('Missing KS_V2_PREVIEW_SECRET (or SUPABASE_SERVICE_ROLE_KEY)');
  return createHash('sha256').update(`${secret}:ks-oauth-consent`).digest();
}

export async function signConsentTicket(userId: string, query: string): Promise<string> {
  return new SignJWT({ uid: userId, q: query })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 15 * 60)
    .sign(consentKey());
}

export async function verifyConsentTicket(ticket: string): Promise<{ userId: string; query: string } | null> {
  try {
    const { payload } = await jwtVerify(ticket, consentKey(), { algorithms: ['HS256'] });
    if (typeof payload.uid !== 'string' || typeof payload.q !== 'string') return null;
    return { userId: payload.uid, query: payload.q };
  } catch {
    return null;
  }
}
