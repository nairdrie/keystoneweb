import { createClient } from '@/lib/db/supabase-server';
import { notFound } from 'next/navigation';
import EditorContent from '@/app/(app)/editor/editor-content-v2';
import SiteAnalyticsTracker from '@/app/components/SiteAnalyticsTracker';
import { getTemplateComponent } from '@/app/templates/registry';
import { getTemplateMetadata } from '@/lib/db/template-queries';
import JsonLdScript from '@/app/components/JsonLdScript';
import { BusinessProfile } from '@/lib/types/sites';
import { fetchTranslationsConfig } from '@/lib/translations/resolve';
import { extractTestimonials } from '@/lib/seo/testimonials';
import type { Block, SocialLinks } from '@/lib/seo/jsonld';

export const dynamic = 'force-dynamic'; // Always fetch fresh data

export default async function PublicSitePage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;

  try {
    const supabase = await createClient();

    // Fetch the published site by subdomain
    const { data: site, error } = await supabase
      .from('sites')
      .select('id, selected_template_id, published_data, business_profile, translations_config')
      .eq('published_domain', subdomain)
      .eq('is_published', true)
      .single();

    if (error || !site) {
      notFound();
    }

    // Fetch the home page's published data which contains the actual blocks
    const { data: homePage } = await supabase
      .from('pages')
      .select('published_data')
      .eq('site_id', site.id)
      .eq('slug', 'home')
      .single();

    // The page's published_data holds the blocks. If not yet published at the page level, fall back to site.published_data
    const pagePublishData = homePage?.published_data || {};
    const sitePublishData = site.published_data || {};

    // Fetch all pages for navigation links (lightweight: no published_data needed)
    const { data: allPages } = await supabase
      .from('pages')
      .select('id, slug, title')
      .eq('site_id', site.id);

    // Use precomputed flags from publish time, falling back to false for older sites
    const hasProductBlock = !!(sitePublishData as any).__hasProductBlock;
    const hasMembershipBlock = !!(sitePublishData as any).__hasMembershipBlock;
    const hasChatSupportBlock = !!(sitePublishData as any).__hasChatSupportBlock;

    const translationsConfig = site.translations_config as any;
    const mergedPublishData = {
      ...sitePublishData,
      ...pagePublishData,
      __pages: (allPages || []).map(({ id, slug, title }: any) => ({ id, slug, title })),
      __currentLanguage: translationsConfig?.defaultLanguage || 'en',
      __translationsConfig: translationsConfig || null,
      __hasProductBlock: hasProductBlock,
      __hasMembershipBlock: hasMembershipBlock,
      __hasChatSupportBlock: hasChatSupportBlock,
    };

    // Preload template component and metadata for SSR
    const TemplateComp = await getTemplateComponent(site.selected_template_id);
    const metadata = await getTemplateMetadata(site.selected_template_id);

    // Resolve palette from site-level data only (not page overrides) for consistency across pages
    let paletteData: Record<string, string> = {};
    if (metadata) {
      const palettesObj = metadata.palettes || {};
      const requestedPalette = sitePublishData.__selectedPalette || 'default';
      if (requestedPalette === 'custom') {
        const defaultPalette = palettesObj['default'] || {};
        paletteData = {
          primary: sitePublishData.__customPalette_primary || defaultPalette.primary || '',
          secondary: sitePublishData.__customPalette_secondary || defaultPalette.secondary || '',
          accent: sitePublishData.__customPalette_accent || defaultPalette.accent || '',
        };
      } else {
        paletteData = palettesObj[requestedPalette] || palettesObj['default'] || {};
      }
    }

    // Render the published site via unified EditorContent (read-only mode)
    const siteUrl = `https://${subdomain}.kswd.ca`;
    const pageBlocks = Array.isArray((mergedPublishData as { blocks?: unknown[] }).blocks)
      ? (mergedPublishData as { blocks: Block[] }).blocks
      : [];

    return (
      <>
        <JsonLdScript
          businessProfile={site.business_profile as BusinessProfile | null}
          siteUrl={siteUrl}
          pageUrl={siteUrl}
          socialLinks={(mergedPublishData as { socialLinks?: SocialLinks }).socialLinks}
          testimonials={extractTestimonials(mergedPublishData)}
          blocks={pageBlocks}
          pageTitle={(mergedPublishData as { seoTitle?: string; siteTitle?: string }).seoTitle || (mergedPublishData as { siteTitle?: string }).siteTitle}
          pageDescription={(mergedPublishData as { seoDescription?: string }).seoDescription}
          isHomePage
        />
        <SiteAnalyticsTracker siteId={site.id} />
        <EditorContent
          isPublicView={true}
          publicSiteData={{
            id: site.id,
            userId: null,
            selectedTemplateId: site.selected_template_id,
            businessType: '',
            category: '',
            designData: mergedPublishData,
            isPublished: true,
            createdAt: '',
            updatedAt: ''
          }}
          precomputedPalette={paletteData}
        >
          {TemplateComp && <TemplateComp palette={paletteData} isEditMode={false} />}
        </EditorContent>
      </>
    );
  } catch (error) {
    // Don't swallow Next.js control-flow errors (redirect/notFound).
    const digest = (error as { digest?: unknown } | null)?.digest;
    if (typeof digest === 'string' && (digest.startsWith('NEXT_REDIRECT') || digest.startsWith('NEXT_NOT_FOUND'))) {
      throw error;
    }
    console.error('Error rendering published site:', error);
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Error Loading Site</h1>
          <p className="text-slate-600">
            Something went wrong while loading your site.
          </p>
        </div>
      </div>
    );
  }
}
