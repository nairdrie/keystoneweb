/**
 * Archie v2 — the in-editor AI designer for agent-built sites.
 *
 * GET  /api/v2/archie?siteId=…                          → { runs }  (recent Archie work, oldest first)
 * POST /api/v2/archie { siteId, prompt, pageSlug?, target? } → NDJSON stream of ArchieEvent lines
 * POST /api/v2/archie { siteId, op: "stop", runId }      → { ok }
 * POST /api/v2/archie { siteId, op: "undo", runId }      → { ok }  (latest run only)
 *
 * Archie edits the site through the MCP tools (lib/v2/archie.ts). Every request
 * is saved as a run, so the owner sees what happened after a refresh, and a run
 * keeps going if the editor is closed mid-way. Each request counts as one AI
 * prompt against the same limits as the classic AI Builder.
 */
import { after, NextRequest, NextResponse } from 'next/server';
import { requireSiteAccess, siteAccessErrorResponse, type SiteAccess } from '@/lib/auth/site-access';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { getUserEffectiveLimits } from '@/lib/addons';
import { getSiteEngine } from '@/lib/v2/store';
import { OpError, opRestoreVersion } from '@/lib/v2/ops';
import { ENGINE_V2, type Actor } from '@/lib/v2/types';
import {
  getArchieRun,
  listArchieRuns,
  runArchie,
  runsToHistory,
  startArchieRun,
  updateArchieRun,
  type ArchieEvent,
  type ArchieTarget,
} from '@/lib/v2/archie';
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
    label: str(t.label, 120),
    instance: str(t.instance, 120),
    section: str(t.section, 120),
    selector: str(t.selector, 600),
    tag: str(t.tag, 40),
    text: str(t.text, 300),
    html: str(t.html, 4000),
    hints: Array.isArray(t.hints) ? t.hints.filter((h): h is string => typeof h === 'string').slice(0, 8).map((h) => h.slice(0, 160)) : [],
  };
}

async function v2Access(request: NextRequest, siteId: string | null): Promise<SiteAccess | NextResponse> {
  let access: SiteAccess;
  try {
    access = await requireSiteAccess(siteId, request);
  } catch (e) {
    return siteAccessErrorResponse(e);
  }
  if ((await getSiteEngine(createAdminClient(), access.siteId)) !== ENGINE_V2) {
    return NextResponse.json({ error: 'Archie v2 works on sites built with the new editor.' }, { status: 409 });
  }
  return access;
}

