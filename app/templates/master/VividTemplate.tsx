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
 * Vivid Template — Bold, colorful, energetic.
 * Thick colored header band, chunky sans-serif, asymmetric CTA.
 * Perfect for fitness, ecommerce, agencies, creative businesses.
 */
export function VividTemplate({ palette, isEditMode, children }: MasterTemplateProps) {
    const context = useEditorContext();
    const siteContent = context?.siteContent || {};

    const titleFont = siteContent.titleFont || 'Space Grotesk';
    const bodyFont = siteContent.bodyFont || 'DM Sans';

    return (
        <div className="template-wrapper min-h-screen flex flex-col" style={{ backgroundColor: '#ffffff', fontFamily: `"${bodyFont}", sans-serif` }}>
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
                    ctaDefaultShape: 'pill',
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
                    layout: 'simple',
                    bgType: 'primary',
                    paddingClass: 'py-16',
                    containerClass: 'max-w-7xl',
                    textIsLight: true,
                    logoSize: 32,
                    logoClass: 'rounded-lg',
                    logoStyleFn: (p) => ({ backgroundColor: p.secondary, color: p.primary }),
                    titleClass: 'font-bold text-lg',
                }}
            />
        </div>
    );
}
