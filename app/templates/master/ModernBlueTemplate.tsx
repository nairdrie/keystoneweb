'use client';

import EditableText from '@/app/components/EditableText';
import EditableImage from '@/app/components/EditableImage';
import { useEditorContext } from '@/lib/editor-context';
import BlockRenderer from '@/app/components/blocks/BlockRenderer';

interface MasterTemplateProps {
    palette: Record<string, string>;
    isEditMode: boolean;
}

export function ModernBlueTemplate({ palette, isEditMode }: MasterTemplateProps) {
    const context = useEditorContext();
    const content = context?.content || {};
    const updateContent = context?.updateContent || (() => { });

    const pPrimary = palette.primary || '#0369a1';
    const pSecondary = palette.secondary || '#0ea5e9';
    const pAccent = palette.accent || '#f0f9ff';

    return (
        <div className="min-h-screen font-sans text-slate-800 bg-white">
            {/* Navbar Minimalist */}
            <nav className="border-b shadow-sm sticky top-0 z-50 bg-white/90 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: pSecondary }}></div>
                        <EditableText
                            as="div"
                            contentKey="siteTitle"
                            content={content.siteTitle}
                            defaultValue="Modern Services"
                            isEditMode={isEditMode}
                            onSave={updateContent}
                            className="text-2xl font-black tracking-tighter"
                            style={{ color: pPrimary }}
                        />
                    </div>
                    <button
                        className="px-6 py-2.5 rounded-full text-white font-bold text-sm shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5"
                        style={{ backgroundColor: pPrimary }}
                    >
                        <EditableText
                            contentKey="navButtonText"
                            content={content.navButtonText}
                            defaultValue="Book Now"
                            isEditMode={isEditMode}
                            onSave={updateContent}
                            className="inline"
                        />
                    </button>
                </div>
            </nav>

            {/* Dynamic Page Content */}
            <main className="flex-1 w-full min-h-[50vh]">
                <BlockRenderer palette={palette} />
            </main>
        </div>
    );
}
