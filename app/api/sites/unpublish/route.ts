import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { trackEvent } from '@/lib/analytics';

/**
 * POST /api/sites/unpublish
 * Unpublish (take offline) a site, freeing up a publish slot.
 *
 * - Sets is_published = false, clears published_domain
 * - Keeps published_data so re-publishing is seamless
 * - If site has a custom_domain, disconnects it (domain_purchases.site_id = null, sites.custom_domain = null)
 * - Records unpublish event in site_history
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { siteId } = await request.json();
    if (!siteId) {
      return NextResponse.json({ error: 'siteId is required' }, { status: 400 });
    }

    // Fetch site and verify ownership
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id, user_id, is_published, published_domain, custom_domain, design_data')
      .eq('id', siteId)
      .single();

    if (siteError || !site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    if (site.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!site.is_published) {
      return NextResponse.json({ error: 'Site is not currently published' }, { status: 400 });
    }

    const admin = createAdminClient();

    // If site has a custom domain, disconnect it (park the domain)
    if (site.custom_domain) {
      await admin
        .from('domain_purchases')
        .update({ site_id: null })
        .eq('site_id', siteId);
    }

    // Unpublish the site — also clear custom inbox email since the custom domain is being removed
    const { error: updateError } = await admin
      .from('sites')
      .update({
        is_published: false,
        published_domain: null,
        custom_domain: null,
        inbox_custom_email: null,
        inbox_resend_domain_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', siteId);

    if (updateError) {
      console.error('Failed to unpublish site:', updateError);
      return NextResponse.json({ error: 'Failed to unpublish site' }, { status: 500 });
    }

    // Record history
    try {
      const { data: pages } = await supabase
        .from('pages')
        .select('id, slug, title, design_data')
        .eq('site_id', siteId);

      await supabase.from('site_history').insert({
        site_id: siteId,
        user_id: user.id,
        event_type: 'unpublish',
        site_design_data: site.design_data || {},
        pages_snapshot: pages || [],
        site_title: (site.design_data as any)?.siteTitle || siteId,
        selected_palette: (site.design_data as any)?.__selectedPalette,
      });
    } catch (historyErr) {
      console.error('Failed to record unpublish history:', historyErr);
    }

    trackEvent('site_unpublish', { userId: user.id, siteId });

    return NextResponse.json({
      success: true,
      siteId,
      domainParked: site.custom_domain || null,
      message: 'Site unpublished successfully.',
    });
  } catch (error) {
    console.error('Error unpublishing site:', error);
    return NextResponse.json({ error: 'Failed to unpublish site' }, { status: 500 });
  }
}
