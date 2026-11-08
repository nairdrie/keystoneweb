/**
 * Archie v2 — the in-editor AI designer for agent-built (engine v2) sites.
 *
 * The owner asks for a change (optionally pointing at a spot on the page they
 * can't edit directly); Archie runs a Claude tool-use loop over the same MCP
 * tools external agents use (lib/v2/mcp-tools.ts), locked to this one site.
 * So Archie can redesign sections, theme, layout and pages — not just blocks.
 *
 * Progress is reported through `emit` so the route can stream it to the editor.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { TokenIdentity } from './api-tokens';
import { callTool, TOOLS, type ToolContext } from './mcp-tools';
import { getGuide } from './guide';
import { createSnapshot, type Db } from './store';
import type { Actor } from './types';

type Json = Record<string, unknown>;

export const ARCHIE_MODEL = process.env.ARCHIE_MODEL || 'claude-sonnet-5-5';

/** MCP tools Archie may use. Publishing, other sites and staff tools stay with the owner / external agents. */
const ARCHIE_TOOLS = [
  'get_site',
  'get_content',
  'set_content',
  'edit_list',
  'put_section',
  'delete_section',
  'set_layout',
  'put_page',
  'delete_page',
  'set_theme',
  'update_business_profile',
  'search_stock_media',
  'import_media',
  'screenshot',
  'get_business_data',
  'upsert_services',
  'upsert_products',
  'upsert_posts',
  'validate',
] as const;

const READ_ONLY = new Set(TOOLS.filter((t) => t.readOnly).map((t) => t.name));

/** What the owner clicked on in the canvas (sent by public/ks/editor.js). */
export interface ArchieTarget {
  /** Short owner-facing description, e.g. "this graphic in Hero". */
  label?: string | null;
  instance?: string | null;
  section?: string | null;
  selector?: string | null;
  tag?: string | null;
  text?: string | null;
  html?: string | null;
  hints?: string[];
}

export interface ArchieRequest {
  prompt: string;
  pageSlug?: string | null;
  target?: ArchieTarget | null;
  /** Earlier turns with Archie on this site (plain text only, already trimmed to a window). */
  history?: Array<{ role: 'user' | 'assistant'; text: string }>;
}

export type ArchieEvent =
  | { type: 'run'; id: string }
  | { type: 'status'; text: string }
  | { type: 'tool'; name: string; text: string }
  | { type: 'done'; text: string; changed: boolean; undoVersionId: string | null; stopped?: boolean }
  | { type: 'error'; text: string };

// ── Run history ──────────────────────────────────────────────────────────────
// Each request is one row in v2_activity (action "archie"), so owners can see
// what Archie did after a refresh, and a run keeps going if they leave.

export type ArchieRunStatus = 'running' | 'done' | 'error' | 'stopped';

export interface ArchieRun {
  id: string;
  createdAt: string;
  prompt: string;
  pageSlug: string | null;
  target: { label: string | null; instance: string | null; section: string | null } | null;
  status: ArchieRunStatus;
  /** Latest progress line while running. */
  progress: string | null;
  reply: string | null;
  changed: boolean;
  undoVersionId: string | null;
  /** The owner pressed Undo on this run. */
  undone?: boolean;
  stopRequested?: boolean;
}

const RUN_ACTION = 'archie';
/** A run still "running" after this long was cut off (function timeout, crash). */
const RUN_STALE_MS = 6 * 60 * 1000;
/** How many earlier runs Archie sees, and how far back: the prompt never grows past this. */
const HISTORY_RUNS = 6;
const HISTORY_WINDOW_MS = 24 * 3600 * 1000;

type RunDetail = Omit<ArchieRun, 'id' | 'createdAt'>;

