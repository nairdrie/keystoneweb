/**
 * New-site orchestrator. Splits the build into three focused Claude calls so
 * each call has plenty of attention budget for tailored copy:
 *
 *   1. Plan — pick template, palette, fonts, header, site title, page briefs
 *   2. Home — fully populate 5–8 home blocks
 *   3. Pages (parallel) — one Claude call per supporting page, 3–5 blocks each
 *
 * The orchestrator emits NDJSON progress events as it works (so the client
 * can show "Building your home page…" / "Writing the About page…") and
 * returns a single consolidated operations list at the end. Pages that fail
 * any phase fall back to a curated recipe so the user is never left with
 * a blank page.
 */

import {
  buildPlanSystemPrompt,
  buildHomeSystemPrompt,
  buildPageSystemPrompt,
  generateCreativeSeed,
  type WizardData,
  type SitePlan,
} from './builder-schema';
import { callAi, extractJSON, getProviderConfig } from './ai-client';
import { getRecipeBlocks, type RecipeBlock } from './page-recipes';

// Mirror the route's allow-lists so the orchestrator's output is already
// safe by the time it lands in `sanitizeOperations`.
const VALID_BLOCK_TYPES = new Set([
  'hero', 'text', 'image', 'servicesGrid', 'featuresList', 'aboutImageText',
  'testimonials', 'stats', 'gallery', 'contact', 'faq', 'cta', 'booking',
  'productGrid', 'contact_form', 'map', 'custom_html', 'pricing', 'logoCloud', 'team', 'blog',
  'resources', 'carousel', 'video', 'deliveryLinks', 'menu', 'events', 'pdf', 'featuredQuote',
  'estimateForm', 'socialFeed', 'tabBar',
]);
const VALID_TEMPLATES = new Set([
  'luxe', 'vivid', 'airy', 'edge', 'classic', 'organic', 'sleek', 'vibrant',
  'atlas', 'editorial', 'booked', 'menu', 'craft', 'retro', 'proof', 'gallery',
]);
const HEX = /^#[0-9a-fA-F]{3,8}$/;

export interface OrchestratorOperation {
  op: string;
  [key: string]: unknown;
}

export type ProgressEvent =
  | { type: 'progress'; step: 'plan' | 'home' | 'page' | 'finalize'; message: string; slug?: string }
  | { type: 'result'; operations: OrchestratorOperation[]; message: string }
  | { type: 'error'; message: string };

export type Emit = (evt: ProgressEvent) => void;

export interface OrchestrateInput {
  wizardData: WizardData;
  availablePalettes: string[];
  signal?: AbortSignal;
}

/**
 * Run the three-phase orchestrated build, emitting progress events as we go.
 * Always emits a single terminal `result` event with the consolidated ops.
 */
