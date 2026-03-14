import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@/lib/db/supabase-server';

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

    const siteId = uuidv4();
    const homePageId = uuidv4();
    const now = new Date().toISOString();

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Fetch default_content and palettes from template_metadata
    const { data: templateMeta } = await supabase
      .from('template_metadata')
      .select('default_content, palettes')
      .eq('template_id', selectedTemplateId)
      .single();

    const defaultContent = templateMeta?.default_content || {};
    const palettes = templateMeta?.palettes || {};

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
      return NextResponse.json({ error: 'Failed to create site' }, { status: 500 });
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

    return NextResponse.json({ siteId, message: 'Site created successfully' }, { status: 201 });
  } catch (error) {
    console.error('Error creating site:', error);
    return NextResponse.json({ error: 'Failed to create site' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const siteId = searchParams.get('id');

    if (!siteId) {
      return NextResponse.json(
        { error: 'Site ID is required' },
        { status: 400 }
      );
    }

    // Create server-side Supabase client
    const supabase = await createClient();

    // Fetch from Supabase
    const { data, error } = await supabase
      .from('sites')
      .select('*')
      .eq('id', siteId)
      .single();

    if (error || !data) {
      console.error('Supabase error fetching site:', error);
      return NextResponse.json(
        { error: 'Site not found' },
        { status: 404 }
      );
    }

    const siteData = mapSupabaseToSiteData(data);
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
    // Create server-side Supabase client
    const supabase = await createClient();

    // ✅ Security: Always use getUser() for authorization checks
    // This cryptographically verifies the JWT token with Supabase backend
    // NEVER use getSession() which only reads local cookies unvalidated
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('Auth error in PATCH /api/sites:', authError?.message);
      return NextResponse.json(
        { error: 'Unauthorized: User authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { siteId, designData, userId, title } = body;

    if (!siteId) {
      return NextResponse.json(
        { error: 'Site ID is required' },
        { status: 400 }
      );
    }

    // ✅ Security: Verify ownership - userId from JWT must match site.user_id
    if (userId && userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You can only edit your own sites' },
        { status: 403 }
      );
    }

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

    // ✅ Security: If site already has an owner, verify it matches current user
    if (currentSite.user_id && currentSite.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: This site is owned by another user' },
        { status: 403 }
      );
    }

    // Merge design data
    const mergedDesignData = {
      ...(currentSite.design_data || {}),
      ...(designData || {}),
    };

    // Update in Supabase - set userId if this is the first save
    const updatePayload: any = {
      user_id: user.id, // Claim ownership on first save
      design_data: mergedDesignData,
      updated_at: new Date().toISOString(),
    };

    // Map frontend 'title' to DB 'site_slug' column
    if (title) {
      updatePayload.site_slug = title;
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
