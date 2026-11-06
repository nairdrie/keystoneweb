/**
 * Owner editor API for agent-built (v2) sites. Every action goes through the
 * same operations the MCP tools use (lib/v2/ops.ts).
 *
 * GET  /api/v2/editor?siteId=…            → editor state + signed canvas links
 * POST /api/v2/editor { siteId, op, … }   → one editing action
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireSiteAccess, siteAccessErrorResponse } from '@/lib/auth/site-access';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { APP_URL } from '@/lib/env/domain';
import type { Actor } from '@/lib/v2/types';
import { ENGINE_V2 } from '@/lib/v2/types';
import { getSiteEngine, copyInstanceContent, saveLayout } from '@/lib/v2/store';
import { createDraftToken } from '@/lib/v2/preview-token';
import {
  OpError,
  newInstanceId,
  opDeletePage,
  opGetContent,
  opGetSite,
  opListOp,
  opListVersions,
  opPageSections,
  opPutPage,
  opRestoreVersion,
  opSetContent,
  opSetOwnerTokens,
  opUpdateBusiness,
  opUpdatePage,
  opValidate,
  type OpsContext,
} from '@/lib/v2/ops';
import { toPlainText } from '@/lib/v2/sanitize';

export const dynamic = 'force-dynamic';

async function context(request: NextRequest, siteId: string | null): Promise<OpsContext> {
  const access = await requireSiteAccess(siteId, request);
  const db = createAdminClient();
  if ((await getSiteEngine(db, access.siteId)) !== ENGINE_V2) {
    throw new OpError('This site uses the classic editor', 409);
  }
  const actor: Actor = access.isAdminMode
    ? { type: 'staff', label: access.user.email || access.user.id }
    : { type: 'owner', label: access.user.email || access.user.id };
  return { db, siteId: access.siteId, actor };
}

function errorResponse(e: unknown) {
  if (e instanceof OpError) return NextResponse.json({ error: e.message, details: e.details }, { status: e.status });
  const res = siteAccessErrorResponse(e);
  if (res.status !== 500) return res;
  console.error('[v2 editor]', e);
  return NextResponse.json({ error: e instanceof Error ? e.message : 'Something went wrong' }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await context(request, request.nextUrl.searchParams.get('siteId'));
    const [site, content, editToken, previewToken] = await Promise.all([
      opGetSite(ctx),
      opGetContent(ctx),
      createDraftToken(ctx.siteId, 'edit', 12 * 3600),
      createDraftToken(ctx.siteId, 'preview', 12 * 3600),
    ]);
    return NextResponse.json({
      ...site,
      content: content.content,
      canvas: { editBase: `/v2r/draft/${editToken}`, previewBase: `/v2r/draft/${previewToken}` },
      appUrl: APP_URL,
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ctx = await context(request, body.siteId);
    const op = String(body.op || '');

    switch (op) {
      case 'content':
        return NextResponse.json(await opSetContent(ctx, body.changes));
      case 'list':
        return NextResponse.json(await opListOp(ctx, { instance: body.instance, path: body.path, op: body.listOp, index: body.index, to: body.to, expected_rev: body.expected_rev }));
      case 'section':
        return NextResponse.json(await opPageSections(ctx, { page: body.page, action: body.action, instance: body.instance, section: body.section, index: body.index, to: body.to, expected_version: body.expected_version }));
      case 'page.add': {
        const slug = String(body.slug || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
        const result = await opPutPage(ctx, { slug, title: body.title, show_in_nav: body.showInNav ?? true });
        // "Start from an existing page": copy its sections and content.
        if (body.copyFrom) {
          const site = await opGetSite(ctx);
          const source = site.pages.find((p) => p.id === body.copyFrom || p.slug === body.copyFrom);
          if (source) {
            const instances = source.sections.map((s) => ({ ...s, id: newInstanceId(), from: s.id }));
            for (const inst of instances) await copyInstanceContent(ctx.db, ctx.siteId, inst.from, inst.id, ctx.actor);
            await saveLayout(ctx.db, ctx.siteId, result.page.id, instances.map(({ from: _from, ...i }) => { void _from; return i; }));
          }
        }
        return NextResponse.json(result);
      }
      case 'page.update':
        return NextResponse.json(await opUpdatePage(ctx, body.page, body.patch || {}));
      case 'page.delete':
        return NextResponse.json(await opDeletePage(ctx, body.page));
      case 'brand':
        return NextResponse.json(await opSetOwnerTokens(ctx, body.overrides || {}));
      case 'business':
        return NextResponse.json(await opUpdateBusiness(ctx, body.business || {}));
      case 'versions':
        return NextResponse.json(await opListVersions(ctx));
      case 'restore':
        return NextResponse.json(await opRestoreVersion(ctx, body.versionId));
      case 'validate':
        return NextResponse.json(await opValidate(ctx));
      case 'change-request': {
        const message = toPlainText(String(body.message || '')).slice(0, 4000);
        if (message.length < 5) throw new OpError('Tell us what you would like changed');
        const site = await opGetSite(ctx);
        const where = [body.pageSlug ? `Page: /${body.pageSlug}` : '', body.instance ? `Section: ${body.instance}` : ''].filter(Boolean).join(' · ');
        const { error } = await ctx.db.from('support_requests').insert({
          from_email: ctx.actor.label.includes('@') ? ctx.actor.label : 'unknown@keystoneweb.ca',
          from_name: site.site.title,
          subject: `[Change request] ${site.site.title}`,
          body_text: `${message}\n\n${where}\nSite: ${ctx.siteId}\nEditor: ${APP_URL}/design?siteId=${ctx.siteId}`,
          status: 'open',
          priority: 'normal',
        });
        if (error) throw new OpError(`Could not send the request: ${error.message}`, 500);
        return NextResponse.json({ ok: true });
      }
      default:
        throw new OpError(`Unknown op "${op}"`);
    }
  } catch (e) {
    return errorResponse(e);
  }
}
