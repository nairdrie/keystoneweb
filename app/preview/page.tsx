import { createClient } from '@/lib/db/supabase-server';
import EditorContent from '@/app/(app)/editor/editor-content-v2';
import { getTemplateComponent } from '@/app/templates/registry';
import { getTemplateMetadata } from '@/lib/db/template-queries';
import { ExternalLink } from 'lucide-react';
import Image from 'next/image';
import KeystoneLogoImage from '@/assets/logo/keystone-logo.png';

export const dynamic = 'force-dynamic';

export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string; pageId?: string }>;
}) {
  const { siteId, pageId } = await searchParams;

  if (!siteId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">No site specified</h1>
          <p className="text-slate-500">A <code>siteId</code> query parameter is required.</p>
        </div>
      </div>
    );
  }

  try {
    const supabase = await createClient();

    // Fetch the site by ID — no auth check, no is_published check (publicly accessible draft preview)
    const { data: site, error } = await supabase
      .from('sites')
      .select('id, selected_template_id, design_data, translations_config')
      .eq('id', siteId)
      .is('deleted_at', null)
      .single();

    if (error || !site) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Preview not found</h1>
            <p className="text-slate-500">This site doesn&apos;t exist or the preview link is invalid.</p>
          </div>
        </div>
      );
    }

    // Fetch all pages for navigation
    const { data: allPages } = await supabase
      .from('pages')
      .select('id, slug, title, design_data')
      .eq('site_id', site.id);

    // Determine which page to show: use pageId param if provided, else fall back to home
    let currentPageData: Record<string, any> = {};
    if (pageId && allPages) {
      const targetPage = allPages.find((p: any) => p.id === pageId);
      currentPageData = targetPage?.design_data || {};
    } else if (allPages) {
      const homePage = allPages.find((p: any) => p.slug === 'home');
      currentPageData = homePage?.design_data || {};
    }

    const siteDesignData = site.design_data || {};

    const hasProductBlock = (allPages || []).some((p: any) =>
      (p.design_data?.blocks || []).some((b: any) => b.type === 'productGrid')
    );
    const hasMembershipBlock = (allPages || []).some((p: any) =>
      (p.design_data?.blocks || []).some((b: any) => b.type === 'membershipGate')
    );

    const translationsConfig = site.translations_config as any;
    const mergedDesignData = {
      ...siteDesignData,
      ...currentPageData,
      __pages: (allPages || []).map(({ id, slug, title }: any) => ({ id, slug, title })),
      __currentLanguage: translationsConfig?.defaultLanguage || 'en',
      __translationsConfig: translationsConfig || null,
      __hasProductBlock: hasProductBlock,
      __hasMembershipBlock: hasMembershipBlock,
    };

    const TemplateComp = await getTemplateComponent(site.selected_template_id);
    const metadata = await getTemplateMetadata(site.selected_template_id);

    let paletteData: Record<string, string> = {};
    if (metadata) {
      const palettesObj = metadata.palettes || {};
      const requestedPalette = siteDesignData.__selectedPalette || 'default';
      if (requestedPalette === 'custom') {
        const defaultPalette = palettesObj['default'] || {};
        paletteData = {
          primary: siteDesignData.__customPalette_primary || defaultPalette.primary || '',
          secondary: siteDesignData.__customPalette_secondary || defaultPalette.secondary || '',
          accent: siteDesignData.__customPalette_accent || defaultPalette.accent || '',
        };
      } else {
        paletteData = palettesObj[requestedPalette] || palettesObj['default'] || {};
      }
    }

    return (
      <div className="flex flex-col min-h-screen">
        {/* Preview banner */}
        <div className="sticky top-0 z-[9999] flex items-center justify-between gap-3 px-4 py-2 bg-slate-900 text-white text-sm shadow-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <Image src={KeystoneLogoImage} alt="Keystone" width={80} height={20} className="shrink-0 rounded" />
            <span className="font-medium text-slate-100 shrink-0">Site Preview</span>
            <span className="text-slate-400 hidden sm:block truncate">
              This is a draft preview — not the published site.
            </span>
          </div>
          <a
            href="https://keystoneweb.ca"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 shrink-0 text-slate-300 hover:text-white transition-colors text-xs font-medium"
          >
            Build your own
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Site content rendered in read-only mode using draft data */}
        <div className="flex-1">
          <EditorContent
            isPublicView={true}
            isPreviewView={true}
            publicSiteData={{
              id: site.id,
              userId: null,
              selectedTemplateId: site.selected_template_id,
              businessType: '',
              category: '',
              designData: mergedDesignData,
              isPublished: false,
              createdAt: '',
              updatedAt: '',
            }}
            precomputedPalette={paletteData}
          >
            {TemplateComp && <TemplateComp palette={paletteData} isEditMode={false} />}
          </EditorContent>
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error rendering site preview:', error);
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Error loading preview</h1>
          <p className="text-slate-500">Something went wrong. Please try again.</p>
        </div>
      </div>
    );
  }
}
