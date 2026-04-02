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
 * Edge Template — Dark, tech-forward, angular.
 * Full-dark theme, neon accents, monospace touches, sharp edges.
 * Perfect for mechanics, tech, dropshipping, digital products.
 */
export function EdgeTemplate({ palette, isEditMode, children }: MasterTemplateProps) {
    const context = useEditorContext();
    const siteContent = context?.siteContent || {};
    const updateSiteContent = context?.updateSiteContent || (() => { });

    const pPrimary = palette.primary || '#0f172a';
    const pSecondary = palette.secondary || '#22d3ee';
    const pAccent = palette.accent || '#0f172a';

    const titleFont = siteContent.titleFont || 'JetBrains Mono';
    const bodyFont = siteContent.bodyFont || 'Inter';

    return (
        <div className="template-wrapper min-h-screen text-gray-200" style={{ backgroundColor: pAccent, fontFamily: `"${bodyFont}", sans-serif` }}>
            <style dangerouslySetInnerHTML={{
                __html: `
                @import url('https://fonts.googleapis.com/css2?family=${titleFont.replace(/ /g, '+')}:wght@400;500;600;700;800&family=${bodyFont.replace(/ /g, '+')}:wght@400;500;600;700&display=swap');
                .template-wrapper h1, .template-wrapper h2, .template-wrapper h3, .template-wrapper h4, .template-wrapper h5, .template-wrapper h6 {
                    font-family: "${titleFont}", monospace !important;
                }
                .template-wrapper .font-title {
                    font-family: "${titleFont}", monospace;
                }
            `}} />

            <SiteHeader
                palette={palette}
                isEditMode={isEditMode}
                defaults={{
                    bgType: 'custom',
                    bgCustom: '#0a0f1a',
                    borderClass: 'border-b',
                    borderStyleFn: (p) => ({ borderColor: `${p.secondary}33` }),
                    sticky: true,
                    hasAccentLine: true,
                    accentColor: pSecondary,
                    containerClass: 'max-w-7xl',
                    navItemClass: 'text-sm font-medium text-gray-400 hover:text-white transition-colors',
                    mobileNavItemClass: 'text-sm font-medium text-gray-400 hover:text-white py-2 px-3 transition-colors',
                    submenuClass: 'bg-[#141a2e] border border-gray-700 shadow-xl',
                    mobileBorderClass: 'border-gray-800',
                    mobileBorderStyleFn: (p) => ({ borderColor: `${p.secondary}22` }),
                    logoSize: 32,
                    logoClass: '',
                    logoStyleFn: (p) => ({ border: `1px solid ${p.secondary}`, color: p.secondary, backgroundColor: 'transparent' }),
                    defaultCtaLabel: 'Launch',
                    ctaClass: 'px-5 py-2 text-sm font-bold transition-all hover:shadow-lg cursor-pointer inline-flex items-center justify-center',
                    ctaStyleFn: (p) => ({ backgroundColor: p.secondary, color: '#0a0f1a', boxShadow: `0 0 20px ${p.secondary}44` }),
                }}
            />

            <main className="flex-1 w-full flex flex-col min-h-[50vh]">
                {children || <BlockRenderer palette={palette} />}
            </main>

            {/* Footer — dark with accent line */}
            <footer className="py-12 border-t" style={{ backgroundColor: '#0a0f1a', borderColor: `${pSecondary}22` }}>
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            {siteContent.showFooterLogo !== false && ((siteContent.footerLogo || siteContent.siteLogo) ? (
                                <img src={siteContent.footerLogo || siteContent.siteLogo} alt="" className="w-6 h-6 object-contain"  style={{ height: siteContent.footerLogoHeight ? `${siteContent.footerLogoHeight}px` : undefined, width: siteContent.footerLogoHeight ? 'auto' : undefined }} />
                            ) : (
                                <span className="font-mono text-xs" style={{ color: pSecondary }}>{'// '}</span>
                            ))}
                            <span className="font-bold text-sm text-white">{siteContent.siteTitle || 'Edge Co'}</span>
                        </div>
                        <p className="text-xs text-gray-600">
                            Powered by <a href="https://keystoneweb.ca" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80 transition-opacity">Keystone</a>
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
