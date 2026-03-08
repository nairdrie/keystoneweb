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
 * Starter Template — Clean, approachable.
 * Lots of whitespace, serif accents, minimal borders.
 * Perfect for freelancers, landscaping, cleaning, portfolios.
 */
export function MinimalWhiteTemplate({ palette, isEditMode, children }: MasterTemplateProps) {
    const context = useEditorContext();
    const content = context?.content || {};
    const siteContent = context?.siteContent || {};
    const updateContent = context?.updateContent || (() => { });
    const updateSiteContent = context?.updateSiteContent || (() => { });
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const pathname = usePathname();
    const isEditor = pathname?.startsWith('/editor');

    const pPrimary = palette.primary || '#374151';
    const pSecondary = palette.secondary || '#10b981';
    const pAccent = palette.accent || '#ffffff';

    return (
        <div className="min-h-screen font-sans text-slate-700" style={{ backgroundColor: pAccent }}>
            {/* Header — minimal, airy */}
            <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-100">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo */}
                        <div className="flex items-center gap-3">
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
                                    className="w-8 h-8 object-contain"
                                    editOverlayStyle="icon"
                                    allowUnsplash={false}
                                    fallback={
                                        <div className="w-8 h-8 rounded flex items-center justify-center font-bold text-sm text-white" style={{ backgroundColor: pPrimary }}>
                                            {(siteContent.siteTitle || 'S')[0]?.toUpperCase()}
                                        </div>
                                    }
                                />
                                <EditableText
                                    as="div"
                                    contentKey="siteTitle"
                                    content={siteContent.siteTitle}
                                    defaultValue="Studio"
                                    isEditMode={isEditMode}
                                    onSave={updateSiteContent}
                                    className="text-lg font-semibold tracking-wide"
                                    style={{ color: pPrimary }}
                                />
                            </Link>
                        </div>

                        {/* Desktop Nav */}
                        <div className="hidden md:flex items-center gap-8">
                            <NavMenu
                                className="flex items-center gap-7"
                                itemClassName="text-sm text-slate-500 hover:text-slate-900 transition-colors font-medium"
                            />
                            <HeaderCartIcon color={pPrimary} />
                            <EditableButton
                                contentKey="navButtonText"
                                label={siteContent.navButtonText}
                                linkData={siteContent.navButtonTextLink}
                                defaultLabel="Contact"
                                isEditMode={isEditMode}
                                onSave={updateSiteContent}
                                className="px-5 py-2 rounded-lg text-white text-sm font-semibold transition-all hover:opacity-90 cursor-pointer inline-flex items-center justify-center"
                                style={{ backgroundColor: pPrimary }}
                            />
                        </div>

                        <div className="flex md:hidden items-center gap-2">
                            <HeaderCartIcon color={pPrimary} />
                            <button
                                className="p-2 text-slate-500"
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            >
                                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {/* Mobile Menu */}
                    {mobileMenuOpen && (
                        <div className="md:hidden border-t border-slate-100 py-4 space-y-1">
                            <NavMenu
                                className="flex flex-col"
                                itemClassName="text-sm text-slate-500 hover:text-slate-900 py-2.5 px-3 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                            />
                            <button
                                className="w-full mt-3 px-5 py-2.5 rounded-lg text-white text-sm font-semibold"
                                style={{ backgroundColor: pPrimary }}
                            >
                                {siteContent.navButtonText || 'Contact'}
                            </button>
                        </div>
                    )}
                </div>
            </nav>

            {/* Page Content */}
            <main className="flex-1 w-full min-h-[50vh]">
                {children || <BlockRenderer palette={palette} />}
            </main>

            {/* Footer — clean & minimal */}
            <footer className="py-16 border-t border-slate-100">
                <div className="max-w-6xl mx-auto px-6 text-center">
                    <p className="text-sm text-slate-400">
                        &copy; {new Date().getFullYear()} {siteContent.siteTitle || 'Studio'}. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
}
