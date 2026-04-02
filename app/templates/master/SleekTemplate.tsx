'use client';

import { useEditorContext } from '@/lib/editor-context';
import BlockRenderer from '@/app/components/blocks/BlockRenderer';
import SiteHeader from '@/app/components/SiteHeader';

interface MasterTemplateProps {
    palette: Record<string, string>;
    isEditMode: boolean;
    children?: React.ReactNode;
}

/**
 * Sleek Template — Ultra-minimal, bold typography.
 * Thin header, massive type, monochrome + single accent, generous whitespace.
 * Perfect for freelancers, agencies, consulting, digital products, portfolios.
 */
export function SleekTemplate({ palette, isEditMode, children }: MasterTemplateProps) {
    const context = useEditorContext();
    const siteContent = context?.siteContent || {};
    const updateSiteContent = context?.updateSiteContent || (() => { });

    const pPrimary = palette.primary || '#111111';
    const pSecondary = palette.secondary || '#6366f1';
    const pAccent = palette.accent || '#ffffff';

    const titleFont = siteContent.titleFont || 'Sora';
    const bodyFont = siteContent.bodyFont || 'Inter';

    return (
        <div className="template-wrapper min-h-screen" style={{ backgroundColor: pAccent, fontFamily: `"${bodyFont}", sans-serif` }}>
            <style dangerouslySetInnerHTML={{
                __html: `
                @import url('https://fonts.googleapis.com/css2?family=${titleFont.replace(/ /g, '+')}:wght@400;500;600;700;800&family=${bodyFont.replace(/ /g, '+')}:wght@400;500;600;700&display=swap');
                .template-wrapper h1, .template-wrapper h2, .template-wrapper h3, .template-wrapper h4, .template-wrapper h5, .template-wrapper h6 {
                    font-family: "${titleFont}", sans-serif !important;
                }
                .template-wrapper .font-title {
                    font-family: "${titleFont}", sans-serif;
                }
            `}} />

            <SiteHeader
                palette={palette}
                isEditMode={isEditMode}
                defaults={{
                    bgType: 'white',
                    bgClass: 'bg-white/95 backdrop-blur-md',
                    sticky: true,
                    containerClass: 'max-w-7xl',
                    navItemClass: 'text-sm text-gray-400 hover:text-gray-900 transition-colors',
                    mobileNavItemClass: 'text-sm text-gray-400 hover:text-gray-900 py-2 px-2 transition-colors',
                    submenuClass: 'bg-white/95 backdrop-blur-md border border-gray-100 shadow-lg',
                    logoSize: 28,
                    logoClass: 'rounded-sm',
                    logoStyleFn: (p) => ({ backgroundColor: p.primary, color: '#ffffff' }),
                    defaultCtaLabel: 'Contact',
                    ctaClass: 'px-5 py-1.5 rounded-sm text-white text-sm font-medium transition-all hover:opacity-90 cursor-pointer inline-flex items-center justify-center',
                    ctaStyleFn: (p, light) => light
                        ? { backgroundColor: 'rgba(255,255,255,0.2)', color: '#ffffff' }
                        : { backgroundColor: p.primary },
                }}
            />

            <main className="flex-1 w-full flex flex-col min-h-[50vh]">
                {children || <BlockRenderer palette={palette} />}
            </main>

            {/* Footer — dead simple */}
            <footer className="py-8 border-t border-gray-100">
                <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {siteContent.showFooterLogo !== false && ((siteContent.footerLogo || siteContent.siteLogo) ? (
                            <img
                                src={siteContent.footerLogo || siteContent.siteLogo}
                                alt={siteContent.siteTitle || 'Logo'}
                                className="w-6 h-6 object-contain"
                             style={{ height: siteContent.footerLogoHeight ? `${siteContent.footerLogoHeight}px` : undefined, width: siteContent.footerLogoHeight ? 'auto' : undefined }} />
                        ) : (
                            <div className="w-6 h-6 rounded-sm flex items-center justify-center font-bold text-[10px] text-white" style={{ backgroundColor: pPrimary }}>
                                {(siteContent.siteTitle || 'S')[0]?.toUpperCase()}
                            </div>
                        ))}
                        <span className="text-sm font-medium" style={{ color: pPrimary }}>{siteContent.siteTitle || 'Sleek'}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <p className="text-xs text-gray-300">
                            &copy; {new Date().getFullYear()}
                        </p>
                        <p className="text-[10px] text-gray-400">
                            Powered by <a href="https://keystoneweb.ca" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80 transition-opacity">Keystone</a>
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
