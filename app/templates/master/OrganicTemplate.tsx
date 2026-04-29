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
 * Organic Template — Warm, natural, handcrafted.
 * Off-white warm background, rounded shapes, earthy tones, friendly feel.
 * Perfect for landscaping, handmade/crafts, salons, freelancers, bakeries.
 */
export function OrganicTemplate({ palette, isEditMode, children }: MasterTemplateProps) {
    const context = useEditorContext();
    const siteContent = context?.siteContent || {};
    const updateSiteContent = context?.updateSiteContent || (() => { });

    const pPrimary = palette.primary || '#78350f';
    const pSecondary = palette.secondary || '#d97706';
    const pAccent = palette.accent || '#fffbeb';

    const titleFont = siteContent.titleFont || 'Libre Baskerville';
    const bodyFont = siteContent.bodyFont || 'Karla';

    return (
        <div className="template-wrapper min-h-screen" style={{ backgroundColor: pAccent, fontFamily: `"${bodyFont}", sans-serif` }}>
            <TemplateFonts
                titleFont={titleFont}
                bodyFont={bodyFont}
                titleWeights="400;700"
                bodyWeights="400;500;600;700"
                fallback="serif"
            />

            <SiteHeader
                palette={palette}
                isEditMode={isEditMode}
                defaults={{
                    bgType: 'white',
                    bgClass: 'bg-white/95 backdrop-blur-sm',
                    borderClass: 'shadow-sm',
                    sticky: true,
                    containerClass: 'max-w-6xl',
                    navItemClass: 'text-sm font-medium text-gray-600 hover:text-amber-800 transition-colors',
                    mobileNavItemClass: 'text-sm font-medium text-gray-600 hover:text-amber-800 py-2 px-3 rounded-lg hover:bg-amber-50 transition-colors',
                    submenuClass: 'bg-white/95 backdrop-blur-sm border border-amber-100 shadow-lg',
                    mobileBorderClass: 'border-amber-100',
                    logoSize: 36,
                    logoClass: 'rounded-full',
                    logoStyleFn: (p) => ({ backgroundColor: p.secondary, color: '#ffffff' }),
                    defaultCtaLabel: 'Shop Now',
                    ctaClass: 'px-6 py-2 rounded-full text-white text-sm font-semibold shadow-sm hover:shadow-md transition-all cursor-pointer inline-flex items-center justify-center',
                    ctaStyleFn: (p, light) => light
                        ? { backgroundColor: 'rgba(255,255,255,0.2)', color: '#ffffff' }
                        : { backgroundColor: p.secondary },
                }}
            />

            <main className="flex-1 w-full flex flex-col min-h-[50vh]">
                {children || <BlockRenderer palette={palette} />}
            </main>

            {/* Footer — warm with leaf/nature motif */}
            <footer className="py-16 border-t" style={{ borderColor: `${pSecondary}33` }}>
                <div className="max-w-6xl mx-auto px-6 text-center">
                    <div className="flex items-center justify-center gap-3 mb-3">
                        {siteContent.showFooterLogo !== false && ((siteContent.footerLogo || siteContent.siteLogo) ? (
                            <img
                                src={siteContent.footerLogo || siteContent.siteLogo}
                                alt={stripHighlight(siteContent.siteTitle) || 'Logo'}
                                className="w-8 h-8 object-contain"
                             style={{ height: siteContent.footerLogoHeight ? `${siteContent.footerLogoHeight}px` : undefined, width: siteContent.footerLogoHeight ? 'auto' : undefined }} />
                        ) : (
                            <div className="w-8 h-8 rounded-full flex items-center justify-center font-serif font-bold text-[10px] text-white" style={{ backgroundColor: pSecondary }}>
                                {(stripHighlight(siteContent.siteTitle) || 'O')[0]?.toUpperCase()}
                            </div>
                        ))}
                        <div className="font-title italic text-lg" style={{ color: pPrimary, ...parseSiteTitleStyles(siteContent['siteTitle__styles']) }}>
                            {renderSiteTitle(siteContent.siteTitle || 'Organic Co.')}
                        </div>
                    </div>
                    <p className="text-sm text-gray-400">
                        &copy; {new Date().getFullYear()} {stripHighlight(siteContent.siteTitle) || 'Organic Co.'}. Made with care.
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                        Powered by <a href="https://keystoneweb.ca" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80 transition-opacity">Keystone</a>
                    </p>
                </div>
            </footer>
        </div>
    );
}
