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
 * Edge Template — Dark, tech-forward, angular.
 * Full-dark theme, neon accents, monospace touches, sharp edges.
 * Perfect for mechanics, tech, dropshipping, digital products.
 */
export function EdgeTemplate({ palette, isEditMode, children }: MasterTemplateProps) {
    const context = useEditorContext();
    const siteContent = context?.siteContent || {};

    const pSecondary = palette.secondary || '#22d3ee';
    const pAccent = palette.accent || '#0f172a';

    const titleFont = siteContent.titleFont || 'JetBrains Mono';
    const bodyFont = siteContent.bodyFont || 'Inter';

    return (
        <div className="template-wrapper min-h-screen flex flex-col text-gray-200" style={{ backgroundColor: pAccent, fontFamily: `"${bodyFont}", sans-serif` }}>
            <TemplateFonts
                titleFont={titleFont}
                bodyFont={bodyFont}
                titleWeights="400;500;600;700;800"
                bodyWeights="400;500;600;700"
                fallback="monospace"
            />

            <SiteHeader
                palette={palette}
                isEditMode={isEditMode}
                defaults={{
                    bgType: 'custom',
                    bgCustom: '#0a0f1a',
                    borderClass: 'border-b',
                    borderStyleFn: (p) => ({ borderColor: `${p.secondary}33` }),
                    sticky: true,
                    hasAccentLine: true,
                    accentColor: pSecondary,
                    containerClass: 'max-w-7xl',
                    navItemClass: 'text-sm font-medium text-gray-400 hover:text-white transition-colors',
                    mobileNavItemClass: 'text-sm font-medium text-gray-400 hover:text-white py-2 px-3 transition-colors',
                    submenuClass: 'bg-[#141a2e] border border-gray-700 shadow-xl',
                    mobileBorderClass: 'border-gray-800',
                    mobileBorderStyleFn: (p) => ({ borderColor: `${p.secondary}22` }),
                    logoSize: 32,
                    logoClass: '',
                    logoStyleFn: (p) => ({ border: `1px solid ${p.secondary}`, color: p.secondary, backgroundColor: 'transparent' }),
                    defaultCtaLabel: 'Launch',
                    ctaClass: 'px-5 py-2 text-sm font-bold transition-all hover:shadow-lg cursor-pointer inline-flex items-center justify-center',
                    ctaStyleFn: (p) => ({ backgroundColor: p.secondary, color: '#0a0f1a', boxShadow: `0 0 20px ${p.secondary}44` }),
                    ctaDefaultShape: 'square',
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
                    bgType: 'dark',
                    paddingClass: 'py-12',
                    containerClass: 'max-w-7xl',
                    textIsLight: true,
                    borderClass: 'border-t',
                    borderStyleFn: () => ({ borderColor: `${pSecondary}22` }),
                    logoSize: 24,
                    logoFallbackPrefix: '// ',
                    titleClass: 'font-bold text-sm',
                }}
            />
        </div>
    );
}
