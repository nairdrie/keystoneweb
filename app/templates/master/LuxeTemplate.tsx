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
 * Luxe Template — Sophisticated, high-end.
 * Centered logo above nav, serif fonts, warm/gold accents.
 * Perfect for salons, consulting, creative studios, boutique shops.
 */
export function LuxeTemplate({ palette, isEditMode, children }: MasterTemplateProps) {
    const context = useEditorContext();
    const siteContent = context?.siteContent || {};
    const updateSiteContent = context?.updateSiteContent || (() => { });
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const pathname = usePathname();
    const isEditor = pathname?.startsWith('/editor');

    const pPrimary = palette.primary || '#1c1917';
    const pSecondary = palette.secondary || '#b45309';
    const pAccent = palette.accent || '#fef7ed';

    const titleFont = siteContent.titleFont || 'Playfair Display';
    const bodyFont = siteContent.bodyFont || 'Lato';

    return (
        <div className="template-wrapper min-h-screen" style={{ backgroundColor: '#ffffff', fontFamily: `"${bodyFont}", sans-serif` }}>
            <style dangerouslySetInnerHTML={{
                __html: `
                @import url('https://fonts.googleapis.com/css2?family=${titleFont.replace(/ /g, '+')}:wght@400;500;600;700;800;900&family=${bodyFont.replace(/ /g, '+')}:wght@300;400;500;600;700&display=swap');
                .template-wrapper h1, .template-wrapper h2, .template-wrapper h3, .template-wrapper h4, .template-wrapper h5, .template-wrapper h6, .template-wrapper .font-title {
                    font-family: "${titleFont}", serif !important;
                }
            `}} />

            {/* Header — centered logo, nav below */}
            <header className="border-b border-gray-100">
                {/* Top bar with CTA */}
                <div className="text-center py-6 px-4">
                    <Link
                        href={isEditor ? `/editor?siteId=${context?.siteId}&pageId=${context?.pages?.find(p => p.slug === 'home')?.id || ''}` : '/'}
                        aria-label="Home"
                        className="inline-flex flex-col items-center gap-2 transition-opacity hover:opacity-90"
                    >
                        {siteContent.siteLogo ? (
                            <img src={siteContent.siteLogo} alt="" className="w-12 h-12 object-contain"  style={{ height: siteContent.headerLogoHeight ? `${siteContent.headerLogoHeight}px` : undefined, width: siteContent.headerLogoHeight ? 'auto' : undefined }} />
                        ) : (
                            <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white" style={{ backgroundColor: pSecondary }}>
                                {(siteContent.siteTitle || 'L')[0]?.toUpperCase()}
                            </div>
                        )}
                        <EditableText
                            as="div"
                            contentKey="siteTitle"
                            styleData={siteContent['siteTitle__styles']}
                            content={siteContent.siteTitle}
                            defaultValue="LUXE STUDIO"
                            isEditMode={isEditMode}
                            onSave={updateSiteContent}
                            className="text-2xl font-bold tracking-[0.2em] uppercase font-title"
                            style={{ color: pPrimary }}
                        />
                    </Link>
                </div>

                {/* Nav bar */}
                <nav className="border-t border-gray-100">
                    <div className="max-w-6xl mx-auto px-6">
                        <div className="hidden md:flex items-center justify-center h-12 gap-8">
                            <NavMenu
                                className="flex items-center gap-8"
                                itemClassName="text-xs font-medium tracking-[0.15em] uppercase text-gray-500 hover:text-gray-900 transition-colors"
                                submenuClassName="bg-white border border-gray-100 shadow-lg"
                            />
                            <HeaderLanguageSelector />
                            <HeaderCartIcon color={pPrimary} />
                            <EditableButton
                                contentKey="navButtonText"
                                label={siteContent.navButtonText}
                                linkData={siteContent.navButtonTextLink} iconData={siteContent.navButtonTextIcon}
                                defaultLabel="Reserve"
                                isEditMode={isEditMode}
                                onSave={updateSiteContent}
                                className="px-6 py-1.5 border-2 text-xs font-semibold tracking-[0.15em] uppercase transition-all cursor-pointer inline-flex items-center justify-center"
                                style={{ borderColor: pSecondary, color: pSecondary, backgroundColor: 'transparent' }}
                            />
                        </div>

                        <div className="flex md:hidden items-center justify-between h-12">
                            <HeaderCartIcon color={pPrimary} />
                            <button className="p-2 text-gray-600" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                            </button>
                        </div>

                        {mobileMenuOpen && (
                            <div className="md:hidden border-t border-gray-100 py-4 space-y-2">
                                <NavMenu
                                    className="flex flex-col items-center gap-3"
                                    itemClassName="text-xs font-medium tracking-[0.15em] uppercase text-gray-500 hover:text-gray-900 py-2 transition-colors"
                                />
                                <EditableButton
                                    contentKey="navButtonText"
                                    label={siteContent.navButtonText}
                                    linkData={siteContent.navButtonTextLink} iconData={siteContent.navButtonTextIcon}
                                    defaultLabel="Reserve"
                                    isEditMode={isEditMode}
                                    onSave={updateSiteContent}
                                    className="w-full mt-3 px-5 py-2.5 border-2 text-xs font-semibold tracking-[0.15em] uppercase flex items-center justify-center"
                                    style={{ borderColor: pSecondary, color: pSecondary, backgroundColor: 'transparent' }}
                                />
                            </div>
                        )}
                    </div>
                </nav>
            </header>

            <main className="flex-1 w-full flex flex-col min-h-[50vh]">
                {children || <BlockRenderer palette={palette} />}
            </main>

            {/* Footer — elegant with columns */}
            <footer className="py-16 border-t border-gray-100" style={{ backgroundColor: pPrimary }}>
                <div className="max-w-6xl mx-auto px-6 text-center">
                    <div className="flex flex-col items-center gap-4 mb-4">
                        {siteContent.siteLogo ? (
                            <img src={siteContent.siteLogo} alt="" className="w-10 h-10 object-contain rounded-full"  style={{ height: siteContent.footerLogoHeight ? `${siteContent.footerLogoHeight}px` : undefined, width: siteContent.footerLogoHeight ? 'auto' : undefined }} />
                        ) : (
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: pSecondary }}>
                                {(siteContent.siteTitle || 'L')[0]?.toUpperCase()}
                            </div>
                        )}
                        <div className="text-2xl font-bold tracking-[0.2em] uppercase font-title text-white/90">
                            {siteContent.siteTitle || 'LUXE STUDIO'}
                        </div>
                    </div>
                    <div className="w-12 border-t mx-auto mb-6" style={{ borderColor: pSecondary }} />
                    <p className="text-sm text-white/40">
                        Powered by <a href="https://keystoneweb.ca" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80 transition-opacity">Keystone</a>
                    </p>
                </div>
            </footer>
        </div>
    );
}
