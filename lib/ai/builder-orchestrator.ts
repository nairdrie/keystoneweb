/**
 * New-site orchestrator. Splits the build into three focused Claude calls so
 * each call has plenty of attention budget for tailored copy:
 *
 *   1. Plan — lock the AI template, then pick palette, fonts, header, site title, page briefs
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
import { AI_SUPPORTED_BLOCK_TYPES, sanitizeAiBlockData, sanitizeAiCustomColors, sanitizeAiHeaderConfig } from './block-capabilities';
import { callAi, extractJSON, getProviderConfig } from './ai-client';
import { type RecipeBlock } from './page-recipes';
import { AI_ONBOARDING_TEMPLATE_ID } from '@/lib/templates/ai-template';
import { buildAiSampleData, enrichBlocksWithSampleMedia, hasAiSampleData } from './sample-data';
import {
  buildFallbackBlocksForArchitecture,
  buildSiteArchitecture,
  type ArchitectureBlock,
} from './site-architecture';
import {
  getTemplateStyleProfileNames,
  isTemplateStyleProfileId,
  recommendTemplateStyleProfileIds,
} from '@/lib/templates/template-style-profiles';

// Mirror the route's allow-lists so the orchestrator's output is already
// safe by the time it lands in `sanitizeOperations`.
const VALID_BLOCK_TYPES = new Set<string>(AI_SUPPORTED_BLOCK_TYPES);

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
  const architecture = buildSiteArchitecture({
    businessType: wizardData.businessType,
    category: wizardData.category,
    templateId: wizardData.templateId,
    requestedPageIds: wizardData.pageIds,
    requestedPageLabels: wizardData.pageLabels,
    description: wizardData.description,
    extras: wizardData.extras,
  });
  console.log('[AI Builder] Orchestrator: seed=', seed);
  console.log(
    `[AI Builder] Architecture: category=${architecture.categoryLabel} pages=${architecture.pages.map((p) => `${p.slug}[${p.blocks.map((b) => b.blockType).join('+')}]`).join(',') || '(none)'}`,
  );

  // ── Phase A — Plan ────────────────────────────────────────────────────
  emit({ type: 'progress', step: 'plan', message: 'Planning your site…' });

  let plan: SitePlan;
  try {
    const planSystem = buildPlanSystemPrompt(wizardData, availablePalettes, seed, architecture);
    const planRaw = await callAi({
      apiKey, model, system: planSystem, user: 'Produce the plan now.', maxTokens: 2048, signal,
    }, provider);
    plan = sanitizePlan(extractJSON<Partial<SitePlan>>(planRaw), wizardData, architecture);
    logPlan(plan);
  } catch (err: unknown) {
    console.error('[AI Builder] Plan call failed — using fallback plan', errorMessage(err));
    plan = derivePlanFromBrief(wizardData, architecture);
    logPlan(plan, 'fallback');
  }

  // ── Phase B — Home ────────────────────────────────────────────────────
  emit({ type: 'progress', step: 'home', message: 'Building your home page…' });

  let homeBlocks: RecipeBlock[] = [];
  try {
    const homeSystem = buildHomeSystemPrompt(plan, wizardData, seed);
    const homeRaw = await callAi({
      apiKey, model, system: homeSystem, user: 'Produce the home blocks now.', maxTokens: 4096, signal,
    }, provider);
    homeBlocks = fitBlocksToArchitecture(
      sanitizeRecipeBlocks(extractJSON<{ blocks?: unknown[] }>(homeRaw)?.blocks),
      plan.homeArchitecture?.blocks,
      plan.siteTitle,
      'home',
    );
    console.log(`[AI Builder] Home built: ${homeBlocks.length} blocks`);
  } catch (err: unknown) {
    console.error('[AI Builder] Home call failed', errorMessage(err));
    homeBlocks = buildFallbackBlocksForArchitecture(plan.homeArchitecture?.blocks, plan.siteTitle, 'home');
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
      const blocks = fitBlocksToArchitecture(
        sanitizeRecipeBlocks(extractJSON<{ blocks?: unknown[] }>(pageRaw)?.blocks),
        page.blocks,
        plan.siteTitle,
        page.slug,
      );
      if (blocks.length === 0) {
        console.warn(`[AI Builder] Page ${page.slug}: AI returned no architecture blocks - using architecture fallback`);
        return { page, blocks: buildFallbackBlocksForArchitecture(page.blocks, plan.siteTitle, page.slug) };
      }
      console.log(`[AI Builder] Page ${page.slug}: ${blocks.length} blocks`);
      return { page, blocks };
    } catch (err: unknown) {
      console.error(`[AI Builder] Page ${page.slug} call failed - using architecture fallback`, errorMessage(err));
      return { page, blocks: buildFallbackBlocksForArchitecture(page.blocks, plan.siteTitle, page.slug) };
    }
  })());
  const pageResults = await Promise.all(pagePromises);

  // ── Assembly ──────────────────────────────────────────────────────────
  emit({ type: 'progress', step: 'finalize', message: 'Putting it all together…' });

  // Home falls back to the deterministic architecture only if the home call
  // failed after sanitization.
  if (homeBlocks.length === 0) {
    homeBlocks = buildFallbackBlocksForArchitecture(plan.homeArchitecture?.blocks, plan.siteTitle, 'home');
  }

  const allGeneratedBlocks = [
    ...homeBlocks,
    ...pageResults.flatMap(({ blocks }) => blocks),
  ];
  const sampleData = buildAiSampleData({
    wizardData,
    siteTitle: plan.siteTitle,
    pages: plan.pages,
    blocks: allGeneratedBlocks,
  });

  homeBlocks = enrichBlocksWithSampleMedia(homeBlocks, {
    wizardData,
    siteTitle: plan.siteTitle,
    pages: plan.pages,
    blocks: allGeneratedBlocks,
    pageSlug: 'home',
  });

  const enrichedPageResults = pageResults.map(({ page, blocks }) => ({
    page,
    blocks: enrichBlocksWithSampleMedia(blocks, {
      wizardData,
      siteTitle: plan.siteTitle,
      pages: plan.pages,
      blocks: allGeneratedBlocks,
      pageSlug: page.slug,
    }),
  }));

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
  if (hasAiSampleData(sampleData)) {
    operations.push({ op: 'seedSampleData', samples: sampleData });
  }
  operations.push({
    op: 'replaceBlocks',
    blocks: homeBlocks.map((b) => ({ blockType: b.blockType, data: b.data })),
  });
  if (enrichedPageResults.length > 0) {
    operations.push({
      op: 'createPages',
      pages: enrichedPageResults.map(({ page, blocks }) => ({
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
    message: `Built your custom site - ${plan.siteTitle} with ${enrichedPageResults.length + 1} page${enrichedPageResults.length === 0 ? '' : 's'}.`,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Sanitizers
// ─────────────────────────────────────────────────────────────────────────────

function sanitizePlan(raw: Partial<SitePlan> | null | undefined, wizardData: WizardData, architecture?: ReturnType<typeof buildSiteArchitecture>): SitePlan {
  const fallback = derivePlanFromBrief(wizardData, architecture);
  if (!raw || typeof raw !== 'object') return fallback;

  const siteTitle = typeof raw.siteTitle === 'string' && raw.siteTitle.trim() ? raw.siteTitle.trim().slice(0, 100) : fallback.siteTitle;
  const templateId = AI_ONBOARDING_TEMPLATE_ID;
  const paletteName = typeof raw.paletteName === 'string' ? raw.paletteName.slice(0, 60) : undefined;

  const customColors = raw.customColors && typeof raw.customColors === 'object'
    ? sanitizeAiCustomColors(raw.customColors as Record<string, unknown>)
    : {};

  const headerConfig = sanitizeAiHeaderConfig(
    raw.headerConfig,
    (value) => value.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/javascript\s*:/gi, ''),
  );

  const fonts: { heading?: string; body?: string } = {};
  if (raw.fonts && typeof raw.fonts === 'object') {
    const f = raw.fonts as Record<string, unknown>;
    if (typeof f.heading === 'string') fonts.heading = f.heading.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 50);
    if (typeof f.body === 'string') fonts.body = f.body.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 50);
  }

  const voice = typeof raw.voice === 'string' && raw.voice.trim() ? raw.voice.trim().slice(0, 300) : fallback.voice;
  const styleProfileIds = sanitizeStyleProfileIds(raw.styleProfileIds, fallback.styleProfileIds);
  const designBrief = typeof raw.designBrief === 'string' && raw.designBrief.trim()
    ? raw.designBrief.trim().slice(0, 500)
    : fallback.designBrief;
  const homeBrief = architecture?.home.brief
    ?? (typeof raw.homeBrief === 'string' && raw.homeBrief.trim() ? raw.homeBrief.trim().slice(0, 500) : fallback.homeBrief);

  // Page and block architecture is deterministic. The plan call can provide
  // voice/style/title direction, but it cannot change site structure.
  const sanitizedPages: SitePlan['pages'] = architecture?.pages ?? fallback.pages;

  return {
    siteTitle,
    templateId,
    paletteName,
    customColors: Object.keys(customColors).length > 0 ? customColors : undefined,
    headerConfig: Object.keys(headerConfig).length > 0 ? headerConfig : undefined,
    fonts: Object.keys(fonts).length > 0 ? fonts : undefined,
    voice,
    styleProfileIds,
    designBrief,
    homeBrief,
    homeArchitecture: architecture?.home ?? fallback.homeArchitecture,
    pages: sanitizedPages,
  };
}

/**
 * Derive a sensible default plan from the wizard answers when the plan call
 * fails entirely. Picks a template based on style chips, uses page chips as
 * the page list, and assigns one-line briefs.
 */
