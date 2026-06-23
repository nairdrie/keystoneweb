// Ownership-checked site operations exposed through the MCP server.
//
// Every function here takes the authenticated user_id (resolved from the MCP
// token) and refuses to touch a site the user does not own. We reuse the same
// persistence paths the app already uses — createSiteFromAiOperations for new
// sites, duplicateSite for clones, and sanitizeAiBlockData for block content —
// so MCP-built sites are byte-for-byte the shape the editor would produce.

import { v4 as uuidv4 } from 'uuid';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { createSiteFromAiOperations, type AiOperation } from '@/lib/ai/apply-operations';
import { duplicateSite } from '@/lib/sites/duplicate';
import {
  AI_SUPPORTED_BLOCK_TYPES,
  sanitizeAiBlockData,
  sanitizeAiCustomColors,
} from '@/lib/ai/block-capabilities';

type Admin = ReturnType<typeof createAdminClient>;
type Json = Record<string, unknown>;

/** Tool-level error: surfaced to the MCP client as an isError result, not a crash. */
export class McpToolError extends Error {}

const SUPPORTED_BLOCK_SET = new Set<string>(AI_SUPPORTED_BLOCK_TYPES);
const BUSINESS_TYPES = new Set(['services', 'products', 'both']);

function newBlockId(): string {
  return `block-${uuidv4().slice(0, 8)}`;
}

function asJson(value: unknown): Json {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {};
}

interface SiteBlock {
  id: string;
  type: string;
  data: Json;
}

function readBlocks(designData: Json): SiteBlock[] {
  const blocks = designData.blocks;
  if (!Array.isArray(blocks)) return [];
  return blocks
    .filter((b): b is SiteBlock => Boolean(b && typeof b === 'object' && typeof (b as SiteBlock).type === 'string'))
    .map((b) => ({ id: typeof b.id === 'string' ? b.id : newBlockId(), type: b.type, data: asJson(b.data) }));
}

function assertSupportedBlock(type: string): void {
  if (!SUPPORTED_BLOCK_SET.has(type)) {
    throw new McpToolError(
      `Unsupported block type "${type}". Call list_block_types to see the ${AI_SUPPORTED_BLOCK_TYPES.length} supported types.`,
    );
  }
}

function makeBlock(type: string, data: unknown): SiteBlock {
  assertSupportedBlock(type);
  return { id: newBlockId(), type, data: sanitizeAiBlockData(type, data ?? {}) };
}

// ── Ownership ───────────────────────────────────────────────────────────────

interface SiteRow {
  id: string;
  user_id: string;
  site_slug: string | null;
  selected_template_id: string | null;
  business_type: string | null;
  category: string | null;
  design_data: Json;
  is_published: boolean | null;
  published_domain: string | null;
  custom_domain: string | null;
  updated_at: string | null;
}

async function loadOwnedSite(admin: Admin, userId: string, siteId: string): Promise<SiteRow> {
  if (!siteId || typeof siteId !== 'string') throw new McpToolError('siteId is required.');
  const { data, error } = await admin
    .from('sites')
    .select('id, user_id, site_slug, selected_template_id, business_type, category, design_data, is_published, published_domain, custom_domain, updated_at')
    .eq('id', siteId)
    .maybeSingle();

  if (error) throw new McpToolError(`Database error: ${error.message}`);
  if (!data) throw new McpToolError(`Site ${siteId} not found.`);
  if (data.user_id !== userId) throw new McpToolError(`You do not have access to site ${siteId}.`);
  return { ...(data as SiteRow), design_data: asJson(data.design_data) };
}

interface PageRow {
  id: string;
  site_id: string;
  slug: string;
  title: string | null;
  display_name: string | null;
  is_visible_in_nav: boolean | null;
  nav_order: number | null;
  design_data: Json;
}

async function loadPage(admin: Admin, siteId: string, slug: string): Promise<PageRow> {
  const normalized = (slug || '').toLowerCase().trim();
  if (!normalized) throw new McpToolError('slug is required (use "home" for the home page).');
  const { data, error } = await admin
    .from('pages')
    .select('id, site_id, slug, title, display_name, is_visible_in_nav, nav_order, design_data')
    .eq('site_id', siteId)
    .eq('slug', normalized)
    .maybeSingle();
  if (error) throw new McpToolError(`Database error: ${error.message}`);
  if (!data) throw new McpToolError(`Page "${normalized}" not found on site ${siteId}.`);
  return { ...(data as PageRow), design_data: asJson(data.design_data) };
}

