'use client';

import { useEditorContext } from '@/lib/editor-context';
import BlockRenderer from '@/app/components/blocks/BlockRenderer';
import SiteHeader from '@/app/components/SiteHeader';
import { stripHighlight, renderSiteTitle, parseSiteTitleStyles } from '@/lib/site-title-utils';
import { TemplateFonts } from './TemplateFonts';

interface MasterTemplateProps {
    palette: Record<string, string>;
    isEditMode: boolean;
    children?: React.ReactNode;
}

/**
 * Vivid Template — Bold, colorful, energetic.
 * Thick colored header band, chunky sans-serif, asymmetric CTA.
 * Perfect for fitness, ecommerce, agencies, creative businesses.
 */
export function VividTemplate({ palette, isEditMode, children }: MasterTemplateProps) {
    const context = useEditorContext();
    const siteContent = context?.siteContent || {};
    const updateSiteContent = context?.updateSiteContent || (() => { });

    const pPrimary = palette.primary || '#7c3aed';
    const pSecondary = palette.secondary || '#f59e0b';
    const pAccent = palette.accent || '#faf5ff';

    const titleFont = siteContent.titleFont || 'Space Grotesk';
    const bodyFont = siteContent.bodyFont || 'DM Sans';

    return (
        <div className="template-wrapper min-h-screen" style={{ backgroundColor: '#ffffff', fontFamily: `"${bodyFont}", sans-serif` }}>
            <TemplateFonts
                titleFont={titleFont}
                bodyFont={bodyFont}
                titleWeights="400;500;600;700"
                bodyWeights="400;500;600;700"
                fallback="sans-serif"
            />

            <SiteHeader
                palette={palette}
                isEditMode={isEditMode}
                defaults={{
                    bgType: 'primary',
                    sticky: true,
                    containerClass: 'max-w-7xl',
                    navItemClass: 'text-sm font-medium text-white/80 hover:text-white transition-colors',
                    mobileNavItemClass: 'text-sm font-medium text-white/80 hover:text-white py-2 px-2 rounded-lg hover:bg-white/10 transition-colors',
                    submenuClass: 'bg-white/15 backdrop-blur-xl border border-white/20 shadow-xl',
                    mobileBorderClass: 'border-white/20',
                    logoSize: 36,
                    logoClass: 'rounded-lg',
                    logoStyleFn: (p) => ({ backgroundColor: p.secondary, color: p.primary }),
                    defaultCtaLabel: 'Get Started',
                    ctaClass: 'px-6 py-2 rounded-full font-bold text-sm transition-all hover:scale-105 cursor-pointer inline-flex items-center justify-center',
                    ctaStyleFn: (p) => ({ backgroundColor: p.secondary, color: p.primary }),
                }}
            />

            <main className="flex-1 w-full flex flex-col min-h-[50vh]">
                {children || <BlockRenderer palette={palette} />}
            </main>

            {/* Footer — bold with gradient */}
            <footer className="py-16 text-white" style={{ background: `linear-gradient(135deg, ${pPrimary}, ${pPrimary}dd)` }}>
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-3">
                            {siteContent.showFooterLogo !== false && ((siteContent.footerLogo || siteContent.siteLogo) ? (
                                <img src={siteContent.footerLogo || siteContent.siteLogo} alt={siteContent.siteTitle || 'Site logo'} className="w-8 h-8 object-contain"  style={{ height: siteContent.footerLogoHeight ? `${siteContent.footerLogoHeight}px` : undefined, width: siteContent.footerLogoHeight ? 'auto' : undefined }} />
                            ) : (
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm" style={{ backgroundColor: pSecondary, color: pPrimary }}>
                                    {(stripHighlight(siteContent.siteTitle) || 'V')[0]?.toUpperCase()}
                                </div>
                            ))}
                            <span className="font-bold text-lg" style={{ ...parseSiteTitleStyles(siteContent['siteTitle__styles']) }}>{renderSiteTitle(siteContent.siteTitle || 'Vivid Co')}</span>
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
