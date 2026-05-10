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
 * Vibrant Template — Playful, colorful, dynamic.
 * Gradient header, rounded nav elements, friendly typography, dynamic color usage.
 * Perfect for fitness, subscription boxes, creative studios, retail, e-commerce.
 */
export function VibrantTemplate({ palette, isEditMode, children }: MasterTemplateProps) {
    const context = useEditorContext();
    const siteContent = context?.siteContent || {};

    const titleFont = siteContent.titleFont || 'Plus Jakarta Sans';
    const bodyFont = siteContent.bodyFont || 'Plus Jakarta Sans';

    return (
        <div className="template-wrapper min-h-screen flex flex-col" style={{ backgroundColor: '#ffffff', fontFamily: `"${bodyFont}", sans-serif` }}>
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
                    bgType: 'gradient',
                    sticky: true,
                    containerClass: 'max-w-7xl',
                    navItemClass: 'text-sm font-medium text-white/80 hover:text-white transition-colors px-3 py-1.5 rounded-full hover:bg-white/10',
                    mobileNavItemClass: 'text-sm font-medium text-white/80 hover:text-white py-2.5 px-4 rounded-xl hover:bg-white/10 transition-colors',
                    submenuClass: 'bg-white/15 backdrop-blur-xl border border-white/20 shadow-xl',
                    mobileBorderClass: 'border-white/20',
                    logoSize: 36,
                    logoClass: 'rounded-xl',
                    logoStyleFn: () => ({ backgroundColor: 'rgba(255,255,255,0.2)', color: '#ffffff' }),
                    defaultCtaLabel: 'Start Free',
                    ctaClass: 'px-6 py-2 rounded-full font-bold text-sm shadow-lg transition-all hover:scale-105 hover:shadow-xl cursor-pointer inline-flex items-center justify-center',
                    ctaStyleFn: (p) => ({ backgroundColor: '#ffffff', color: p.primary }),
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
                    layout: 'card',
                    bgType: 'gradient',
                    paddingClass: 'py-16',
                    containerClass: 'max-w-6xl',
                    textIsLight: true,
                    cardClass: 'bg-white/10 backdrop-blur-sm rounded-3xl p-8',
                    logoSize: 28,
                    logoClass: 'rounded-lg',
                    logoStyleFn: () => ({ backgroundColor: 'rgba(255,255,255,0.2)', color: '#ffffff' }),
                    titleClass: 'font-bold',
                }}
            />
        </div>
    );
}
