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
 * Elegant Template — Premium, refined.
 * Frosted glass navbar, smooth gradients, modern feel.
 * Perfect for salons, consulting, agencies.
 */
export function ModernBlueTemplate({ palette, isEditMode, children }: MasterTemplateProps) {
    const context = useEditorContext();
    const siteContent = context?.siteContent || {};
    const updateSiteContent = context?.updateSiteContent || (() => { });

    const pPrimary = palette.primary || '#0369a1';
    const pSecondary = palette.secondary || '#0ea5e9';
    const pAccent = palette.accent || '#f0f9ff';

    const titleFont = siteContent.titleFont || 'Inter';
    const bodyFont = siteContent.bodyFont || 'Inter';

    return (
        <div className="template-wrapper min-h-screen text-slate-800 bg-white" style={{ fontFamily: `"${bodyFont}", sans-serif` }}>
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
                    bgType: 'white',
                    bgClass: 'bg-white/80 backdrop-blur-xl',
                    borderClass: 'border-b border-white/20 shadow-sm',
                    sticky: true,
                    containerClass: 'max-w-7xl',
                    navItemClass: 'text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors',
                    mobileNavItemClass: 'text-sm font-medium text-slate-600 hover:text-slate-900 py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors',
                    submenuClass: 'bg-white/95 backdrop-blur-xl border border-slate-200 shadow-xl',
                    logoSize: 36,
                    logoClass: 'rounded-xl',
                    logoStyleFn: (p) => ({ background: `linear-gradient(135deg, ${p.primary}, ${p.secondary})` }),
                    defaultCtaLabel: 'Book Now',
                    ctaClass: 'px-6 py-2.5 rounded-full text-white font-bold text-sm shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer inline-flex items-center justify-center',
                    ctaStyleFn: (p, light) => light
                        ? { backgroundColor: 'rgba(255,255,255,0.2)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.3)' }
                        : { background: `linear-gradient(135deg, ${p.primary}, ${p.secondary})` },
                }}
            />

            {/* Page Content */}
            <main className="flex-1 w-full min-h-[50vh]">
                {children || <BlockRenderer palette={palette} />}
            </main>

            {/* Footer */}
            <footer className="py-12 border-t border-slate-100">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            {siteContent.showFooterLogo !== false && ((siteContent.footerLogo || siteContent.siteLogo) ? (
                                <img
                                    src={siteContent.footerLogo || siteContent.siteLogo}
                                    alt={stripHighlight(siteContent.siteTitle) || 'Logo'}
                                    className="w-6 h-6 object-contain"
                                 style={{ height: siteContent.footerLogoHeight ? `${siteContent.footerLogoHeight}px` : undefined, width: siteContent.footerLogoHeight ? 'auto' : undefined }} />
                            ) : (
                                <div
                                    className="w-6 h-6 rounded-lg flex items-center justify-center"
                                    style={{ background: `linear-gradient(135deg, ${pPrimary}, ${pSecondary})` }}
                                >
                                    <span className="text-white font-black text-[8px]">
                                        {(stripHighlight(siteContent.siteTitle) || 'E')[0]?.toUpperCase()}
                                    </span>
                                </div>
                            ))}
                            <span className="font-bold text-sm text-slate-800" style={{ ...parseSiteTitleStyles(siteContent['siteTitle__styles']) }}>{renderSiteTitle(siteContent.siteTitle || 'Elegant Co.')}</span>
                        </div>
                        <p className="text-sm text-slate-400">
                            Powered by <a href="https://keystoneweb.ca" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80 transition-opacity">Keystone</a>
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
