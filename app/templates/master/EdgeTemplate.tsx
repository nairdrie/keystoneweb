'use client';

import EditableText from '@/app/components/EditableText';
import EditableButton from '@/app/components/EditableButton';
import { useEditorContext } from '@/lib/editor-context';
import BlockRenderer from '@/app/components/blocks/BlockRenderer';
import Link from 'next/link';
import NavMenu from '@/app/components/NavMenu';
import HeaderCartIcon from '@/app/components/ecommerce/HeaderCartIcon';
import HeaderLanguageSelector from '@/app/components/HeaderLanguageSelector';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { usePathname } from 'next/navigation';

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
    const updateSiteContent = context?.updateSiteContent || (() => { });
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const pathname = usePathname();
    const isEditor = pathname?.startsWith('/editor');

    const pPrimary = palette.primary || '#0f172a';
    const pSecondary = palette.secondary || '#22d3ee';
    const pAccent = palette.accent || '#0f172a';

    const titleFont = siteContent.titleFont || 'JetBrains Mono';
    const bodyFont = siteContent.bodyFont || 'Inter';

    return (
        <div className="template-wrapper min-h-screen text-gray-200" style={{ backgroundColor: pAccent, fontFamily: `"${bodyFont}", sans-serif` }}>
            <style dangerouslySetInnerHTML={{
                __html: `
                @import url('https://fonts.googleapis.com/css2?family=${titleFont.replace(/ /g, '+')}:wght@400;500;600;700;800&family=${bodyFont.replace(/ /g, '+')}:wght@400;500;600;700&display=swap');
                .template-wrapper h1, .template-wrapper h2, .template-wrapper h3, .template-wrapper h4, .template-wrapper h5, .template-wrapper h6, .template-wrapper .font-title {
                    font-family: "${titleFont}", monospace !important;
                }
            `}} />

            {/* Header — dark with neon accent line */}
            <header className="sticky top-0 z-50 border-b" style={{ backgroundColor: '#0a0f1a', borderColor: `${pSecondary}33` }}>
                <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, transparent, ${pSecondary}, transparent)` }} />
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex items-center justify-between h-16">
                        <Link
                            href={isEditor ? `/editor?siteId=${context?.siteId}&pageId=${context?.pages?.find(p => p.slug === 'home')?.id || ''}` : '/'}
                            aria-label="Home"
                            className="flex items-center gap-3 transition-opacity hover:opacity-90"
                        >
                            {siteContent.siteLogo ? (
                                <img src={siteContent.siteLogo} alt="" className="w-8 h-8 object-contain"  style={{ height: siteContent.headerLogoHeight ? `${siteContent.headerLogoHeight}px` : undefined, width: siteContent.headerLogoHeight ? 'auto' : undefined }} />
                            ) : (
                                <div className="w-8 h-8 border flex items-center justify-center font-mono font-bold text-sm" style={{ borderColor: pSecondary, color: pSecondary }}>
                                    {'//'}
                                </div>
                            )}
                            <EditableText
                                as="div"
                                contentKey="siteTitle"
                                styleData={siteContent['siteTitle__styles']}
                                content={siteContent.siteTitle}
                                defaultValue="EDGE_CO"
                                isEditMode={isEditMode}
                                onSave={updateSiteContent}
                                className="text-lg font-bold tracking-tight font-title"
                                style={{ color: pSecondary }}
                            />
                        </Link>

                        <div className="hidden md:flex items-center gap-6">
                            <NavMenu
                                className="flex items-center gap-6"
                                itemClassName="text-sm font-medium text-gray-400 hover:text-white transition-colors"
                            />
                            <HeaderLanguageSelector />
                            <HeaderCartIcon color={pSecondary} />
                            <EditableButton
                                contentKey="navButtonText"
                                label={siteContent.navButtonText}
                                linkData={siteContent.navButtonTextLink} iconData={siteContent.navButtonTextIcon}
                                defaultLabel="Launch"
                                isEditMode={isEditMode}
                                onSave={updateSiteContent}
                                className="px-5 py-2 text-sm font-bold transition-all hover:shadow-lg cursor-pointer inline-flex items-center justify-center"
                                style={{ backgroundColor: pSecondary, color: '#0a0f1a', boxShadow: `0 0 20px ${pSecondary}44` }}
                            />
                        </div>

                        <div className="flex md:hidden items-center gap-2">
                            <HeaderCartIcon color={pSecondary} />
                            <button className="p-2 text-gray-400" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                            </button>
                        </div>
                    </div>

                    {mobileMenuOpen && (
                        <div className="md:hidden border-t py-4 space-y-2" style={{ borderColor: `${pSecondary}22` }}>
                            <NavMenu
                                className="flex flex-col gap-1"
                                itemClassName="text-sm font-medium text-gray-400 hover:text-white py-2 px-3 transition-colors"
                            />
                            <EditableButton
                                contentKey="navButtonText"
                                label={siteContent.navButtonText}
                                linkData={siteContent.navButtonTextLink} iconData={siteContent.navButtonTextIcon}
                                defaultLabel="Launch"
                                isEditMode={isEditMode}
                                onSave={updateSiteContent}
                                className="w-full mt-3 px-5 py-2.5 font-bold text-sm cursor-pointer inline-flex items-center justify-center"
                                style={{ backgroundColor: pSecondary, color: '#0a0f1a' }}
                            />
                        </div>
                    )}
                </div>
            </header>

            <main className="flex-1 w-full flex flex-col min-h-[50vh]">
                {children || <BlockRenderer palette={palette} />}
            </main>

            {/* Footer — dark with accent line */}
            <footer className="py-12 border-t" style={{ backgroundColor: '#0a0f1a', borderColor: `${pSecondary}22` }}>
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            {siteContent.siteLogo ? (
                                <img src={siteContent.siteLogo} alt="" className="w-6 h-6 object-contain"  style={{ height: siteContent.footerLogoHeight ? `${siteContent.footerLogoHeight}px` : undefined, width: siteContent.footerLogoHeight ? 'auto' : undefined }} />
                            ) : (
                                <span className="font-mono text-xs" style={{ color: pSecondary }}>{'// '}</span>
                            )}
                            <span className="font-bold text-sm text-white">{siteContent.siteTitle || 'Edge Co'}</span>
                        </div>
                        <p className="text-xs text-gray-600">
                            Powered by <a href="https://keystoneweb.ca" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80 transition-opacity">Keystone</a>
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
