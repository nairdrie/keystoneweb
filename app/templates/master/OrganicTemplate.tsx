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
 * Organic Template — Warm, natural, handcrafted.
 * Off-white warm background, rounded shapes, earthy tones, friendly feel.
 * Perfect for landscaping, handmade/crafts, salons, freelancers, bakeries.
 */
export function OrganicTemplate({ palette, isEditMode, children }: MasterTemplateProps) {
    const context = useEditorContext();
    const siteContent = context?.siteContent || {};
    const updateSiteContent = context?.updateSiteContent || (() => { });
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const pathname = usePathname();
    const isEditor = pathname?.startsWith('/editor');

    const pPrimary = palette.primary || '#78350f';
    const pSecondary = palette.secondary || '#d97706';
    const pAccent = palette.accent || '#fffbeb';

    const titleFont = siteContent.titleFont || 'Libre Baskerville';
    const bodyFont = siteContent.bodyFont || 'Karla';

    return (
        <div className="template-wrapper min-h-screen" style={{ backgroundColor: pAccent, fontFamily: `"${bodyFont}", sans-serif` }}>
            <style dangerouslySetInnerHTML={{
                __html: `
                @import url('https://fonts.googleapis.com/css2?family=${titleFont.replace(/ /g, '+')}:wght@400;700&family=${bodyFont.replace(/ /g, '+')}:wght@400;500;600;700&display=swap');
                .template-wrapper h1, .template-wrapper h2, .template-wrapper h3, .template-wrapper h4, .template-wrapper h5, .template-wrapper h6, .template-wrapper .font-title {
                    font-family: "${titleFont}", serif !important;
                }
            `}} />

            {/* Header — warm, centered feel */}
            <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm shadow-sm">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="flex items-center justify-between h-16">
                        <Link
                            href={isEditor ? `/editor?siteId=${context?.siteId}&pageId=${context?.pages?.find(p => p.slug === 'home')?.id || ''}` : '/'}
                            aria-label="Home"
                            className="flex items-center gap-3 transition-opacity hover:opacity-90"
                        >
                            {siteContent.siteLogo ? (
                                <img
                                    src={siteContent.siteLogo}
                                    alt={siteContent.siteTitle || 'Logo'}
                                    className="w-9 h-9 object-contain rounded-full"
                                 style={{ height: siteContent.headerLogoHeight ? `${siteContent.headerLogoHeight}px` : undefined, width: siteContent.headerLogoHeight ? 'auto' : undefined }} />
                            ) : (
                                <div className="w-9 h-9 rounded-full flex items-center justify-center font-serif font-bold text-sm text-white" style={{ backgroundColor: pSecondary }}>
                                    {(siteContent.siteTitle || 'O')[0]?.toUpperCase()}
                                </div>
                            )}
                            <EditableText
                                as="div"
                                contentKey="siteTitle"
                                styleData={siteContent['siteTitle__styles']}
                                content={siteContent.siteTitle}
                                defaultValue="Organic Co."
                                isEditMode={isEditMode}
                                onSave={updateSiteContent}
                                className="text-xl font-title italic"
                                style={{ color: pPrimary }}
                            />
                        </Link>

                        <div className="hidden md:flex items-center gap-7">
                            <NavMenu
                                className="flex items-center gap-6"
                                itemClassName="text-sm font-medium text-gray-600 hover:text-amber-800 transition-colors"
                            />
                            <HeaderLanguageSelector />
                            <HeaderCartIcon color={pPrimary} />
                            <EditableButton
                                contentKey="navButtonText"
                                label={siteContent.navButtonText}
                                linkData={siteContent.navButtonTextLink}
                                iconData={siteContent.navButtonTextIcon}
                                defaultLabel="Shop Now"
                                isEditMode={isEditMode}
                                onSave={updateSiteContent}
                                className="px-6 py-2 rounded-full text-white text-sm font-semibold shadow-sm hover:shadow-md transition-all cursor-pointer inline-flex items-center justify-center"
                                style={{ backgroundColor: pSecondary }}
                            />
                        </div>

                        <div className="flex md:hidden items-center gap-2">
                            <HeaderCartIcon color={pPrimary} />
                            <button className="p-2 text-gray-500" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {mobileMenuOpen && (
                        <div className="md:hidden border-t border-amber-100 py-4 space-y-2">
                            <NavMenu
                                className="flex flex-col gap-1"
                                itemClassName="text-sm font-medium text-gray-600 hover:text-amber-800 py-2 px-3 rounded-lg hover:bg-amber-50 transition-colors"
                            />
                            <EditableButton
                                contentKey="navButtonText"
                                label={siteContent.navButtonText}
                                linkData={siteContent.navButtonTextLink}
                                iconData={siteContent.navButtonTextIcon}
                                defaultLabel="Shop Now"
                                isEditMode={isEditMode}
                                onSave={updateSiteContent}
                                className="w-full mt-3 px-5 py-2.5 rounded-full text-white text-sm font-semibold flex items-center justify-center"
                                style={{ backgroundColor: pSecondary }}
                            />
                        </div>
                    )}
                </div>
            </header>

            <main className="flex-1 w-full flex flex-col min-h-[50vh]">
                {children || <BlockRenderer palette={palette} />}
            </main>

            {/* Footer — warm with leaf/nature motif */}
            <footer className="py-16 border-t" style={{ borderColor: `${pSecondary}33` }}>
                <div className="max-w-6xl mx-auto px-6 text-center">
                    <div className="flex items-center justify-center gap-3 mb-3">
                        {siteContent.siteLogo ? (
                            <img
                                src={siteContent.siteLogo}
                                alt={siteContent.siteTitle || 'Logo'}
                                className="w-8 h-8 object-contain rounded-full"
                             style={{ height: siteContent.footerLogoHeight ? `${siteContent.footerLogoHeight}px` : undefined, width: siteContent.footerLogoHeight ? 'auto' : undefined }} />
                        ) : (
                            <div className="w-8 h-8 rounded-full flex items-center justify-center font-serif font-bold text-[10px] text-white" style={{ backgroundColor: pSecondary }}>
                                {(siteContent.siteTitle || 'O')[0]?.toUpperCase()}
                            </div>
                        )}
                        <div className="font-title italic text-lg" style={{ color: pPrimary }}>
                            {siteContent.siteTitle || 'Organic Co.'}
                        </div>
                    </div>
                    <p className="text-sm text-gray-400">
                        &copy; {new Date().getFullYear()} {siteContent.siteTitle || 'Organic Co.'}. Made with care.
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                        Powered by <a href="https://keystoneweb.ca" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80 transition-opacity">Keystone</a>
                    </p>
                </div>
            </footer>
        </div>
    );
}
