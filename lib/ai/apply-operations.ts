// Server-side materializer for AI builder operations.
//
// The user-facing AI onboarding flow streams operations to the editor, which
// applies them to client state and saves. The ops "generate site for a lead"
// flow has no editor session, so this module applies the same operations
// directly to the database: it creates the site row, the home page, the
// supporting pages, navigation, fonts/colors/header settings, and seeds
// sample admin content — producing the same design_data shape the editor
// would have saved (see aiSetFont/aiSetCustomColors/aiSetHeaderConfig/
// aiCreatePages in app/(app)/editor/editor-content-v2.tsx).

import { v4 as uuidv4 } from 'uuid';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { AI_ONBOARDING_TEMPLATE_ID } from '@/lib/templates/ai-template';
import { sanitizeAiSampleDataPayload } from '@/lib/ai/sample-data';
import { seedSampleBookingServices, seedSampleMenuItems, seedSampleProducts } from '@/lib/ai/sample-data-seed';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

export interface AiOperation {
  op: string;
  [key: string]: unknown;
}

export interface ApplyAiOperationsOptions {
  userId: string;
  // Base for the site_slug ("Acme Plumbing"); made unique within the user's sites.
  slugBase: string;
  businessType: string;
  category: string;
  operations: AiOperation[];
}

export interface ApplyAiOperationsResult {
  siteId: string;
  homePageId: string;
  siteTitle: string;
}

// Same header config → design_data key mapping the editor applies.
const HEADER_KEY_MAP: Record<string, string> = {
  bgType: 'headerBgType',
  bgColor: 'headerBgColor',
  layout: 'headerLayout',
  logoPosition: 'headerLogoPosition',
  navPosition: 'headerNavPosition',
  desktopMenuStyle: 'headerDesktopMenuStyle',
  hamburgerPosition: 'headerHamburgerPosition',
  overlay: 'headerOverlay',
  rightElement: 'headerRightSide',
  bannerEnabled: 'headerShowBanner',
  bannerText: 'headerBannerText',
  bannerBgType: 'headerBannerBgType',
  bannerBgColor: 'headerBannerBgColor',
  socialFacebook: 'headerSocialFacebook',
  socialInstagram: 'headerSocialInstagram',
  socialX: 'headerSocialX',
  socialLinkedin: 'headerSocialLinkedin',
  socialYoutube: 'headerSocialYoutube',
  socialWhatsapp: 'headerSocialWhatsapp',
  navFontSize: 'headerNavFontSize',
  navFontWeight: 'headerNavFontWeight',
  navColor: 'headerNavColor',
  showMemberSignIn: 'headerShowMemberSignIn',
  memberSignInText: 'headerMemberSignInText',
  showProductSearch: 'headerShowProductSearch',
};

interface PendingPage {
  slug: string;
  title: string;
  displayName: string;
  isVisibleInNav: boolean;
  blocks: Array<{ blockType?: string; data?: Record<string, unknown> }>;
}

