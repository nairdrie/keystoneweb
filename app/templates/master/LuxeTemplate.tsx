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
 * Luxe Template — Sophisticated, high-end.
 * Centered logo above nav, serif fonts, warm/gold accents.
 * Perfect for salons, consulting, creative studios, boutique shops.
 */
export function LuxeTemplate({ palette, isEditMode, children }: MasterTemplateProps) {
    const context = useEditorContext();
    const siteContent = context?.siteContent || {};
    const updateSiteContent = context?.updateSiteContent || (() => { });

    const pPrimary = palette.primary || '#1c1917';
    const pSecondary = palette.secondary || '#b45309';
    const pAccent = palette.accent || '#fef7ed';

    const titleFont = siteContent.titleFont || 'Playfair Display';
    const bodyFont = siteContent.bodyFont || 'Lato';

    return (
        <div className="template-wrapper min-h-screen" style={{ backgroundColor: '#ffffff', fontFamily: `"${bodyFont}", sans-serif` }}>
            <style dangerouslySetInnerHTML={{
                __html: `
                @import url('https://fonts.googleapis.com/css2?family=${titleFont.replace(/ /g, '+')}:wght@400;500;600;700;800;900&family=${bodyFont.replace(/ /g, '+')}:wght@300;400;500;600;700&display=swap');
                .template-wrapper h1, .template-wrapper h2, .template-wrapper h3, .template-wrapper h4, .template-wrapper h5, .template-wrapper h6 {
                    font-family: "${titleFont}", serif !important;
                }
                .template-wrapper .font-title {
                    font-family: "${titleFont}", serif;
                }
            `}} />

            <SiteHeader
                palette={palette}
                isEditMode={isEditMode}
                defaults={{
                    layout: 'centeredAboveNav',
                    bgType: 'white',
                    bgClass: 'bg-white',
                    borderClass: 'border-b border-gray-100',
                    sticky: false,
                    containerClass: 'max-w-6xl',
                    navItemClass: 'text-xs font-medium tracking-[0.15em] uppercase text-gray-500 hover:text-gray-900 transition-colors',
                    mobileNavItemClass: 'text-xs font-medium tracking-[0.15em] uppercase text-gray-500 hover:text-gray-900 py-2 transition-colors',
                    logoSize: 48,
                    logoClass: 'rounded-full',
                    logoStyleFn: (p) => ({ backgroundColor: p.secondary, color: '#ffffff' }),
                    defaultCtaLabel: 'Reserve',
                    ctaClass: 'px-6 py-1.5 border-2 text-xs font-semibold tracking-[0.15em] uppercase transition-all cursor-pointer inline-flex items-center justify-center',
                    ctaStyleFn: (p, light) => light
                        ? { borderColor: '#ffffff', color: '#ffffff', backgroundColor: 'transparent' }
                        : { borderColor: p.secondary, color: p.secondary, backgroundColor: 'transparent' },
                }}
            />

            <main className="flex-1 w-full flex flex-col min-h-[50vh]">
                {children || <BlockRenderer palette={palette} />}
            </main>

            {/* Footer — elegant with columns */}
            <footer className="py-16 border-t border-gray-100" style={{ backgroundColor: pPrimary }}>
                <div className="max-w-6xl mx-auto px-6 text-center">
                    <div className="flex flex-col items-center gap-4 mb-4">
                        {siteContent.showFooterLogo !== false && ((siteContent.footerLogo || siteContent.siteLogo) ? (
                            <img src={siteContent.footerLogo || siteContent.siteLogo} alt="" className="w-10 h-10 object-contain"  style={{ height: siteContent.footerLogoHeight ? `${siteContent.footerLogoHeight}px` : undefined, width: siteContent.footerLogoHeight ? 'auto' : undefined }} />
                        ) : (
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: pSecondary }}>
                                {(stripHighlight(siteContent.siteTitle) || 'L')[0]?.toUpperCase()}
                            </div>
                        ))}
                        <div className="text-2xl font-bold tracking-[0.2em] uppercase font-title text-white/90" style={{ ...parseSiteTitleStyles(siteContent['siteTitle__styles']) }}>
                            {renderSiteTitle(siteContent.siteTitle || 'LUXE STUDIO')}
                        </div>
                    </div>
                    <div className="w-12 border-t mx-auto mb-6" style={{ borderColor: pSecondary }} />
                    <p className="text-sm text-white/40">
                        Powered by <a href="https://keystoneweb.ca" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80 transition-opacity">Keystone</a>
                    </p>
                </div>
            </footer>
        </div>
    );
}
