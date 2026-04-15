import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { runAIBuilder } from '@/lib/ai/builder-engine';
import { requireOpsAccess, type OpsAccessContext } from '@/lib/ops/access';
import { createClient } from '@/lib/db/supabase-server';
import type { ContentBuilderImportPayload } from '@/lib/ops/scraper/types';

interface BuildSiteRequest {
  builderImport?: ContentBuilderImportPayload;
  rawJson?: string;
}

type SiteBusinessType = 'services' | 'products' | 'portfolio' | 'nonprofit' | 'other';

interface DraftPageInput {
  slug: string;
  title: string;
  displayName: string;
  isVisibleInNav: boolean;
  navOrder: number;
  seoTitle?: string;
  seoDescription?: string;
  blocks: Array<Record<string, unknown>>;
}

interface AiGeneratedDraft {
  pages: DraftPageInput[];
  navigation: Array<{ label: string; pageSlug: string; navOrder: number }>;
  selectedTemplateId?: string;
  siteTitle?: string;
  siteDesignOverrides: Record<string, unknown>;
  message: string;
}

const VALID_SITE_BUSINESS_TYPES = new Set<SiteBusinessType>([
  'services',
  'products',
  'portfolio',
  'nonprofit',
  'other',
]);

const OPS_AI_CONTEXT_CHAR_LIMIT = 500_000;

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveSiteBusinessType(...values: unknown[]): SiteBusinessType {
  for (const value of values) {
    const normalized = normalizeString(value).toLowerCase();
    if (VALID_SITE_BUSINESS_TYPES.has(normalized as SiteBusinessType)) {
      return normalized as SiteBusinessType;
    }
    if (normalized === 'both') return 'other';
  }
  return 'services';
}

function slugifySegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function uniqueSlug(base: string, used: Set<string>) {
  const cleanBase = slugifySegment(base) || 'page';
  let candidate = cleanBase;
  let counter = 2;
  while (used.has(candidate)) {
    candidate = `${cleanBase}-${counter}`;
    counter += 1;
  }
  used.add(candidate);
  return candidate;
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function parseRawScraperJson(rawJson?: string) {
  if (!rawJson) return null;
  try {
    return JSON.parse(rawJson) as unknown;
  } catch {
    return rawJson.slice(0, OPS_AI_CONTEXT_CHAR_LIMIT);
  }
}

function compactRawScraperContext(raw: unknown) {
  const record = asRecord(raw);
  const extractedPages = Array.isArray(record.extractedPages) ? record.extractedPages : [];
  const mappedPages = Array.isArray(record.mappedPages) ? record.mappedPages : [];

  if (extractedPages.length === 0 && mappedPages.length === 0) return raw;

  return {
    sourceUrl: record.sourceUrl,
    mode: record.mode,
    includeBlog: record.includeBlog,
    templateSuggestion: record.templateSuggestion,
    warnings: record.warnings,
    extractedPages: extractedPages.slice(0, 30).map((page) => {
      const pageRecord = asRecord(page);
      const sections = Array.isArray(pageRecord.sections) ? pageRecord.sections : [];
      return {
        sourceUrl: pageRecord.sourceUrl,
        finalUrl: pageRecord.finalUrl,
        slug: pageRecord.slug,
        title: pageRecord.title,
        inferredType: pageRecord.inferredType,
        renderMode: pageRecord.renderMode,
        jsWarning: pageRecord.jsWarning,
        sections: sections.slice(0, 40).map((section) => {
          const sectionRecord = asRecord(section);
          return {
            heading: sectionRecord.heading,
            text: normalizeString(sectionRecord.text).slice(0, 4000),
            paragraphs: Array.isArray(sectionRecord.paragraphs) ? sectionRecord.paragraphs.slice(0, 12) : [],
            bullets: Array.isArray(sectionRecord.bullets) ? sectionRecord.bullets.slice(0, 20) : [],
            ctas: sectionRecord.ctas,
            faqs: sectionRecord.faqs,
            testimonials: sectionRecord.testimonials,
            team: sectionRecord.team,
            pricing: sectionRecord.pricing,
            stats: sectionRecord.stats,
            forms: sectionRecord.forms,
            downloads: sectionRecord.downloads,
            videoUrls: sectionRecord.videoUrls,
          };
        }),
      };
    }),
    mappedPages: mappedPages.slice(0, 30).map((page) => {
      const pageRecord = asRecord(page);
      return {
        title: pageRecord.title,
        url: pageRecord.url,
        slug: pageRecord.slug,
        inferredType: pageRecord.inferredType,
        confidence: pageRecord.confidence,
        compatibilityStatus: pageRecord.compatibilityStatus,
        builderBlocks: pageRecord.builderBlocks,
        warnings: pageRecord.warnings,
      };
    }),
  };
}

function buildOpsAiPrompt(builderImport: ContentBuilderImportPayload, rawJson?: string) {
  const rawContext = compactRawScraperContext(parseRawScraperJson(rawJson));
  const context = {
    instruction: 'Create a Keystone Web draft site from an OPS scraper migration export.',
    sourceUrl: builderImport.sourceUrl,
    scraperBuilderImport: builderImport,
    rawScraperContext: rawContext,
  };
  let serializedContext = JSON.stringify(context, null, 2);
  let truncated = false;
  if (serializedContext.length > OPS_AI_CONTEXT_CHAR_LIMIT) {
    serializedContext = serializedContext.slice(0, OPS_AI_CONTEXT_CHAR_LIMIT);
    truncated = true;
  }

  return `OPS SCRAPER MIGRATION BUILD

You are being called from the Keystone ops scraper backend by an authorized admin or agent. This backend call is allowed to bypass normal end-user prompt length and usage limits, but your output is still sanitized by the standard AI builder operation validator.

Build a draft Keystone Web site from the scraped migration context below.

Requirements:
- Use the existing Keystone AI builder operations, especially setPages for multi-page output.
- Create one draft page for each meaningful scraped page in the context. Do not collapse everything into Home unless only one page exists.
- Preserve the source site's content, section order, CTAs, FAQs, testimonials, pricing, contact details, SEO titles, and SEO descriptions as much as possible.
- Use only Keystone-supported builder block types and fields from the system prompt.
- Prefer structured blocks over custom_html. Use custom_html only for important content that no supported block can represent.
- Include a Home page first.
- Include navigation entries for primary pages.
- Pick a template/style that fits the scraped site if the context provides enough signal.

${truncated ? 'Note: the scraper context was truncated to fit the ops backend AI context guard. Use the included pages and sections first.\n' : ''}
SCRAPER_CONTEXT_JSON:
${serializedContext}`;
}

async function resolveUniqueSiteSlug(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, baseName: string) {
  const normalizedBase = normalizeString(baseName) || 'Imported Site';
  const { data: existingSites } = await supabase
    .from('sites')
    .select('site_slug')
    .eq('user_id', userId)
    .ilike('site_slug', `${normalizedBase}%`);

  const existing = new Set((existingSites || []).map((site) => normalizeString(site.site_slug)).filter(Boolean));
  if (!existing.has(normalizedBase)) return normalizedBase;

  let counter = 2;
  while (existing.has(`${normalizedBase} ${counter}`)) {
    counter += 1;
  }
  return `${normalizedBase} ${counter}`;
}

function buildSiteDesignData(
  builderImport: ContentBuilderImportPayload,
  navItems: Array<Record<string, unknown>>,
  overrides: Record<string, unknown> = {}
) {
  const baseDesignData = asRecord(builderImport.builderSiteModel.designData);
  const contactInfo = asRecord(builderImport.builderSiteModel.contactInfo);

  return {
    ...baseDesignData,
    ...overrides,
    __selectedPalette: normalizeString(overrides.__selectedPalette) || normalizeString(baseDesignData.__selectedPalette) || 'default',
    __navItems: navItems,
    footerLinks: builderImport.builderSiteModel.footerLinks || [],
    contactInfo,
    phone: normalizeString(overrides.phone) || normalizeString(baseDesignData.phone) || normalizeString(contactInfo.phone),
    email: normalizeString(overrides.email) || normalizeString(baseDesignData.email) || normalizeString(contactInfo.email),
    address: normalizeString(overrides.address) || normalizeString(baseDesignData.address) || normalizeString(contactInfo.address),
    hours: normalizeString(overrides.hours) || normalizeString(baseDesignData.hours) || normalizeString(contactInfo.hours),
  };
}

function fallbackPagesFromBuilderImport(builderImport: ContentBuilderImportPayload): DraftPageInput[] {
  return builderImport.pages.map((page, index) => {
    const record = asRecord(page);
    const designData = asRecord(record.design_data);
    return {
      slug: normalizeString(record.slug) || (index === 0 ? 'home' : `page-${index + 1}`),
      title: normalizeString(record.title) || (index === 0 ? 'Home' : `Page ${index + 1}`),
      displayName: normalizeString(record.display_name) || normalizeString(record.title) || (index === 0 ? 'Home' : `Page ${index + 1}`),
      isVisibleInNav: typeof record.is_visible_in_nav === 'boolean' ? record.is_visible_in_nav : index === 0,
      navOrder: typeof record.nav_order === 'number' ? record.nav_order : index,
      seoTitle: normalizeString(asRecord(record.design_data).seoTitle),
      seoDescription: normalizeString(asRecord(record.design_data).seoDescription),
      blocks: Array.isArray(designData.blocks) ? designData.blocks as Array<Record<string, unknown>> : [],
    };
  });
}

function mapDraftPagesToRows(pages: DraftPageInput[], siteId: string, now: string) {
  const usedSlugs = new Set<string>();
  return pages
    .map((page, index) => {
      const slug = uniqueSlug(page.slug || (index === 0 ? 'home' : `page-${index + 1}`), usedSlugs);
      const title = normalizeString(page.title) || (slug === 'home' ? 'Home' : `Page ${index + 1}`);
      return {
        id: uuidv4(),
        site_id: siteId,
        slug,
        title,
        display_name: normalizeString(page.displayName) || title,
        is_visible_in_nav: page.isVisibleInNav,
        nav_order: page.navOrder,
        design_data: {
          seoTitle: normalizeString(page.seoTitle) || title,
          seoDescription: normalizeString(page.seoDescription),
          blocks: page.blocks || [],
        },
        created_at: now,
        updated_at: now,
      };
    })
    .sort((left, right) => left.nav_order - right.nav_order);
}

function buildNavItems(
  importedPages: Array<{
    id: string;
    slug: string;
    display_name: string;
    is_visible_in_nav: boolean;
    nav_order: number;
  }>,
  aiNavigation: AiGeneratedDraft['navigation'] = [],
  builderImport?: ContentBuilderImportPayload
) {
  const pageBySlug = new Map(importedPages.map((page) => [page.slug, page]));
  const importedNavigation = aiNavigation.length > 0
    ? aiNavigation.map((item) => ({ ...item, isVisibleInPrimaryNav: true }))
    : Array.isArray(builderImport?.builderSiteModel.navigation)
      ? builderImport.builderSiteModel.navigation
      : [];

  const mappedNavItems = importedNavigation
    .map((item) => {
      const page = pageBySlug.get(normalizeString(item.pageSlug));
      if (!page || item.isVisibleInPrimaryNav === false) return null;
      return {
        id: `nav-${uuidv4().slice(0, 8)}`,
        label: normalizeString(item.label) || page.display_name,
        linkType: 'page',
        href: page.slug === 'home' ? '/' : `/${page.slug}`,
        pageId: page.id,
        navOrder: typeof item.navOrder === 'number' ? item.navOrder : page.nav_order,
      };
    })
    .filter((item): item is { id: string; label: string; linkType: string; href: string; pageId: string; navOrder: number } => Boolean(item))
    .sort((left, right) => left.navOrder - right.navOrder)
    .map((item) => ({
      id: item.id,
      label: item.label,
      linkType: item.linkType,
      href: item.href,
      pageId: item.pageId,
    }));

  if (mappedNavItems.length > 0) return mappedNavItems;

  return importedPages
    .filter((page) => page.is_visible_in_nav)
    .sort((left, right) => left.nav_order - right.nav_order)
    .map((page) => ({
      id: `nav-${uuidv4().slice(0, 8)}`,
      label: page.display_name,
      linkType: 'page',
      href: page.slug === 'home' ? '/' : `/${page.slug}`,
      pageId: page.id,
    }));
}

function getAiModelConfig() {
  const provider = process.env.AI_BUILDER_PROVIDER || 'anthropic';
  const modelId = process.env.AI_BUILDER_MODEL || (provider === 'anthropic' ? 'claude-sonnet-4-5-20250514' : 'gpt-4o-mini');
  return { provider, modelId };
}

async function buildDraftWithAiBuilder(
  builderImport: ContentBuilderImportPayload,
  rawJson: string | undefined,
  access: OpsAccessContext
): Promise<AiGeneratedDraft | null> {
  const apiKey = process.env.AI_BUILDER_API_KEY;
  if (!apiKey) {
    console.warn('[ops scraper][build-site] ai_builder.skip', { reason: 'missing_ai_builder_api_key' });
    return null;
  }

  const { provider, modelId } = getAiModelConfig();
  const prompt = buildOpsAiPrompt(builderImport, rawJson);
  console.info('[ops scraper][build-site] ai_builder.usage_bypass_granted', {
    userId: access.userId,
    userEmail: access.userEmail,
    isAdmin: access.isAdmin,
    isAgent: access.isAgent,
    source: 'ops_scraper_build_site',
  });
  console.info('[ops scraper][build-site] ai_builder.prompt', {
    provider,
    model: modelId,
    promptChars: prompt.length,
    prompt,
  });

  try {
    const result = await runAIBuilder({
      apiKey,
      provider,
      modelId,
      prompt,
      history: [],
      siteState: {
        title: normalizeString(asRecord(builderImport.builderSiteModel.designData).siteTitle) || 'Imported Site',
        blocks: [],
        palette: 'default',
      },
      availablePalettes: [],
      isNewSite: true,
      enableMultiPage: true,
      maxTokens: 12000,
      temperature: 0,
    });

    const setPagesOp = result.operations.find((operation) => operation.op === 'setPages');
    const pages = Array.isArray(setPagesOp?.pages) ? setPagesOp.pages as DraftPageInput[] : [];
    if (pages.length === 0) {
      console.warn('[ops scraper][build-site] ai_builder.no_pages', {
        operations: result.operations.map((operation) => operation.op),
      });
      return null;
    }

    const selectedTemplateId = normalizeString(result.operations.find((operation) => operation.op === 'setTemplate')?.templateId);
    const siteTitle = normalizeString(result.operations.find((operation) => operation.op === 'setSiteTitle')?.title);
    const colorOp = asRecord(result.operations.find((operation) => operation.op === 'setCustomColors'));
    const headerOp = asRecord(result.operations.find((operation) => operation.op === 'setHeaderConfig'));
    const headerConfig = asRecord(headerOp.config);
    const navigation = Array.isArray(setPagesOp?.navigation)
      ? setPagesOp.navigation as AiGeneratedDraft['navigation']
      : [];

    const siteDesignOverrides: Record<string, unknown> = {};
    if (colorOp.primary || colorOp.secondary || colorOp.accent) {
      siteDesignOverrides.__selectedPalette = 'custom';
      if (colorOp.primary) siteDesignOverrides.__customPalette_primary = colorOp.primary;
      if (colorOp.secondary) siteDesignOverrides.__customPalette_secondary = colorOp.secondary;
      if (colorOp.accent) siteDesignOverrides.__customPalette_accent = colorOp.accent;
    }

    const headerKeyMap: Record<string, string> = {
      bgType: 'headerBgType',
      layout: 'headerLayout',
      sticky: 'headerSticky',
      rightElement: 'headerRightElement',
      bannerEnabled: 'headerBannerEnabled',
      bannerText: 'headerBannerText',
    };
    for (const [sourceKey, targetKey] of Object.entries(headerKeyMap)) {
      if (headerConfig[sourceKey] !== undefined) {
        siteDesignOverrides[targetKey] = headerConfig[sourceKey];
      }
    }

    console.info('[ops scraper][build-site] ai_builder.success', {
      provider,
      model: modelId,
      pages: pages.length,
      operations: result.operations.map((operation) => operation.op),
    });

    return {
      pages,
      navigation,
      selectedTemplateId,
      siteTitle,
      siteDesignOverrides,
      message: result.message,
    };
  } catch (error) {
    console.warn('[ops scraper][build-site] ai_builder.failed', {
      provider,
      model: modelId,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

export async function POST(request: NextRequest) {
  const access = await requireOpsAccess();
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: BuildSiteRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const builderImport = body.builderImport;
  if (!builderImport || !Array.isArray(builderImport.pages) || builderImport.pages.length === 0) {
    return NextResponse.json({ error: 'Missing builder import payload.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user || user.id !== access.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date().toISOString();
    const siteId = uuidv4();
    const aiDraft = await buildDraftWithAiBuilder(builderImport, body.rawJson, access);
    const draftPages = aiDraft?.pages.length ? aiDraft.pages : fallbackPagesFromBuilderImport(builderImport);
    const importedPages = mapDraftPagesToRows(draftPages, siteId, now);
    const homePage = importedPages.find((page) => page.slug === 'home') || importedPages[0];
    const navItems = buildNavItems(importedPages, aiDraft?.navigation || [], builderImport);

    const siteTitle =
      normalizeString(aiDraft?.siteTitle) ||
      normalizeString(asRecord(builderImport.builderSiteModel.designData).siteTitle) ||
      normalizeString(homePage?.title) ||
      'Imported Site';
    const siteSlug = await resolveUniqueSiteSlug(supabase, access.userId, siteTitle);
    const selectedTemplateId =
      normalizeString(aiDraft?.selectedTemplateId) ||
      normalizeString(builderImport.builderSiteModel.selectedTemplateStyle) ||
      'organic';
    const businessType = resolveSiteBusinessType(
      builderImport.builderSiteModel.businessType,
      builderImport.templateSuggestion.businessType
    );
    const category = `migration-${selectedTemplateId}`;
    const siteDesignData = buildSiteDesignData(builderImport, navItems, {
      ...(aiDraft?.siteDesignOverrides || {}),
      siteTitle,
    });

    const { error: siteError } = await supabase.from('sites').insert({
      id: siteId,
      user_id: access.userId,
      site_slug: siteSlug,
      selected_template_id: selectedTemplateId,
      business_type: businessType,
      category,
      design_data: siteDesignData,
      created_at: now,
      updated_at: now,
    });

    if (siteError) {
      console.error('Failed to create imported site:', siteError);
      return NextResponse.json({ error: 'Failed to create site.' }, { status: 500 });
    }

    const { error: pagesError } = await supabase.from('pages').insert(importedPages);
    if (pagesError) {
      console.error('Failed to create imported pages:', pagesError);
      await supabase.from('sites').delete().eq('id', siteId);
      return NextResponse.json({ error: 'Failed to create site pages.' }, { status: 500 });
    }

    return NextResponse.json({
      siteId,
      editorUrl: `/editor?siteId=${siteId}&pageId=${homePage.id}`,
      pageCount: importedPages.length,
      siteTitle: siteSlug,
      aiBuilderUsed: Boolean(aiDraft),
      aiBuilderMessage: aiDraft?.message,
    });
  } catch (error) {
    console.error('Build site import failed:', error);
    return NextResponse.json({ error: 'Failed to build draft site.' }, { status: 500 });
  }
}
