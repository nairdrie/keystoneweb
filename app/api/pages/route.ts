import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

interface CreatePageRequest {
  siteId: string;
  slug: string;
  title: string;
  displayName?: string;
}

interface UpdatePageRequest {
  id: string;
  siteId: string;
  title?: string;
  displayName?: string;
  display_name?: string;
  isVisibleInNav?: boolean;
  is_visible_in_nav?: boolean;
  navOrder?: number;
  nav_order?: number;
  designData?: Record<string, any>;
  design_data?: Record<string, any>;
}

/**
 * GET /api/pages?siteId=xxx
 * Fetch all pages for a site, ordered by nav_order
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const siteId = request.nextUrl.searchParams.get('siteId');
    if (!siteId) {
      return NextResponse.json(
        { error: 'siteId query parameter required' },
        { status: 400 }
      );
    }

    // Verify user owns the site
    const { data: site } = await supabase
      .from('sites')
      .select('user_id')
      .eq('id', siteId)
      .single();

    if (!site || site.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all pages for this site
    const { data: pages, error } = await supabase
      .from('pages')
      .select('*')
      .eq('site_id', siteId)
      .order('nav_order', { ascending: true });

    if (error) {
      console.error('Failed to fetch pages:', error);
      return NextResponse.json(
        { error: 'Failed to fetch pages' },
        { status: 500 }
      );
    }

    return NextResponse.json({ pages });
  } catch (error) {
    console.error('Error in GET /api/pages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pages
 * Create a new page for a site
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreatePageRequest = await request.json();
    const { siteId, slug, title, displayName } = body;

    if (!siteId || !slug || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: siteId, slug, title' },
        { status: 400 }
      );
    }

    // Verify user owns the site
    const { data: site } = await supabase
      .from('sites')
      .select('user_id')
      .eq('id', siteId)
      .single();

    if (!site || site.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get next nav_order
    const { data: pages } = await supabase
      .from('pages')
      .select('nav_order')
      .eq('site_id', siteId)
      .order('nav_order', { ascending: false })
      .limit(1);

    const nextNavOrder = (pages?.[0]?.nav_order ?? -1) + 1;

    // Create page
    const { data: newPage, error } = await supabase
      .from('pages')
      .insert({
        site_id: siteId,
        slug,
        title,
        display_name: displayName || title,
        nav_order: nextNavOrder,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create page:', error);
      return NextResponse.json(
        { error: 'Failed to create page' },
        { status: 500 }
      );
    }

    return NextResponse.json({ page: newPage });
  } catch (error) {
    console.error('Error in POST /api/pages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/pages
 * Update an existing page
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: UpdatePageRequest = await request.json();
    const { id, siteId, title, displayName, isVisibleInNav, navOrder, designData } = body;

    if (!id || !siteId) {
      return NextResponse.json(
        { error: 'Missing required fields: id, siteId' },
        { status: 400 }
      );
    }

    // Verify user owns the site
    const { data: site } = await supabase
      .from('sites')
      .select('user_id')
      .eq('id', siteId)
      .single();

    if (!site || site.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify page belongs to site
    const { data: page } = await supabase
      .from('pages')
      .select('id')
      .eq('id', id)
      .eq('site_id', siteId)
      .single();

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    // Prepare update data (Support both camelCase and snake_case from usePages hook)
    const updateData: Record<string, any> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.displayName !== undefined || body.display_name !== undefined)
      updateData.display_name = body.displayName ?? body.display_name;
    if (body.isVisibleInNav !== undefined || body.is_visible_in_nav !== undefined)
      updateData.is_visible_in_nav = body.isVisibleInNav ?? body.is_visible_in_nav;
    if (body.navOrder !== undefined || body.nav_order !== undefined)
      updateData.nav_order = body.navOrder ?? body.nav_order;
    if (body.designData !== undefined || body.design_data !== undefined)
      updateData.design_data = body.designData ?? body.design_data;

    // Update page
    const { data: updatedPage, error } = await supabase
      .from('pages')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update page:', error);
      return NextResponse.json(
        { error: 'Failed to update page' },
        { status: 500 }
      );
    }

    return NextResponse.json({ page: updatedPage });
  } catch (error) {
    console.error('Error in PATCH /api/pages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/pages/:id
 * Delete a page (via query parameter)
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pageId = request.nextUrl.searchParams.get('id');
    const siteId = request.nextUrl.searchParams.get('siteId');

    if (!pageId || !siteId) {
      return NextResponse.json(
        { error: 'id and siteId query parameters required' },
        { status: 400 }
      );
    }

    // Verify user owns the site
    const { data: site } = await supabase
      .from('sites')
      .select('user_id')
      .eq('id', siteId)
      .single();

    if (!site || site.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete page
    const { error } = await supabase
      .from('pages')
      .delete()
      .eq('id', pageId)
      .eq('site_id', siteId);

    if (error) {
      console.error('Failed to delete page:', error);
      return NextResponse.json(
        { error: 'Failed to delete page' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/pages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