export async function orchestrateNewSiteBuild(input: OrchestrateInput, emit: Emit): Promise<void> {
  const { wizardData, availablePalettes, signal } = input;
  const { apiKey, provider, model } = getProviderConfig();

  if (!apiKey) {
    emit({ type: 'error', message: 'AI Builder is not configured.' });
    return;
  }

  const seed = generateCreativeSeed();
  console.log('[AI Builder] Orchestrator: seed=', seed);

  // ── Phase A — Plan ────────────────────────────────────────────────────
  emit({ type: 'progress', step: 'plan', message: 'Planning your site…' });

  let plan: SitePlan;
  try {
    const planSystem = buildPlanSystemPrompt(wizardData, availablePalettes, seed);
    const planRaw = await callAi({
      apiKey, model, system: planSystem, user: 'Produce the plan now.', maxTokens: 2048, signal,
    }, provider);
    plan = sanitizePlan(extractJSON<Partial<SitePlan>>(planRaw), wizardData);
    console.log(`[AI Builder] Plan: tpl=${plan.templateId} title="${plan.siteTitle}" pages=${plan.pages.map((p) => p.slug).join(',') || '(none)'}`);
  } catch (err: unknown) {
    console.error('[AI Builder] Plan call failed — using fallback plan', errorMessage(err));
    plan = derivePlanFromBrief(wizardData);
  }

  // ── Phase B — Home ────────────────────────────────────────────────────
  emit({ type: 'progress', step: 'home', message: 'Building your home page…' });

  let homeBlocks: RecipeBlock[] = [];
  try {
    const homeSystem = buildHomeSystemPrompt(plan, wizardData, seed);
    const homeRaw = await callAi({
      apiKey, model, system: homeSystem, user: 'Produce the home blocks now.', maxTokens: 4096, signal,
    }, provider);
    homeBlocks = sanitizeRecipeBlocks(extractJSON<{ blocks?: unknown[] }>(homeRaw)?.blocks);
    console.log(`[AI Builder] Home built: ${homeBlocks.length} blocks`);
  } catch (err: unknown) {
    console.error('[AI Builder] Home call failed', errorMessage(err));
    homeBlocks = [];
  }

  // ── Phase C — Pages (parallel) ────────────────────────────────────────
  // Each page kicks off its own emit('progress') as it starts so the user
  // sees live page-by-page feedback even though they run concurrently.
  const pagePromises = plan.pages.map((page) => (async () => {
    emit({ type: 'progress', step: 'page', slug: page.slug, message: `Writing the ${page.title} page…` });
    try {
      const pageSystem = buildPageSystemPrompt(plan, page, wizardData, seed);
      const pageRaw = await callAi({
        apiKey, model, system: pageSystem, user: `Produce the blocks for the "${page.slug}" page now.`, maxTokens: 3072, signal,
      }, provider);
      const blocks = sanitizeRecipeBlocks(extractJSON<{ blocks?: unknown[] }>(pageRaw)?.blocks);
      if (blocks.length === 0) {
        console.warn(`[AI Builder] Page ${page.slug}: AI returned no blocks — using recipe fallback`);
        return { page, blocks: getRecipeBlocks(page.slug, plan.siteTitle) };
      }
      console.log(`[AI Builder] Page ${page.slug}: ${blocks.length} blocks`);
      return { page, blocks };
    } catch (err: unknown) {
      console.error(`[AI Builder] Page ${page.slug} call failed — using recipe fallback`, errorMessage(err));
      return { page, blocks: getRecipeBlocks(page.slug, plan.siteTitle) };
    }
  })());
  const pageResults = await Promise.all(pagePromises);

  // ── Assembly ──────────────────────────────────────────────────────────
  emit({ type: 'progress', step: 'finalize', message: 'Putting it all together…' });

  // Home falls back to a "text + cta" recipe only if the home call totally
  // failed. The wizard's first stage has at least 5 chars, so we always
  // have something to write about.
  if (homeBlocks.length === 0) {
    homeBlocks = [
      { blockType: 'hero', data: {
        variant: 'split',
        title: plan.siteTitle,
        subtitle: wizardData.description.slice(0, 200),
        buttonText: 'Get in touch',
        buttonTextLink: { linkType: 'page', pageSlug: 'contact' },
      } },
      { blockType: 'cta', data: {
        title: `Welcome to ${plan.siteTitle}`,
        subtitle: 'Edit this section to introduce your business.',
        buttonText: 'Contact us',
        buttonTextLink: { linkType: 'page', pageSlug: 'contact' },
      } },
    ];
  }

  const operations: OrchestratorOperation[] = [];
  operations.push({ op: 'setTemplate', templateId: plan.templateId });
  operations.push({ op: 'setSiteTitle', title: plan.siteTitle });
  if (plan.fonts?.heading) operations.push({ op: 'setFont', target: 'heading', font: plan.fonts.heading });
  if (plan.fonts?.body) operations.push({ op: 'setFont', target: 'body', font: plan.fonts.body });
  if (plan.customColors && (plan.customColors.primary || plan.customColors.secondary || plan.customColors.accent)) {
    operations.push({ op: 'setCustomColors', ...plan.customColors });
  }
  if (plan.headerConfig && Object.keys(plan.headerConfig).length > 0) {
    operations.push({ op: 'setHeaderConfig', config: plan.headerConfig });
  }
  operations.push({
    op: 'replaceBlocks',
    blocks: homeBlocks.map((b) => ({ blockType: b.blockType, data: b.data })),
  });
  if (pageResults.length > 0) {
    operations.push({
      op: 'createPages',
      pages: pageResults.map(({ page, blocks }) => ({
        slug: page.slug,
        title: page.title,
        displayName: page.displayName ?? page.title,
        isVisibleInNav: true,
        blocks: blocks.map((b) => ({ blockType: b.blockType, data: b.data })),
      })),
    });
  }

  emit({
    type: 'result',
    operations,
    message: `Built your ${plan.templateId} site — ${plan.siteTitle} with ${pageResults.length + 1} page${pageResults.length === 0 ? '' : 's'}.`,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Sanitizers
// ─────────────────────────────────────────────────────────────────────────────

function sanitizePlan(raw: Partial<SitePlan> | null | undefined, wizardData: WizardData): SitePlan {
  const fallback = derivePlanFromBrief(wizardData);
  if (!raw || typeof raw !== 'object') return fallback;

  const siteTitle = typeof raw.siteTitle === 'string' && raw.siteTitle.trim() ? raw.siteTitle.trim().slice(0, 100) : fallback.siteTitle;
  const templateId = typeof raw.templateId === 'string' && VALID_TEMPLATES.has(raw.templateId.toLowerCase())
    ? raw.templateId.toLowerCase()
    : fallback.templateId;
  const paletteName = typeof raw.paletteName === 'string' ? raw.paletteName.slice(0, 60) : undefined;

  const customColors: Record<string, string> = {};
  if (raw.customColors && typeof raw.customColors === 'object') {
    for (const k of ['primary', 'secondary', 'accent'] as const) {
      const v = (raw.customColors as Record<string, unknown>)[k];
      if (typeof v === 'string' && HEX.test(v)) customColors[k] = v;
    }
  }

  const headerConfig: Record<string, unknown> = {};
  if (raw.headerConfig && typeof raw.headerConfig === 'object') {
    const VALID_BG = new Set(['white', 'primary', 'secondary', 'gradient']);
    const VALID_LAYOUT = new Set(['default', 'centeredAboveNav']);
    const VALID_RIGHT = new Set(['cta', 'social', 'none']);
    const h = raw.headerConfig as Record<string, unknown>;
    if (typeof h.bgType === 'string' && VALID_BG.has(h.bgType)) headerConfig.bgType = h.bgType;
    if (typeof h.layout === 'string' && VALID_LAYOUT.has(h.layout)) headerConfig.layout = h.layout;
    if (typeof h.rightElement === 'string' && VALID_RIGHT.has(h.rightElement)) headerConfig.rightElement = h.rightElement;
    if (typeof h.sticky === 'boolean') headerConfig.sticky = h.sticky;
    if (typeof h.bannerEnabled === 'boolean') headerConfig.bannerEnabled = h.bannerEnabled;
    if (typeof h.bannerText === 'string') headerConfig.bannerText = h.bannerText.slice(0, 200);
  }

  const fonts: { heading?: string; body?: string } = {};
  if (raw.fonts && typeof raw.fonts === 'object') {
    const f = raw.fonts as Record<string, unknown>;
    if (typeof f.heading === 'string') fonts.heading = f.heading.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 50);
    if (typeof f.body === 'string') fonts.body = f.body.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 50);
  }

  const voice = typeof raw.voice === 'string' && raw.voice.trim() ? raw.voice.trim().slice(0, 300) : fallback.voice;
  const homeBrief = typeof raw.homeBrief === 'string' && raw.homeBrief.trim() ? raw.homeBrief.trim().slice(0, 500) : fallback.homeBrief;

  // Pages — we honor the AI's slugs first; if it dropped any the user requested,
  // we backfill from the wizard pageIds so the user never gets fewer pages than asked.
  const aiPages = Array.isArray(raw.pages) ? raw.pages : [];
  const sanitizedPages: SitePlan['pages'] = [];
  const seen = new Set<string>();
  for (const p of aiPages) {
    if (!p || typeof p !== 'object') continue;
    const pp = p as Record<string, unknown>;
    const slugRaw = typeof pp.slug === 'string' ? pp.slug : '';
    const slug = slugRaw.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '').slice(0, 60);
    if (!slug || slug === 'home' || seen.has(slug)) continue;
    seen.add(slug);
    const title = typeof pp.title === 'string' ? pp.title.slice(0, 60) : prettify(slug);
    const displayName = typeof pp.displayName === 'string' ? pp.displayName.slice(0, 60) : title;
    const brief = typeof pp.brief === 'string' ? pp.brief.slice(0, 300) : `Build the ${title} page.`;
    sanitizedPages.push({ slug, title, displayName, brief });
  }
  // Backfill any user-requested page that the AI omitted.
  for (const fp of fallback.pages) {
    if (!seen.has(fp.slug)) {
      sanitizedPages.push(fp);
      seen.add(fp.slug);
    }
  }

  return {
    siteTitle,
    templateId,
    paletteName,
    customColors: Object.keys(customColors).length > 0 ? customColors : undefined,
    headerConfig: Object.keys(headerConfig).length > 0 ? headerConfig : undefined,
    fonts: Object.keys(fonts).length > 0 ? fonts : undefined,
    voice,
    homeBrief,
    pages: sanitizedPages,
  };
}