function derivePlanFromBrief(wizardData: WizardData, architecture?: ReturnType<typeof buildSiteArchitecture>): SitePlan {
  const templateId = AI_ONBOARDING_TEMPLATE_ID;

  const siteTitle = guessSiteTitle(wizardData.description);
  const styleProfileIds = recommendTemplateStyleProfileIds({
    styleIds: wizardData.styleIds,
    styleLabels: wizardData.styleLabels,
    description: wizardData.description,
  }).slice(0, 2);
  const styleNames = getTemplateStyleProfileNames(styleProfileIds);

  const requestedSlugs = (wizardData.pageIds ?? []).filter((id) => id && id !== 'home');
  const pages: SitePlan['pages'] = architecture?.pages ?? requestedSlugs.map((slug) => {
    const title = prettify(slug);
    return { slug, title, displayName: title, role: slug, brief: `Standard ${title} page for the site.`, blocks: [] };
  });

  return {
    siteTitle,
    templateId,
    voice: 'Clear, friendly, on-brand.',
    styleProfileIds,
    designBrief: styleNames.length
      ? `Custom AI baseline styled with ${styleNames.join(' + ')} cues through palette, fonts, header settings, and block layout choices.`
      : 'Custom AI baseline styled through palette, fonts, header settings, and block layout choices.',
    homeBrief: architecture?.home.brief ?? 'Hero with the brand promise, services or about section, social proof, and a clear CTA.',
    homeArchitecture: architecture?.home,
    pages,
  };
}

