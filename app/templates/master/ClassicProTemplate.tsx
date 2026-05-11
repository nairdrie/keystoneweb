'use client';

import { useEditorContext } from '@/lib/editor-context';
import BlockRenderer from '@/app/components/blocks/BlockRenderer';
import SiteHeader from '@/app/components/SiteHeader';
import SiteFooter from '@/app/components/SiteFooter';
import { TemplateFonts } from './TemplateFonts';

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

    const pAccent = palette.accent || '#f8fafc';

    const titleFont = siteContent.titleFont || 'Oswald';
    const bodyFont = siteContent.bodyFont || 'Roboto';

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
                    ctaDefaultShape: 'rounded',
                    ctaDefaultFill: 'filled',
                }}
            />

            {/* Page Content */}
            <main className="flex-1 w-full flex flex-col min-h-[50vh]">
                <BlockRenderer palette={palette} />
            </main>

            <SiteFooter
                palette={palette}
                isEditMode={isEditMode}
                defaults={{
                    layout: 'simple',
                    bgType: 'primary',
                    paddingClass: 'py-12',
                    containerClass: 'max-w-7xl',
                    textIsLight: true,
                    logoSize: 24,
                    logoClass: 'rounded',
                    logoStyleFn: (p) => ({ backgroundColor: p.secondary, color: '#ffffff' }),
                    titleClass: 'font-bold text-sm',
                }}
            />
        </div>
    );
}
