/**
 * Renderer for agent-built (engine v2) sites.
 *
 *   /v2r/pub/<siteId>/<path>    published release — reached via the middleware
 *                               rewrite for *.kswd.ca and custom domains
 *   /v2r/draft/<token>/<path>   signed draft link (editor canvas / previews)
 *
 * An expired preview link shows the site owner an "Extend for another week"
 * button (POST to the same URL); other visitors just see that it has expired.
 *
 * Drafts are served with a CSP sandbox so agent JS runs in an opaque origin
 * and can never read keystoneweb.ca cookies or storage, even though the draft
 * is served from the app host.
 */
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { APP_URL, parseHost } from '@/lib/env/domain';
import { ALLOWED_SCRIPT_HOSTS_FOR_CSP } from '@/lib/v2/render';
import { loadDraftBundle, loadRelease, loadSiteRow, siteMetaFromRow } from '@/lib/v2/store';
import { ENGINE_V2 } from '@/lib/v2/types';
import { inspectDraftToken, type DraftTokenCheck } from '@/lib/v2/preview-token';
import { draftLinkExtendedUntil, extendDraftLink } from '@/lib/v2/draft-link-extensions';
import { escapeHtml } from '@/lib/v2/sanitize';
import { requireSiteAccess, SiteAccessDeniedError } from '@/lib/auth/site-access';
import { renderSitePath } from '@/lib/v2/articles';
import { MEMBER_COOKIE_NAME } from '@/lib/membership/auth';
import { resolveMemberVisitor } from '@/lib/membership/access';

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

type ExpiredViewer = 'owner' | 'signed-out' | 'other';

/** Who is looking at an expired link: only the site's owner (or staff managing it) may extend it. */
async function expiredViewer(request: NextRequest, siteId: string): Promise<{ viewer: ExpiredViewer; userId?: string }> {
  try {
    const access = await requireSiteAccess(siteId, request);
    return { viewer: 'owner', userId: access.user.id };
  } catch (e) {
    if (e instanceof SiteAccessDeniedError && e.status === 401) return { viewer: 'signed-out' };
    return { viewer: 'other' };
  }
}

