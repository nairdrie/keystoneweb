import { createClient } from '@/lib/db/supabase-server';
import EditorContent from '@/app/(app)/editor/editor-content-v2';
import { getTemplateComponent } from '@/app/templates/registry';
import { getTemplateMetadata } from '@/lib/db/template-queries';

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
      .select('id, selected_template_id, published_data')
      .eq('published_domain', subdomain)
      .eq('is_published', true)
      .single();

    if (error || !site) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-slate-900 mb-4">Site Not Found</h1>
            <p className="text-slate-600">
              The site at <code className="bg-slate-100 px-2 py-1 rounded">{subdomain}.kswd.ca</code> is not public or does not exist.
            </p>
          </div>
        </div>
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

    // Fetch all pages for navigation links
    const { data: allPages } = await supabase
      .from('pages')
      .select('id, slug, title')
      .eq('site_id', site.id);

    const mergedPublishData = {
      ...sitePublishData,
      ...pagePublishData,
      __pages: allPages || []
    };

    // Preload template component and metadata for SSR
    const TemplateComp = await getTemplateComponent(site.selected_template_id);
    const metadata = await getTemplateMetadata(site.selected_template_id);

    let paletteData = {};
    if (metadata) {
      const palettesObj = metadata.palettes || {};
      const requestedPalette = mergedPublishData.__selectedPalette || 'default';
      paletteData = palettesObj[requestedPalette] || palettesObj['default'] || {};
    }

    // Render the published site via unified EditorContent (read-only mode)
    return (
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
    );
  } catch (error) {
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
