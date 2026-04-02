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
 * Vibrant Template — Playful, colorful, dynamic.
 * Gradient header, rounded nav elements, friendly typography, dynamic color usage.
 * Perfect for fitness, subscription boxes, creative studios, retail, e-commerce.
 */
export function VibrantTemplate({ palette, isEditMode, children }: MasterTemplateProps) {
    const context = useEditorContext();
    const siteContent = context?.siteContent || {};
    const updateSiteContent = context?.updateSiteContent || (() => { });

    const pPrimary = palette.primary || '#e11d48';
    const pSecondary = palette.secondary || '#f97316';
    const pAccent = palette.accent || '#fff1f2';

    const titleFont = siteContent.titleFont || 'Plus Jakarta Sans';
    const bodyFont = siteContent.bodyFont || 'Plus Jakarta Sans';

    return (
        <div className="template-wrapper min-h-screen" style={{ backgroundColor: '#ffffff', fontFamily: `"${bodyFont}", sans-serif` }}>
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
                    bgType: 'gradient',
                    sticky: true,
                    containerClass: 'max-w-7xl',
                    navItemClass: 'text-sm font-medium text-white/80 hover:text-white transition-colors px-3 py-1.5 rounded-full hover:bg-white/10',
                    mobileNavItemClass: 'text-sm font-medium text-white/80 hover:text-white py-2.5 px-4 rounded-xl hover:bg-white/10 transition-colors',
                    submenuClass: 'bg-white/15 backdrop-blur-xl border border-white/20 shadow-xl',
                    mobileBorderClass: 'border-white/20',
                    logoSize: 36,
                    logoClass: 'rounded-xl',
                    logoStyleFn: () => ({ backgroundColor: 'rgba(255,255,255,0.2)', color: '#ffffff' }),
                    defaultCtaLabel: 'Start Free',
                    ctaClass: 'px-6 py-2 rounded-full font-bold text-sm shadow-lg transition-all hover:scale-105 hover:shadow-xl cursor-pointer inline-flex items-center justify-center',
                    ctaStyleFn: (p) => ({ backgroundColor: '#ffffff', color: p.primary }),
                }}
            />

            <main className="flex-1 w-full flex flex-col min-h-[50vh]">
                {children || <BlockRenderer palette={palette} />}
            </main>

            {/* Footer — gradient with rounded card */}
            <footer className="py-16" style={{ background: `linear-gradient(135deg, ${pPrimary}, ${pSecondary})` }}>
                <div className="max-w-6xl mx-auto px-4">
                    <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 text-center">
                        <div className="flex items-center justify-center gap-2 mb-3">
                            {siteContent.showFooterLogo !== false && ((siteContent.footerLogo || siteContent.siteLogo) ? (
                                <img src={siteContent.footerLogo || siteContent.siteLogo} alt="" className="w-7 h-7 object-contain"  style={{ height: siteContent.footerLogoHeight ? `${siteContent.footerLogoHeight}px` : undefined, width: siteContent.footerLogoHeight ? 'auto' : undefined }} />
                            ) : (
                                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-xs font-bold text-white">
                                    {(stripHighlight(siteContent.siteTitle) || 'V')[0]?.toUpperCase()}
                                </div>
                            ))}
                            <span className="font-bold text-white" style={{ ...parseSiteTitleStyles(siteContent['siteTitle__styles']) }}>{renderSiteTitle(siteContent.siteTitle || 'Vibrant Co')}</span>
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
