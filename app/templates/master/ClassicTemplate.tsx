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
 * Classic Template — Traditional, structured, trustworthy.
 * Top utility bar + main nav below, structured grid, professional serif/sans pairing.
 * Perfect for plumbers, electricians, HVAC, consulting, trades.
 */
export function ClassicTemplate({ palette, isEditMode, children }: MasterTemplateProps) {
    const context = useEditorContext();
    const siteContent = context?.siteContent || {};

    const titleFont = siteContent.titleFont || 'Merriweather';
    const bodyFont = siteContent.bodyFont || 'Source Sans 3';

    return (
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

            <SiteFooter
                palette={palette}
                isEditMode={isEditMode}
                defaults={{
                    layout: 'centered',
                    bgType: 'primary',
                    paddingClass: 'py-12',
                    containerClass: 'max-w-7xl',
                    textIsLight: true,
                    logoSize: 40,
                    logoClass: 'rounded',
                    logoStyleFn: (p) => ({ backgroundColor: p.secondary, color: '#ffffff' }),
                    titleClass: 'font-bold text-lg font-title',
                    defaultShowTagline: true,
                    defaultTaglineText: 'Professional service you can trust.',
                }}
            />
        </div>
    );
}
