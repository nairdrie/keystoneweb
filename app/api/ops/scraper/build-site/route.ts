import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { requireOpsAccess } from '@/lib/ops/access';
import { createClient } from '@/lib/db/supabase-server';
import type { ContentBuilderImportPayload } from '@/lib/ops/scraper/types';

interface BuildSiteRequest {
  builderImport?: ContentBuilderImportPayload;
}

type SiteBusinessType = 'services' | 'products' | 'portfolio' | 'nonprofit' | 'other';

const VALID_SITE_BUSINESS_TYPES = new Set<SiteBusinessType>([
  'services',
  'products',
  'portfolio',
  'nonprofit',
  'other',
]);

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveSiteBusinessType(...values: unknown[]): SiteBusinessType {
  for (const value of values) {
    const normalized = normalizeString(value).toLowerCase();
    if (VALID_SITE_BUSINESS_TYPES.has(normalized as SiteBusinessType)) {
      return normalized as SiteBusinessType;
    }

    // Older builder/scraper payloads used "both"; the DB constraint now expects "other".
    if (normalized === 'both') {
      return 'other';
    }
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

function buildSiteDesignData(builderImport: ContentBuilderImportPayload, navItems: Array<Record<string, unknown>>) {
  const baseDesignData = asRecord(builderImport.builderSiteModel.designData);
  const contactInfo = asRecord(builderImport.builderSiteModel.contactInfo);

  return {
    ...baseDesignData,
    __selectedPalette: normalizeString(baseDesignData.__selectedPalette) || 'default',
    __navItems: navItems,
    footerLinks: builderImport.builderSiteModel.footerLinks || [],
    contactInfo,
    phone: normalizeString(baseDesignData.phone) || normalizeString(contactInfo.phone),
    email: normalizeString(baseDesignData.email) || normalizeString(contactInfo.email),
    address: normalizeString(baseDesignData.address) || normalizeString(contactInfo.address),
    hours: normalizeString(baseDesignData.hours) || normalizeString(contactInfo.hours),
  };
}

function buildNavItems(
  builderImport: ContentBuilderImportPayload,
  importedPages: Array<{
    id: string;
    slug: string;
    display_name: string;
    is_visible_in_nav: boolean;
    nav_order: number;
  }>
) {
  const pageBySlug = new Map(importedPages.map((page) => [page.slug, page]));
  const importedNavigation = Array.isArray(builderImport.builderSiteModel.navigation)
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

  if (mappedNavItems.length > 0) {
    return mappedNavItems;
  }

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

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date().toISOString();
    const siteId = uuidv4();
    const usedSlugs = new Set<string>();

    const importedPages = builderImport.pages
      .map((page, index) => {
        const record = asRecord(page);
        const rawSlug = normalizeString(record.slug) || (index === 0 ? 'home' : `page-${index + 1}`);
        const slug = uniqueSlug(rawSlug, usedSlugs);
        const title = normalizeString(record.title) || (slug === 'home' ? 'Home' : `Page ${index + 1}`);
        const displayName = normalizeString(record.display_name) || title;
        const navOrder = typeof record.nav_order === 'number' ? record.nav_order : index;
        const designData = asRecord(record.design_data);
        const isVisibleInNav = typeof record.is_visible_in_nav === 'boolean'
          ? record.is_visible_in_nav
          : slug === 'home';

        return {
          id: uuidv4(),
          site_id: siteId,
          slug,
          title,
          display_name: displayName,
          is_visible_in_nav: isVisibleInNav,
          nav_order: navOrder,
          design_data: designData,
          created_at: now,
          updated_at: now,
        };
      })
      .sort((left, right) => left.nav_order - right.nav_order);

    const homePage = importedPages.find((page) => page.slug === 'home') || importedPages[0];
    const navItems = buildNavItems(builderImport, importedPages);

    const siteTitle =
      normalizeString(asRecord(builderImport.builderSiteModel.designData).siteTitle) ||
      normalizeString(homePage?.title) ||
      'Imported Site';
    const siteSlug = await resolveUniqueSiteSlug(supabase, access.userId, siteTitle);
    const selectedTemplateId = normalizeString(builderImport.builderSiteModel.selectedTemplateStyle) || 'organic';
    const businessType = resolveSiteBusinessType(
      builderImport.builderSiteModel.businessType,
      builderImport.templateSuggestion.businessType
    );
    const category = `migration-${selectedTemplateId}`;

    const siteDesignData = buildSiteDesignData(builderImport, navItems);

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
    });
  } catch (error) {
    console.error('Build site import failed:', error);
    return NextResponse.json({ error: 'Failed to build draft site.' }, { status: 500 });
  }
}
