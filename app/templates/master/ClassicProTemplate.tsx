'use client';

import EditableText from '@/app/components/EditableText';
import EditableImage from '@/app/components/EditableImage';
import { Palette } from 'lucide-react';
import { useEditorContext } from '@/lib/editor-context';
import BlockRenderer from '@/app/components/blocks/BlockRenderer';

interface MasterTemplateProps {
    palette: Record<string, string>;
    isEditMode: boolean;
}

export function ClassicProTemplate({ palette, isEditMode }: MasterTemplateProps) {
    const context = useEditorContext();
    const content = context?.content || {};
    const updateContent = context?.updateContent || (() => { });

    const pPrimary = palette.primary || '#1f2937';
    const pSecondary = palette.secondary || '#dc2626';
    const pAccent = palette.accent || '#f3f4f6';

    return (
        <div className="min-h-screen font-sans bg-gray-50">
            {/* Header */}
            <header
                className="sticky top-0 z-50 text-white shadow-sm"
                style={{ backgroundColor: pPrimary }}
            >
                <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
                    <EditableText
                        as="div"
                        contentKey="siteTitle"
                        content={content.siteTitle}
                        defaultValue="Professional Services"
                        isEditMode={isEditMode}
                        onSave={updateContent}
                        className="text-2xl font-bold tracking-tight"
                    />
                    <nav className="hidden md:flex space-x-6 text-sm font-medium">
                        <a href="#services" className="hover:opacity-80 transition-opacity">Services</a>
                        <a href="#about" className="hover:opacity-80 transition-opacity">About</a>
                        <a href="#reviews" className="hover:opacity-80 transition-opacity">Reviews</a>
                        <a href="#contact" className="hover:opacity-80 transition-opacity">Contact</a>
                    </nav>
                </div>
            </header>

            {/* Dynamic Page Content */}
            <main className="flex-1 w-full flex flex-col min-h-[50vh]">
                <BlockRenderer palette={palette} />
            </main>

            {/* Footer */}
            <footer className="bg-gray-900 text-gray-400 py-12">
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <p className="mb-4">
                        &copy; {new Date().getFullYear()}{' '}
                        <EditableText
                            as="span"
                            contentKey="siteTitle"
                            content={content.siteTitle}
                            defaultValue="Professional Services"
                            isEditMode={isEditMode}
                            onSave={updateContent}
                        />
                        . All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
}
