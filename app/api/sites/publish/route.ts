import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

interface PublishRequest {
  siteId: string;
  publishedDomain: string; // e.g., "mysite.keystoneweb.ca"
}

/**
 * POST /api/sites/publish
 * Publish a site to the web with a custom subdomain
 * 
 * Requirements:
 * - User must be authenticated
 * - User must own the site
 * - Site must have active subscription
 * - Domain must be available
 * 
 * Returns:
 * {
 *   success: true,
 *   siteId: string,
 *   publishedDomain: string,
 *   publicUrl: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: PublishRequest = await request.json();
    const { siteId, publishedDomain } = body;

    if (!siteId || !publishedDomain) {
      return NextResponse.json(
        { error: 'Missing required fields: siteId, publishedDomain' },
        { status: 400 }
      );
    }

    // Fetch site and verify ownership
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id, user_id, subscription_status, subscription_plan, published_domain')
      .eq('id', siteId)
      .single();

    if (siteError || !site) {
      return NextResponse.json(
        { error: 'Site not found' },
        { status: 404 }
      );
    }

    // Verify user owns the site
    if (site.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this site' },
        { status: 403 }
      );
    }

    // Verify subscription is active
    if (site.subscription_status !== 'active') {
      return NextResponse.json(
        { error: 'Subscription required to publish' },
        { status: 402 } // Payment Required
      );
    }

    // Check if domain is already taken (by another site)
    if (site.published_domain !== publishedDomain) {
      const { data: existingDomain, error: domainError } = await supabase
        .from('sites')
        .select('id')
        .eq('published_domain', publishedDomain)
        .neq('id', siteId)
        .single();

      if (!domainError && existingDomain) {
        return NextResponse.json(
          { error: 'Domain is already taken' },
          { status: 409 }
        );
      }
    }

    // Update site with published domain and status
    const { data: updatedSite, error: updateError } = await supabase
      .from('sites')
      .update({
        published_domain: publishedDomain,
        is_published: true,
        published_at: new Date().toISOString(),
      })
      .eq('id', siteId)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to publish site:', updateError);
      return NextResponse.json(
        { error: 'Failed to publish site' },
        { status: 500 }
      );
    }

    console.log(`✅ Site published: ${siteId} → ${publishedDomain}`);

    return NextResponse.json({
      success: true,
      siteId: updatedSite.id,
      publishedDomain: updatedSite.published_domain,
      publicUrl: `https://${updatedSite.published_domain}`,
      message: `Your site is now live at https://${updatedSite.published_domain}`,
    });
  } catch (error) {
    console.error('Error publishing site:', error);
    return NextResponse.json(
      { error: 'Failed to publish site' },
      { status: 500 }
    );
  }
}
