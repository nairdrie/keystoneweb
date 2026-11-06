/**
 * HTTP emulation of the Supabase endpoints the app uses (PostgREST /rest/v1,
 * GoTrue /auth/v1/user + token refresh, Storage upload/public objects), backed
 * by the in-memory FakeSupabase. Lets the real Next.js server, middleware and
 * routes run end-to-end in tests. Test-only.
 */
import http from 'node:http';
import { FakeSupabase } from './fake-supabase';

type Row = Record<string, unknown>;

export interface FakeSession {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  expires_in: number;
  expires_at: number;
  user: Row;
}

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

function parseFilter(raw: string): (v: unknown) => boolean {
  const dot = raw.indexOf('.');
  const op = raw.slice(0, dot);
  const val = raw.slice(dot + 1);
  const s = (v: unknown) => (v === null || v === undefined ? null : typeof v === 'object' ? JSON.stringify(v) : String(v));
  switch (op) {
    case 'eq': return (v) => s(v) === val;
    case 'neq': return (v) => s(v) !== val;
    case 'gt': return (v) => (s(v) ?? '') > val;
    case 'gte': return (v) => (s(v) ?? '') >= val;
    case 'lt': return (v) => (s(v) ?? '') < val;
    case 'is': return (v) => (val === 'null' ? v === null || v === undefined : s(v) === val);
    case 'in': {
      const items = val.replace(/^\(|\)$/g, '').split(',').map((x) => x.trim().replace(/^"|"$/g, ''));
      return (v) => items.includes(s(v) as string);
    }
    case 'ilike':
    case 'like': {
      const re = new RegExp(`^${val.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[%*]/g, '.*')}$`, op === 'ilike' ? 'i' : '');
      return (v) => re.test(s(v) ?? '');
    }
    default: return () => true;
  }
}

