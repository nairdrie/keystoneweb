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
