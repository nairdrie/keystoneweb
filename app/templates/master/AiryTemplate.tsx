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
 * Airy Template — Light, spacious, friendly.
 * Transparent floating nav, rounded elements, soft shadows, pastel-friendly.
 * Perfect for cleaning, landscaping, handmade/crafts, wellness.
 */
export function AiryTemplate({ palette, isEditMode, children }: MasterTemplateProps) {
    const context = useEditorContext();
    const siteContent = context?.siteContent || {};
    const updateSiteContent = context?.updateSiteContent || (() => { });

    const pPrimary = palette.primary || '#059669';
    const pAccent = palette.accent || '#ecfdf5';

    const titleFont = siteContent.titleFont || 'Nunito';
    const bodyFont = siteContent.bodyFont || 'Nunito';

    return (
        <div className="template-wrapper min-h-screen flex flex-col" style={{ backgroundColor: pAccent, fontFamily: `"${bodyFont}", sans-serif` }}>
            <TemplateFonts
                titleFont={titleFont}
                bodyFont={bodyFont}
                titleWeights="400;500;600;700;800;900"
                bodyWeights="400;500;600;700"
                fallback="sans-serif"
            />

            <SiteHeader
                palette={palette}
                isEditMode={isEditMode}
                defaults={{
                    isFloating: true,
                    bgType: 'white',
                    bgClass: 'bg-white/90',
                    sticky: true,
                    containerClass: 'max-w-6xl',
                    navItemClass: 'text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors',
                    mobileNavItemClass: 'text-sm font-medium text-gray-500 hover:text-gray-800 py-2.5 px-3 rounded-xl hover:bg-gray-50 transition-colors',
                    submenuClass: 'bg-white/95 backdrop-blur-xl border border-gray-100 shadow-lg',
                    logoSize: 32,
                    logoClass: 'rounded-full',
                    logoStyleFn: (p) => ({ backgroundColor: p.primary, color: '#ffffff' }),
                    defaultCtaLabel: 'Contact Us',
                    ctaClass: 'px-5 py-2 rounded-full text-white text-sm font-semibold shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer inline-flex items-center justify-center',
                    ctaStyleFn: (p, light) => light
                        ? { backgroundColor: 'rgba(255,255,255,0.2)', color: '#ffffff' }
                        : { backgroundColor: p.primary },
                    ctaDefaultShape: 'pill',
                    ctaDefaultFill: 'filled',
                }}
            />

            <main className="flex-1 w-full flex flex-col min-h-[50vh]">
                {children || <BlockRenderer palette={palette} />}
            </main>

            {/* Footer — soft rounded */}
            <footer className="py-12 mt-8">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                        <div className="flex items-center justify-center gap-2 mb-3">
                            {siteContent.showFooterLogo !== false && ((siteContent.footerLogo || siteContent.siteLogo) ? (
                                <img src={siteContent.footerLogo || siteContent.siteLogo} alt={siteContent.siteTitle || 'Site logo'} className="w-8 h-8 object-contain"  style={{ height: siteContent.footerLogoHeight ? `${siteContent.footerLogoHeight}px` : undefined, width: siteContent.footerLogoHeight ? 'auto' : undefined }} />
                            ) : (
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: pPrimary }}>
                                    {(stripHighlight(siteContent.siteTitle) || 'A')[0]?.toUpperCase()}
                                </div>
                            ))}
                            <span className="font-bold text-sm" style={{ color: pPrimary, ...parseSiteTitleStyles(siteContent['siteTitle__styles']) }}>{renderSiteTitle(siteContent.siteTitle || 'Airy Studio')}</span>
                        </div>
                        <p className="text-xs text-gray-400">
                            Powered by <a href="https://keystoneweb.ca" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80 transition-opacity">Keystone</a>
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
