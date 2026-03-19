import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { trackEvent } from '@/lib/analytics';

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
    let { siteId, publishedDomain } = body;

    if (!siteId || !publishedDomain) {
      return NextResponse.json(
        { error: 'Missing required fields: siteId, publishedDomain' },
        { status: 400 }
      );
    }

    // Extract just the subdomain from the full domain
    // e.g., "akdesigns.kswd.ca" → "akdesigns"
    const subdomain = publishedDomain.split('.')[0];

    // Fetch site and verify ownership
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id, user_id, published_domain, design_data, translations_config, translations')
      .eq('id', siteId)
      .single();

    if (siteError || !site) {
      console.error('Supabase fetch error for site:', siteError, 'Site object:', site);
      return NextResponse.json(
        { error: 'Site not found', details: siteError },
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
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('subscription_status')
      .eq('user_id', user.id)
      .single();

    if (!subscription || subscription.subscription_status !== 'active') {
      return NextResponse.json(
        { error: 'Subscription required to publish' },
        { status: 402 } // Payment Required
      );
    }

    // Check if domain is already taken (by another site)
    if (site.published_domain !== subdomain) {
      const { data: existingDomain, error: domainError } = await supabase
        .from('sites')
        .select('id')
        .eq('published_domain', subdomain)
        .neq('id', siteId)
        .single();

      if (!domainError && existingDomain) {
        return NextResponse.json(
          { error: 'Domain is already taken' },
          { status: 409 }
        );
      }
    }

    // Update site with published domain (just subdomain) and status
    const { data: updatedSite, error: updateError } = await supabase
      .from('sites')
      .update({
        published_domain: subdomain,
        is_published: true,
        published_at: new Date().toISOString(),
        published_data: site.design_data || {},
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

    // Publish all pages by copying their design_data to published_data
    const { data: pages } = await supabase
      .from('pages')
      .select('id, design_data')
      .eq('site_id', siteId);

    if (pages && pages.length > 0) {
      for (const page of pages) {
        await supabase
          .from('pages')
          .update({ published_data: page.design_data || {} })
          .eq('id', page.id);
      }
    }

    const fullPublishedDomain = `${updatedSite.published_domain}.kswd.ca`;
    console.log(`✅ Site published: ${siteId} → ${fullPublishedDomain}`);

    trackEvent('site_publish', {
      userId: user.id,
      siteId,
      metadata: { domain: fullPublishedDomain },
    });

    return NextResponse.json({
      success: true,
      siteId: updatedSite.id,
      publishedDomain: updatedSite.published_domain,
      publicUrl: `https://${fullPublishedDomain}`,
      message: `Your site is now live at https://${fullPublishedDomain}`,
    });
  } catch (error) {
    console.error('Error publishing site:', error);
    return NextResponse.json(
      { error: 'Failed to publish site' },
      { status: 500 }
    );
  }
}