export async function startFakeSupabase(port: number) {
  const db = new FakeSupabase();
  const sessions = new Map<string, FakeSession>();
  const log: string[] = [];

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const raw = Buffer.concat(chunks);
    const send = (status: number, body?: unknown, headers: Record<string, string> = {}) => {
      res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
      res.end(body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body));
    };
    log.push(`${req.method} ${url.pathname}${url.search}`);

    try {
      // ── Auth ──────────────────────────────────────────────────────────────
      if (url.pathname === '/auth/v1/user') {
        const token = (req.headers.authorization || '').replace(/^Bearer /i, '');
        const session = sessions.get(token);
        return session ? send(200, session.user) : send(401, { code: 401, msg: 'invalid JWT', error_code: 'bad_jwt' });
      }
      if (url.pathname === '/auth/v1/token') {
        const body = raw.length ? JSON.parse(raw.toString()) : {};
        const session = [...sessions.values()].find((s) => s.refresh_token === body.refresh_token);
        return session ? send(200, session) : send(400, { error: 'invalid_grant' });
      }
      const adminUser = url.pathname.match(/^\/auth\/v1\/admin\/users\/([^/]+)$/);
      if (adminUser) {
        const row = db.table('users').find((u) => u.id === adminUser[1]);
        return row ? send(200, { id: row.id, email: row.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} }) : send(404, { msg: 'User not found' });
      }
      if (url.pathname.startsWith('/auth/v1/')) return send(200, {});

      // ── Storage ───────────────────────────────────────────────────────────
      const pub = url.pathname.match(/^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
      if (pub) {
        const buf = db.storageObjects[`${pub[1]}/${decodeURIComponent(pub[2])}`];
        if (!buf) return send(404, { error: 'not found' });
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        return res.end(buf);
      }
      const up = url.pathname.match(/^\/storage\/v1\/object\/([^/]+)\/(.+)$/);
      if (up && req.method === 'POST') {
        const path = decodeURIComponent(up[2]);
        db.storageObjects[`${up[1]}/${path}`] = raw;
        return send(200, { Key: `${up[1]}/${path}`, Id: path });
      }
      if (url.pathname.startsWith('/storage/v1/object/list/')) return send(200, []);

      // ── PostgREST ─────────────────────────────────────────────────────────
      const m = url.pathname.match(/^\/rest\/v1\/(.+)$/);
      if (!m) return send(404, { message: 'not found' });
      if (m[1].startsWith('rpc/')) return send(200, null);
      const table = m[1];
      const prefer = String(req.headers.prefer || '');
      const wantsObject = String(req.headers.accept || '').includes('vnd.pgrst.object+json');
      const filters: Array<[string, (v: unknown) => boolean]> = [];
      for (const [k, v] of url.searchParams) if (!RESERVED.has(k)) filters.push([k, parseFilter(v)]);
      const match = (r: Row) => filters.every(([k, f]) => f(r[k]));

      const respond = (rows: Row[], total: number) => {
        const headers: Record<string, string> = {};
        if (/count=/.test(prefer)) headers['Content-Range'] = rows.length ? `0-${rows.length - 1}/${total}` : `*/${total}`;
        if (wantsObject) {
          if (rows.length !== 1) return send(406, { code: 'PGRST116', details: `The result contains ${rows.length} rows`, hint: null, message: 'JSON object requested, multiple (or no) rows returned' }, headers);
          return send(200, rows[0], headers);
        }
        if (req.method === 'HEAD') return send(200, undefined, headers);
        return send(200, rows, headers);
      };

      if (req.method === 'GET' || req.method === 'HEAD') {
        let rows = db.table(table).filter(match).map((r) => structuredClone(r));
        const total = rows.length;
        const order = url.searchParams.get('order');
        if (order) {
          const [col, dir] = order.split('.');
          rows.sort((a, b) => (String(a[col] ?? '') < String(b[col] ?? '') ? -1 : String(a[col] ?? '') > String(b[col] ?? '') ? 1 : 0) * (dir === 'desc' ? -1 : 1));
        }
        const limit = url.searchParams.get('limit');
        if (limit) rows = rows.slice(0, Number(limit));
        return respond(rows, total);
      }

      if (req.method === 'POST') {
        const body = raw.length ? JSON.parse(raw.toString()) : [];
        const rows: Row[] = Array.isArray(body) ? body : [body];
        const onConflict = url.searchParams.get('on_conflict');
        const isUpsert = /resolution=(merge|ignore)-duplicates/.test(prefer);
        const q = db.from(table);
        const builder = isUpsert
          ? q.upsert(rows, { onConflict: onConflict || undefined, ignoreDuplicates: /ignore-duplicates/.test(prefer) })
          : q.insert(rows);
        const result = await builder.select();
        if (result.error) return send(409, result.error);
        if (!/return=representation/.test(prefer)) return send(201);
        return respond((result.data as Row[]) || [], ((result.data as Row[]) || []).length);
      }

      if (req.method === 'PATCH') {
        const patch = JSON.parse(raw.toString() || '{}');
        const rows = db.table(table).filter(match);
        for (const r of rows) Object.assign(r, patch);
        if (!/return=representation/.test(prefer)) return send(204);
        return respond(rows.map((r) => structuredClone(r)), rows.length);
      }

      if (req.method === 'DELETE') {
        db.tables[table] = db.table(table).filter((r) => !match(r));
        return send(204);
      }
      return send(405, { message: 'method not allowed' });
    } catch (e) {
      return send(500, { message: (e as Error).message });
    }
  });

  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));

  function addSession(user: { id: string; email: string }): { session: FakeSession; cookieName: string; cookieValue: string } {
    const session: FakeSession = {
      access_token: `at-${user.id}`,
      refresh_token: `rt-${user.id}`,
      token_type: 'bearer',
      expires_in: 3600 * 24,
      expires_at: Math.floor(Date.now() / 1000) + 3600 * 24,
      user: { id: user.id, aud: 'authenticated', role: 'authenticated', email: user.email, app_metadata: { provider: 'email' }, user_metadata: {}, created_at: new Date().toISOString() },
    };
    sessions.set(session.access_token, session);
    return {
      session,
      cookieName: 'sb-127-auth-token',
      cookieValue: `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`,
    };
  }

  return { db, server, log, addSession, close: () => new Promise<void>((r) => { server.closeAllConnections(); server.close(() => r()); }) };
}