function rowToRun(row: { id: string; created_at: string; detail: unknown }): ArchieRun {
  const d = (row.detail || {}) as Partial<RunDetail>;
  let status = (d.status || 'done') as ArchieRunStatus;
  let reply = d.reply ?? null;
  if (status === 'running' && Date.now() - new Date(row.created_at).getTime() > RUN_STALE_MS) {
    status = 'error';
    reply = reply || "I didn't get to finish this one. Anything I changed is saved — ask me again to continue.";
  }
  return {
    id: row.id,
    createdAt: row.created_at,
    prompt: String(d.prompt || ''),
    pageSlug: d.pageSlug ?? null,
    target: d.target ?? null,
    status,
    progress: status === 'running' ? d.progress ?? null : null,
    reply,
    changed: !!d.changed,
    undoVersionId: d.undoVersionId ?? null,
    undone: !!d.undone,
    stopRequested: !!d.stopRequested,
  };
}

export async function listArchieRuns(db: Db, siteId: string, limit = 30): Promise<ArchieRun[]> {
  const { data } = await db
    .from('v2_activity')
    .select('id, created_at, detail')
    .eq('site_id', siteId)
    .eq('action', RUN_ACTION)
    .order('created_at', { ascending: false })
    .limit(Math.min(100, limit));
  return (data || []).map(rowToRun).reverse();
}

export async function getArchieRun(db: Db, siteId: string, id: string): Promise<ArchieRun | null> {
  const { data } = await db.from('v2_activity').select('id, created_at, detail, site_id, action').eq('id', id).maybeSingle();
  if (!data || data.site_id !== siteId || data.action !== RUN_ACTION) return null;
  return rowToRun(data);
}

export async function startArchieRun(db: Db, siteId: string, actor: Actor, detail: RunDetail): Promise<string> {
  const { data, error } = await db
    .from('v2_activity')
    .insert({ site_id: siteId, actor_type: actor.type, actor_label: actor.label, action: RUN_ACTION, detail })
    .select('id')
    .single();
  if (error || !data) throw new Error(`Could not start Archie: ${error?.message || 'no row'}`);
  return data.id as string;
}

/** Merge a patch into the run (read-modify-write; only one writer per run plus the stop flag). */
export async function updateArchieRun(db: Db, id: string, patch: Partial<RunDetail>): Promise<void> {
  const { data } = await db.from('v2_activity').select('detail').eq('id', id).maybeSingle();
  const detail = { ...((data?.detail as RunDetail) || {}), ...patch };
  // Never let a progress write clear a stop request made in between.
  if ((data?.detail as RunDetail | undefined)?.stopRequested) detail.stopRequested = true;
  await db.from('v2_activity').update({ detail }).eq('id', id);
}

/** Earlier runs as plain conversation turns for the model: recent ones only, trimmed. */
export function runsToHistory(runs: ArchieRun[], excludeId?: string): ArchieRequest['history'] {
  const since = Date.now() - HISTORY_WINDOW_MS;
  const recent = runs
    .filter((r) => r.id !== excludeId && r.status !== 'running' && r.reply && new Date(r.createdAt).getTime() >= since)
    .slice(-HISTORY_RUNS);
  return recent.flatMap((r) => [
    { role: 'user' as const, text: `[Earlier request${r.target?.label ? `, about ${r.target.label}` : ''}${r.pageSlug ? ` on page "${r.pageSlug}"` : ''}]\n${r.prompt.slice(0, 1200)}` },
    { role: 'assistant' as const, text: `${(r.reply || '').slice(0, 800)}${r.status === 'stopped' ? ' (stopped by the owner)' : ''}` },
  ]);
}

const TOOL_LABELS: Record<string, string> = {
  get_site: 'Looking over your site',
  get_content: 'Reading your content',
  set_content: 'Updating content',
  edit_list: 'Rearranging items',
  put_section: 'Redesigning a section',
  delete_section: 'Removing a section design',
  set_layout: 'Updating header and footer',
  put_page: 'Updating the page',
  delete_page: 'Deleting a page',
  set_theme: 'Adjusting colours and styles',
  update_business_profile: 'Updating business info',
  search_stock_media: 'Searching for photos',
  import_media: 'Adding an image',
  screenshot: 'Checking how it looks',
  get_business_data: 'Checking products and services',
  upsert_services: 'Updating services',
  upsert_products: 'Updating products',
  upsert_posts: 'Updating blog posts',
  validate: 'Double-checking everything',
};

