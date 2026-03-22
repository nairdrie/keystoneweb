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
 * Elegant Template — Premium, refined.
 * Frosted glass navbar, smooth gradients, modern feel.
 * Perfect for salons, consulting, agencies.
 */
export function ModernBlueTemplate({ palette, isEditMode, children }: MasterTemplateProps) {
    const context = useEditorContext();
    const siteContent = context?.siteContent || {};
    const updateSiteContent = context?.updateSiteContent || (() => { });
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const pathname = usePathname();
    const isEditor = pathname?.startsWith('/editor');

    const pPrimary = palette.primary || '#0369a1';
    const pSecondary = palette.secondary || '#0ea5e9';
    const pAccent = palette.accent || '#f0f9ff';

    const titleFont = siteContent.titleFont || 'Inter';
    const bodyFont = siteContent.bodyFont || 'Inter';

    return (
        <div className="template-wrapper min-h-screen text-slate-800 bg-white" style={{ fontFamily: `"${bodyFont}", sans-serif` }}>
            <style dangerouslySetInnerHTML={{
                __html: `
                @import url('https://fonts.googleapis.com/css2?family=${titleFont.replace(/ /g, '+')}:wght@400;500;600;700;800;900&family=${bodyFont.replace(/ /g, '+')}:wght@400;500;600;700&display=swap');
                .template-wrapper h1, .template-wrapper h2, .template-wrapper h3, .template-wrapper h4, .template-wrapper h5, .template-wrapper h6, .template-wrapper .font-title { 
                    font-family: "${titleFont}", sans-serif !important; 
                }
            `}} />
            {/* Header — frosted glass, elegant */}
            <nav className="sticky top-0 z-50 border-b border-white/20 shadow-sm bg-white/80 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex items-center justify-between h-18 py-4">
                        {/* Logo */}
                        <div className="flex items-center gap-3">
                            <Link
                                href={isEditor ? `/editor?siteId=${context?.siteId}&pageId=${context?.pages?.find(p => p.slug === 'home')?.id || ''}` : '/'}
                                aria-label="Home"
                                className="flex items-center gap-3 transition-opacity hover:opacity-90"
                            >
                                {siteContent.siteLogo ? (
                                    <img
                                        src={siteContent.siteLogo}
                                        alt={siteContent.siteTitle || 'Logo'}
                                        className="w-9 h-9 object-contain"
                                     style={{ height: siteContent.headerLogoHeight ? `${siteContent.headerLogoHeight}px` : undefined, width: siteContent.headerLogoHeight ? 'auto' : undefined }} />
                                ) : (
                                    <div
                                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                                        style={{ background: `linear-gradient(135deg, ${pPrimary}, ${pSecondary})` }}
                                    >
                                        <span className="text-white font-black text-sm">
                                            {(siteContent.siteTitle || 'E')[0]?.toUpperCase()}
                                        </span>
                                    </div>
                                )}
                                <EditableText
                                    as="div"
                                    contentKey="siteTitle"
                                    styleData={siteContent['siteTitle__styles']}
                                    content={siteContent.siteTitle}
                                    defaultValue="Elegant Co."
                                    isEditMode={isEditMode}
                                    onSave={updateSiteContent}
                                    className="text-xl font-bold tracking-tight font-title"
                                    style={{ color: pPrimary }}
                                />
                            </Link>
                        </div>

                        {/* Desktop Nav + CTA */}
                        <div className="hidden md:flex items-center gap-8">
                            <NavMenu
                                className="flex items-center gap-7"
                                itemClassName="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                                submenuClassName="bg-white/95 backdrop-blur-xl border border-slate-200 shadow-xl"
                            />
                            <HeaderLanguageSelector />
                            <HeaderCartIcon color={pPrimary} />
                            <EditableButton
                                contentKey="navButtonText"
                                label={siteContent.navButtonText}
                                linkData={siteContent.navButtonTextLink} iconData={siteContent.navButtonTextIcon}
                                defaultLabel="Book Now"
                                isEditMode={isEditMode}
                                onSave={updateSiteContent}
                                className="px-6 py-2.5 rounded-full text-white font-bold text-sm shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer inline-flex items-center justify-center"
                                style={{ background: `linear-gradient(135deg, ${pPrimary}, ${pSecondary})` }}
                            />
                        </div>

                        <div className="flex md:hidden items-center gap-2">
                            <HeaderCartIcon color={pPrimary} />
                            <button
                                className="p-2 text-slate-600"
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            >
                                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                            </button>
                        </div>
                    </div>

                    {/* Mobile Menu */}
                    {mobileMenuOpen && (
                        <div className="md:hidden border-t border-slate-100 py-4 space-y-2">
                            <NavMenu
                                className="flex flex-col gap-1"
                                itemClassName="text-sm font-medium text-slate-600 hover:text-slate-900 py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors"
                            />
                            <EditableButton
                                contentKey="navButtonText"
                                label={siteContent.navButtonText}
                                linkData={siteContent.navButtonTextLink} iconData={siteContent.navButtonTextIcon}
                                defaultLabel="Book Now"
                                isEditMode={isEditMode}
                                onSave={updateSiteContent}
                                className="w-full mt-3 px-5 py-2.5 rounded-full text-white font-bold text-sm cursor-pointer inline-flex items-center justify-center"
                                style={{ background: `linear-gradient(135deg, ${pPrimary}, ${pSecondary})` }}
                            />
                        </div>
                    )}
                </div>
            </nav>

            {/* Page Content */}
            <main className="flex-1 w-full min-h-[50vh]">
                {children || <BlockRenderer palette={palette} />}
            </main>

            {/* Footer */}
            <footer className="py-12 border-t border-slate-100">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            {siteContent.siteLogo ? (
                                <img
                                    src={siteContent.siteLogo}
                                    alt={siteContent.siteTitle || 'Logo'}
                                    className="w-6 h-6 object-contain"
                                 style={{ height: siteContent.footerLogoHeight ? `${siteContent.footerLogoHeight}px` : undefined, width: siteContent.footerLogoHeight ? 'auto' : undefined }} />
                            ) : (
                                <div
                                    className="w-6 h-6 rounded-lg flex items-center justify-center"
                                    style={{ background: `linear-gradient(135deg, ${pPrimary}, ${pSecondary})` }}
                                >
                                    <span className="text-white font-black text-[8px]">
                                        {(siteContent.siteTitle || 'E')[0]?.toUpperCase()}
                                    </span>
                                </div>
                            )}
                            <span className="font-bold text-sm text-slate-800">{siteContent.siteTitle || 'Elegant Co.'}</span>
                        </div>
                        <p className="text-sm text-slate-400">
                            Powered by <a href="https://keystoneweb.ca" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80 transition-opacity">Keystone</a>
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