export async function createSiteFromAiOperations(
  admin: SupabaseAdmin,
  options: ApplyAiOperationsOptions,
): Promise<ApplyAiOperationsResult> {
  const { userId, operations } = options;

  // ── Template baseline (palettes + header defaults for custom_ai) ──────────
  const { data: templateMeta } = await admin
    .from('template_metadata')
    .select('default_content, palettes')
    .eq('template_id', AI_ONBOARDING_TEMPLATE_ID)
    .maybeSingle();

  const defaultContent = (templateMeta?.default_content ?? {}) as Record<string, unknown>;
  const palettes = (templateMeta?.palettes ?? {}) as Record<string, unknown>;
  // Header/site-level defaults only — template blocks/pages/nav are replaced
  // wholesale by the generated operations.
  const siteHeaderFields = { ...defaultContent };
  delete siteHeaderFields.blocks;
  delete siteHeaderFields.extra_pages;
  delete siteHeaderFields.__navItems;

  const paletteNames = Object.keys(palettes);
  const siteDesignData: Record<string, unknown> = {
    ...siteHeaderFields,
    __selectedPalette: paletteNames[0] || 'default',
  };

  let selectedTemplateId = AI_ONBOARDING_TEMPLATE_ID;
  let siteTitle = options.slugBase;
  let homeBlocks: Array<{ id: string; type: string; data: Record<string, unknown> }> = [];
  const pendingPages: PendingPage[] = [];
  let samples: Record<string, unknown> | null = null;

  const newBlockId = () => `block-${uuidv4().slice(0, 8)}`;

  for (const op of operations) {
    switch (op.op) {
      case 'setTemplate':
        if (typeof op.templateId === 'string' && op.templateId) {
          selectedTemplateId = op.templateId;
        }
        break;
      case 'setSiteTitle':
        if (typeof op.title === 'string' && op.title.trim()) {
          siteTitle = op.title.trim();
          siteDesignData.siteTitle = siteTitle;
        }
        break;
      case 'setFont':
        if (typeof op.font === 'string' && op.font) {
          if (op.target === 'heading') siteDesignData.titleFont = op.font;
          if (op.target === 'body') siteDesignData.bodyFont = op.font;
        }
        break;
      case 'setCustomColors': {
        const colors = op as { primary?: unknown; secondary?: unknown; accent?: unknown };
        let any = false;
        for (const key of ['primary', 'secondary', 'accent'] as const) {
          if (typeof colors[key] === 'string' && colors[key]) {
            siteDesignData[`__customPalette_${key}`] = colors[key];
            any = true;
          }
        }
        if (any) siteDesignData.__selectedPalette = 'custom';
        break;
      }
      case 'setHeaderConfig': {
        const config = (op.config && typeof op.config === 'object' ? op.config : {}) as Record<string, unknown>;
        for (const [configKey, siteKey] of Object.entries(HEADER_KEY_MAP)) {
          if (config[configKey] !== undefined) {
            siteDesignData[siteKey] = config[configKey];
          }
        }
        if (config.sticky === 'always' || config.sticky === 'none') {
          siteDesignData.headerSticky = config.sticky;
        } else if (typeof config.sticky === 'boolean') {
          siteDesignData.headerSticky = config.sticky ? 'always' : 'none';
        }
        if (config.logoPosition && !config.layout) {
          siteDesignData.headerLayout = config.logoPosition === 'above' ? 'centeredAboveNav' : 'default';
        }
        break;
      }
      case 'replaceBlocks':
        if (Array.isArray(op.blocks)) {
          homeBlocks = op.blocks
            .filter((b): b is { blockType: string; data?: Record<string, unknown> } => Boolean(b && typeof b === 'object' && typeof (b as { blockType?: unknown }).blockType === 'string'))
            .map((b) => ({ id: newBlockId(), type: b.blockType, data: deepSanitizeStrings(b.data || {}) as Record<string, unknown> }));
        }
        break;
      case 'addBlock':
        if (typeof op.blockType === 'string' && op.blockType) {
          homeBlocks.push({ id: newBlockId(), type: op.blockType, data: deepSanitizeStrings((op.data as Record<string, unknown>) || {}) as Record<string, unknown> });
        }
        break;
      case 'createPages':
        if (Array.isArray(op.pages)) {
          for (const page of op.pages) {
            if (!page || typeof page !== 'object') continue;
            const p = page as Record<string, unknown>;
            const slug = typeof p.slug === 'string' ? p.slug.toLowerCase().trim() : '';
            if (!slug || slug === 'home' || pendingPages.some((existing) => existing.slug === slug)) continue;
            pendingPages.push({
              slug,
              title: typeof p.title === 'string' && p.title ? p.title : slug,
              displayName: typeof p.displayName === 'string' && p.displayName ? p.displayName : (typeof p.title === 'string' && p.title ? p.title : slug),
              isVisibleInNav: p.isVisibleInNav !== false,
              blocks: Array.isArray(p.blocks) ? p.blocks as PendingPage['blocks'] : [],
            });
          }
        }
        break;
      case 'seedSampleData':
        if (op.samples && typeof op.samples === 'object') {
          samples = op.samples as Record<string, unknown>;
        }
        break;
      default:
        break;
    }
  }

  // ── IDs, slug-link resolution, navigation ─────────────────────────────────
  const siteId = uuidv4();
  const homePageId = uuidv4();
  const now = new Date().toISOString();

  const slugToPageId: Record<string, string> = { home: homePageId };
  const pageInserts = pendingPages.map((page, index) => {
    const pageId = uuidv4();
    slugToPageId[page.slug] = pageId;
    return { page, pageId, navOrder: index + 1 };
  });

  const resolvedHomeBlocks = homeBlocks.map((block) => ({
    ...block,
    data: resolvePageSlugLinks(block.data, slugToPageId) as Record<string, unknown>,
  }));

  const resolvedPageInserts = pageInserts.map(({ page, pageId, navOrder }) => ({
    id: pageId,
    site_id: siteId,
    slug: page.slug,
    title: page.title,
    display_name: page.displayName,
    is_visible_in_nav: page.isVisibleInNav,
    nav_order: navOrder,
    design_data: {
      blocks: page.blocks
        .filter((b) => b && typeof b.blockType === 'string')
        .map((b) => ({
          id: newBlockId(),
          type: b.blockType as string,
          data: resolvePageSlugLinks(deepSanitizeStrings(b.data || {}), slugToPageId) as Record<string, unknown>,
        })),
    },
    created_at: now,
    updated_at: now,
  }));

  const navItems = [
    { id: `nav-${uuidv4().slice(0, 8)}`, label: 'Home', linkType: 'page', href: '/', pageId: homePageId },
    ...pageInserts
      .filter(({ page }) => page.isVisibleInNav)
      .map(({ page, pageId }) => ({
        id: `nav-${uuidv4().slice(0, 8)}`,
        label: page.displayName,
        linkType: 'page',
        href: `/${page.slug}`,
        pageId,
      })),
  ];
  siteDesignData.__navItems = navItems;
  if (!siteDesignData.siteTitle) siteDesignData.siteTitle = siteTitle;

  // ── Insert rows ────────────────────────────────────────────────────────────
  const siteSlug = await uniqueSiteSlug(admin, userId, options.slugBase || siteTitle);

  const { error: siteError } = await admin.from('sites').insert({
    id: siteId,
    user_id: userId,
    site_slug: siteSlug,
    selected_template_id: selectedTemplateId,
    business_type: options.businessType,
    category: options.category,
    design_data: siteDesignData,
    created_at: now,
    updated_at: now,
  });
  if (siteError) {
    throw new Error(`Failed to create site: ${siteError.message}`);
  }

  const { error: homeError } = await admin.from('pages').insert({
    id: homePageId,
    site_id: siteId,
    slug: 'home',
    title: 'Home',
    display_name: 'Home',
    is_visible_in_nav: true,
    nav_order: 0,
    design_data: { blocks: resolvedHomeBlocks },
    created_at: now,
    updated_at: now,
  });
  if (homeError) {
    throw new Error(`Failed to create home page: ${homeError.message}`);
  }

  if (resolvedPageInserts.length > 0) {
    const { error: pagesError } = await admin.from('pages').insert(resolvedPageInserts);
    if (pagesError) {
      console.error('[AI apply-operations] Failed to insert pages:', pagesError.message);
    }
  }

  if (samples) {
    try {
      const sanitized = sanitizeAiSampleDataPayload(samples);
      if (sanitized.products?.length) await seedSampleProducts(admin, siteId, sanitized.products);
      if (sanitized.menuItems?.length) await seedSampleMenuItems(admin, siteId, sanitized.menuItems);
      if (sanitized.bookingServices?.length) await seedSampleBookingServices(admin, siteId, sanitized.bookingServices);
    } catch (seedError) {
      console.error('[AI apply-operations] Sample data seed failed:', seedError);
    }
  }

  return { siteId, homePageId, siteTitle };
}

