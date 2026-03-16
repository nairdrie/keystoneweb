'use client';

import EditableText from '@/app/components/EditableText';
import EditableButton from '@/app/components/EditableButton';
import EditableImage from '@/app/components/EditableImage';
import { useEditorContext } from '@/lib/editor-context';
import BlockRenderer from '@/app/components/blocks/BlockRenderer';
import Link from 'next/link';
import NavMenu from '@/app/components/NavMenu';
import HeaderCartIcon from '@/app/components/ecommerce/HeaderCartIcon';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { usePathname } from 'next/navigation';

interface MasterTemplateProps {
    palette: Record<string, string>;
    isEditMode: boolean;
    children?: React.ReactNode;
}

/**
 * Airy Template — Light, spacious, friendly.
 * Transparent floating nav, rounded elements, soft shadows, pastel-friendly.
 * Perfect for cleaning, landscaping, handmade/crafts, wellness.
 */
export function AiryTemplate({ palette, isEditMode, children }: MasterTemplateProps) {
    const context = useEditorContext();
    const siteContent = context?.siteContent || {};
    const updateSiteContent = context?.updateSiteContent || (() => { });
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const pathname = usePathname();
    const isEditor = pathname?.startsWith('/editor');

    const pPrimary = palette.primary || '#059669';
    const pSecondary = palette.secondary || '#34d399';
    const pAccent = palette.accent || '#ecfdf5';

    const titleFont = siteContent.titleFont || 'Nunito';
    const bodyFont = siteContent.bodyFont || 'Nunito';

    return (
        <div className="template-wrapper min-h-screen" style={{ backgroundColor: pAccent, fontFamily: `"${bodyFont}", sans-serif` }}>
            <style dangerouslySetInnerHTML={{
                __html: `
                @import url('https://fonts.googleapis.com/css2?family=${titleFont.replace(/ /g, '+')}:wght@400;500;600;700;800;900&family=${bodyFont.replace(/ /g, '+')}:wght@400;500;600;700&display=swap');
                .template-wrapper h1, .template-wrapper h2, .template-wrapper h3, .template-wrapper h4, .template-wrapper h5, .template-wrapper h6, .template-wrapper .font-title {
                    font-family: "${titleFont}", sans-serif !important;
                }
                /* First block top-padding offset for floating header — adds header height to existing block padding */
                .first-block-offset section.py-40 { padding-top: calc(10rem + var(--header-offset, 0px)) !important; }
                .first-block-offset section.py-24 { padding-top: calc(6rem + var(--header-offset, 0px)) !important; }
                .first-block-offset section.py-20 { padding-top: calc(5rem + var(--header-offset, 0px)) !important; }
                .first-block-offset section.py-16 { padding-top: calc(4rem + var(--header-offset, 0px)) !important; }
                .first-block-offset section.py-12 { padding-top: calc(3rem + var(--header-offset, 0px)) !important; }
                .first-block-offset section:not([class*="py-"]) { padding-top: var(--header-offset, 0px) !important; }
            `}} />

            {/* Header — floating pill nav. Sticky with h-0 so it takes no document space;
                the inner pill is absolutely positioned to overlay content. */}
            <header className="sticky top-0 z-50 h-0 overflow-visible">
                <div className="pt-3 px-4">
                <div className="max-w-6xl mx-auto bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg shadow-black/5 border border-white/50 px-5">
                    <div className="flex items-center justify-between h-14">
                        <Link
                            href={isEditor ? `/editor?siteId=${context?.siteId}&pageId=${context?.pages?.find(p => p.slug === 'home')?.id || ''}` : '/'}
                            aria-label="Home"
                            className="flex items-center gap-2.5 transition-opacity hover:opacity-90"
                        >
                            <EditableImage
                                contentKey="siteLogo"
                                imageUrl={siteContent.siteLogo}
                                isEditMode={isEditMode}
                                onSave={updateSiteContent}
                                className="w-8 h-8 object-contain rounded-full"
                                editOverlayStyle="icon"
                                allowUnsplash={false}
                                fallback={
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white" style={{ backgroundColor: pPrimary }}>
                                        {(siteContent.siteTitle || 'A')[0]?.toUpperCase()}
                                    </div>
                                }
                            />
                            <EditableText
                                as="div"
                                contentKey="siteTitle"
                                styleData={siteContent['siteTitle__styles']}
                                content={siteContent.siteTitle}
                                defaultValue="Airy Studio"
                                isEditMode={isEditMode}
                                onSave={updateSiteContent}
                                className="text-lg font-bold font-title"
                                style={{ color: pPrimary }}
                            />
                        </Link>

                        <div className="hidden md:flex items-center gap-6">
                            <NavMenu
                                className="flex items-center gap-5"
                                itemClassName="text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
                            />
                            <HeaderCartIcon color={pPrimary} />
                            <EditableButton
                                contentKey="navButtonText"
                                label={siteContent.navButtonText}
                                linkData={siteContent.navButtonTextLink}
                                defaultLabel="Contact Us"
                                isEditMode={isEditMode}
                                onSave={updateSiteContent}
                                className="px-5 py-2 rounded-full text-white text-sm font-semibold shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer inline-flex items-center justify-center"
                                style={{ backgroundColor: pPrimary }}
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
                        <div className="md:hidden border-t border-gray-100 py-3 space-y-1">
                            <NavMenu
                                className="flex flex-col"
                                itemClassName="text-sm font-medium text-gray-500 hover:text-gray-800 py-2 px-3 rounded-xl hover:bg-gray-50 transition-colors"
                            />
                            <button
                                className="w-full mt-2 px-5 py-2.5 rounded-full text-white text-sm font-semibold"
                                style={{ backgroundColor: pPrimary }}
                            >
                                {siteContent.navButtonText || 'Contact Us'}
                            </button>
                        </div>
                    )}
                </div>
                </div>
            </header>

            <main className="flex-1 w-full flex flex-col min-h-[50vh]">
                {children || <BlockRenderer palette={palette} headerOffset={80} />}
            </main>

            {/* Footer — soft rounded */}
            <footer className="py-12 mt-8">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                        <div className="flex items-center justify-center gap-2 mb-3">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: pPrimary }}>
                                {(siteContent.siteTitle || 'A')[0]?.toUpperCase()}
                            </div>
                            <span className="font-bold text-sm" style={{ color: pPrimary }}>{siteContent.siteTitle || 'Airy Studio'}</span>
                        </div>
                        <p className="text-xs text-gray-400">
                            Powered by Keystone
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
