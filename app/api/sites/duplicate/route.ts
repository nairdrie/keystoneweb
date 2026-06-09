import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { trackEvent } from '@/lib/analytics';
import { getUserEffectiveLimits } from '@/lib/addons';
import { getPlanByName } from '@/lib/plans';
import { requireSiteAccess, siteAccessErrorResponse } from '@/lib/auth/site-access';

// Content tables keyed by site_id that hold user-editable content and should be
// carried over to the copy. Site-scoped data that must NOT be copied (domains,
// published state, transfers, orders, members, bookings, analytics, history) is
// deliberately excluded.
const CONTENT_TABLES = ['products', 'blog_posts', 'menu_items'] as const;

/**
 * Duplicate an existing site into a fresh draft owned by the same user.
 *
 * Enforces the user's total-site allowance (plan publishLimit + extra_sites
 * add-ons): if they already have that many sites, the copy is blocked and the
 * caller is told to upgrade / buy an add-on.
 */
export async function POST(request: NextRequest) {
  try {
    const { siteId } = await request.json();

    let access;
    try {
      access = await requireSiteAccess(siteId, request);
    } catch (e) {
      return siteAccessErrorResponse(e);
    }
    const { targetUserId } = access;

    // Use the admin client for all reads/writes so child-table RLS and the
    // brand-new site row insert are handled uniformly. Access is already
    // authorized above.
    const admin = createAdminClient();

    // ── Enforce the total-site allowance ─────────────────────────────────────
    const limits = await getUserEffectiveLimits(targetUserId, admin);
    const { count: siteCount, error: countError } = await admin
      .from('sites')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', targetUserId);

    if (countError) {
      console.error('Error counting sites for duplicate:', countError);
      return NextResponse.json({ error: 'Failed to duplicate site' }, { status: 500 });
    }

    if ((siteCount ?? 0) >= limits.publishLimit) {
      const { data: sub } = await admin
        .from('user_subscriptions')
        .select('subscription_plan')
        .eq('user_id', targetUserId)
        .single();
      const plan = getPlanByName(sub?.subscription_plan);
      return NextResponse.json(
        {
          siteLimitReached: true,
          plan: plan?.name || sub?.subscription_plan || 'Basic',
          limit: limits.publishLimit,
        },
        { status: 403 }
      );
    }

    // ── Load the source site + pages ─────────────────────────────────────────
    const { data: sourceSite, error: siteFetchError } = await admin
      .from('sites')
      .select('*')
      .eq('id', siteId)
      .single();

    if (siteFetchError || !sourceSite) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    const { data: sourcePages, error: pagesFetchError } = await admin
      .from('pages')
      .select('*')
      .eq('site_id', siteId);

    if (pagesFetchError) {
      console.error('Error fetching pages for duplicate:', pagesFetchError);
      return NextResponse.json({ error: 'Failed to duplicate site' }, { status: 500 });
    }

    const newSiteId = uuidv4();
    const now = new Date().toISOString();

    // ── Generate a unique slug ("<name> Copy", "<name> Copy 2", …) ───────────
    const baseName = `${sourceSite.site_slug || 'My Website'} Copy`;
    let newSlug = baseName;
    const { data: existingSites } = await admin
      .from('sites')
      .select('site_slug')
      .eq('user_id', targetUserId)
      .ilike('site_slug', `${baseName}%`);

    if (existingSites && existingSites.length > 0) {
      const existingSlugs = new Set(existingSites.map((s: any) => s.site_slug));
      if (existingSlugs.has(baseName)) {
        let counter = 2;
        while (existingSlugs.has(`${baseName} ${counter}`)) counter++;
        newSlug = `${baseName} ${counter}`;
      }
    }

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
      return NextResponse.json({ error: 'Failed to duplicate site' }, { status: 500 });
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
        .eq('site_id', siteId);

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

    trackEvent('site_duplicate', {
      userId: targetUserId,
      siteId: newSiteId,
      metadata: { sourceSiteId: siteId },
    });

    return NextResponse.json(
      { siteId: newSiteId, message: 'Site duplicated successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error duplicating site:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to duplicate site', detail: message }, { status: 500 });
  }
}