/**
 * Derive a sensible default plan from the wizard answers when the plan call
 * fails entirely. Picks a template based on style chips, uses page chips as
 * the page list, and assigns one-line briefs.
 */
function derivePlanFromBrief(wizardData: WizardData): SitePlan {
  const styleToTemplate: Record<string, string> = {
    bold: 'vivid',
    minimal: 'sleek',
    warm: 'organic',
    luxury: 'luxe',
    playful: 'vibrant',
    dark: 'edge',
    editorial: 'editorial',
    earthy: 'organic',
  };

  const templateId = wizardData.styleIds?.find((s) => styleToTemplate[s])
    ? styleToTemplate[wizardData.styleIds.find((s) => styleToTemplate[s])!]
    : 'classic';

  const siteTitle = guessSiteTitle(wizardData.description);

  const requestedSlugs = (wizardData.pageIds ?? []).filter((id) => id && id !== 'home');
  const pages: SitePlan['pages'] = requestedSlugs.map((slug) => {
    const title = prettify(slug);
    return { slug, title, displayName: title, brief: `Standard ${title} page for the site.` };
  });

  return {
    siteTitle,
    templateId,
    voice: 'Clear, friendly, on-brand.',
    homeBrief: 'Hero with the brand promise, services or about section, social proof, and a clear CTA.',
    pages,
  };
}

function guessSiteTitle(description: string): string {
  // Try to extract a "called X" / "named X" / "for X" phrase, otherwise
  // fall back to capitalized words from the description.
  const namedMatch = description.match(/(?:called|named|for|the)\s+([A-Z][\w'’]*(?:\s+[A-Z][\w'’]*){0,4})/);
  if (namedMatch) return namedMatch[1];
  const capWords = description.match(/[A-Z][\w'’]*(?:\s+[A-Z][\w'’]*){0,3}/);
  if (capWords) return capWords[0];
  return 'My Site';
}

function prettify(slug: string): string {
  return slug.split(/[-_]/g).map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
}

function errorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return String(err);
}

function sanitizeRecipeBlocks(raw: unknown): RecipeBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: RecipeBlock[] = [];
  for (const b of raw) {
    if (!b || typeof b !== 'object') continue;
    const bb = b as Record<string, unknown>;
    if (typeof bb.blockType !== 'string' || !VALID_BLOCK_TYPES.has(bb.blockType)) continue;
    const data = (bb.data && typeof bb.data === 'object') ? (bb.data as Record<string, unknown>) : {};
    out.push({ blockType: bb.blockType, data });
  }
  return out;
}
