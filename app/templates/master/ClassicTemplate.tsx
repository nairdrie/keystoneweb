'use client';

import EditableButton from '@/app/components/EditableButton';
import EditableText from '@/app/components/EditableText';
import { useEditorContext, BlockDataProvider } from '@/lib/editor-context';
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
 * Classic Template — Traditional, structured, trustworthy.
 * Top utility bar + main nav below, structured grid, professional serif/sans pairing.
 * Perfect for plumbers, electricians, HVAC, consulting, trades.
 */
export function ClassicTemplate({ palette, isEditMode, children }: MasterTemplateProps) {
    const context = useEditorContext();
    const siteContent = context?.siteContent || {};
    const updateSiteContent = context?.updateSiteContent || (() => { });

    const pPrimary = palette.primary || '#1e3a5f';
    const pSecondary = palette.secondary || '#dc2626';
    const pAccent = palette.accent || '#f8fafc';

    const titleFont = siteContent.titleFont || 'Merriweather';
    const bodyFont = siteContent.bodyFont || 'Source Sans 3';

    return (
        <BlockDataProvider value={siteContent}>
        <div className="template-wrapper min-h-screen flex flex-col" style={{ backgroundColor: '#ffffff', fontFamily: `"${bodyFont}", sans-serif` }}>
            <TemplateFonts
                titleFont={titleFont}
                bodyFont={bodyFont}
                titleWeights="400;700;900"
                bodyWeights="400;500;600;700"
                fallback="serif"
            />

            <SiteHeader
                palette={palette}
                isEditMode={isEditMode}
                defaults={{
                    bgType: 'white',
                    bgClass: 'bg-white',
                    borderClass: 'shadow-md',
                    sticky: true,
                    showBanner: true,
                    isBannerClassic: true,
                    containerClass: 'max-w-7xl',
                    navItemClass: 'text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors',
                    mobileNavItemClass: 'text-sm font-semibold text-gray-700 hover:text-gray-900 py-2 px-3 rounded hover:bg-gray-50 transition-colors',
                    submenuClass: 'bg-white border border-gray-200 shadow-xl',
                    logoSize: 40,
                    logoClass: 'rounded',
                    logoStyleFn: (p) => ({ backgroundColor: p.primary, color: '#ffffff' }),
                    defaultCtaLabel: 'Get a Quote',
                    ctaClass: 'px-6 py-2.5 rounded text-white text-sm font-bold shadow-md hover:shadow-lg transition-all cursor-pointer inline-flex items-center justify-center',
                    ctaStyleFn: (p, light) => light
                        ? { backgroundColor: 'rgba(255,255,255,0.15)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.3)' }
                        : { backgroundColor: p.secondary },
                    ctaDefaultShape: 'rounded',
                    ctaDefaultFill: 'filled',
                }}
            />

            <main className="flex-1 w-full flex flex-col min-h-[50vh]">
                {children || <BlockRenderer palette={palette} />}
            </main>

            {/* Footer — structured two-row */}
            <footer style={{ backgroundColor: pPrimary }}>
                <div className="max-w-7xl mx-auto px-4 py-12">
                    <div className="flex flex-col md:flex-row items-center gap-6">
                        <div className="flex items-center gap-3 flex-1">
                            {siteContent.showFooterLogo !== false && ((siteContent.footerLogo || siteContent.siteLogo) ? (
                                <img src={siteContent.footerLogo || siteContent.siteLogo} alt={siteContent.siteTitle || 'Site logo'} className="w-10 h-10 object-contain"  style={{ height: siteContent.footerLogoHeight ? `${siteContent.footerLogoHeight}px` : undefined, width: siteContent.footerLogoHeight ? 'auto' : undefined }} />
                            ) : (
                                <div className="w-10 h-10 rounded flex items-center justify-center font-bold text-sm text-white" style={{ backgroundColor: pSecondary }}>
                                    {(stripHighlight(siteContent.siteTitle) || 'C')[0]?.toUpperCase()}
                                </div>
                            ))}
                        </div>
                        <div className="text-center flex-1">
                            <div className="font-bold text-lg text-white font-title" style={{ ...parseSiteTitleStyles(siteContent['siteTitle__styles']) }}>{renderSiteTitle(siteContent.siteTitle || 'Classic Services')}</div>
                            <EditableText
                                contentKey="footerSlogan"
                                content={siteContent.footerSlogan}
                                defaultValue="Professional service you can trust."
                                isEditMode={isEditMode}
                                onSave={updateSiteContent}
                                className="text-sm text-white/50 mt-1 block"
                            />
                        </div>
                        <div className="flex-1 flex justify-end">
                            <EditableButton
                                contentKey="navButtonText"
                                label={siteContent.navButtonText}
                                linkData={siteContent.navButtonTextLink} iconData={siteContent.navButtonTextIcon}
                                defaultLabel="Get a Quote"
                                isEditMode={isEditMode}
                                onSave={updateSiteContent}
                                className="px-8 py-3 rounded text-white text-sm font-bold transition-all hover:opacity-90 cursor-pointer inline-flex items-center justify-center"
                                style={{ backgroundColor: pSecondary }}
                            />
                        </div>
                    </div>
                </div>
                <div className="border-t border-white/10 py-4">
                    <div className="max-w-7xl mx-auto px-4 text-center">
                        <p className="text-xs text-white/30">
                            Powered by <a href="https://keystoneweb.ca" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80 transition-opacity">Keystone</a>
                        </p>
                    </div>
                </div>
            </footer>
        </div>
        </BlockDataProvider>
    );
}
