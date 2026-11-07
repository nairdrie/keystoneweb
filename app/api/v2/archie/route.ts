/**
 * Archie v2 — the in-editor AI designer for agent-built sites.
 *
 * POST /api/v2/archie { siteId, prompt, pageSlug?, target?, history? }
 *   → NDJSON stream of ArchieEvent lines (status / tool / done / error).
 *
 * Archie edits the site through the MCP tools (lib/v2/archie.ts). Each request
 * counts as one AI prompt against the same limits as the classic AI Builder.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireSiteAccess, siteAccessErrorResponse } from '@/lib/auth/site-access';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getUserEffectiveLimits } from '@/lib/addons';
import { getSiteEngine } from '@/lib/v2/store';
import { ENGINE_V2 } from '@/lib/v2/types';
import { runArchie, type ArchieEvent, type ArchieTarget } from '@/lib/v2/archie';
import { checkAndRecordUsage, refundLastUsage, type UserPlan } from '@/app/api/ai/builder/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_PROMPT = 2000;

function planOf(status: string | undefined, plan: string | undefined): UserPlan {
  // Grace-aware: past_due keeps its paid tier during the dunning window.
  if (status !== 'active' && status !== 'past_due') return 'free';
  return plan?.toLowerCase().includes('pro') ? 'pro' : 'basic';
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : null);

function cleanTarget(raw: unknown): ArchieTarget | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  return {
    instance: str(t.instance, 120),
    section: str(t.section, 120),
    selector: str(t.selector, 600),
    tag: str(t.tag, 40),
    text: str(t.text, 300),
    html: str(t.html, 4000),
    hints: Array.isArray(t.hints) ? t.hints.filter((h): h is string => typeof h === 'string').slice(0, 8).map((h) => h.slice(0, 160)) : [],
  };
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  let access;
  try {
    access = await requireSiteAccess(typeof body.siteId === 'string' ? body.siteId : null, request);
  } catch (e) {
    return siteAccessErrorResponse(e);
  }

  const db = createAdminClient();
  if ((await getSiteEngine(db, access.siteId)) !== ENGINE_V2) {
    return NextResponse.json({ error: 'Archie v2 works on sites built with the new editor.' }, { status: 409 });
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (prompt.length < 2) return NextResponse.json({ error: 'Tell Archie what you would like to change.' }, { status: 400 });
  if (prompt.length > MAX_PROMPT) return NextResponse.json({ error: `Please keep it under ${MAX_PROMPT} characters.` }, { status: 400 });

  const apiKey = process.env.ARCHIE_API_KEY || process.env.AI_BUILDER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Archie is not configured (AI_BUILDER_API_KEY).' }, { status: 500 });

  const { data: profile } = await db.from('users').select('is_admin, email').eq('id', access.user.id).maybeSingle();
  const isStaff = !!profile?.is_admin;

  // Same prompt limits as the classic AI Builder; Keystone staff are exempt.
  if (!isStaff) {
    const { data: subscription } = await db
      .from('user_subscriptions')
      .select('subscription_status, subscription_plan, subscription_started_at')
      .eq('user_id', access.user.id)
      .maybeSingle();
    const limits = await getUserEffectiveLimits(access.user.id, access.supabase);
    const usage = await checkAndRecordUsage(
      access.user.id,
      planOf(subscription?.subscription_status, subscription?.subscription_plan),
      subscription?.subscription_started_at ?? null,
      db,
      limits.aiMultiplier,
    );
    if (!usage.allowed) {
      return NextResponse.json({ error: usage.message, upgradeRequired: !!usage.upgradeRequired, remaining: usage.remaining }, { status: 429 });
    }
  }

  const history = Array.isArray(body.history)
    ? body.history
        .filter((h): h is { role: string; text: string } => !!h && typeof h === 'object' && typeof (h as { text?: unknown }).text === 'string')
        .map((h) => ({ role: h.role === 'assistant' ? ('assistant' as const) : ('user' as const), text: h.text }))
    : [];

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let finished = false;
      const emit = (event: ArchieEvent) => {
        if (event.type === 'done') finished = true;
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          closed = true;
        }
      };
      try {
        await runArchie({
          db,
          siteId: access.siteId,
          user: { id: access.user.id, email: profile?.email || access.user.email || null, isStaff },
          request: { prompt, pageSlug: str(body.pageSlug, 120), target: cleanTarget(body.target), history },
          apiKey,
          signal: request.signal,
          emit,
        });
      } catch (e) {
        const aborted = request.signal.aborted;
        if (!aborted) console.error('[archie]', e);
        if (!finished) {
          // Nothing useful happened: don't charge the prompt.
          if (!isStaff) await refundLastUsage(access.user.id, db).catch(() => {});
          emit({ type: 'error', text: aborted ? 'Stopped.' : 'Archie hit a snag. Please try again in a moment.' });
        }
      } finally {
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' },
  });
}
