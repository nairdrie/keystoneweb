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
 * Elegant Template — Premium, refined.
 * Frosted glass navbar, smooth gradients, modern feel.
 * Perfect for salons, consulting, agencies.
 */
export function ModernBlueTemplate({ palette, isEditMode }: MasterTemplateProps) {
    const context = useEditorContext();
    const siteContent = context?.siteContent || {};
    const updateSiteContent = context?.updateSiteContent || (() => { });
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const pPrimary = palette.primary || '#0369a1';
    const pSecondary = palette.secondary || '#0ea5e9';
    const pAccent = palette.accent || '#f0f9ff';

    return (
        <div className="min-h-screen font-sans text-slate-800 bg-white">
            {/* Header — frosted glass, elegant */}
            <nav className="sticky top-0 z-50 border-b border-white/20 shadow-sm bg-white/80 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex items-center justify-between h-18 py-4">
                        {/* Logo */}
                        <div className="flex items-center gap-3">
                            <div
                                className="w-9 h-9 rounded-xl flex items-center justify-center"
                                style={{ background: `linear-gradient(135deg, ${pPrimary}, ${pSecondary})` }}
                            >
                                <span className="text-white font-black text-sm">
                                    {(siteContent.siteTitle || 'E')[0]?.toUpperCase()}
                                </span>
                            </div>
                            <EditableText
                                as="div"
                                contentKey="siteTitle"
                                content={siteContent.siteTitle}
                                defaultValue="Elegant Co."
                                isEditMode={isEditMode}
                                onSave={updateSiteContent}
                                className="text-xl font-bold tracking-tight"
                                style={{ color: pPrimary }}
                            />
                        </div>

                        {/* Desktop Nav + CTA */}
                        <div className="hidden md:flex items-center gap-8">
                            <NavMenu
                                className="flex items-center gap-7"
                                itemClassName="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                            />
                            <div
                                className="px-6 py-2.5 rounded-full text-white font-bold text-sm shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer inline-flex items-center justify-center"
                                style={{ background: `linear-gradient(135deg, ${pPrimary}, ${pSecondary})` }}
                            >
                                <EditableText
                                    contentKey="navButtonText"
                                    content={siteContent.navButtonText}
                                    defaultValue="Book Now"
                                    isEditMode={isEditMode}
                                    onSave={updateSiteContent}
                                    className="inline"
                                />
                            </div>
                        </div>

                        {/* Mobile toggle */}
                        <button
                            className="md:hidden p-2 text-slate-600"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        >
                            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>

                    {/* Mobile Menu */}
                    {mobileMenuOpen && (
                        <div className="md:hidden border-t border-slate-100 py-4 space-y-2">
                            <NavMenu
                                className="flex flex-col gap-1"
                                itemClassName="text-sm font-medium text-slate-600 hover:text-slate-900 py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors"
                            />
                            <button
                                className="w-full mt-3 px-5 py-2.5 rounded-full text-white font-bold text-sm"
                                style={{ background: `linear-gradient(135deg, ${pPrimary}, ${pSecondary})` }}
                            >
                                {siteContent.navButtonText || 'Book Now'}
                            </button>
                        </div>
                    )}
                </div>
            </nav>

            {/* Page Content */}
            <main className="flex-1 w-full min-h-[50vh]">
                <BlockRenderer palette={palette} />
            </main>

            {/* Footer */}
            <footer className="py-12 border-t border-slate-100">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <div
                                className="w-6 h-6 rounded-lg"
                                style={{ background: `linear-gradient(135deg, ${pPrimary}, ${pSecondary})` }}
                            />
                            <span className="font-bold text-sm text-slate-800">{siteContent.siteTitle || 'Elegant Co.'}</span>
                        </div>
                        <p className="text-sm text-slate-400">
                            &copy; {new Date().getFullYear()} {siteContent.siteTitle || 'Elegant Co.'}. All rights reserved.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
