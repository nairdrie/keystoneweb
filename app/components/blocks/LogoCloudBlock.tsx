'use client';

import React from 'react';
import EditableText from '../EditableText';
import EditableImage from '../EditableImage';
import { useEditorContext } from '@/lib/editor-context';
import { resolvePaletteColor } from '@/lib/palette-colors';

interface LogoCloudBlockProps {
    id: string;
    data: any;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: (key: string, value: any) => void;
}

export default function LogoCloudBlock({ id, data, isEditMode, palette, updateContent }: LogoCloudBlockProps) {
    const context = useEditorContext();
    const pPrimary = palette.primary || '#1f2937';
    const bgColor = resolvePaletteColor(data.backgroundColor, palette, '');
    const fgOverride = resolvePaletteColor(data.foregroundColor, palette);

    const variant = data.variant || 'inline'; // 'inline' | 'grid' | 'marquee'
    const logos: string[] = Array.isArray(data.logos)
        ? data.logos.map((logo: unknown) => typeof logo === 'string' ? logo : '')
        : [];
    const slots = isEditMode ? Math.max(logos.length + 1, 6) : logos.length;

    const handleUpdateLogo = (index: number, value: string) => {
        const newLogos = [...logos];
        while (newLogos.length <= index) newLogos.push('');
        newLogos[index] = value;
        updateContent('logos', newLogos);
    };

    const handleLogoSave = (index: number, key: string, value: unknown) => {
        if (key === `logo_${index}`) {
            handleUpdateLogo(index, typeof value === 'string' ? value : '');
            return;
        }
        updateContent(key, value);
    };

    if (variant === 'grid') {
        return (
            <section className="py-20" style={{ backgroundColor: bgColor || '#ffffff' }}>
                <div className="max-w-6xl mx-auto px-4">
                    <EditableText
                        as="p"
                        contentKey="title"
                        content={data.title}
                        defaultValue="Trusted by leading brands"
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="text-center text-sm font-semibold uppercase tracking-widest mb-12"
                        style={{ color: fgOverride || pPrimary, opacity: 0.4 }}
                    />
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                        {Array.from({ length: slots }).map((_, index) => {
                            const logoUrl = logos[index] || '';
                            if (!isEditMode && !logoUrl) return null;
                            return (
                                <div key={index} className="flex items-center justify-center p-6 bg-gray-50 rounded-xl">
                                    <EditableImage
                                        contentKey={`logo_${index}`}
                                        initialSettings={data[`logo_${index}__settings`]}
                                        imageUrl={logoUrl}
                                        isEditMode={isEditMode}
                                        onSave={(key, value) => handleLogoSave(index, key, value)}
                                        onUpload={context?.uploadImage}
                                        className="h-12 w-auto max-w-[160px] object-contain grayscale hover:grayscale-0 transition-all opacity-60 hover:opacity-100"
                                        placeholder="+ Logo"
                                        allowUnsplash={false}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>
        );
    }

    if (variant === 'marquee') {
        return (
            <section className="py-12 overflow-hidden" style={{ backgroundColor: bgColor || palette.accent || '#f8fafc' }}>
                <div className="max-w-7xl mx-auto px-4">
                    <EditableText
                        as="p"
                        contentKey="title"
                        content={data.title}
                        defaultValue="Trusted by leading brands"
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="text-center text-sm font-semibold uppercase tracking-widest mb-8"
                        style={{ color: fgOverride || pPrimary, opacity: 0.4 }}
                    />
                </div>
                <div className={isEditMode ? "flex flex-wrap justify-center gap-12 px-4" : "flex items-center gap-16 animate-marquee"}>
                    {Array.from({ length: slots }).map((_, index) => {
                        const logoUrl = logos[index] || '';
                        if (!isEditMode && !logoUrl) return null;
                        return (
                            <div key={index} className="flex-shrink-0">
                                <EditableImage
                                    contentKey={`logo_${index}`}
                                    initialSettings={data[`logo_${index}__settings`]}
                                    imageUrl={logoUrl}
                                    isEditMode={isEditMode}
                                    onSave={(key, value) => handleLogoSave(index, key, value)}
                                    onUpload={context?.uploadImage}
                                    className="h-10 w-auto max-w-[140px] object-contain grayscale opacity-50"
                                    placeholder="+ Logo"
                                    allowUnsplash={false}
                                />
                            </div>
                        );
                    })}
                </div>
                {!isEditMode && (
                    <style dangerouslySetInnerHTML={{ __html: `
                        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
                        .animate-marquee { animation: marquee 30s linear infinite; width: max-content; }
                    `}} />
                )}
            </section>
        );
    }

    // Inline variant (default) — single row of logos
    return (
        <section className="py-16 border-y border-gray-100" style={{ backgroundColor: bgColor || '#ffffff' }}>
            <div className="max-w-7xl mx-auto px-4">
                <EditableText
                    as="p"
                    contentKey="title"
                    content={data.title}
                    defaultValue="Trusted by leading brands"
                    isEditMode={isEditMode}
                    onSave={(key, value) => updateContent(key, value)}
                    className="text-center text-sm font-semibold uppercase tracking-widest mb-10"
                    style={{ color: fgOverride || pPrimary, opacity: 0.4 }}
                />
                <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
                    {Array.from({ length: slots }).map((_, index) => {
                        const logoUrl = logos[index] || '';
                        if (!isEditMode && !logoUrl) return null;
                        return (
                            <EditableImage
                                key={index}
                                contentKey={`logo_${index}`}
                                initialSettings={data[`logo_${index}__settings`]}
                                imageUrl={logoUrl}
                                isEditMode={isEditMode}
                                onSave={(key, value) => handleLogoSave(index, key, value)}
                                onUpload={context?.uploadImage}
                                className="h-10 w-auto max-w-[140px] object-contain grayscale hover:grayscale-0 transition-all opacity-50 hover:opacity-100"
                                placeholder="+ Logo"
                                allowUnsplash={false}
                            />
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
