'use client';

import EditableText from '@/app/components/EditableText';
import { useEditorContext } from '@/lib/editor-context';
import BlockRenderer from '@/app/components/blocks/BlockRenderer';
import NavMenu from '@/app/components/NavMenu';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';

interface MasterTemplateProps {
    palette: Record<string, string>;
    isEditMode: boolean;
}

/**
 * Bold Template — Strong, authoritative.
 * Dark sticky header, bold fonts, high contrast.
 * Perfect for trades, mechanics, HVAC, plumbing.
 */
export function BoldTemplate({ palette, isEditMode }: MasterTemplateProps) {
    const context = useEditorContext();
    const siteContent = context?.siteContent || {};
    const updateSiteContent = context?.updateSiteContent || (() => { });
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const pPrimary = palette.primary || '#0f172a';
    const pSecondary = palette.secondary || '#ef4444';
    const pAccent = palette.accent || '#f8fafc';

    return (
        <div className="min-h-screen font-sans" style={{ backgroundColor: pAccent }}>
            {/* Header — dark, bold, authoritative */}
            <header className="sticky top-0 z-50 shadow-lg" style={{ backgroundColor: pPrimary }}>
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo/Title */}
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-md flex items-center justify-center font-black text-sm text-white" style={{ backgroundColor: pSecondary }}>
                                {(siteContent.siteTitle || 'B')[0]?.toUpperCase()}
                            </div>
                            <EditableText
                                as="div"
                                contentKey="siteTitle"
                                content={siteContent.siteTitle}
                                defaultValue="YOUR BUSINESS"
                                isEditMode={isEditMode}
                                onSave={updateSiteContent}
                                className="text-lg font-black tracking-tight text-white"
                            />
                        </div>

                        {/* Desktop Nav */}
                        <div className="hidden md:flex items-center gap-6">
                            <NavMenu
                                className="flex items-center gap-6"
                                itemClassName="text-sm font-semibold text-white/80 hover:text-white transition-colors tracking-wide uppercase"
                            />
                            <button
                                className="px-5 py-2 rounded-md font-bold text-sm transition-all hover:scale-105 text-white"
                                style={{ backgroundColor: pSecondary }}
                            >
                                <EditableText
                                    contentKey="navButtonText"
                                    content={siteContent.navButtonText}
                                    defaultValue="Get Quote"
                                    isEditMode={isEditMode}
                                    onSave={updateSiteContent}
                                    className="inline"
                                />
                            </button>
                        </div>

                        {/* Mobile toggle */}
                        <button
                            className="md:hidden text-white p-2"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        >
                            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>

                    {/* Mobile Menu */}
                    {mobileMenuOpen && (
                        <div className="md:hidden border-t border-white/10 py-4 space-y-2">
                            <NavMenu
                                className="flex flex-col gap-2"
                                itemClassName="text-sm font-semibold text-white/80 hover:text-white py-2 px-2 rounded-md hover:bg-white/5 transition-colors"
                            />
                            <button
                                className="w-full mt-2 px-5 py-2.5 rounded-md font-bold text-sm text-white"
                                style={{ backgroundColor: pSecondary }}
                            >
                                {siteContent.navButtonText || 'Get Quote'}
                            </button>
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
                            <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-black text-white" style={{ backgroundColor: pSecondary }}>
                                {(siteContent.siteTitle || 'B')[0]?.toUpperCase()}
                            </div>
                            <span className="font-bold text-sm">{siteContent.siteTitle || 'Your Business'}</span>
                        </div>
                        <p className="text-sm text-white/50">
                            &copy; {new Date().getFullYear()} {siteContent.siteTitle || 'Your Business'}. All rights reserved.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
