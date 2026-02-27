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
    console.log('[Publish API] ===== PUBLISH REQUEST START =====');
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[Publish API] Auth error:', authError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log(`[Publish API] User authenticated: ${user.id}`);

    const body: PublishRequest = await request.json();
    const { siteId, publishedDomain } = body;

    console.log(`[Publish API] Request: siteId=${siteId}, publishedDomain=${publishedDomain}`);

    if (!siteId || !publishedDomain) {
      return NextResponse.json(
        { error: 'Missing required fields: siteId, publishedDomain' },
        { status: 400 }
      );
    }

    // Fetch site and verify ownership
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id, user_id, published_domain')
      .eq('id', siteId)
      .single();

    if (siteError || !site) {
      console.error(`[Publish API] Site fetch error: ${siteError?.code} - ${siteError?.message}`);
      return NextResponse.json(
        { error: 'Site not found', details: siteError },
        { status: 404 }
      );
    }

    console.log(`[Publish API] Site found: ${site.id}, owned by ${site.user_id}`);

    // Verify user owns the site
    if (site.user_id !== user.id) {
      console.error(`[Publish API] Ownership mismatch: ${site.user_id} !== ${user.id}`);
      return NextResponse.json(
        { error: 'Forbidden: You do not own this site' },
        { status: 403 }
      );
    }

    // Verify subscription is active (check both user_subscriptions and sites table)
    console.log(`[Publish API] Checking subscription for user ${user.id}`);
    
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('subscription_status')
      .eq('user_id', user.id)
      .single();

    if (subError) {
      console.log(`[Publish API] user_subscriptions query error: ${subError.code} - ${subError.message}`);
      // Fall back to checking sites table
      const { data: siteWithSub } = await supabase
        .from('sites')
        .select('subscription_status')
        .eq('user_id', user.id)
        .eq('subscription_status', 'active')
        .limit(1);
      
      if (!siteWithSub || siteWithSub.length === 0) {
        console.log(`[Publish API] No active subscription found for user ${user.id}`);
        return NextResponse.json(
          { error: 'Subscription required to publish' },
          { status: 402 }
        );
      }
      console.log(`[Publish API] Active subscription found in sites table`);
    } else if (!subscription || subscription.subscription_status !== 'active') {
      console.log(`[Publish API] Subscription not active: ${subscription?.subscription_status}`);
      return NextResponse.json(
        { error: 'Subscription required to publish' },
        { status: 402 }
      );
    } else {
      console.log(`[Publish API] ✅ Subscription is active`);
    }

    // Check if domain is already taken (by another site)
    if (site.published_domain !== publishedDomain) {
      console.log(`[Publish API] Checking domain availability: ${publishedDomain}`);
      const { data: existingDomain, error: domainError } = await supabase
        .from('sites')
        .select('id')
        .eq('published_domain', publishedDomain)
        .neq('id', siteId);

      if (existingDomain && existingDomain.length > 0) {
        console.error(`[Publish API] Domain already taken: ${publishedDomain}`);
        return NextResponse.json(
          { error: 'Domain is already taken' },
          { status: 409 }
        );
      }
      console.log(`[Publish API] ✅ Domain available: ${publishedDomain}`);
    }

    // Update site with published domain and status
    console.log(`[Publish API] Updating site ${siteId} with domain ${publishedDomain}...`);
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
      console.error(`[Publish API] Update failed: ${updateError.code} - ${updateError.message}`);
      return NextResponse.json(
        { error: 'Failed to publish site', details: updateError },
        { status: 500 }
      );
    }

    console.log(`[Publish API] ✅ Site published: ${siteId} → ${publishedDomain}`);
    console.log('[Publish API] ===== PUBLISH REQUEST END =====');

    return NextResponse.json({
      success: true,
      siteId: updatedSite.id,
      publishedDomain: updatedSite.published_domain,
      publicUrl: `https://${updatedSite.published_domain}`,
      message: `Your site is now live at https://${updatedSite.published_domain}`,
    });
  } catch (error) {
    console.error('[Publish API] Catch error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Failed to publish site', details: msg },
      { status: 500 }
    );
  }
}
