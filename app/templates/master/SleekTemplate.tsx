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
 * Sleek Template — Ultra-minimal, bold typography.
 * Thin header, massive type, monochrome + single accent, generous whitespace.
 * Perfect for freelancers, agencies, consulting, digital products, portfolios.
 */
export function SleekTemplate({ palette, isEditMode, children }: MasterTemplateProps) {
    const context = useEditorContext();
    const siteContent = context?.siteContent || {};
    const updateSiteContent = context?.updateSiteContent || (() => { });
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const pathname = usePathname();
    const isEditor = pathname?.startsWith('/editor');

    const pPrimary = palette.primary || '#111111';
    const pSecondary = palette.secondary || '#6366f1';
    const pAccent = palette.accent || '#ffffff';

    const titleFont = siteContent.titleFont || 'Sora';
    const bodyFont = siteContent.bodyFont || 'Inter';

    return (
        <div className="template-wrapper min-h-screen" style={{ backgroundColor: pAccent, fontFamily: `"${bodyFont}", sans-serif` }}>
            <style dangerouslySetInnerHTML={{
                __html: `
                @import url('https://fonts.googleapis.com/css2?family=${titleFont.replace(/ /g, '+')}:wght@400;500;600;700;800&family=${bodyFont.replace(/ /g, '+')}:wght@400;500;600;700&display=swap');
                .template-wrapper h1, .template-wrapper h2, .template-wrapper h3, .template-wrapper h4, .template-wrapper h5, .template-wrapper h6, .template-wrapper .font-title {
                    font-family: "${titleFont}", sans-serif !important;
                }
            `}} />

            {/* Header — ultra thin, minimal */}
            <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex items-center justify-between h-14">
                        <Link
                            href={isEditor ? `/editor?siteId=${context?.siteId}&pageId=${context?.pages?.find(p => p.slug === 'home')?.id || ''}` : '/'}
                            aria-label="Home"
                            className="flex items-center gap-2 transition-opacity hover:opacity-90"
                        >
                            <EditableImage
                                contentKey="siteLogo"
                                imageUrl={siteContent.siteLogo}
                                isEditMode={isEditMode}
                                onSave={updateSiteContent}
                                className="w-7 h-7 object-contain"
                                editOverlayStyle="icon"
                                allowUnsplash={false}
                                fallback={
                                    <div className="w-7 h-7 rounded-sm flex items-center justify-center font-bold text-xs text-white" style={{ backgroundColor: pPrimary }}>
                                        {(siteContent.siteTitle || 'S')[0]?.toUpperCase()}
                                    </div>
                                }
                            />
                            <EditableText
                                as="div"
                                contentKey="siteTitle"
                                styleData={siteContent['siteTitle__styles']}
                                content={siteContent.siteTitle}
                                defaultValue="Sleek"
                                isEditMode={isEditMode}
                                onSave={updateSiteContent}
                                className="text-base font-semibold tracking-tight font-title"
                                style={{ color: pPrimary }}
                            />
                        </Link>

                        <div className="hidden md:flex items-center gap-6">
                            <NavMenu
                                className="flex items-center gap-5"
                                itemClassName="text-sm text-gray-400 hover:text-gray-900 transition-colors"
                            />
                            <HeaderLanguageSelector />
                            <HeaderCartIcon color={pPrimary} />
                            <EditableButton
                                contentKey="navButtonText"
                                label={siteContent.navButtonText}
                                linkData={siteContent.navButtonTextLink} iconData={siteContent.navButtonTextIcon}
                                defaultLabel="Contact"
                                isEditMode={isEditMode}
                                onSave={updateSiteContent}
                                className="px-5 py-1.5 rounded-sm text-white text-sm font-medium transition-all hover:opacity-90 cursor-pointer inline-flex items-center justify-center"
                                style={{ backgroundColor: pPrimary }}
                            />
                        </div>

                        <div className="flex md:hidden items-center gap-2">
                            <HeaderCartIcon color={pPrimary} />
                            <button className="p-2 text-gray-400" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {mobileMenuOpen && (
                        <div className="md:hidden border-t border-gray-100 py-3 space-y-1">
                            <NavMenu
                                className="flex flex-col"
                                itemClassName="text-sm text-gray-400 hover:text-gray-900 py-2 px-2 transition-colors"
                            />
                            <EditableButton
                                contentKey="navButtonText"
                                label={siteContent.navButtonText}
                                linkData={siteContent.navButtonTextLink} iconData={siteContent.navButtonTextIcon}
                                defaultLabel="Contact"
                                isEditMode={isEditMode}
                                onSave={updateSiteContent}
                                className="w-full mt-2 px-5 py-2 rounded-sm text-white text-sm font-medium flex items-center justify-center"
                                style={{ backgroundColor: pPrimary }}
                            />
                        </div>
                    )}
                </div>
            </header>

            <main className="flex-1 w-full flex flex-col min-h-[50vh]">
                {children || <BlockRenderer palette={palette} />}
            </main>

            {/* Footer — dead simple */}
            <footer className="py-8 border-t border-gray-100">
                <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
                    <span className="text-sm font-medium" style={{ color: pPrimary }}>{siteContent.siteTitle || 'Sleek'}</span>
                    <p className="text-xs text-gray-300">
                        &copy; {new Date().getFullYear()}
                    </p>
                </div>
            </footer>
        </div>
    );
}
