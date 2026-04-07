import { createClient } from '@/lib/db/supabase-server';
import EditorContent from '@/app/(app)/editor/editor-content-v2';
import { getTemplateComponent } from '@/app/templates/registry';
import { getTemplateMetadata } from '@/lib/db/template-queries';
import JsonLdScript from '@/app/components/JsonLdScript';
import SiteAnalyticsTracker from '@/app/components/SiteAnalyticsTracker';
import { BusinessProfile } from '@/lib/types/sites';
import SiteNotFound from '@/app/components/SiteNotFound';

export const dynamic = 'force-dynamic';

export default async function CustomDomainPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;

  try {
    const supabase = await createClient();

    // Fetch the published site by custom domain
    // We assume there's a custom_domain column in the sites table
    const { data: site, error } = await supabase
      .from('sites')
      .select('id, selected_template_id, published_data, business_profile, translations_config')
      .eq('custom_domain', domain)
      .eq('is_published', true)
      .single();

    if (error || !site) {
      return (
        <SiteNotFound 
          message="The site for this domain is not public or does not exist. Are you the owner?"
          ctaText="Login to manage domain"
          domain={domain}
        />
      );
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

    // Fetch all pages for navigation links (include published_data to detect product blocks site-wide)
    const { data: allPages } = await supabase
      .from('pages')
      .select('id, slug, title, published_data')
      .eq('site_id', site.id);

    const hasProductBlock = (allPages || []).some((p: any) =>
      (p.published_data?.blocks || []).some((b: any) => b.type === 'productGrid')
    );
    const hasMembershipBlock = (allPages || []).some((p: any) =>
      (p.published_data?.blocks || []).some((b: any) => b.type === 'membershipGate')
    );

    const translationsConfig = site.translations_config as any;
    const mergedPublishData = {
      ...sitePublishData,
      ...pagePublishData,
      __pages: (allPages || []).map(({ id, slug, title }: any) => ({ id, slug, title })),
      __currentLanguage: translationsConfig?.defaultLanguage || 'en',
      __translationsConfig: translationsConfig || null,
      __hasProductBlock: hasProductBlock,
      __hasMembershipBlock: hasMembershipBlock,
    };

    // Preload template component and metadata for SSR
    const TemplateComp = await getTemplateComponent(site.selected_template_id);
    const metadata = await getTemplateMetadata(site.selected_template_id);

    let paletteData: Record<string, string> = {};
    if (metadata) {
      const palettesObj = metadata.palettes || {};
      // Prioritize site-level palette settings for consistency across all pages
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
    return (
      <>
        <SiteAnalyticsTracker siteId={site.id} />
        {site.business_profile && (
          <JsonLdScript
            businessProfile={site.business_profile as BusinessProfile}
            siteUrl={`https://${domain}`}
            socialLinks={(mergedPublishData as any).socialLinks}
          />
        )}
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
    console.error('Error rendering custom domain site:', error);
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
