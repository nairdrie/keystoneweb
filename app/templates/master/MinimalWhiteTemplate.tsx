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
 * Starter Template — Clean, approachable.
 * Lots of whitespace, serif accents, minimal borders.
 * Perfect for freelancers, landscaping, cleaning, portfolios.
 */
export function MinimalWhiteTemplate({ palette, isEditMode, children }: MasterTemplateProps) {
    const context = useEditorContext();
    const siteContent = context?.siteContent || {};

    const pAccent = palette.accent || '#ffffff';

    const titleFont = siteContent.titleFont || 'Lora';
    const bodyFont = siteContent.bodyFont || 'Inter';

    return (
        <div className="template-wrapper min-h-screen flex flex-col text-slate-700" style={{ backgroundColor: pAccent, fontFamily: `"${bodyFont}", sans-serif` }}>
            <TemplateFonts
                titleFont={titleFont}
                bodyFont={bodyFont}
                titleWeights="400;500;600;700;800;900"
                bodyWeights="400;500;600;700"
                fallback="serif"
            />
            <SiteHeader
                palette={palette}
                isEditMode={isEditMode}
                defaults={{
                    bgType: 'white',
                    bgClass: 'bg-white/95 backdrop-blur-sm',
                    borderClass: 'border-b border-slate-100',
                    sticky: true,
                    containerClass: 'max-w-6xl',
                    navItemClass: 'text-sm text-slate-500 hover:text-slate-900 transition-colors font-medium',
                    mobileNavItemClass: 'text-sm text-slate-500 hover:text-slate-900 py-2.5 px-3 rounded-lg hover:bg-slate-50 transition-colors font-medium',
                    logoSize: 32,
                    logoClass: 'rounded',
                    logoStyleFn: (p) => ({ backgroundColor: p.primary, color: '#ffffff' }),
                    defaultCtaLabel: 'Contact',
                    ctaClass: 'px-5 py-2 rounded-lg text-white text-sm font-semibold transition-all hover:opacity-90 cursor-pointer inline-flex items-center justify-center',
                    ctaStyleFn: (p, light) => light
                        ? { backgroundColor: 'rgba(255,255,255,0.15)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.3)' }
                        : { backgroundColor: p.primary },
                    ctaDefaultShape: 'rounded',
                    ctaDefaultFill: 'filled',
                }}
            />

            {/* Page Content */}
            <main className="flex-1 w-full min-h-[50vh]">
                {children || <BlockRenderer palette={palette} />}
            </main>

            <SiteFooter
                palette={palette}
                isEditMode={isEditMode}
                defaults={{
                    layout: 'centered',
                    bgType: 'transparent',
                    bgClass: '',
                    borderClass: 'border-t border-slate-100',
                    paddingClass: 'py-16',
                    containerClass: 'max-w-6xl',
                    logoSize: 32,
                    logoClass: 'rounded',
                    logoStyleFn: (p) => ({ backgroundColor: p.primary, color: '#ffffff' }),
                    titleClass: 'text-lg font-semibold tracking-wide font-title',
                }}
            />
        </div>
    );
}