const SYSTEM_PROMPT = `You are Archie, the friendly AI designer built into the Keystone site editor. You are talking to the
business owner directly, inside their editor, while they look at their site. They are usually not technical.

The owner can already edit words, images and links themselves by clicking them. They come to you for everything
else: layout, spacing, colours, fonts, decorative shapes and graphics, animations, custom HTML, new or redesigned
sections, pages, and anything else about how the site looks or works.

You work on exactly one site, through Keystone's site tools (the same ones external AI agents use). The site is
already chosen for you; never ask for a site id. Every tool call changes the live draft immediately and the owner's
canvas reloads when you finish. Restore points are taken automatically, and the owner gets an "Undo" button for
your whole change.

How to work:
- The first message includes the site overview and, when the owner pointed at something, the exact element they
  clicked and the code of the section it lives in. Use that to find what they mean; read more with get_site
  (include_code) or get_content only when you need it.
- Make the change they asked for, completely, then stop. Keep everything else as it is: change the smallest
  section/theme/CSS that achieves it, keep field ids stable so their content survives, and pass expected_version /
  expected_rev from what you read.
- The owner is the human here, so when they ask you to change content they edited, you may pass force: true for
  exactly those fields. Never overwrite other owner-edited content.
- A click target may be decorative (an svg, a shape, a background, a pseudo-element painted by CSS). Find the CSS or
  markup that draws it in the section code or the theme's global CSS.
- If something is ambiguous but low-risk, make a sensible choice and mention it. Ask a question instead of acting
  only when you genuinely cannot tell what they want, or when the change would delete pages or lots of content.
- Use screenshot only when a visual check really matters (it is slow). Never publish; the owner publishes.
- If a tool rejects your change (validation issues, conflicts), fix it and try again rather than giving up.

Your final reply is shown in a small chat bubble next to the page: one to three short, warm, plain-language
sentences saying what you changed (or the one question you need answered). No code, no markdown headings, no
tool names, no ids.

The Keystone authoring guide (the rules every section must follow) is below.

${getGuide('all')}`;

function toolDefs(): Anthropic.Beta.BetaTool[] {
  return ARCHIE_TOOLS.map((name) => {
    const def = TOOLS.find((t) => t.name === name);
    if (!def) throw new Error(`Archie tool ${name} is missing`);
    // The site is fixed for Archie: drop site_id from the schema and inject it on every call.
    const schema = JSON.parse(JSON.stringify(def.inputSchema)) as Json & { properties?: Json; required?: string[] };
    if (schema.properties) delete schema.properties.site_id;
    if (Array.isArray(schema.required)) schema.required = schema.required.filter((r) => r !== 'site_id');
    return { name: def.name, description: def.description, input_schema: schema as Anthropic.Beta.BetaTool.InputSchema };
  });
}

const MAX_RESULT_CHARS = 120_000;

/** Tool results without the agent-facing preview links, as tool_result content. */
function toolResultContent(result: unknown): Anthropic.Beta.BetaToolResultBlockParam['content'] {
  let images: Array<{ label?: string; data: string; mimeType: string }> = [];
  let payload = result;
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const { __images, preview_url: _p, ...rest } = payload as Json & { __images?: typeof images };
    void _p;
    if (Array.isArray(__images)) images = __images;
    payload = rest;
  }
  let text = JSON.stringify(payload ?? null);
  if (text.length > MAX_RESULT_CHARS) text = `${text.slice(0, MAX_RESULT_CHARS)}… [truncated — ask for less, e.g. get_content for one page or instance]`;
  const content: Exclude<Anthropic.Beta.BetaToolResultBlockParam['content'], string | undefined> = [{ type: 'text', text }];
  for (const image of images) {
    if (image.label) content.push({ type: 'text', text: image.label });
    const mediaType = (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(image.mimeType) ? image.mimeType : 'image/jpeg') as 'image/jpeg';
    content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: image.data } });
  }
  return content;
}

