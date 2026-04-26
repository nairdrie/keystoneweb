'use client';

import EditableText from '@/app/components/EditableText';
import EditableButton from '@/app/components/EditableButton';
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
 * Starter Template — Clean, approachable.
 * Lots of whitespace, serif accents, minimal borders.
 * Perfect for freelancers, landscaping, cleaning, portfolios.
 */
export function MinimalWhiteTemplate({ palette, isEditMode, children }: MasterTemplateProps) {
    const context = useEditorContext();
    const content = context?.content || {};
    const siteContent = context?.siteContent || {};
    const updateContent = context?.updateContent || (() => { });
    const updateSiteContent = context?.updateSiteContent || (() => { });

    const pPrimary = palette.primary || '#374151';
    const pSecondary = palette.secondary || '#10b981';
    const pAccent = palette.accent || '#ffffff';

    const titleFont = siteContent.titleFont || 'Lora';
    const bodyFont = siteContent.bodyFont || 'Inter';

    return (
        <div className="template-wrapper min-h-screen text-slate-700" style={{ backgroundColor: pAccent, fontFamily: `"${bodyFont}", sans-serif` }}>
            <TemplateFonts
                titleFont={titleFont}
                bodyFont={bodyFont}
                titleWeights="400;500;600;700;800;900"
                bodyWeights="400;500;600;700"
                fallback="serif"
            />
            <SiteHeader
                palette={palette}
                isEditMode={isEditMode}
                defaults={{
                    bgType: 'white',
                    bgClass: 'bg-white/95 backdrop-blur-sm',
                    borderClass: 'border-b border-slate-100',
                    sticky: true,
                    containerClass: 'max-w-6xl',
                    navItemClass: 'text-sm text-slate-500 hover:text-slate-900 transition-colors font-medium',
                    mobileNavItemClass: 'text-sm text-slate-500 hover:text-slate-900 py-2.5 px-3 rounded-lg hover:bg-slate-50 transition-colors font-medium',
                    logoSize: 32,
                    logoClass: 'rounded',
                    logoStyleFn: (p) => ({ backgroundColor: p.primary, color: '#ffffff' }),
                    defaultCtaLabel: 'Contact',
                    ctaClass: 'px-5 py-2 rounded-lg text-white text-sm font-semibold transition-all hover:opacity-90 cursor-pointer inline-flex items-center justify-center',
                    ctaStyleFn: (p, light) => light
                        ? { backgroundColor: 'rgba(255,255,255,0.15)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.3)' }
                        : { backgroundColor: p.primary },
                }}
            />

            {/* Page Content */}
            <main className="flex-1 w-full min-h-[50vh]">
                {children || <BlockRenderer palette={palette} />}
            </main>

            {/* Footer — clean & minimal */}
            <footer className="py-16 border-t border-slate-100">
                <div className="max-w-6xl mx-auto px-6 text-center">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        {siteContent.showFooterLogo !== false && ((siteContent.footerLogo || siteContent.siteLogo) ? (
                            <img
                                src={siteContent.footerLogo || siteContent.siteLogo}
                                alt={stripHighlight(siteContent.siteTitle) || 'Logo'}
                                className="w-8 h-8 object-contain"
                             style={{ height: siteContent.footerLogoHeight ? `${siteContent.footerLogoHeight}px` : undefined, width: siteContent.footerLogoHeight ? 'auto' : undefined }} />
                        ) : (
                            <div className="w-8 h-8 rounded flex items-center justify-center font-bold text-sm text-white" style={{ backgroundColor: pPrimary }}>
                                {(stripHighlight(siteContent.siteTitle) || 'S')[0]?.toUpperCase()}
                            </div>
                        ))}
                        <span className="text-lg font-semibold tracking-wide font-title" style={{ color: pPrimary, ...parseSiteTitleStyles(siteContent['siteTitle__styles']) }}>
                            {renderSiteTitle(siteContent.siteTitle || 'Studio')}
                        </span>
                    </div>
                    <p className="text-sm text-slate-400">
                        Powered by <a href="https://keystoneweb.ca" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80 transition-opacity">Keystone</a>
                    </p>
                </div>
            </footer>
        </div>
    );
}