async function savePageBlocks(admin: Admin, page: PageRow, blocks: SiteBlock[]): Promise<void> {
  const designData = { ...page.design_data, blocks };
  const { error } = await admin
    .from('pages')
    .update({ design_data: designData, updated_at: new Date().toISOString() })
    .eq('id', page.id);
  if (error) throw new McpToolError(`Failed to save page: ${error.message}`);
  await touchSite(admin, page.site_id);
}

async function touchSite(admin: Admin, siteId: string): Promise<void> {
  await admin.from('sites').update({ updated_at: new Date().toISOString() }).eq('id', siteId);
}

// ── Read tools ────────────────────────────────────────────────────────────────

export async function listSites(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('sites')
    .select('id, site_slug, design_data, business_type, category, is_published, published_domain, custom_domain, updated_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });
  if (error) throw new McpToolError(`Database error: ${error.message}`);

  return (data ?? []).map((row) => {
    const design = asJson(row.design_data);
    return {
      siteId: row.id,
      name: row.site_slug,
      title: typeof design.siteTitle === 'string' ? design.siteTitle : row.site_slug,
      businessType: row.business_type,
      category: row.category,
      isPublished: Boolean(row.is_published),
      publishedDomain: row.published_domain,
      customDomain: row.custom_domain,
      updatedAt: row.updated_at,
    };
  });
}

export async function getSite(userId: string, siteId: string) {
  const admin = createAdminClient();
  const site = await loadOwnedSite(admin, userId, siteId);
  const { data: pages, error } = await admin
    .from('pages')
    .select('id, slug, title, display_name, is_visible_in_nav, nav_order, design_data')
    .eq('site_id', siteId)
    .order('nav_order', { ascending: true });
  if (error) throw new McpToolError(`Database error: ${error.message}`);

  const design = site.design_data;
  return {
    siteId: site.id,
    name: site.site_slug,
    title: typeof design.siteTitle === 'string' ? design.siteTitle : site.site_slug,
    templateId: site.selected_template_id,
    businessType: site.business_type,
    category: site.category,
    isPublished: Boolean(site.is_published),
    publishedDomain: site.published_domain,
    theme: {
      headingFont: design.titleFont ?? null,
      bodyFont: design.bodyFont ?? null,
      selectedPalette: design.__selectedPalette ?? null,
      customColors: {
        primary: design.__customPalette_primary ?? null,
        secondary: design.__customPalette_secondary ?? null,
        accent: design.__customPalette_accent ?? null,
      },
    },
    pages: (pages ?? []).map((p) => ({
      slug: p.slug,
      title: p.title,
      displayName: p.display_name,
      visibleInNav: p.is_visible_in_nav,
      navOrder: p.nav_order,
      blockCount: readBlocks(asJson(p.design_data)).length,
    })),
  };
}

export async function getPage(userId: string, siteId: string, slug: string) {
  const admin = createAdminClient();
  await loadOwnedSite(admin, userId, siteId);
  const page = await loadPage(admin, siteId, slug);
  return {
    siteId,
    slug: page.slug,
    title: page.title,
    displayName: page.display_name,
    visibleInNav: page.is_visible_in_nav,
    blocks: readBlocks(page.design_data),
  };
}

// ── Site lifecycle ────────────────────────────────────────────────────────────

export async function createSite(
  userId: string,
  input: { name: string; businessType?: string; category?: string; templateId?: string },
) {
  const name = (input.name || '').trim();
  if (!name) throw new McpToolError('name is required.');
  const businessType = input.businessType && BUSINESS_TYPES.has(input.businessType) ? input.businessType : 'services';
  const category = (input.category || '').trim() || 'general';

  const operations: AiOperation[] = [{ op: 'setSiteTitle', title: name }];
  if (input.templateId) operations.push({ op: 'setTemplate', templateId: input.templateId });

  const admin = createAdminClient();
  const result = await createSiteFromAiOperations(admin, {
    userId,
    slugBase: name,
    businessType,
    category,
    operations,
  });
  return { siteId: result.siteId, homePageSlug: 'home', title: result.siteTitle };
}

export async function duplicateSiteForUser(userId: string, siteId: string, newName?: string) {
  const admin = createAdminClient();
  await loadOwnedSite(admin, userId, siteId); // ownership check
  const result = await duplicateSite(admin, siteId, userId, newName ? { siteTitle: newName, newSlug: newName } : undefined);
  if (!result.ok) throw new McpToolError(result.error || 'Failed to duplicate site.');
  return { siteId: result.siteId };
}

// ── Block editing ─────────────────────────────────────────────────────────────

export async function setPageBlocks(
  userId: string,
  siteId: string,
  slug: string,
  blocks: Array<{ type: string; data?: unknown }>,
) {
  if (!Array.isArray(blocks)) throw new McpToolError('blocks must be an array of { type, data }.');
  const admin = createAdminClient();
  await loadOwnedSite(admin, userId, siteId);
  const page = await loadPage(admin, siteId, slug);
  const built = blocks.map((b) => makeBlock(b.type, b.data));
  await savePageBlocks(admin, page, built);
  return { slug: page.slug, blockCount: built.length, blocks: built };
}

export async function addBlock(
  userId: string,
  siteId: string,
  slug: string,
  type: string,
  data: unknown,
  index?: number,
) {
  const admin = createAdminClient();
  await loadOwnedSite(admin, userId, siteId);
  const page = await loadPage(admin, siteId, slug);
  const blocks = readBlocks(page.design_data);
  const block = makeBlock(type, data);
  const at = typeof index === 'number' && index >= 0 && index <= blocks.length ? index : blocks.length;
  blocks.splice(at, 0, block);
  await savePageBlocks(admin, page, blocks);
  return { slug: page.slug, blockId: block.id, index: at, blockCount: blocks.length };
}

export async function updateBlock(userId: string, siteId: string, slug: string, blockId: string, data: unknown) {
  const admin = createAdminClient();
  await loadOwnedSite(admin, userId, siteId);
  const page = await loadPage(admin, siteId, slug);
  const blocks = readBlocks(page.design_data);
  const target = blocks.find((b) => b.id === blockId);
  if (!target) throw new McpToolError(`Block ${blockId} not found on page "${page.slug}".`);
  // Merge incoming fields over existing data, then re-sanitize for the type.
  target.data = sanitizeAiBlockData(target.type, { ...target.data, ...asJson(data) });
  await savePageBlocks(admin, page, blocks);
  return { slug: page.slug, blockId, block: target };
}

export async function removeBlock(userId: string, siteId: string, slug: string, blockId: string) {
  const admin = createAdminClient();
  await loadOwnedSite(admin, userId, siteId);
  const page = await loadPage(admin, siteId, slug);
  const blocks = readBlocks(page.design_data);
  const next = blocks.filter((b) => b.id !== blockId);
  if (next.length === blocks.length) throw new McpToolError(`Block ${blockId} not found on page "${page.slug}".`);
  await savePageBlocks(admin, page, next);
  return { slug: page.slug, removed: blockId, blockCount: next.length };
}

// ── Pages ─────────────────────────────────────────────────────────────────────

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function navItems(design: Json): Array<Json> {
  const items = design.__navItems;
  return Array.isArray(items) ? (items as Json[]) : [];
}

export async function createPage(
  userId: string,
  siteId: string,
  input: { slug: string; title?: string; displayName?: string; visibleInNav?: boolean; blocks?: Array<{ type: string; data?: unknown }> },
) {
  const slug = (input.slug || '').toLowerCase().trim();
  if (!SLUG_RE.test(slug)) throw new McpToolError('slug must be lowercase letters, numbers and hyphens (e.g. "about-us").');
  if (slug === 'home') throw new McpToolError('The "home" page already exists; edit it instead.');

  const admin = createAdminClient();
  const site = await loadOwnedSite(admin, userId, siteId);

  const { data: existing } = await admin.from('pages').select('id, nav_order').eq('site_id', siteId);
  const dup = await admin.from('pages').select('id').eq('site_id', siteId).eq('slug', slug).maybeSingle();
  if (dup.data) throw new McpToolError(`A page with slug "${slug}" already exists.`);

  const title = (input.title || slug).trim();
  const displayName = (input.displayName || title).trim();
  const visibleInNav = input.visibleInNav !== false;
  const maxOrder = (existing ?? []).reduce((m, p) => Math.max(m, p.nav_order ?? 0), 0);
  const pageId = uuidv4();
  const now = new Date().toISOString();
  const built = Array.isArray(input.blocks) ? input.blocks.map((b) => makeBlock(b.type, b.data)) : [];

  const { error } = await admin.from('pages').insert({
    id: pageId,
    site_id: siteId,
    slug,
    title,
    display_name: displayName,
    is_visible_in_nav: visibleInNav,
    nav_order: maxOrder + 1,
    design_data: { blocks: built },
    created_at: now,
    updated_at: now,
  });
  if (error) throw new McpToolError(`Failed to create page: ${error.message}`);

  if (visibleInNav) {
    const items = navItems(site.design_data);
    items.push({ id: `nav-${uuidv4().slice(0, 8)}`, label: displayName, linkType: 'page', href: `/${slug}`, pageId });
    await admin
      .from('sites')
      .update({ design_data: { ...site.design_data, __navItems: items }, updated_at: now })
      .eq('id', siteId);
  } else {
    await touchSite(admin, siteId);
  }

  return { siteId, slug, pageId, blockCount: built.length };
}

export async function deletePage(userId: string, siteId: string, slug: string) {
  const normalized = (slug || '').toLowerCase().trim();
  if (normalized === 'home') throw new McpToolError('The home page cannot be deleted.');
  const admin = createAdminClient();
  const site = await loadOwnedSite(admin, userId, siteId);
  const page = await loadPage(admin, siteId, normalized);

  const { error } = await admin.from('pages').delete().eq('id', page.id);
  if (error) throw new McpToolError(`Failed to delete page: ${error.message}`);

  const items = navItems(site.design_data).filter((item) => item.pageId !== page.id && item.href !== `/${normalized}`);
  await admin
    .from('sites')
    .update({ design_data: { ...site.design_data, __navItems: items }, updated_at: new Date().toISOString() })
    .eq('id', siteId);

  return { siteId, deleted: normalized };
}

// ── Theme ─────────────────────────────────────────────────────────────────────

export async function setTheme(
  userId: string,
  siteId: string,
  input: { siteTitle?: string; headingFont?: string; bodyFont?: string; primaryColor?: string; secondaryColor?: string; accentColor?: string },
) {
  const admin = createAdminClient();
  const site = await loadOwnedSite(admin, userId, siteId);
  const design: Json = { ...site.design_data };

  if (typeof input.siteTitle === 'string' && input.siteTitle.trim()) design.siteTitle = input.siteTitle.trim();
  if (typeof input.headingFont === 'string' && input.headingFont.trim()) design.titleFont = input.headingFont.trim();
  if (typeof input.bodyFont === 'string' && input.bodyFont.trim()) design.bodyFont = input.bodyFont.trim();

  const rawColors: Record<string, unknown> = {};
  if (input.primaryColor) rawColors.primary = input.primaryColor;
  if (input.secondaryColor) rawColors.secondary = input.secondaryColor;
  if (input.accentColor) rawColors.accent = input.accentColor;
  if (Object.keys(rawColors).length) {
    const colors = sanitizeAiCustomColors(rawColors);
    let any = false;
    for (const key of ['primary', 'secondary', 'accent'] as const) {
      if (colors[key]) {
        design[`__customPalette_${key}`] = colors[key];
        any = true;
      }
    }
    if (any) design.__selectedPalette = 'custom';
  }

  const { error } = await admin
    .from('sites')
    .update({ design_data: design, updated_at: new Date().toISOString() })
    .eq('id', siteId);
  if (error) throw new McpToolError(`Failed to update theme: ${error.message}`);

  return {
    siteId,
    title: design.siteTitle ?? site.site_slug,
    headingFont: design.titleFont ?? null,
    bodyFont: design.bodyFont ?? null,
    selectedPalette: design.__selectedPalette ?? null,
  };
}
