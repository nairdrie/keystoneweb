'use client';

import { useEditorContext } from '@/lib/editor-context';
import BlockRenderer from '@/app/components/blocks/BlockRenderer';
import SiteHeader from '@/app/components/SiteHeader';
import { stripHighlight, renderSiteTitle, parseSiteTitleStyles } from '@/lib/site-title-utils';

interface MasterTemplateProps {
    palette: Record<string, string>;
    isEditMode: boolean;
    children?: React.ReactNode;
}

/**
 * Bold Template — Strong, authoritative.
 * Dark sticky header, bold fonts, high contrast.
 * Perfect for trades, mechanics, HVAC, plumbing.
 */
export function BoldTemplate({ palette, isEditMode, children }: MasterTemplateProps) {
    const context = useEditorContext();
    const siteContent = context?.siteContent || {};
    const updateSiteContent = context?.updateSiteContent || (() => { });

    const pPrimary = palette.primary || '#0f172a';
    const pSecondary = palette.secondary || '#ef4444';
    const pAccent = palette.accent || '#f8fafc';

    const titleFont = siteContent.titleFont || 'Oswald';
    const bodyFont = siteContent.bodyFont || 'Roboto';

    return (
        <div className="template-wrapper min-h-screen" style={{ backgroundColor: pAccent, fontFamily: `"${bodyFont}", sans-serif` }}>
            <style dangerouslySetInnerHTML={{
                __html: `
                @import url('https://fonts.googleapis.com/css2?family=${titleFont.replace(/ /g, '+')}:wght@400;500;600;700;800;900&family=${bodyFont.replace(/ /g, '+')}:wght@400;500;600;700&display=swap');
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
                    bgType: 'primary',
                    borderClass: 'shadow-lg',
                    sticky: true,
                    containerClass: 'max-w-7xl',
                    navItemClass: 'text-sm font-semibold text-white/80 hover:text-white transition-colors tracking-wide uppercase',
                    mobileNavItemClass: 'text-sm font-semibold text-white/80 hover:text-white py-2 px-2 rounded-md hover:bg-white/5 transition-colors',
                    submenuClass: 'bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl',
                    mobileBorderClass: 'border-white/10',
                    logoSize: 32,
                    logoClass: 'rounded-md',
                    logoStyleFn: (p) => ({ backgroundColor: p.secondary, color: '#ffffff' }),
                    defaultCtaLabel: 'Get Quote',
                    ctaClass: 'px-5 py-2 rounded-md font-bold text-sm transition-all hover:scale-105 text-white cursor-pointer inline-flex items-center justify-center',
                    ctaStyleFn: (p) => ({ backgroundColor: p.secondary }),
                }}
            />

            {/* Page Content */}
            <main className="flex-1 w-full flex flex-col min-h-[50vh]">
                <BlockRenderer palette={palette} />
            </main>

            {/* Footer */}
            <footer className="py-12 text-white" style={{ backgroundColor: pPrimary }}>
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            {siteContent.showFooterLogo !== false && ((siteContent.footerLogo || siteContent.siteLogo) ? (
                                <img src={siteContent.footerLogo || siteContent.siteLogo} alt="" className="w-6 h-6 object-contain"  style={{ height: siteContent.footerLogoHeight ? `${siteContent.footerLogoHeight}px` : undefined, width: siteContent.footerLogoHeight ? 'auto' : undefined }} />
                            ) : (
                                <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-black text-white" style={{ backgroundColor: pSecondary }}>
                                    {(stripHighlight(siteContent.siteTitle) || 'B')[0]?.toUpperCase()}
                                </div>
                            ))}
                            <span className="font-bold text-sm" style={{ ...parseSiteTitleStyles(siteContent['siteTitle__styles']) }}>{renderSiteTitle(siteContent.siteTitle || 'Your Business')}</span>
                        </div>
                        <p className="text-sm text-white/50">
                            Powered by <a href="https://keystoneweb.ca" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80 transition-opacity">Keystone</a>
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
