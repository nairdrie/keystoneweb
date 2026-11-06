import { v4 as uuidv4 } from 'uuid';
import { createAdminClient } from '@/lib/db/supabase-admin';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

// Content tables keyed by site_id that hold user-editable content and should be
// carried over to the copy. Site-scoped data that must NOT be copied (domains,
// published state, transfers, orders, members, bookings, analytics, history) is
// deliberately excluded.
const CONTENT_TABLES = ['products', 'blog_posts', 'menu_items'] as const;

export interface DuplicateSiteOptions {
  // Explicit slug for the new site. When omitted, a unique "<name> Copy" slug is
  // generated from the source site's slug. When provided, the slug is still made
  // unique within the target user's sites ("<name>", "<name> 2", …).
  newSlug?: string;
  // Override design_data.siteTitle (the name shown in the site header/footer) on
  // the copy — used to brand a template build with a lead's business name. When
  // omitted the source title is preserved.
  siteTitle?: string;
}

export type DuplicateSiteResult =
  | { ok: true; siteId: string }
  | { ok: false; error: string; status: number };

/**
 * Clone a site's design data, pages, and content (products, blog posts, menu
 * items) into a fresh draft owned by `targetUserId`, regenerating page/nav IDs.
 * Domains, published state, and transfers are intentionally not copied.
 *
 * This is the shared engine behind both the editor "Duplicate Site" action and
 * the ops "Build from template" lead flow. It performs no access or site-limit
 * enforcement — callers are responsible for authorizing the duplication.
 */
export async function duplicateSite(
  admin: SupabaseAdmin,
  sourceSiteId: string,
  targetUserId: string,
  options: DuplicateSiteOptions = {},
): Promise<DuplicateSiteResult> {
  // ── Load the source site + pages ─────────────────────────────────────────
  const { data: sourceSite, error: siteFetchError } = await admin
    .from('sites')
    .select('*')
    .eq('id', sourceSiteId)
    .single();

  if (siteFetchError || !sourceSite) {
    return { ok: false, error: 'Site not found', status: 404 };
  }

  const { data: sourcePages, error: pagesFetchError } = await admin
    .from('pages')
    .select('*')
    .eq('site_id', sourceSiteId);

  if (pagesFetchError) {
    console.error('Error fetching pages for duplicate:', pagesFetchError);
    return { ok: false, error: 'Failed to duplicate site', status: 500 };
  }

  const newSiteId = uuidv4();
  const now = new Date().toISOString();

  // ── Resolve a unique slug ────────────────────────────────────────────────
  const baseName = options.newSlug?.trim()
    ? options.newSlug.trim()
    : `${sourceSite.site_slug || 'My Website'} Copy`;
  const newSlug = await uniqueSlug(admin, targetUserId, baseName);

  // ── Remap page IDs and rewrite nav items that point at pages ─────────────
  const pageIdMap = new Map<string, string>();
  (sourcePages || []).forEach((page: any) => {
    pageIdMap.set(page.id, uuidv4());
  });

  const newDesignData = { ...(sourceSite.design_data || {}) };
  if (Array.isArray(newDesignData.__navItems)) {
    newDesignData.__navItems = newDesignData.__navItems.map((item: any) => ({
      ...item,
      id: `nav-${uuidv4().slice(0, 8)}`,
      pageId: item.pageId && pageIdMap.has(item.pageId) ? pageIdMap.get(item.pageId) : item.pageId,
    }));
  }

  // Brand the copy with the requested title (shown in the site header/footer).
  if (options.siteTitle?.trim()) {
    newDesignData.siteTitle = options.siteTitle.trim();
  }

  // ── Insert the new site (draft, no domains, not published) ───────────────
  const { error: insertSiteError } = await admin.from('sites').insert({
    id: newSiteId,
    user_id: targetUserId,
    site_slug: newSlug,
    selected_template_id: sourceSite.selected_template_id,
    business_type: sourceSite.business_type,
    category: sourceSite.category,
    design_data: newDesignData,
    created_at: now,
    updated_at: now,
  });

  if (insertSiteError) {
    console.error('Error inserting duplicated site:', insertSiteError);
    return { ok: false, error: 'Failed to duplicate site', status: 500 };
  }

  // ── Copy pages with their new IDs ────────────────────────────────────────
  if (sourcePages && sourcePages.length > 0) {
    const newPages = sourcePages.map((page: any) => {
      const { id, site_id, created_at, updated_at, published_data, ...rest } = page;
      return {
        ...rest,
        id: pageIdMap.get(page.id),
        site_id: newSiteId,
        created_at: now,
        updated_at: now,
      };
    });
    const { error: insertPagesError } = await admin.from('pages').insert(newPages);
    if (insertPagesError) {
      console.error('Error inserting duplicated pages:', insertPagesError);
    }
  }

  // ── Agent-built (v2) sites: copy design, layouts and content ─────────────
  if (sourceSite.engine === 'sections_v2') {
    const v2Error = await copyV2Design(admin, sourceSiteId, newSiteId, pageIdMap);
    if (v2Error) {
      console.error('Error copying v2 design for duplicate:', v2Error);
      return { ok: false, error: 'Failed to duplicate site', status: 500 };
    }
  }

  // ── Copy content tables (products, blog posts, menu items) ───────────────
  for (const table of CONTENT_TABLES) {
    const { data: rows, error: readError } = await admin
      .from(table)
      .select('*')
      .eq('site_id', sourceSiteId);

    if (readError) {
      // Table may not exist in every environment — skip rather than fail.
      console.error(`Error reading ${table} for duplicate:`, readError.message);
      continue;
    }
    if (!rows || rows.length === 0) continue;

    const newRows = rows.map((row: any) => {
      const { id, created_at, updated_at, ...rest } = row;
      return { ...rest, site_id: newSiteId };
    });

    const { error: writeError } = await admin.from(table).insert(newRows);
    if (writeError) {
      console.error(`Error copying ${table} for duplicate:`, writeError.message);
    }
  }

  return { ok: true, siteId: newSiteId };
}