function expiredPage(opts: { siteTitle: string; viewer: ExpiredViewer; selfUrl: string; error?: string }) {
  const { siteTitle, viewer, selfUrl, error } = opts;
  const url = escapeHtml(selfUrl);
  let action: string;
  if (viewer === 'owner') {
    action = `<p>You own this site, so you can keep this link working for another week. Anyone you've already sent it to can use the same link again.</p>
      ${error ? `<p class="err">${escapeHtml(error)}</p>` : ''}
      <form method="post" action="${url}"><button type="submit">Extend for another week</button></form>`;
  } else if (viewer === 'signed-out') {
    action = `<p>Ask the site owner for a new link.</p>
      <p class="muted">Own this site? <a href="/signin?returnTo=${escapeHtml(encodeURIComponent(selfUrl))}">Sign in</a> to extend this link for another week.</p>`;
  } else {
    action = `<p>Ask the site owner for a new link.</p>`;
  }
  const body = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Preview link expired</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8fafc;color:#0f172a;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;padding:1.5rem;box-sizing:border-box}
  main{max-width:28rem;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:2rem;text-align:center;box-shadow:0 1px 3px rgba(15,23,42,.06)}
  h1{font-size:1.25rem;margin:0 0 .25rem}
  .site{color:#64748b;margin:0 0 1.25rem;font-size:.95rem}
  p{margin:0 0 1rem}
  .muted{color:#64748b;font-size:.9rem}
  .err{color:#b91c1c;font-size:.9rem}
  a{color:#2563eb}
  button{appearance:none;border:0;border-radius:8px;background:#0f172a;color:#fff;font:600 1rem system-ui,sans-serif;padding:.75rem 1.25rem;cursor:pointer;width:100%}
  button:hover{background:#1e293b}
</style></head>
<body><main>
  <h1>This preview link has expired</h1>
  <p class="site">${escapeHtml(siteTitle)}</p>
  ${action}
</main></body></html>`;
  return htmlResponse(body, 410, { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' });
}

/** A correctly signed preview token whose own expiry passed, but which the owner extended. */
async function isExtended(db: ReturnType<typeof createAdminClient>, key: string, check: DraftTokenCheck): Promise<boolean> {
  if (check.status !== 'expired' || check.mode !== 'preview') return false;
  const until = await draftLinkExtendedUntil(db, key, check.siteId);
  return !!until && until.getTime() > Date.now();
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
    // The member cookie is host-only on the site's own domain; on the app host there is none.
    const memberToken = request.cookies.get(MEMBER_COOKIE_NAME)?.value;
    const rendered = await renderSitePath(db, bundle, site.id, pathname, {
      mode: 'published',
      siteUrl,
      version: site.v2_release_id,
      resolveVisitor: (access) => resolveMemberVisitor(db, site.id, memberToken, access?.packages),
    });

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
      // Members-only pages/sections differ per visitor: never cache them publicly.
      'Cache-Control': rendered.personalized ? 'private, no-store' : 'public, s-maxage=60, stale-while-revalidate=300',
      ...(rendered.personalized ? { Vary: 'Cookie' } : {}),
      'Content-Security-Policy': csp.join('; '),
    });
  }

  if (mode === 'draft') {
    const check = await inspectDraftToken(key);
    if (!check) return notFound('This preview link is not valid.');
    if (check.status === 'expired' && !(await isExtended(db, key, check))) {
      // Editor canvas links are short-lived and renewed by reloading the editor.
      if (check.mode !== 'preview') return notFound('This preview link has expired.');
      const site = await loadSiteRow(db, check.siteId);
      if (!site || site.deleted_at) return notFound();
      const { viewer } = await expiredViewer(request, check.siteId);
      return expiredPage({
        siteTitle: siteMetaFromRow(site).title,
        viewer,
        selfUrl: `${request.nextUrl.pathname}${request.nextUrl.search}`,
      });
    }
    const claims = { siteId: check.siteId, mode: check.mode };
    const bundle = await loadDraftBundle(db, claims.siteId);
    if (!bundle) return notFound();
    const appOrigin = new URL(APP_URL).origin;
    const requestOrigin = request.nextUrl.origin;
    const view = request.nextUrl.searchParams.get('ks_view');
    const rendered = await renderSitePath(db, bundle, claims.siteId, pathname, {
      mode: claims.mode,
      // Preview what members (or signed-out visitors) see on members-only pages.
      viewAs: claims.mode === 'preview' && (view === 'member' || view === 'guest') ? view : undefined,
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

/** POST /v2r/draft/<token>/<path>: the owner extends an expired preview link by a week. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ mode: string; key: string; path?: string[] }> }) {
  const { mode, key } = await params;
  if (mode !== 'draft') return notFound();

  // Same-origin form posts only (the session cookie is SameSite=Lax as well).
  const origin = request.headers.get('origin');
  const sameOrigin = origin
    ? origin === request.nextUrl.origin || origin === new URL(APP_URL).origin
    : request.headers.get('sec-fetch-site') === 'same-origin';
  if (!sameOrigin) return htmlResponse('Forbidden', 403, { 'Cache-Control': 'no-store' });

  const check = await inspectDraftToken(key);
  if (!check || check.mode !== 'preview') return notFound('This preview link is not valid.');

  const db = createAdminClient();
  const site = await loadSiteRow(db, check.siteId);
  if (!site || site.deleted_at) return notFound();

  const selfUrl = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const { viewer, userId } = await expiredViewer(request, check.siteId);
  if (viewer !== 'owner' || !userId) {
    return expiredPage({ siteTitle: siteMetaFromRow(site).title, viewer, selfUrl });
  }

  try {
    await extendDraftLink(db, key, check.siteId, userId);
  } catch (e) {
    console.error('[v2r] extending draft link failed:', e);
    return expiredPage({
      siteTitle: siteMetaFromRow(site).title,
      viewer,
      selfUrl,
      error: "Couldn't extend the link. Please try again.",
    });
  }
  // Back to the same link, which now works again.
  return new Response(null, { status: 303, headers: { Location: selfUrl, 'Cache-Control': 'no-store' } });
}
