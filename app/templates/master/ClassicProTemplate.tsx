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
 * Bold Template — Strong, authoritative.
 * Dark sticky header, bold fonts, high contrast.
 * Perfect for trades, mechanics, HVAC, plumbing.
 */
export function BoldTemplate({ palette, isEditMode, children }: MasterTemplateProps) {
    const context = useEditorContext();
    const siteContent = context?.siteContent || {};
    const updateSiteContent = context?.updateSiteContent || (() => { });
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const pathname = usePathname();
    const isEditor = pathname?.startsWith('/editor');

    const pPrimary = palette.primary || '#0f172a';
    const pSecondary = palette.secondary || '#ef4444';
    const pAccent = palette.accent || '#f8fafc';

    const titleFont = siteContent.titleFont || 'Oswald';
    const bodyFont = siteContent.bodyFont || 'Roboto';

    return (
        <div className="template-wrapper min-h-screen" style={{ backgroundColor: pAccent, fontFamily: `"${bodyFont}", sans-serif` }}>
            <style dangerouslySetInnerHTML={{
                __html: `
                @import url('https://fonts.googleapis.com/css2?family=${titleFont.replace(/ /g, '+')}:wght@400;500;600;700;800;900&family=${bodyFont.replace(/ /g, '+')}:wght@400;500;600;700&display=swap');
                .template-wrapper h1, .template-wrapper h2, .template-wrapper h3, .template-wrapper h4, .template-wrapper h5, .template-wrapper h6, .template-wrapper .font-title { 
                    font-family: "${titleFont}", sans-serif !important; 
                }
            `}} />
            {/* Header — dark, bold, authoritative */}
            <header className="sticky top-0 z-50 shadow-lg" style={{ backgroundColor: pPrimary }}>
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo/Title */}
                        <div className="flex items-center gap-3">
                            <Link
                                href={isEditor ? `/editor?siteId=${context?.siteId}&pageId=${context?.pages?.find(p => p.slug === 'home')?.id || ''}` : '/'}
                                aria-label="Home"
                                className="flex items-center gap-3 transition-opacity hover:opacity-90"
                            >
                                {siteContent.siteLogo ? (
                                    <img src={siteContent.siteLogo} alt="" className="w-8 h-8 object-contain rounded-md"  style={{ height: siteContent.headerLogoHeight ? `${siteContent.headerLogoHeight}px` : undefined, width: siteContent.headerLogoHeight ? 'auto' : undefined }} />
                                ) : (
                                    <div className="w-8 h-8 rounded-md flex items-center justify-center font-black text-sm text-white" style={{ backgroundColor: pSecondary }}>
                                        {(siteContent.siteTitle || 'B')[0]?.toUpperCase()}
                                    </div>
                                )}
                                <EditableText
                                    as="div"
                                    contentKey="siteTitle"
                                    styleData={siteContent['siteTitle__styles']}
                                    content={siteContent.siteTitle}
                                    defaultValue="YOUR BUSINESS"
                                    isEditMode={isEditMode}
                                    onSave={updateSiteContent}
                                    className="text-lg font-black tracking-tight text-white font-title"
                                />
                            </Link>
                        </div>

                        {/* Desktop Nav */}
                        <div className="hidden md:flex items-center gap-6">
                            <NavMenu
                                className="flex items-center gap-6"
                                itemClassName="text-sm font-semibold text-white/80 hover:text-white transition-colors tracking-wide uppercase"
                            />
                            <HeaderLanguageSelector />
                            <HeaderCartIcon color="#ffffff" />
                            <EditableButton
                                contentKey="navButtonText"
                                label={siteContent.navButtonText}
                                linkData={siteContent.navButtonTextLink} iconData={siteContent.navButtonTextIcon}
                                defaultLabel="Get Quote"
                                isEditMode={isEditMode}
                                onSave={updateSiteContent}
                                className="px-5 py-2 rounded-md font-bold text-sm transition-all hover:scale-105 text-white cursor-pointer inline-flex items-center justify-center"
                                style={{ backgroundColor: pSecondary }}
                            />
                        </div>

                        <div className="flex md:hidden items-center gap-2">
                            <HeaderCartIcon color="#ffffff" />
                            <button
                                className="text-white p-2"
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            >
                                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                            </button>
                        </div>
                    </div>

                    {/* Mobile Menu */}
                    {mobileMenuOpen && (
                        <div className="md:hidden border-t border-white/10 py-4 space-y-2">
                            <NavMenu
                                className="flex flex-col gap-2"
                                itemClassName="text-sm font-semibold text-white/80 hover:text-white py-2 px-2 rounded-md hover:bg-white/5 transition-colors"
                            />
                            <EditableButton
                                contentKey="navButtonText"
                                label={siteContent.navButtonText}
                                linkData={siteContent.navButtonTextLink} iconData={siteContent.navButtonTextIcon}
                                defaultLabel="Get Quote"
                                isEditMode={isEditMode}
                                onSave={updateSiteContent}
                                className="w-full mt-2 px-5 py-2.5 rounded-md font-bold text-sm text-white flex items-center justify-center"
                                style={{ backgroundColor: pSecondary }}
                            />
                        </div>
                    )}
                </div>
            </header>

            {/* Page Content */}
            <main className="flex-1 w-full flex flex-col min-h-[50vh]">
                <BlockRenderer palette={palette} />
            </main>

            {/* Footer */}
            <footer className="py-12 text-white" style={{ backgroundColor: pPrimary }}>
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            {siteContent.siteLogo ? (
                                <img src={siteContent.siteLogo} alt="" className="w-6 h-6 object-contain rounded"  style={{ height: siteContent.footerLogoHeight ? `${siteContent.footerLogoHeight}px` : undefined, width: siteContent.footerLogoHeight ? 'auto' : undefined }} />
                            ) : (
                                <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-black text-white" style={{ backgroundColor: pSecondary }}>
                                    {(siteContent.siteTitle || 'B')[0]?.toUpperCase()}
                                </div>
                            )}
                            <span className="font-bold text-sm">{siteContent.siteTitle || 'Your Business'}</span>
                        </div>
                        <p className="text-sm text-white/50">
                            Powered by <a href="https://keystoneweb.ca" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80 transition-opacity">Keystone</a>
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
