/**
 * IndexNow ping — notifies Bing and Yandex (and any other adopters) that a
 * set of URLs has changed. Spec: https://www.indexnow.org/documentation
 *
 * IndexNow requires a key file at <host>/<key>.txt with the same key inside.
 * For Keystone sites we serve a generated key from /api/seo/indexnow-key.txt
 * keyed off the site's id (deterministic), so we never need user-uploaded keys.
 *
 * If INDEXNOW_DISABLED=1 or there is no internet egress, this is a no-op.
 */

import crypto from 'node:crypto';

const INDEXNOW_ENDPOINTS = [
  'https://api.indexnow.org/indexnow',
];

export function deriveIndexNowKey(siteId: string): string {
  const salt = process.env.INDEXNOW_KEY_SALT || 'keystoneweb-indexnow';
  return crypto.createHash('sha256').update(`${salt}:${siteId}`).digest('hex').slice(0, 32);
}

interface PingInput {
  host: string;
  urls: string[];
  siteId: string;
}

export async function submitIndexNow({ host, urls, siteId }: PingInput): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (process.env.INDEXNOW_DISABLED === '1') return { ok: true };
  if (!urls.length) return { ok: true };

  const key = deriveIndexNowKey(siteId);
  const keyLocation = `https://${host}/.well-known/indexnow-${key}.txt`;

  const body = {
    host,
    key,
    keyLocation,
    urlList: urls.slice(0, 10000),
  };

  for (const endpoint of INDEXNOW_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) return { ok: true, status: res.status };
      const txt = await res.text().catch(() => '');
      return { ok: false, status: res.status, error: txt.slice(0, 200) };
    } catch (err) {
      console.warn(`[IndexNow] ${endpoint} failed:`, err);
    }
  }
  return { ok: false, error: 'All endpoints unreachable' };
}