function sanitizeStyleProfileIds(raw: unknown, fallback?: string[]): string[] | undefined {
  const ids: string[] = [];
  const add = (value: unknown) => {
    if (isTemplateStyleProfileId(value) && !ids.includes(value)) ids.push(value);
  };

  if (Array.isArray(raw)) {
    raw.forEach(add);
  } else {
    add(raw);
  }

  return ids.length > 0 ? ids.slice(0, 2) : fallback;
}

function logPlan(plan: SitePlan, mode?: 'fallback') {
  const styleIds = plan.styleProfileIds?.length ? plan.styleProfileIds.join('/') : 'none';
  const styleNames = getTemplateStyleProfileNames(plan.styleProfileIds).join(' + ') || 'none';
  const designBrief = plan.designBrief ? ` design="${plan.designBrief.slice(0, 180)}"` : '';
  const modePrefix = mode ? ` (${mode})` : '';
  console.log(
    `[AI Builder] Plan${modePrefix}: tpl=${plan.templateId} style=${styleIds} styleNames="${styleNames}" title="${plan.siteTitle}" pages=${plan.pages.map((p) => p.slug).join(',') || '(none)'}${designBrief}`,
  );
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

function fitBlocksToArchitecture(
  blocks: RecipeBlock[],
  architectureBlocks: readonly ArchitectureBlock[] | undefined,
  siteTitle: string,
  pageSlug: string,
): RecipeBlock[] {
  if (!architectureBlocks || architectureBlocks.length === 0) return blocks;

  const queues = new Map<string, RecipeBlock[]>();
  for (const block of blocks) {
    const queue = queues.get(block.blockType) ?? [];
    queue.push(block);
    queues.set(block.blockType, queue);
  }

  return architectureBlocks.map((spec) => {
    const queue = queues.get(spec.blockType);
    const next = queue?.shift();
    if (next) return next;
    return buildFallbackBlocksForArchitecture([spec], siteTitle, pageSlug)[0];
  }).filter((block): block is RecipeBlock => Boolean(block));
}

function sanitizeRecipeBlocks(raw: unknown): RecipeBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: RecipeBlock[] = [];
  for (const b of raw) {
    if (!b || typeof b !== 'object') continue;
    const bb = b as Record<string, unknown>;
    if (typeof bb.blockType !== 'string' || !VALID_BLOCK_TYPES.has(bb.blockType)) continue;
    out.push({ blockType: bb.blockType, data: sanitizeAiBlockData(bb.blockType, bb.data) });
  }
  return out;
}
