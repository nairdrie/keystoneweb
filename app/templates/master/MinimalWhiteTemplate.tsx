'use client';

import EditableText from '@/app/components/EditableText';
import EditableImage from '@/app/components/EditableImage';
import { useEditorContext } from '@/lib/editor-context';
import BlockRenderer from '@/app/components/blocks/BlockRenderer';

interface MasterTemplateProps {
    palette: Record<string, string>;
    isEditMode: boolean;
}

export function MinimalWhiteTemplate({ palette, isEditMode }: MasterTemplateProps) {
    const context = useEditorContext();
    const content = context?.content || {};
    const updateContent = context?.updateContent || (() => { });

    const pPrimary = palette.primary || '#374151';
    const pSecondary = palette.secondary || '#10b981';
    const pAccent = palette.accent || '#ffffff';

    return (
        <div className="min-h-screen font-serif text-slate-800" style={{ backgroundColor: pAccent }}>
            {/* Navbar Minimal */}
            <nav className="border-b border-gray-100">
                <div className="max-w-5xl mx-auto px-6 py-8 flex items-center justify-between">
                    <EditableText
                        as="div"
                        contentKey="siteTitle"
                        content={content.siteTitle}
                        defaultValue="MINIMAL CO."
                        isEditMode={isEditMode}
                        onSave={updateContent}
                        className="text-xl tracking-[0.2em] font-light uppercase"
                        style={{ color: pPrimary }}
                    />
                    <div className="flex gap-8 text-sm tracking-widest uppercase font-light">
                        <a href="#work" className="hover:opacity-60 transition-opacity">Work</a>
                        <a href="#about" className="hover:opacity-60 transition-opacity">About</a>
                    </div>
                </div>
            </nav>

            {/* Dynamic Page Content */}
            <main className="flex-1 w-full min-h-[50vh]">
                <BlockRenderer palette={palette} />
            </main>

            {/* Footer Minimal */}
            <footer className="py-24 border-t border-gray-100 text-center">
                <div className="max-w-3xl mx-auto px-6">
                    <EditableText
                        as="h2"
                        contentKey="ctaTitle"
                        content={content.ctaTitle}
                        defaultValue="Let's create something together."
                        isEditMode={isEditMode}
                        onSave={updateContent}
                        className="text-3xl font-light mb-10"
                        style={{ color: pPrimary }}
                    />
                    <button
                        className="text-white px-12 py-4 tracking-widest text-sm uppercase font-medium hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: pPrimary }}
                    >
                        Contact
                    </button>
                </div>
            </footer>
        </div>
    );
}
