'use client';

import EditableText from '@/app/components/EditableText';
import EditableButton from '@/app/components/EditableButton';
import EditableImage from '@/app/components/EditableImage';
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
 * Vivid Template — Bold, colorful, energetic.
 * Thick colored header band, chunky sans-serif, asymmetric CTA.
 * Perfect for fitness, ecommerce, agencies, creative businesses.
 */
export function VividTemplate({ palette, isEditMode, children }: MasterTemplateProps) {
    const context = useEditorContext();
    const siteContent = context?.siteContent || {};
    const updateSiteContent = context?.updateSiteContent || (() => { });
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const pathname = usePathname();
    const isEditor = pathname?.startsWith('/editor');

    const pPrimary = palette.primary || '#7c3aed';
    const pSecondary = palette.secondary || '#f59e0b';
    const pAccent = palette.accent || '#faf5ff';

    const titleFont = siteContent.titleFont || 'Space Grotesk';
    const bodyFont = siteContent.bodyFont || 'DM Sans';

    return (
        <div className="template-wrapper min-h-screen" style={{ backgroundColor: '#ffffff', fontFamily: `"${bodyFont}", sans-serif` }}>
            <style dangerouslySetInnerHTML={{
                __html: `
                @import url('https://fonts.googleapis.com/css2?family=${titleFont.replace(/ /g, '+')}:wght@400;500;600;700&family=${bodyFont.replace(/ /g, '+')}:wght@400;500;600;700&display=swap');
                .template-wrapper h1, .template-wrapper h2, .template-wrapper h3, .template-wrapper h4, .template-wrapper h5, .template-wrapper h6, .template-wrapper .font-title {
                    font-family: "${titleFont}", sans-serif !important;
                }
            `}} />

            {/* Header — bold colored band */}
            <header className="sticky top-0 z-50" style={{ backgroundColor: pPrimary }}>
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex items-center justify-between h-16">
                        <Link
                            href={isEditor ? `/editor?siteId=${context?.siteId}&pageId=${context?.pages?.find(p => p.slug === 'home')?.id || ''}` : '/'}
                            aria-label="Home"
                            className="flex items-center gap-3 transition-opacity hover:opacity-90"
                        >
                            <EditableImage
                                contentKey="siteLogo"
                                imageUrl={siteContent.siteLogo}
                                isEditMode={isEditMode}
                                onSave={updateSiteContent}
                                className="w-9 h-9 object-contain rounded-lg"
                                editOverlayStyle="icon"
                                allowUnsplash={false}
                                fallback={
                                    <div className="w-9 h-9 rounded-lg flex items-center justify-center font-black text-sm" style={{ backgroundColor: pSecondary, color: pPrimary }}>
                                        {(siteContent.siteTitle || 'V')[0]?.toUpperCase()}
                                    </div>
                                }
                            />
                            <EditableText
                                as="div"
                                contentKey="siteTitle"
                                styleData={siteContent['siteTitle__styles']}
                                content={siteContent.siteTitle}
                                defaultValue="VIVID CO"
                                isEditMode={isEditMode}
                                onSave={updateSiteContent}
                                className="text-lg font-bold text-white font-title"
                            />
                        </Link>

                        <div className="hidden md:flex items-center gap-6">
                            <NavMenu
                                className="flex items-center gap-6"
                                itemClassName="text-sm font-medium text-white/80 hover:text-white transition-colors"
                            />
                            <HeaderLanguageSelector />
                            <HeaderCartIcon color="#ffffff" />
                            <EditableButton
                                contentKey="navButtonText"
                                label={siteContent.navButtonText}
                                linkData={siteContent.navButtonTextLink}
                                iconData={siteContent.navButtonTextIcon}
                                iconData={siteContent.navButtonTextIcon}
                                defaultLabel="Get Started"
                                isEditMode={isEditMode}
                                onSave={updateSiteContent}
                                className="px-6 py-2 rounded-full font-bold text-sm transition-all hover:scale-105 cursor-pointer inline-flex items-center justify-center"
                                style={{ backgroundColor: pSecondary, color: pPrimary }}
                            />
                        </div>

                        <div className="flex md:hidden items-center gap-2">
                            <HeaderCartIcon color="#ffffff" />
                            <button className="text-white p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                            </button>
                        </div>
                    </div>

                    {mobileMenuOpen && (
                        <div className="md:hidden border-t border-white/20 py-4 space-y-2">
                            <NavMenu
                                className="flex flex-col gap-2"
                                itemClassName="text-sm font-medium text-white/80 hover:text-white py-2 px-2 rounded-lg hover:bg-white/10 transition-colors"
                            />
                            <EditableButton
                                contentKey="navButtonText"
                                label={siteContent.navButtonText}
                                linkData={siteContent.navButtonTextLink}
                                iconData={siteContent.navButtonTextIcon}
                                defaultLabel="Get Started"
                                isEditMode={isEditMode}
                                onSave={updateSiteContent}
                                className="w-full mt-3 px-5 py-2.5 rounded-full font-bold text-sm flex items-center justify-center"
                                style={{ backgroundColor: pSecondary, color: pPrimary }}
                            />
                        </div>
                    )}
                </div>
            </header>

            <main className="flex-1 w-full flex flex-col min-h-[50vh]">
                {children || <BlockRenderer palette={palette} />}
            </main>

            {/* Footer — bold with gradient */}
            <footer className="py-16 text-white" style={{ background: `linear-gradient(135deg, ${pPrimary}, ${pPrimary}dd)` }}>
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm" style={{ backgroundColor: pSecondary, color: pPrimary }}>
                                {(siteContent.siteTitle || 'V')[0]?.toUpperCase()}
                            </div>
                            <span className="font-bold text-lg">{siteContent.siteTitle || 'Vivid Co'}</span>
                        </div>
                        <p className="text-sm text-white/40">
                            Powered by Keystone
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
