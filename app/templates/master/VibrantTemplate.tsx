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
 * Vibrant Template — Playful, colorful, dynamic.
 * Gradient header, rounded nav elements, friendly typography, dynamic color usage.
 * Perfect for fitness, subscription boxes, creative studios, retail, e-commerce.
 */
export function VibrantTemplate({ palette, isEditMode, children }: MasterTemplateProps) {
    const context = useEditorContext();
    const siteContent = context?.siteContent || {};
    const updateSiteContent = context?.updateSiteContent || (() => { });
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const pathname = usePathname();
    const isEditor = pathname?.startsWith('/editor');

    const pPrimary = palette.primary || '#e11d48';
    const pSecondary = palette.secondary || '#f97316';
    const pAccent = palette.accent || '#fff1f2';

    const titleFont = siteContent.titleFont || 'Plus Jakarta Sans';
    const bodyFont = siteContent.bodyFont || 'Plus Jakarta Sans';

    return (
        <div className="template-wrapper min-h-screen" style={{ backgroundColor: '#ffffff', fontFamily: `"${bodyFont}", sans-serif` }}>
            <style dangerouslySetInnerHTML={{
                __html: `
                @import url('https://fonts.googleapis.com/css2?family=${titleFont.replace(/ /g, '+')}:wght@400;500;600;700;800&family=${bodyFont.replace(/ /g, '+')}:wght@400;500;600;700&display=swap');
                .template-wrapper h1, .template-wrapper h2, .template-wrapper h3, .template-wrapper h4, .template-wrapper h5, .template-wrapper h6, .template-wrapper .font-title {
                    font-family: "${titleFont}", sans-serif !important;
                }
            `}} />

            {/* Header — gradient background with rounded elements */}
            <header className="sticky top-0 z-50 text-white" style={{ background: `linear-gradient(135deg, ${pPrimary}, ${pSecondary})` }}>
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex items-center justify-between h-16">
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
                                className="w-9 h-9 object-contain rounded-xl"
                                editOverlayStyle="icon"
                                allowUnsplash={false}
                                fallback={
                                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center font-bold text-sm text-white backdrop-blur-sm">
                                        {(siteContent.siteTitle || 'V')[0]?.toUpperCase()}
                                    </div>
                                }
                            />
                            <EditableText
                                as="div"
                                contentKey="siteTitle"
                                styleData={siteContent['siteTitle__styles']}
                                content={siteContent.siteTitle}
                                defaultValue="Vibrant Co"
                                isEditMode={isEditMode}
                                onSave={updateSiteContent}
                                className="text-lg font-extrabold text-white font-title"
                            />
                        </Link>

                        <div className="hidden md:flex items-center gap-5">
                            <NavMenu
                                className="flex items-center gap-4"
                                itemClassName="text-sm font-medium text-white/80 hover:text-white transition-colors px-3 py-1.5 rounded-full hover:bg-white/10"
                            />
                            <HeaderCartIcon color="#ffffff" />
                            <EditableButton
                                contentKey="navButtonText"
                                label={siteContent.navButtonText}
                                linkData={siteContent.navButtonTextLink}
                                defaultLabel="Start Free"
                                isEditMode={isEditMode}
                                onSave={updateSiteContent}
                                className="px-6 py-2 rounded-full font-bold text-sm shadow-lg transition-all hover:scale-105 hover:shadow-xl cursor-pointer inline-flex items-center justify-center"
                                style={{ backgroundColor: '#ffffff', color: pPrimary }}
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
                                className="flex flex-col gap-1"
                                itemClassName="text-sm font-medium text-white/80 hover:text-white py-2.5 px-4 rounded-xl hover:bg-white/10 transition-colors"
                            />
                            <button
                                className="w-full mt-3 px-5 py-2.5 rounded-full font-bold text-sm bg-white"
                                style={{ color: pPrimary }}
                            >
                                {siteContent.navButtonText || 'Start Free'}
                            </button>
                        </div>
                    )}
                </div>
            </header>

            <main className="flex-1 w-full flex flex-col min-h-[50vh]">
                {children || <BlockRenderer palette={palette} />}
            </main>

            {/* Footer — gradient with rounded card */}
            <footer className="py-16" style={{ background: `linear-gradient(135deg, ${pPrimary}, ${pSecondary})` }}>
                <div className="max-w-6xl mx-auto px-4">
                    <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 text-center">
                        <div className="flex items-center justify-center gap-2 mb-3">
                            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-xs font-bold text-white">
                                {(siteContent.siteTitle || 'V')[0]?.toUpperCase()}
                            </div>
                            <span className="font-bold text-white">{siteContent.siteTitle || 'Vibrant Co'}</span>
                        </div>
                        <p className="text-sm text-white/50">
                            Powered by Keystone
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
