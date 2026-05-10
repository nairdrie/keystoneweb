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
 * Elegant Template — Premium, refined.
 * Frosted glass navbar, smooth gradients, modern feel.
 * Perfect for salons, consulting, agencies.
 */
export function ModernBlueTemplate({ palette, isEditMode, children }: MasterTemplateProps) {
    const context = useEditorContext();
    const siteContent = context?.siteContent || {};

    const titleFont = siteContent.titleFont || 'Inter';
    const bodyFont = siteContent.bodyFont || 'Inter';

    return (
        <div className="template-wrapper min-h-screen flex flex-col text-slate-800 bg-white" style={{ fontFamily: `"${bodyFont}", sans-serif` }}>
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
                    bgType: 'white',
                    bgClass: 'bg-white/80 backdrop-blur-xl',
                    borderClass: 'border-b border-white/20 shadow-sm',
                    sticky: true,
                    containerClass: 'max-w-7xl',
                    navItemClass: 'text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors',
                    mobileNavItemClass: 'text-sm font-medium text-slate-600 hover:text-slate-900 py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors',
                    submenuClass: 'bg-white/95 backdrop-blur-xl border border-slate-200 shadow-xl',
                    logoSize: 36,
                    logoClass: 'rounded-xl',
                    logoStyleFn: (p) => ({ background: `linear-gradient(135deg, ${p.primary}, ${p.secondary})` }),
                    defaultCtaLabel: 'Book Now',
                    ctaClass: 'px-6 py-2.5 rounded-full text-white font-bold text-sm shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer inline-flex items-center justify-center',
                    ctaStyleFn: (p, light) => light
                        ? { backgroundColor: 'rgba(255,255,255,0.2)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.3)' }
                        : { background: `linear-gradient(135deg, ${p.primary}, ${p.secondary})` },
                    ctaDefaultShape: 'pill',
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
                    layout: 'simple',
                    bgType: 'transparent',
                    bgClass: '',
                    borderClass: 'border-t border-slate-100',
                    paddingClass: 'py-12',
                    containerClass: 'max-w-7xl',
                    logoSize: 24,
                    logoClass: 'rounded-lg',
                    logoStyleFn: (p) => ({
                        background: `linear-gradient(135deg, ${p.primary}, ${p.secondary})`,
                        color: '#ffffff',
                    }),
                    titleClass: 'font-bold text-sm',
                }}
            />
        </div>
    );
}