// Same defensive string scrub the /api/ai/builder route applies to LLM output
// before it reaches the editor: strip script/style payloads and inline event
// handlers from every generated string.
function deepSanitizeStrings(value: unknown): unknown {
  if (typeof value === 'string') return stripTags(value);
  if (Array.isArray(value)) return value.map(deepSanitizeStrings);
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (/^on[A-Z]/.test(key)) continue;
      result[key] = deepSanitizeStrings(nested);
    }
    return result;
  }
  return value;
}

function stripTags(str: string): string {
  return str
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\sstyle\s*=\s*[^>]*/gi, '')
    .replace(/@import/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
}

// Server-side twin of the editor's resolvePageSlugLinks: rewrites
// { linkType:"page", pageSlug } references into { linkType:"page", href, pageId }.
function resolvePageSlugLinks(value: unknown, slugToPageId: Record<string, string>): unknown {
  if (Array.isArray(value)) return value.map((item) => resolvePageSlugLinks(item, slugToPageId));
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (obj.linkType === 'page' && typeof obj.pageSlug === 'string') {
      const slug = obj.pageSlug.toLowerCase();
      const pageId = slugToPageId[slug];
      if (pageId) {
        return { linkType: 'page', href: slug === 'home' ? '/' : `/${slug}`, pageId };
      }
      const rest: Record<string, unknown> = { ...obj };
      delete rest.pageSlug;
      return resolvePageSlugLinks(rest, slugToPageId);
    }
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(obj)) {
      out[key] = resolvePageSlugLinks(nested, slugToPageId);
    }
    return out;
  }
  return value;
}

async function uniqueSiteSlug(admin: SupabaseAdmin, userId: string, base: string): Promise<string> {
  const trimmed = base.trim() || 'My Website';
  const { data: existingSites } = await admin
    .from('sites')
    .select('site_slug')
    .eq('user_id', userId)
    .ilike('site_slug', `${trimmed}%`);

  if (!existingSites || existingSites.length === 0) return trimmed;
  const existing = new Set(existingSites.map((s: { site_slug: string }) => s.site_slug));
  if (!existing.has(trimmed)) return trimmed;
  let counter = 2;
  while (existing.has(`${trimmed} ${counter}`)) counter++;
  return `${trimmed} ${counter}`;
}