/**
 * Make `base` unique within the target user's site slugs by appending an
 * incrementing counter ("Acme", "Acme 2", "Acme 3", …) when it collides.
 */
async function uniqueSlug(
  admin: SupabaseAdmin,
  targetUserId: string,
  base: string,
): Promise<string> {
  const { data: existingSites } = await admin
    .from('sites')
    .select('site_slug')
    .eq('user_id', targetUserId)
    .ilike('site_slug', `${base}%`);

  if (!existingSites || existingSites.length === 0) return base;

  const existingSlugs = new Set(existingSites.map((s: any) => s.site_slug));
  if (!existingSlugs.has(base)) return base;

  let counter = 2;
  while (existingSlugs.has(`${base} ${counter}`)) counter++;
  return `${base} ${counter}`;
}

/** Copy an agent-built site's theme, section designs, page layouts and content. */
async function copyV2Design(
  admin: SupabaseAdmin,
  sourceSiteId: string,
  newSiteId: string,
  pageIdMap: Map<string, string>,
): Promise<string | null> {
  const { error: engineError } = await admin.from('sites').update({ engine: 'sections_v2' }).eq('id', newSiteId);
  if (engineError) return engineError.message;

  const [theme, sections, layouts, content] = await Promise.all([
    admin.from('v2_themes').select('*').eq('site_id', sourceSiteId).maybeSingle(),
    admin.from('v2_sections').select('key, name, html, css, js, schema').eq('site_id', sourceSiteId),
    admin.from('v2_page_layouts').select('page_id, instances').eq('site_id', sourceSiteId),
    admin.from('v2_content').select('instance_id, field, locale, value, owner_edited').eq('site_id', sourceSiteId),
  ]);

  if (theme.data) {
    const { site_id: _s, updated_at: _u, version: _v, ...rest } = theme.data as Record<string, unknown>;
    void _s; void _u; void _v;
    const { error } = await admin.from('v2_themes').insert({ ...rest, site_id: newSiteId });
    if (error) return error.message;
  }
  if (sections.data?.length) {
    const { error } = await admin.from('v2_sections').insert(sections.data.map((row) => ({
      site_id: newSiteId, key: row.key, name: row.name, html: row.html, css: row.css, js: row.js, schema: row.schema,
    })));
    if (error) return error.message;
  }
  const layoutRows = (layouts.data || [])
    .filter((row) => pageIdMap.has(row.page_id))
    .map((row) => ({ page_id: pageIdMap.get(row.page_id), site_id: newSiteId, instances: row.instances }));
  if (layoutRows.length) {
    const { error } = await admin.from('v2_page_layouts').insert(layoutRows);
    if (error) return error.message;
  }
  // Instance ids are unique within a site, so they can be kept as-is.
  const contentRows = (content.data || []).map((row) => ({
    site_id: newSiteId, instance_id: row.instance_id, field: row.field, locale: row.locale, value: row.value, owner_edited: row.owner_edited,
  }));
  for (let i = 0; i < contentRows.length; i += 500) {
    const { error } = await admin.from('v2_content').insert(contentRows.slice(i, i + 500));
    if (error) return error.message;
  }
  return null;
}
