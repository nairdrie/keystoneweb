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
 * Organic Template — Warm, natural, handcrafted.
 * Off-white warm background, rounded shapes, earthy tones, friendly feel.
 * Perfect for landscaping, handmade/crafts, salons, freelancers, bakeries.
 */
export function OrganicTemplate({ palette, isEditMode, children }: MasterTemplateProps) {
    const context = useEditorContext();
    const siteContent = context?.siteContent || {};

    const pSecondary = palette.secondary || '#d97706';
    const pAccent = palette.accent || '#fffbeb';

    const titleFont = siteContent.titleFont || 'Libre Baskerville';
    const bodyFont = siteContent.bodyFont || 'Karla';

    return (
        <div className="template-wrapper min-h-screen flex flex-col" style={{ backgroundColor: pAccent, fontFamily: `"${bodyFont}", sans-serif` }}>
            <TemplateFonts
                titleFont={titleFont}
                bodyFont={bodyFont}
                titleWeights="400;700"
                bodyWeights="400;500;600;700"
                fallback="serif"
            />

            <SiteHeader
                palette={palette}
                isEditMode={isEditMode}
                defaults={{
                    bgType: 'white',
                    bgClass: 'bg-white/95 backdrop-blur-sm',
                    borderClass: 'shadow-sm',
                    sticky: true,
                    containerClass: 'max-w-6xl',
                    navItemClass: 'text-sm font-medium text-gray-600 hover:text-amber-800 transition-colors',
                    mobileNavItemClass: 'text-sm font-medium text-gray-600 hover:text-amber-800 py-2 px-3 rounded-lg hover:bg-amber-50 transition-colors',
                    submenuClass: 'bg-white/95 backdrop-blur-sm border border-amber-100 shadow-lg',
                    mobileBorderClass: 'border-amber-100',
                    logoSize: 36,
                    logoClass: 'rounded-full',
                    logoStyleFn: (p) => ({ backgroundColor: p.secondary, color: '#ffffff' }),
                    defaultCtaLabel: 'Shop Now',
                    ctaClass: 'px-6 py-2 rounded-full text-white text-sm font-semibold shadow-sm hover:shadow-md transition-all cursor-pointer inline-flex items-center justify-center',
                    ctaStyleFn: (p, light) => light
                        ? { backgroundColor: 'rgba(255,255,255,0.2)', color: '#ffffff' }
                        : { backgroundColor: p.secondary },
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
                    layout: 'centered',
                    bgType: 'transparent',
                    bgClass: '',
                    borderClass: 'border-t',
                    borderStyleFn: () => ({ borderColor: `${pSecondary}33` }),
                    paddingClass: 'py-16',
                    containerClass: 'max-w-6xl',
                    logoSize: 32,
                    logoClass: 'rounded-full',
                    logoStyleFn: (p) => ({ backgroundColor: p.secondary, color: '#ffffff' }),
                    titleClass: 'font-title italic text-lg',
                    defaultShowCopyright: true,
                    defaultCopyrightText: '© {year} {title}. Made with care.',
                }}
            />
        </div>
    );
}