/** Site overview for the first message; full code only for the section the owner pointed at. */
async function siteOverview(ctx: ToolContext, siteId: string, sectionKey: string | null | undefined): Promise<string> {
  const { result, error } = await callTool('get_site', { site_id: siteId, include_code: true }, ctx);
  if (error || !result) return `(Could not load the site overview: ${error || 'unknown error'} — call get_site.)`;
  const site = { ...(result as Json) } as Json & { sections?: Array<Json>; theme?: Json };
  delete site.preview_url;
  if (Array.isArray(site.sections)) {
    site.sections = site.sections.map((s) => {
      if (sectionKey && s.key === sectionKey) return s;
      const { html: _h, css: _c, js: _j, ...rest } = s;
      void _h; void _c; void _j;
      return rest;
    });
  }
  if (site.theme) {
    const theme = { ...site.theme };
    for (const key of ['globalCss', 'globalJs'] as const) {
      const code = typeof theme[key] === 'string' ? (theme[key] as string) : '';
      if (code.length > 8000) theme[key] = `[${code.length} characters — call get_site with include_code to read it]`;
    }
    site.theme = theme;
  }
  return JSON.stringify(site);
}

function describeTarget(target: ArchieTarget): string {
  const clip = (s: string | null | undefined, n: number) => (s ? String(s).slice(0, n) : '');
  const wholeSection = target.tag === 'section' && !target.selector;
  const lines = [
    wholeSection
      ? 'The owner opened you from a section\'s toolbar: their request is about this whole section (its layout, look or content), not one element.'
      : 'The owner clicked this spot on the page (something they could not edit themselves):',
    target.instance ? `- Section instance: "${clip(target.instance, 80)}" (section design "${clip(target.section, 80) || 'unknown'}")` : '- Not inside a section (page chrome or global theme).',
    target.tag ? `- Element: <${clip(target.tag, 30)}>` : '',
    target.selector ? `- CSS path inside the section: ${clip(target.selector, 400)}` : '',
    target.text ? `- Visible text nearby: "${clip(target.text, 200)}"` : '',
    target.hints?.length ? `- Notes: ${target.hints.slice(0, 6).map((h) => clip(h, 120)).join('; ')}` : '',
    target.html ? `- Rendered markup (trimmed; lists and bindings are already filled in, so it differs slightly from the section source):\n\`\`\`html\n${clip(target.html, 2500)}\n\`\`\`` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

export async function runArchie(opts: {
  db: Db;
  siteId: string;
  user: { id: string; email: string | null; isStaff: boolean };
  request: ArchieRequest;
  apiKey: string;
  signal?: AbortSignal;
  emit: (event: ArchieEvent) => void;
  /** Checked between model turns; true ends the run (the owner pressed Stop). */
  shouldStop?: () => Promise<boolean>;
  deadlineMs?: number;
}): Promise<void> {
  const { db, siteId, user, request, emit, signal } = opts;
  const started = Date.now();
  const deadline = started + (opts.deadlineMs ?? 240_000);

  // Archie acts with the owner's own access, scoped to this site and without publish rights.
  const auth: TokenIdentity = {
    tokenId: 'archie',
    tokenName: 'Archie',
    userId: user.id,
    email: user.email,
    isStaff: user.isStaff,
    scopes: ['sites:read', 'sites:write'],
  };
  const ctx: ToolContext = { db, auth };
  const actor: Actor = { type: user.isStaff ? 'staff' : 'agent', label: `Archie · ${user.email || user.id}` };

  emit({ type: 'status', text: 'Taking a look…' });
  const overview = await siteOverview(ctx, siteId, request.target?.section);

  const parts = [
    `Site overview (get_site):\n${overview}`,
    request.pageSlug ? `The owner is looking at the page with slug "${request.pageSlug}".` : '',
    request.target ? describeTarget(request.target) : '',
    `The owner's request:\n${request.prompt}`,
  ].filter(Boolean);

  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  for (const turn of (request.history || []).slice(-HISTORY_RUNS * 2)) {
    const text = String(turn.text || '').slice(0, 2000);
    if (text) messages.push({ role: turn.role === 'assistant' ? 'assistant' : 'user', content: text });
  }
  if (messages[0]?.role === 'assistant') messages.shift();
  messages.push({ role: 'user', content: parts.join('\n\n') });

  const client = new Anthropic({ apiKey: opts.apiKey });
  const tools = toolDefs();
  let changed = false;
  let undoVersionId: string | null = null;
  let finalText = '';
  let stopped = false;

  for (let turn = 0; turn < 30; turn++) {
    if (turn > 0 && opts.shouldStop && (await opts.shouldStop().catch(() => false))) {
      stopped = true;
      finalText = changed ? 'Stopped. What I changed before you stopped me is saved — use Undo if you want it gone.' : 'Stopped before I changed anything.';
      break;
    }
    if (Date.now() > deadline) {
      finalText = finalText || "I ran out of time before finishing. What I changed so far is saved — ask me again to continue.";
      break;
    }
    let message: Anthropic.Beta.BetaMessage;
    try {
      message = await client.beta.messages.stream(
      {
        model: ARCHIE_MODEL,
        max_tokens: 32_000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium' },
        cache_control: { type: 'ephemeral' },
        system: SYSTEM_PROMPT,
        tools,
        messages,
      },
      { signal },
      ).finalMessage();
    } catch (e) {
      // Partway through a change: keep what was saved and hand back Undo.
      if (!changed || signal?.aborted) throw e;
      console.error('[archie] model call failed after changes', e);
      finalText = 'I hit a snag partway through. What I changed so far is saved — use Undo if it looks off, or ask me to finish.';
      break;
    }
    messages.push({ role: 'assistant', content: message.content });

    const text = message.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    if (text) finalText = text;

    if (message.stop_reason === 'refusal') {
      finalText = "Sorry, I can't help with that one. Try describing the change a different way, or use Ask the Keystone team.";
      break;
    }
    if (message.stop_reason === 'pause_turn') continue;

    const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
    if (!toolUses.length) {
      if (message.stop_reason === 'max_tokens' && !finalText) finalText = 'That was a big one and I got cut off. Ask me again with a smaller piece of the change.';
      break;
    }
    if (message.stop_reason === 'max_tokens') {
      // A tool input cut off mid-way is never run; ask for a smaller step.
      messages.push({
        role: 'user',
        content: toolUses.map((t) => ({ type: 'tool_result' as const, tool_use_id: t.id, is_error: true, content: 'Your output hit the length limit before this call was complete, so it did not run. Make the change in smaller steps.' })),
      });
      continue;
    }

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const use of toolUses) {
      emit({ type: 'tool', name: use.name, text: TOOL_LABELS[use.name] || 'Working on it' });
      if (!(ARCHIE_TOOLS as readonly string[]).includes(use.name)) {
        results.push({ type: 'tool_result', tool_use_id: use.id, is_error: true, content: `Unknown tool "${use.name}"` });
        continue;
      }
      const writes = !READ_ONLY.has(use.name);
      if (writes && !undoVersionId) {
        try {
          const snap = await createSnapshot(db, siteId, `Before Archie: ${request.prompt.slice(0, 80)}`, actor);
          undoVersionId = snap.id;
        } catch (e) {
          console.error('[archie] snapshot failed', e);
        }
      }
      const input = (use.input && typeof use.input === 'object' ? use.input : {}) as Json;
      const { result, error, details } = await callTool(use.name, { ...input, site_id: siteId }, ctx);
      if (error) {
        results.push({ type: 'tool_result', tool_use_id: use.id, is_error: true, content: JSON.stringify({ error, ...(details ? { details } : {}) }).slice(0, 20_000) });
      } else {
        if (writes) changed = true;
        results.push({ type: 'tool_result', tool_use_id: use.id, content: toolResultContent(result) });
      }
    }
    messages.push({ role: 'user', content: results });
  }

  emit({ type: 'done', text: finalText || (changed ? 'Done! Take a look.' : "I didn't change anything."), changed, undoVersionId: changed ? undoVersionId : null, stopped });
}
