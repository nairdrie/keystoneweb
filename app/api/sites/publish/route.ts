import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { trackEvent } from '@/lib/analytics';
import { getPlanByName } from '@/lib/plans';
import { getUserEffectiveLimits } from '@/lib/addons';

interface PublishRequest {
  siteId: string;
  publishedDomain: string; // e.g., "mysite.keystoneweb.ca"
  reattachCustomDomain?: string; // domain from domain_purchases to reattach to sites.custom_domain
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
    let { siteId, publishedDomain, reattachCustomDomain } = body;

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
      .select('subscription_status, subscription_plan')
      .eq('user_id', user.id)
      .single();

    if (!subscription || subscription.subscription_status !== 'active') {
      return NextResponse.json(
        { error: 'Subscription required to publish' },
        { status: 402 } // Payment Required
      );
    }

    // Enforce publish limit: count currently published sites (excluding this one)
    const plan = getPlanByName(subscription.subscription_plan);
    const effectiveLimits = await getUserEffectiveLimits(user.id, supabase);
    const publishLimit = effectiveLimits.publishLimit;

    const { count: publishedCount } = await supabase
      .from('sites')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_published', true)
      .neq('id', siteId);

    if ((publishedCount ?? 0) >= publishLimit) {
      return NextResponse.json(
        {
          error: 'Publish limit reached',
          publishLimitReached: true,
          plan: plan?.name ?? 'Basic',
          limit: publishLimit,
        },
        { status: 403 }
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

    // Precompute site-wide block flags so page renders don't need to scan all pages
    const hasProductBlock = (pages || []).some((p: any) =>
      ((p.design_data as any)?.blocks || []).some((b: any) => b.type === 'productGrid')
    );
    const hasMembershipBlock = (pages || []).some((p: any) =>
      ((p.design_data as any)?.blocks || []).some((b: any) => b.type === 'membershipGate')
    );

    // Store precomputed flags in site's published_data
    if (hasProductBlock || hasMembershipBlock) {
      const enrichedPublishedData = {
        ...(site.design_data || {}),
        __hasProductBlock: hasProductBlock,
        __hasMembershipBlock: hasMembershipBlock,
      };
      await supabase
        .from('sites')
        .update({ published_data: enrichedPublishedData })
        .eq('id', siteId);
    }

    // Reattach custom domain from domain_purchases if requested
    // This handles the post-transfer scenario where custom_domain was cleared but domain_purchases.site_id stayed linked
    let reattachedDomain: string | null = null;
    if (reattachCustomDomain) {
      // Verify the user is Pro (custom domains require Pro)
      const isPro = subscription.subscription_plan?.toLowerCase().includes('pro');
      if (isPro) {
        // Verify the domain exists in domain_purchases linked to this site and owned by this user
        const { data: domainPurchase } = await supabase
          .from('domain_purchases')
          .select('id, domain, status, transfer_status')
          .eq('site_id', siteId)
          .eq('user_id', user.id)
          .eq('domain', reattachCustomDomain)
          .single();

        if (domainPurchase && (domainPurchase.status === 'completed' || domainPurchase.transfer_status === 'completed')) {
          // Reattach the custom domain to the site
          await supabase
            .from('sites')
            .update({ custom_domain: reattachCustomDomain })
            .eq('id', siteId);

          reattachedDomain = reattachCustomDomain;
          console.log(`✅ Reattached custom domain: ${reattachCustomDomain} → site ${siteId}`);
        } else {
          console.warn(`⚠️ Could not reattach domain ${reattachCustomDomain}: not found or not completed for site ${siteId}`);
        }
      }
    }

    // Record history snapshot (publish event)
    try {
      await supabase.from('site_history').insert({
        site_id: siteId,
        user_id: user.id,
        event_type: 'publish',
        site_design_data: site.design_data || {},
        pages_snapshot: pages || [],
        site_title: updatedSite.site_slug,
        selected_palette: (site.design_data as any)?.__selectedPalette,
      });
    } catch (historyErr) {
      console.error('Failed to record publish history:', historyErr);
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
      publicUrl: reattachedDomain ? `https://${reattachedDomain}` : `https://${fullPublishedDomain}`,
      message: reattachedDomain
        ? `Your site is now live at https://${reattachedDomain}`
        : `Your site is now live at https://${fullPublishedDomain}`,
      reattachedDomain,
    });
  } catch (error) {
    console.error('Error publishing site:', error);
    return NextResponse.json(
      { error: 'Failed to publish site' },
      { status: 500 }
    );
  }
}
