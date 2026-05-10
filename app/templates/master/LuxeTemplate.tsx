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
 * Luxe Template — Sophisticated, high-end.
 * Centered logo above nav, serif fonts, warm/gold accents.
 * Perfect for salons, consulting, creative studios, boutique shops.
 */
export function LuxeTemplate({ palette, isEditMode, children }: MasterTemplateProps) {
    const context = useEditorContext();
    const siteContent = context?.siteContent || {};

    const titleFont = siteContent.titleFont || 'Playfair Display';
    const bodyFont = siteContent.bodyFont || 'Lato';

    return (
        <div className="template-wrapper min-h-screen flex flex-col" style={{ backgroundColor: '#ffffff', fontFamily: `"${bodyFont}", sans-serif` }}>
            <TemplateFonts
                titleFont={titleFont}
                bodyFont={bodyFont}
                titleWeights="400;500;600;700;800;900"
                bodyWeights="300;400;500;600;700"
                fallback="serif"
            />

            <SiteHeader
                palette={palette}
                isEditMode={isEditMode}
                defaults={{
                    layout: 'centeredAboveNav',
                    bgType: 'white',
                    bgClass: 'bg-white',
                    borderClass: 'border-b border-gray-100',
                    sticky: false,
                    containerClass: 'max-w-6xl',
                    navItemClass: 'text-xs font-medium tracking-[0.15em] uppercase text-gray-500 hover:text-gray-900 transition-colors',
                    mobileNavItemClass: 'text-xs font-medium tracking-[0.15em] uppercase text-gray-500 hover:text-gray-900 py-2 transition-colors',
                    logoSize: 48,
                    logoClass: 'rounded-full',
                    logoStyleFn: (p) => ({ backgroundColor: p.secondary, color: '#ffffff' }),
                    defaultCtaLabel: 'Reserve',
                    ctaClass: 'px-6 py-1.5 border-2 text-xs font-semibold tracking-[0.15em] uppercase transition-all cursor-pointer inline-flex items-center justify-center',
                    ctaStyleFn: (p, light) => light
                        ? { borderColor: '#ffffff', color: '#ffffff', backgroundColor: 'transparent' }
                        : { borderColor: p.secondary, color: p.secondary, backgroundColor: 'transparent' },
                    ctaDefaultShape: 'square',
                    ctaDefaultFill: 'outline',
                }}
            />

            <main className="flex-1 w-full flex flex-col min-h-[50vh]">
                {children || <BlockRenderer palette={palette} />}
            </main>

            <SiteFooter
                palette={palette}
                isEditMode={isEditMode}
                defaults={{
                    layout: 'centered',
                    bgType: 'primary',
                    paddingClass: 'py-16',
                    containerClass: 'max-w-6xl',
                    textIsLight: true,
                    logoSize: 40,
                    logoClass: 'rounded-full',
                    logoStyleFn: (p) => ({ backgroundColor: p.secondary, color: '#ffffff' }),
                    titleClass: 'text-2xl font-bold tracking-[0.2em] uppercase font-title',
                }}
            />
        </div>
    );
}
