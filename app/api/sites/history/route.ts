import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

/**
 * GET /api/sites/history?siteId=xxx&limit=50&offset=0
 * Returns edit history for a site, most recent first.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const siteId = searchParams.get('siteId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!siteId) {
      return NextResponse.json({ error: 'siteId is required' }, { status: 400 });
    }

    // Verify ownership
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id, user_id')
      .eq('id', siteId)
      .single();

    if (siteError || !site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    if (site.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch history entries (without full snapshots for the list view)
    const { data: history, error: historyError, count } = await supabase
      .from('site_history')
      .select('id, event_type, site_title, selected_palette, created_at', { count: 'exact' })
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (historyError) {
      console.error('Error fetching site history:', historyError);
      return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }

    return NextResponse.json({
      history: history || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error in GET /api/sites/history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/sites/history
 * Revert a site to a specific history snapshot.
 * Body: { siteId: string, historyId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { siteId, historyId } = await request.json();

    if (!siteId || !historyId) {
      return NextResponse.json({ error: 'siteId and historyId are required' }, { status: 400 });
    }

    // Verify ownership
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id, user_id')
      .eq('id', siteId)
      .single();

    if (siteError || !site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    if (site.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch the full history snapshot
    const { data: snapshot, error: snapError } = await supabase
      .from('site_history')
      .select('*')
      .eq('id', historyId)
      .eq('site_id', siteId)
      .single();

    if (snapError || !snapshot) {
      return NextResponse.json({ error: 'History entry not found' }, { status: 404 });
    }

    // Save current state as a history entry before reverting (so the revert itself is undoable)
    const { data: currentSite } = await supabase
      .from('sites')
      .select('design_data, site_slug')
      .eq('id', siteId)
      .single();

    const { data: currentPages } = await supabase
      .from('pages')
      .select('id, slug, title, design_data')
      .eq('site_id', siteId)
      .order('nav_order', { ascending: true });

    await supabase.from('site_history').insert({
      site_id: siteId,
      user_id: user.id,
      event_type: 'save_draft',
      site_design_data: currentSite?.design_data || {},
      pages_snapshot: currentPages || [],
      site_title: currentSite?.site_slug,
      selected_palette: currentSite?.design_data?.__selectedPalette,
    });

    // Restore site-level design data
    const { error: updateError } = await supabase
      .from('sites')
      .update({
        design_data: snapshot.site_design_data,
        site_slug: snapshot.site_title,
        updated_at: new Date().toISOString(),
      })
      .eq('id', siteId);

    if (updateError) {
      console.error('Error reverting site:', updateError);
      return NextResponse.json({ error: 'Failed to revert site' }, { status: 500 });
    }

    // Restore pages from snapshot
    const pagesSnapshot = snapshot.pages_snapshot || [];
    if (Array.isArray(pagesSnapshot) && pagesSnapshot.length > 0) {
      for (const page of pagesSnapshot) {
        await supabase
          .from('pages')
          .update({
            design_data: page.design_data || {},
            updated_at: new Date().toISOString(),
          })
          .eq('id', page.id)
          .eq('site_id', siteId);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Site reverted successfully',
    });
  } catch (error) {
    console.error('Error in POST /api/sites/history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