export async function GET(request: NextRequest) {
  const access = await v2Access(request, request.nextUrl.searchParams.get('siteId'));
  if (access instanceof NextResponse) return access;
  const runs = await listArchieRuns(createAdminClient(), access.siteId, 30);
  return NextResponse.json({ runs }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const access = await v2Access(request, typeof body.siteId === 'string' ? body.siteId : null);
  if (access instanceof NextResponse) return access;
  const db = createAdminClient();

  if (body.op === 'stop') {
    const run = typeof body.runId === 'string' ? await getArchieRun(db, access.siteId, body.runId) : null;
    if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (run.status === 'running') await updateArchieRun(db, run.id, { stopRequested: true, progress: 'Stopping…' });
    return NextResponse.json({ ok: true });
  }

  if (body.op === 'undo') {
    const runs = await listArchieRuns(db, access.siteId, 5);
    const run = runs[runs.length - 1];
    // Only the latest run: restoring an older snapshot would also wipe everything after it.
    if (!run || run.id !== body.runId || !run.undoVersionId || run.undone || run.status === 'running') {
      return NextResponse.json({ error: 'Only Archie’s most recent change can be undone here. Use History for older versions.' }, { status: 409 });
    }
    const actor: Actor = access.isAdminMode ? { type: 'staff', label: access.user.email || access.user.id } : { type: 'owner', label: access.user.email || access.user.id };
    try {
      await opRestoreVersion({ db, siteId: access.siteId, actor }, run.undoVersionId);
    } catch (e) {
      if (e instanceof OpError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
    await updateArchieRun(db, run.id, { undone: true });
    return NextResponse.json({ ok: true });
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (prompt.length < 2) return NextResponse.json({ error: 'Tell Archie what you would like to change.' }, { status: 400 });
  if (prompt.length > MAX_PROMPT) return NextResponse.json({ error: `Please keep it under ${MAX_PROMPT} characters.` }, { status: 400 });

  const apiKey = process.env.ARCHIE_API_KEY || process.env.AI_BUILDER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Archie is not configured (AI_BUILDER_API_KEY).' }, { status: 500 });

  // One change at a time per site: two runs editing the same sections would trip over each other.
  const runs = await listArchieRuns(db, access.siteId, 30);
  const busy = runs.find((r) => r.status === 'running');
  if (busy) {
    return NextResponse.json({ error: "Archie is still working on your last request. Give him a moment, or stop it first.", runId: busy.id }, { status: 409 });
  }

  const { data: profile } = await db.from('users').select('is_admin, email').eq('id', access.user.id).maybeSingle();
  const isStaff = !!profile?.is_admin;
  const email = profile?.email || access.user.email || null;

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

  const target = cleanTarget(body.target);
  const pageSlug = str(body.pageSlug, 120);
  const actor: Actor = { type: isStaff ? 'staff' : 'owner', label: email || access.user.id };
  const runId = await startArchieRun(db, access.siteId, actor, {
    prompt,
    pageSlug,
    target: target ? { label: target.label ?? null, instance: target.instance ?? null, section: target.section ?? null } : null,
    status: 'running',
    progress: 'Taking a look…',
    reply: null,
    changed: false,
    undoVersionId: null,
  });

  // The stream is only a live view: the run itself carries on (via after())
  // if the owner refreshes or closes the editor, and its result is saved.
  const encoder = new TextEncoder();
  const out: { c: ReadableStreamDefaultController<Uint8Array> | null } = { c: null };
  const stream = new ReadableStream<Uint8Array>({
    start(c) { out.c = c; },
    cancel() { out.c = null; },
  });
  const send = (event: ArchieEvent) => {
    try { out.c?.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)); } catch { out.c = null; }
  };

  let progressWrite = Promise.resolve();
  const work = (async () => {
    let finished = false;
    send({ type: 'run', id: runId });
    try {
      await runArchie({
        db,
        siteId: access.siteId,
        user: { id: access.user.id, email, isStaff },
        request: { prompt, pageSlug, target, history: runsToHistory(runs, runId) },
        apiKey,
        shouldStop: async () => !!(await getArchieRun(db, access.siteId, runId))?.stopRequested,
        emit: (event) => {
          send(event);
          if (event.type === 'status' || event.type === 'tool') {
            progressWrite = progressWrite.then(() => updateArchieRun(db, runId, { progress: event.text })).catch(() => {});
          } else if (event.type === 'done') {
            finished = true;
            progressWrite = progressWrite.then(() => updateArchieRun(db, runId, {
              status: event.stopped ? 'stopped' : 'done',
              progress: null,
              reply: event.text,
              changed: event.changed,
              undoVersionId: event.undoVersionId,
            }));
          }
        },
      });
      await progressWrite;
    } catch (e) {
      console.error('[archie]', e);
      if (!finished) {
        // Nothing useful happened: don't charge the prompt.
        if (!isStaff) await refundLastUsage(access.user.id, db).catch(() => {});
        const text = 'Archie hit a snag. Please try again in a moment.';
        await progressWrite.catch(() => {});
        await updateArchieRun(db, runId, { status: 'error', progress: null, reply: text }).catch(() => {});
        send({ type: 'error', text });
      }
    } finally {
      try { out.c?.close(); } catch { /* client already gone */ }
    }
  })();
  after(work);

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' },
  });
}
