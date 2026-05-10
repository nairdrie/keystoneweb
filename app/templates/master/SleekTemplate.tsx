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
 * Sleek Template — Ultra-minimal, bold typography.
 * Thin header, massive type, monochrome + single accent, generous whitespace.
 * Perfect for freelancers, agencies, consulting, digital products, portfolios.
 */
export function SleekTemplate({ palette, isEditMode, children }: MasterTemplateProps) {
    const context = useEditorContext();
    const siteContent = context?.siteContent || {};

    const pAccent = palette.accent || '#ffffff';

    const titleFont = siteContent.titleFont || 'Sora';
    const bodyFont = siteContent.bodyFont || 'Inter';

    return (
        <div className="template-wrapper min-h-screen flex flex-col" style={{ backgroundColor: pAccent, fontFamily: `"${bodyFont}", sans-serif` }}>
            <TemplateFonts
                titleFont={titleFont}
                bodyFont={bodyFont}
                titleWeights="400;500;600;700;800"
                bodyWeights="400;500;600;700"
                fallback="sans-serif"
            />

            <SiteHeader
                palette={palette}
                isEditMode={isEditMode}
                defaults={{
                    bgType: 'white',
                    bgClass: 'bg-white/95 backdrop-blur-md',
                    sticky: true,
                    containerClass: 'max-w-7xl',
                    navItemClass: 'text-sm text-gray-400 hover:text-gray-900 transition-colors',
                    mobileNavItemClass: 'text-sm text-gray-400 hover:text-gray-900 py-2 px-2 transition-colors',
                    submenuClass: 'bg-white/95 backdrop-blur-md border border-gray-100 shadow-lg',
                    logoSize: 28,
                    logoClass: 'rounded-sm',
                    logoStyleFn: (p) => ({ backgroundColor: p.primary, color: '#ffffff' }),
                    defaultCtaLabel: 'Contact',
                    ctaClass: 'px-5 py-1.5 rounded-sm text-white text-sm font-medium transition-all hover:opacity-90 cursor-pointer inline-flex items-center justify-center',
                    ctaStyleFn: (p, light) => light
                        ? { backgroundColor: 'rgba(255,255,255,0.2)', color: '#ffffff' }
                        : { backgroundColor: p.primary },
                    ctaDefaultShape: 'rounded',
                    ctaDefaultFill: 'filled',
                }}
            />

            <main className="flex-1 w-full flex flex-col min-h-[50vh]">
                {children || <BlockRenderer palette={palette} />}
            </main>

            <SiteFooter
                palette={palette}
                isEditMode={isEditMode}
                defaults={{
                    layout: 'minimal',
                    bgType: 'transparent',
                    bgClass: '',
                    borderClass: 'border-t border-gray-100',
                    paddingClass: 'py-8',
                    containerClass: 'max-w-7xl',
                    logoSize: 24,
                    logoClass: 'rounded-sm',
                    logoStyleFn: (p) => ({ backgroundColor: p.primary, color: '#ffffff' }),
                    titleClass: 'text-sm font-medium',
                    defaultShowCopyright: true,
                    defaultCopyrightText: '© {year}',
                }}
            />
        </div>
    );
}
