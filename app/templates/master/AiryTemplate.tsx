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
 * Airy Template — Light, spacious, friendly.
 * Transparent floating nav, rounded elements, soft shadows, pastel-friendly.
 * Perfect for cleaning, landscaping, handmade/crafts, wellness.
 */
export function AiryTemplate({ palette, isEditMode, children }: MasterTemplateProps) {
    const context = useEditorContext();
    const siteContent = context?.siteContent || {};

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

            <SiteFooter
                palette={palette}
                isEditMode={isEditMode}
                defaults={{
                    layout: 'card',
                    bgType: 'transparent',
                    paddingClass: 'py-12 mt-8',
                    containerClass: 'max-w-6xl',
                    cardClass: 'bg-white rounded-2xl shadow-sm p-8',
                    logoSize: 32,
                    logoClass: 'rounded-full',
                    logoStyleFn: (p) => ({ backgroundColor: p.primary, color: '#ffffff' }),
                    titleClass: 'font-bold text-sm',
                }}
            />
        </div>
    );
}
