'use client';

/** Client-side calls to /api/shop/*. Rule errors come back with a message and a list of details. */

export class ShopApiError extends Error {
  status: number;
  details: string[];
  constructor(message: string, status: number, details: string[] = []) {
    super(message);
    this.name = 'ShopApiError';
    this.status = status;
    this.details = details;
  }
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  form?: FormData;
  query?: Record<string, string | number | null | undefined>;
  headers?: Record<string, string>;
}

export function shopUrl(siteId: string | null, path: string, query: ApiOptions['query'] = {}): string {
  const params = new URLSearchParams();
  if (siteId) params.set('siteId', siteId);
  for (const [k, v] of Object.entries(query || {})) if (v !== null && v !== undefined && v !== '') params.set(k, String(v));
  const qs = params.toString();
  return `/api/shop${path}${qs ? (path.includes('?') ? '&' : '?') + qs : ''}`;
}

export async function api<T = unknown>(siteId: string | null, path: string, opts: ApiOptions = {}): Promise<T> {
  const method = opts.method || (opts.body !== undefined || opts.form ? 'POST' : 'GET');
  const headers: Record<string, string> = { ...(opts.headers || {}) };
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(siteId && typeof opts.body === 'object' && opts.body && !Array.isArray(opts.body) ? { siteId, ...(opts.body as object) } : opts.body);
  }
  let res: Response;
  try {
    res = await fetch(shopUrl(siteId, path, opts.query), { method, headers, body, credentials: 'include' });
  } catch {
    throw new ShopApiError('Couldn’t reach the server. Check the connection and try again.', 0);
  }
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) {
    const d = (data || {}) as { error?: string; details?: string[] };
    throw new ShopApiError(d.error || `Something went wrong (${res.status}).`, res.status, Array.isArray(d.details) ? d.details : []);
  }
  return data as T;
}

export function errorText(err: unknown): string {
  if (err instanceof ShopApiError) return err.details.length ? `${err.message} ${err.details.join(' · ')}` : err.message;
  return err instanceof Error ? err.message : 'Something went wrong.';
}
