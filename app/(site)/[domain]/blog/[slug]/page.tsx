import { createClient } from '@/lib/db/supabase-server';
import EditorContent from '@/app/(app)/editor/editor-content-v2';
import { getTemplateComponent } from '@/app/templates/registry';
import { getTemplateMetadata } from '@/lib/db/template-queries';
import BlogPostPageClient from './BlogPostPageClient';
import SiteAnalyticsTracker from '@/app/components/SiteAnalyticsTracker';

export const dynamic = 'force-dynamic';

export default async function BlogPostPage({
    params,
}: {
    params: Promise<{ domain: string; slug: string }>;
}) {
    const { domain, slug } = await params;

    try {
        const supabase = await createClient();

        // Fetch the published site by custom domain
        const { data: site, error: siteError } = await supabase
            .from('sites')
            .select('id, selected_template_id, published_data')
            .eq('custom_domain', domain)
            .eq('is_published', true)
            .single();

        if (siteError || !site) {
            return (
                <div className="flex items-center justify-center min-h-screen bg-slate-50">
                    <div className="text-center">
                        <h1 className="text-4xl font-bold text-slate-900 mb-4">Site Not Found</h1>
                    </div>
                </div>
            );
        }

        // Fetch the blog post by slug
        const { data: post, error: postError } = await supabase
            .from('blog_posts')
            .select('*')
            .eq('slug', slug)
            .eq('site_id', site.id)
            .eq('is_published', true)
            .single();

        if (postError || !post) {
            return (
                <div className="flex items-center justify-center min-h-screen bg-slate-50">
                    <div className="text-center">
                        <h1 className="text-4xl font-bold text-slate-900 mb-4">Post Not Found</h1>
                        <a href="/" className="text-blue-600 hover:underline">← Back to site</a>
                    </div>
                </div>
            );
        }

        // Fetch recent posts for "More posts" sidebar
        const { data: recentPosts } = await supabase
            .from('blog_posts')
            .select('id, title, slug, excerpt, cover_image, author, tags, published_at, created_at')
            .eq('site_id', site.id)
            .eq('is_published', true)
            .neq('id', post.id)
            .order('published_at', { ascending: false })
            .limit(4);

        // Get template + palette from homepage
        const { data: homePage } = await supabase
            .from('pages')
            .select('published_data')
            .eq('site_id', site.id)
            .eq('slug', 'home')
            .single();

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

        const TemplateComp = await getTemplateComponent(site.selected_template_id);
        const metadata = await getTemplateMetadata(site.selected_template_id);

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

        return (
            <>
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
                {TemplateComp ? (
                    <TemplateComp palette={paletteData} isEditMode={false}>
                        <BlogPostPageClient
                            post={post}
                            recentPosts={recentPosts || []}
                            palette={paletteData}
                            siteName={mergedPublishData.siteTitle || ''}
                        />
                    </TemplateComp>
                ) : (
                    <BlogPostPageClient
                        post={post}
                        recentPosts={recentPosts || []}
                        palette={paletteData}
                        siteName={mergedPublishData.siteTitle || ''}
                    />
                )}
            </EditorContent>
            </>
        );
    } catch (error) {
        console.error('Error rendering blog post page:', error);
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">Error Loading Post</h1>
                </div>
            </div>
        );
    }
}
