/**
 * Renderer for agent-built (engine v2) sites.
 *
 *   /v2r/pub/<siteId>/<path>    published release — reached via the middleware
 *                               rewrite for *.kswd.ca and custom domains
 *   /v2r/draft/<token>/<path>   signed draft link (editor canvas / previews)
 *
 * Drafts are served with a CSP sandbox so agent JS runs in an opaque origin
 * and can never read keystoneweb.ca cookies or storage, even though the draft
 * is served from the app host.
 */
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { APP_URL, parseHost } from '@/lib/env/domain';
import { ALLOWED_SCRIPT_HOSTS_FOR_CSP } from '@/lib/v2/render';
import { loadDraftBundle, loadRelease, loadSiteRow } from '@/lib/v2/store';
import { ENGINE_V2 } from '@/lib/v2/types';
import { verifyDraftToken } from '@/lib/v2/preview-token';
import { renderSitePath } from '@/lib/v2/articles';

export const dynamic = 'force-dynamic';

const SANDBOX_CSP = "sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox";

function htmlResponse(body: string, status: number, headers: Record<string, string>) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff', ...headers },
  });
}

function notFound(message = 'Not found') {
  return htmlResponse(`<!doctype html><title>${message}</title><p style="font:16px system-ui;padding:3rem;text-align:center">${message}</p>`, 404, { 'Cache-Control': 'no-store' });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ mode: string; key: string; path?: string[] }> }) {
  const { mode, key, path } = await params;
  const pathname = `/${(path || []).map(encodeURIComponent).join('/')}`;
  const db = createAdminClient();

  if (mode === 'pub') {
    const site = await loadSiteRow(db, key);
    if (!site || site.deleted_at || !site.is_published || site.engine !== ENGINE_V2 || !site.v2_release_id) return notFound();
    const bundle = await loadRelease(db, site.v2_release_id);
    if (!bundle) return notFound();

    const host = (request.headers.get('host') || '').split(':')[0];
    const hostKind = parseHost(host).kind;
    const siteUrl = site.custom_domain ? `https://${site.custom_domain}` : bundle.site.domain ? `https://${bundle.site.domain}` : `https://${host}`;
    const rendered = await renderSitePath(db, bundle, site.id, pathname, { mode: 'published', siteUrl, version: site.v2_release_id });

    const csp = [
      `script-src 'self' blob: ${ALLOWED_SCRIPT_HOSTS_FOR_CSP} https://www.googletagmanager.com`,
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'self'",
    ];
    // Reached directly on the app host (not through the site's own domain):
    // isolate it so site scripts can't touch app cookies.
    if (hostKind === 'app' || hostKind === 'ops') csp.push(SANDBOX_CSP);

    return htmlResponse(rendered.html, rendered.status, {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      'Content-Security-Policy': csp.join('; '),
    });
  }

  if (mode === 'draft') {
    const claims = await verifyDraftToken(key);
    if (!claims) return notFound('This preview link has expired.');
    const bundle = await loadDraftBundle(db, claims.siteId);
    if (!bundle) return notFound();
    const appOrigin = new URL(APP_URL).origin;
    const requestOrigin = request.nextUrl.origin;
    const rendered = await renderSitePath(db, bundle, claims.siteId, pathname, {
      mode: claims.mode,
      linkBase: `/v2r/draft/${key}`,
      editorOrigin: claims.mode === 'edit' ? requestOrigin || appOrigin : undefined,
      version: 'draft',
    });
    return htmlResponse(rendered.html, rendered.status, {
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'Content-Security-Policy': `${SANDBOX_CSP}; frame-ancestors 'self' ${appOrigin}`,
    });
  }

  return notFound();
}
