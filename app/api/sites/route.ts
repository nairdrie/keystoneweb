import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { trackEvent } from '@/lib/analytics';
import { getStructuralTemplateMetadata } from '@/lib/templates/structural-templates';
import { personalizeTemplateContentForCategory } from '@/lib/templates/template-content-personalization';
import { seedTemplateAdminContent } from '@/lib/templates/admin-seed-data';
import { getTemplateMetadata } from '@/lib/db/template-queries';
import { migratePaletteTokensInDesignData } from '@/lib/template-palette-migration';
import { requireSiteAccess, siteAccessErrorResponse } from '@/lib/auth/site-access';

interface CreateSiteRequest {
  selectedTemplateId: string;
  businessType: string;
  category: string;
  userId?: string | null; // Optional - set if user is authenticated
}

interface SiteData {
  id: string;
  userId: string | null; // null until authenticated
  siteSlug?: string; // Display name (saved from editor 'title')
  selectedTemplateId: string;
  businessType: string;
  category: string;
  designData: Record<string, any>;
  publishedData?: Record<string, any>;
  isPublished: boolean;
  publishedDomain?: string;
  customDomain?: string;
  pendingCustomDomain?: string;
  inboxCustomEmail?: string;
  marketingEnabled?: boolean;
  googleAdsCustomerId?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Helper to map Supabase data to SiteData
function mapSupabaseToSiteData(row: any): SiteData {
  return {
    id: row.id,
    userId: row.user_id,
    siteSlug: row.site_slug,
    selectedTemplateId: row.selected_template_id,
    businessType: row.business_type,
    category: row.category,
    designData: row.design_data || {},
    publishedData: row.published_data || {},
    isPublished: row.is_published || false,
    publishedDomain: row.published_domain,
    customDomain: row.custom_domain,
    pendingCustomDomain: row.pending_custom_domain,
    inboxCustomEmail: row.inbox_custom_email,
    marketingEnabled: row.marketing_enabled || false,
    googleAdsCustomerId: row.google_ads_customer_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateSiteRequest = await request.json();
    const { selectedTemplateId, businessType, category, userId } = body;

    if (!selectedTemplateId || !businessType || !category) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // No creation limit — users can create unlimited draft sites.
    // Publish limits are enforced separately at publish time.

    const siteId = uuidv4();
    const homePageId = uuidv4();
    const now = new Date().toISOString();

    // Fetch default_content and palettes from template_metadata
    const { data: templateMeta } = await supabase
      .from('template_metadata')
      .select('default_content, palettes')
      .eq('template_id', selectedTemplateId)
      .single();

    const structuralTemplate = getStructuralTemplateMetadata(selectedTemplateId);
    const baseDefaultContent = structuralTemplate?.default_content || templateMeta?.default_content || {};
    const shouldApplyTemplateArchitecture = selectedTemplateId !== 'custom_ai';
    const defaultContent = shouldApplyTemplateArchitecture
      ? personalizeTemplateContentForCategory(baseDefaultContent, { category, businessType, templateId: selectedTemplateId })
      : baseDefaultContent;
    const palettes = structuralTemplate?.palettes || templateMeta?.palettes || {};

    // Extract site-level fields from default_content
    const { blocks, extra_pages, __navItems: templateNavItems, ...siteHeaderFields } = defaultContent as any;

    // Pick the first palette as default
    const paletteNames = Object.keys(palettes);
    const defaultPaletteName = paletteNames[0] || 'default';
    const defaultPalette = palettes[defaultPaletteName] || {};

    // Build site design_data (header content + palette selection)
    const siteDesignData: Record<string, any> = {
      ...siteHeaderFields,
      __selectedPalette: defaultPaletteName,
    };

    // Build home page design_data with default blocks
    const homePageDesignData: Record<string, any> = {};
    if (blocks && Array.isArray(blocks)) {
      homePageDesignData.blocks = blocks.map((block: any) => ({
        id: `block-${uuidv4().slice(0, 8)}`,
        type: block.type,
        data: block.data || {},
      }));
    }

    // Generate a site_slug from the template's siteTitle (e.g. "Iron Fitness")
    const baseName = siteHeaderFields.siteTitle || 'My Website';
    let siteSlug = baseName;

    if (user?.id) {
      // Check for existing sites with the same base name to avoid duplicates
      const { data: existingSites } = await supabase
        .from('sites')
        .select('site_slug')
        .eq('user_id', user.id)
        .ilike('site_slug', `${baseName}%`);

      if (existingSites && existingSites.length > 0) {
        const existingSlugs = new Set(existingSites.map((s: any) => s.site_slug));
        if (existingSlugs.has(baseName)) {
          let counter = 2;
          while (existingSlugs.has(`${baseName} ${counter}`)) {
            counter++;
          }
          siteSlug = `${baseName} ${counter}`;
        }
      }
    }

    // Build nav items: start with template-defined ones, or build from pages
    const navItems: any[] = [];
    // Track page IDs for nav item linking
    const pageIdMap: Record<string, string> = {};
    pageIdMap['home'] = homePageId;

    // Prepare extra pages from template
    const extraPageInserts: any[] = [];
    if (extra_pages && Array.isArray(extra_pages)) {
      extra_pages.forEach((page: any, index: number) => {
        const pageId = uuidv4();
        const pageSlug = page.slug || page.title?.toLowerCase().replace(/\s+/g, '-') || `page-${index + 1}`;
        pageIdMap[pageSlug] = pageId;

        const pageDesignData: Record<string, any> = {};
        if (page.blocks && Array.isArray(page.blocks)) {
          pageDesignData.blocks = page.blocks.map((block: any) => ({
            id: `block-${uuidv4().slice(0, 8)}`,
            type: block.type,
            data: block.data || {},
          }));
        }

        extraPageInserts.push({
          id: pageId,
          site_id: siteId,
          slug: pageSlug,
          title: page.title || `Page ${index + 1}`,
          display_name: page.display_name || page.title || `Page ${index + 1}`,
          is_visible_in_nav: page.is_visible_in_nav !== false,
          nav_order: index + 1,
          design_data: pageDesignData,
          created_at: now,
          updated_at: now,
        });
      });
    }

    // Build nav items from template nav items or auto-generate from pages
    if (templateNavItems && Array.isArray(templateNavItems)) {
      templateNavItems.forEach((navItem: any) => {
        const resolvedPageId = navItem.pageSlug ? pageIdMap[navItem.pageSlug] : undefined;
        navItems.push({
          id: `nav-${uuidv4().slice(0, 8)}`,
          label: navItem.label,
          linkType: navItem.linkType || 'page',
          href: navItem.href || `/${navItem.pageSlug || ''}`,
          pageId: resolvedPageId || navItem.pageId,
          blockId: navItem.blockId,
        });
      });
    } else {
      // Auto-generate nav items: Home + extra pages
      navItems.push({
        id: `nav-${uuidv4().slice(0, 8)}`,
        label: 'Home',
        linkType: 'page',
        href: '/',
        pageId: homePageId,
      });
      extraPageInserts.forEach((page) => {
        navItems.push({
          id: `nav-${uuidv4().slice(0, 8)}`,
          label: page.display_name,
          linkType: 'page',
          href: `/${page.slug}`,
          pageId: page.id,
        });
      });
    }

    // Store nav items in site design data
    if (navItems.length > 0) {
      siteDesignData.__navItems = navItems;
    }

    // Insert site
    const { error: siteError } = await supabase.from('sites').insert({
      id: siteId,
      user_id: user?.id || null,
      site_slug: siteSlug,
      selected_template_id: selectedTemplateId,
      business_type: businessType,
      category,
      design_data: siteDesignData,
      created_at: now,
      updated_at: now,
    });

    if (siteError) {
      console.error('Supabase error creating site:', siteError);
      return NextResponse.json({ error: 'Failed to create site', detail: siteError.message }, { status: 500 });
    }

    // Insert home page with default blocks
    const { error: pageError } = await supabase.from('pages').insert({
      id: homePageId,
      site_id: siteId,
      slug: 'home',
      title: 'Home',
      display_name: 'Home',
      is_visible_in_nav: true,
      nav_order: 0,
      design_data: homePageDesignData,
      created_at: now,
      updated_at: now,
    });

    if (pageError) {
      console.error('Supabase error creating home page:', pageError);
    }

    // Insert extra pages (Products, Booking, About, etc.)
    if (extraPageInserts.length > 0) {
      const { error: extraPagesError } = await supabase.from('pages').insert(extraPageInserts);
      if (extraPagesError) {
        console.error('Supabase error creating extra pages:', extraPagesError);
      }
    }

    try {
      await seedTemplateAdminContent(createAdminClient(), siteId, selectedTemplateId, { businessType, category });
    } catch (seedError) {
      console.error('Failed to seed template admin content:', seedError);
    }

    trackEvent('site_create', {
      userId: user?.id,
      siteId,
      metadata: { templateId: selectedTemplateId, businessType, category },
    });

    return NextResponse.json({ siteId, message: 'Site created successfully' }, { status: 201 });
  } catch (error) {
    console.error('Error creating site:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to create site', detail: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const siteId = request.nextUrl.searchParams.get('id');

    let access;
    try {
      access = await requireSiteAccess(siteId, request);
    } catch (e) {
      return siteAccessErrorResponse(e);
    }
    const { supabase } = access;

    const { data, error } = await supabase
      .from('sites')
      .select('*')
      .eq('id', siteId!)
      .single();

    if (error || !data) {
      console.error('Supabase error fetching site:', error);
      return NextResponse.json(
        { error: 'Site not found' },
        { status: 404 }
      );
    }

    let siteRow = data;
    try {
      const metadata = await getTemplateMetadata(data.selected_template_id);
      if (metadata?.palettes) {
        const migration = migratePaletteTokensInDesignData(
          data.design_data || {},
          metadata.palettes,
          data.design_data?.__selectedPalette,
        );

        if (migration.changed) {
          const { data: migratedSite, error: migrationError } = await supabase
            .from('sites')
            .update({
              design_data: migration.data,
              updated_at: new Date().toISOString(),
            })
            .eq('id', siteId!)
            .select()
            .single();

          if (!migrationError && migratedSite) {
            siteRow = migratedSite;
          } else {
            console.error('Failed to migrate site palette tokens:', migrationError);
            siteRow = { ...data, design_data: migration.data };
          }
        }
      }
    } catch (migrationErr) {
      console.error('Error migrating site palette tokens:', migrationErr);
    }

    const siteData = mapSupabaseToSiteData(siteRow);
    return NextResponse.json(siteData);
  } catch (error) {
    console.error('Error fetching site:', error);
    return NextResponse.json(
      { error: 'Failed to fetch site' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { siteId, designData, title, selectedTemplateId } = body;

    let access;
    try {
      access = await requireSiteAccess(siteId, request);
    } catch (e) {
      return siteAccessErrorResponse(e);
    }
    const { supabase, user, isAdminMode, targetUserId } = access;

    // Fetch current site to merge design data
    const { data: currentSite, error: fetchError } = await supabase
      .from('sites')
      .select('*')
      .eq('id', siteId)
      .single();

    if (fetchError || !currentSite) {
      return NextResponse.json(
        { error: 'Site not found' },
        { status: 404 }
      );
    }

    // Merge design data
    const mergedDesignData = {
      ...(currentSite.design_data || {}),
      ...(designData || {}),
    };

    const updatePayload: any = {
      design_data: mergedDesignData,
      updated_at: new Date().toISOString(),
    };

    // Claim ownership on first save (only when an owner is not yet set, and
    // never in admin manage-mode — admins must not become the owner).
    if (!currentSite.user_id && !isAdminMode) {
      updatePayload.user_id = user.id;
    }

    if (title) {
      updatePayload.site_slug = title;
    }

    if (selectedTemplateId) {
      updatePayload.selected_template_id = selectedTemplateId;
    }

    const { data: updatedSite, error: updateError } = await supabase
      .from('sites')
      .update(updatePayload)
      .eq('id', siteId)
      .select()
      .single();

    if (updateError) {
      console.error('Supabase error updating site:', updateError);
      return NextResponse.json(
        { error: 'Failed to update site' },
        { status: 500 }
      );
    }

    const siteData = mapSupabaseToSiteData(updatedSite);

    // Record history snapshot (save_draft event).
    // Record against the owner's user_id so the owner can see the entry in
    // their history list (RLS on site_history is user_id = auth.uid()).
    try {
      const { data: allPages } = await supabase
        .from('pages')
        .select('id, slug, title, design_data')
        .eq('site_id', siteId)
        .order('nav_order', { ascending: true });

      await supabase.from('site_history').insert({
        site_id: siteId,
        user_id: targetUserId,
        event_type: 'save_draft',
        site_design_data: mergedDesignData,
        pages_snapshot: allPages || [],
        site_title: title || currentSite.site_slug,
        selected_palette: mergedDesignData.__selectedPalette,
      });
    } catch (historyErr) {
      console.error('Failed to record site history:', historyErr);
    }

    trackEvent('site_edit', { userId: targetUserId, siteId });

    return NextResponse.json({
      message: 'Site updated successfully',
      site: siteData,
    });
  } catch (error) {
    console.error('Error updating site:', error);
    return NextResponse.json(
      { error: 'Failed to update site' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { siteId } = await request.json();

    let access;
    try {
      access = await requireSiteAccess(siteId, request);
    } catch (e) {
      return siteAccessErrorResponse(e);
    }
    const { supabase, targetUserId } = access;

    const { data: site, error: fetchError } = await supabase
      .from('sites')
      .select('id, user_id, published_domain, custom_domain')
      .eq('id', siteId)
      .single();

    if (fetchError || !site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Use admin client to bypass RLS for cascading deletes (children's policies
    // are owner-only; an admin in manage-mode needs the bypass).
    const admin = createAdminClient();

    // Unlink any purchased domains from this site (preserve domain ownership)
    // The domain_purchases record stays — it just becomes unallocated (site_id = null)
    if (site.custom_domain) {
      await admin
        .from('domain_purchases')
        .update({ site_id: null })
        .eq('site_id', siteId);
    }

    // Delete pages first (foreign key constraint)
    await admin.from('pages').delete().eq('site_id', siteId);

    // Delete any pending transfers
    await admin.from('site_transfers').delete().eq('site_id', siteId);

    // Delete DNS records
    await admin.from('dns_records').delete().eq('site_id', siteId);

    // Delete the site
    const { error: deleteError } = await admin.from('sites').delete().eq('id', siteId);

    if (deleteError) {
      console.error('Error deleting site:', deleteError);
      return NextResponse.json({ error: 'Failed to delete site' }, { status: 500 });
    }

    trackEvent('site_delete', { userId: targetUserId, siteId });

    // Return domain info so the frontend can show the ownership notice
    return NextResponse.json({
      message: 'Site deleted successfully',
      domainRetained: site.custom_domain || null,
    });
  } catch (error) {
    console.error('Error deleting site:', error);
    return NextResponse.json({ error: 'Failed to delete site' }, { status: 500 });
  }
}
