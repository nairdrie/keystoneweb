import { NextRequest, NextResponse } from 'next/server';
import { trackEvent } from '@/lib/analytics';
import { getPlanByName } from '@/lib/plans';
import { getUserEffectiveLimits } from '@/lib/addons';
import { getTemplateMetadata } from '@/lib/db/template-queries';
import { migratePaletteTokensInDesignData } from '@/lib/template-palette-migration';
import { submitIndexNow } from '@/lib/seo/indexnow';
import { requireSiteAccess, siteAccessErrorResponse } from '@/lib/auth/site-access';
import { ensureKswdInboxAddress } from '@/lib/email/inbox-addresses';

interface PublishRequest {
  siteId: string;
  publishedDomain: string; // e.g., "mysite.keystoneweb.ca"
  reattachCustomDomain?: string; // domain from domain_purchases to reattach to sites.custom_domain
}

type DesignData = Record<string, unknown>;
type PagePublishData = {
  id: string;
  design_data: DesignData;
};

function asDesignData(value: unknown): DesignData {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as DesignData
    : {};
}

function getSelectedPalette(designData: DesignData): string | undefined {
  return typeof designData.__selectedPalette === 'string'
    ? designData.__selectedPalette
    : undefined;
}

function pageHasBlockType(page: PagePublishData, blockType: string): boolean {
  const blocks = page.design_data.blocks;
  if (!Array.isArray(blocks)) return false;

  return blocks.some((block) => (
    block &&
    typeof block === 'object' &&
    'type' in block &&
    block.type === blockType
  ));
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
    const body: PublishRequest = await request.json();
    const { siteId, publishedDomain, reattachCustomDomain } = body;

    if (!siteId || !publishedDomain) {
      return NextResponse.json(
        { error: 'Missing required fields: siteId, publishedDomain' },
        { status: 400 }
      );
    }

    let access;
    try {
      access = await requireSiteAccess(siteId, request);
    } catch (e) {
      return siteAccessErrorResponse(e);
    }
    const { supabase, targetUserId } = access;

    // Extract just the subdomain from the full domain
    // e.g., "akdesigns.kswd.ca" → "akdesigns"
    const subdomain = publishedDomain.split('.')[0];

    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id, user_id, published_domain, selected_template_id, design_data, translations_config, translations')
      .eq('id', siteId)
      .single();

    if (siteError || !site) {
      console.error('Supabase fetch error for site:', siteError, 'Site object:', site);
      return NextResponse.json(
        { error: 'Site not found', details: siteError },
        { status: 404 }
      );
    }

    // Subscription is the OWNER's, not the acting admin's.
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('subscription_status, subscription_plan')
      .eq('user_id', targetUserId)
      .single();

    if (!subscription || subscription.subscription_status !== 'active') {
      return NextResponse.json(
        { error: 'Subscription required to publish' },
        { status: 402 } // Payment Required
      );
    }

    // Enforce publish limit: count currently published sites (excluding this one)
    const plan = getPlanByName(subscription.subscription_plan);
    const effectiveLimits = await getUserEffectiveLimits(targetUserId, supabase);
    const publishLimit = effectiveLimits.publishLimit;

    const { count: publishedCount } = await supabase
      .from('sites')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', targetUserId)
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

    let siteDesignDataForPublish = asDesignData(site.design_data);
    let templatePalettes: Record<string, Record<string, string>> | null = null;
    try {
      const metadata = await getTemplateMetadata(site.selected_template_id);
      templatePalettes = metadata?.palettes || null;
      if (templatePalettes) {
        const migration = migratePaletteTokensInDesignData(
          siteDesignDataForPublish,
          templatePalettes,
          getSelectedPalette(siteDesignDataForPublish),
        );
        siteDesignDataForPublish = migration.data;

        if (migration.changed) {
          await supabase
            .from('sites')
            .update({ design_data: siteDesignDataForPublish })
            .eq('id', siteId);
        }
      }
    } catch (migrationErr) {
      console.error('Error migrating site palette tokens before publish:', migrationErr);
    }

    // Update site with published domain (just subdomain) and status
    const { data: updatedSite, error: updateError } = await supabase
      .from('sites')
      .update({
        published_domain: subdomain,
        is_published: true,
        published_at: new Date().toISOString(),
        published_data: siteDesignDataForPublish,
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

    // Provision the free <slug>@kswd.ca inbox row so contact-form submissions
    // and inbound mail land on a real primary address from the first request,
    // instead of orphaning with inbox_address_id=null until the owner opens
    // the inbox for the first time.
    try {
      await ensureKswdInboxAddress(supabase, siteId, subdomain);
    } catch (err) {
      console.error('Failed to provision kswd inbox address on publish:', err);
    }

    // Publish all pages by copying their design_data to published_data
    const { data: pages } = await supabase
      .from('pages')
      .select('id, design_data')
      .eq('site_id', siteId);

    const pagesForPublish: PagePublishData[] = [];
    if (pages && pages.length > 0) {
      for (const page of pages) {
        let pageDesignDataForPublish = asDesignData(page.design_data);

        if (templatePalettes) {
          const migration = migratePaletteTokensInDesignData(
            pageDesignDataForPublish,
            templatePalettes,
            getSelectedPalette(siteDesignDataForPublish),
          );
          pageDesignDataForPublish = migration.data;

          if (migration.changed) {
            await supabase
              .from('pages')
              .update({ design_data: pageDesignDataForPublish })
              .eq('id', page.id);
          }
        }

        pagesForPublish.push({ ...page, design_data: pageDesignDataForPublish });

        await supabase
          .from('pages')
          .update({ published_data: pageDesignDataForPublish })
          .eq('id', page.id);
      }
    }

    // Precompute site-wide block flags so page renders don't need to scan all pages
    const hasProductBlock = pagesForPublish.some((page) => pageHasBlockType(page, 'productGrid'));
    const hasMembershipBlock = pagesForPublish.some((page) => pageHasBlockType(page, 'membershipGate'));

    // Store precomputed flags in site's published_data
    if (hasProductBlock || hasMembershipBlock) {
      const enrichedPublishedData = {
        ...siteDesignDataForPublish,
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
          .eq('user_id', targetUserId)
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

    // Record history snapshot (publish event) — recorded against the owner so
    // it appears in their history list (site_history RLS is owner-only).
    try {
      await supabase.from('site_history').insert({
        site_id: siteId,
        user_id: targetUserId,
        event_type: 'publish',
        site_design_data: siteDesignDataForPublish,
        pages_snapshot: pagesForPublish,
        site_title: updatedSite.site_slug,
        selected_palette: getSelectedPalette(siteDesignDataForPublish),
      });
    } catch (historyErr) {
      console.error('Failed to record publish history:', historyErr);
    }

    const fullPublishedDomain = `${updatedSite.published_domain}.kswd.ca`;
    console.log(`✅ Site published: ${siteId} → ${fullPublishedDomain}`);

    trackEvent('site_publish', {
      userId: targetUserId,
      siteId,
      metadata: { domain: fullPublishedDomain },
    });

    // Fire-and-forget IndexNow ping so Bing/Yandex pick up the new content
    // immediately. Sitemap is included so any reverse-lookup also works.
    void (async () => {
      try {
        const host = reattachedDomain || fullPublishedDomain;
        const baseUrl = `https://${host}`;
        const { data: allPagesForPing } = await supabase
          .from('pages')
          .select('slug')
          .eq('site_id', siteId);
        const urls = [
          baseUrl,
          `${baseUrl}/sitemap.xml`,
          ...(allPagesForPing || [])
            .filter(p => p.slug && p.slug !== 'home')
            .map(p => `${baseUrl}/${p.slug}`),
        ];
        const result = await submitIndexNow({ host, urls, siteId });
        if (!result.ok) console.warn('[publish] IndexNow ping failed:', result.error);
      } catch (err) {
        console.warn('[publish] IndexNow ping threw:', err);
      }
    })();

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
