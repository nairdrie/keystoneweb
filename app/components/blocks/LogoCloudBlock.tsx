'use client';

import React from 'react';
import EditableText from '../EditableText';
import EditableImage from '../EditableImage';
import type { ImageSettings } from '../ImageEditorModal';
import { useEditorContext } from '@/lib/editor-context';
import { resolvePaletteColor } from '@/lib/palette-colors';
import { Image as ImageIcon, Plus, Trash2 } from 'lucide-react';

type LogoCloudData = Record<string, unknown>;
type UpdateContent = (key: string, value: unknown) => void;

interface LogoCloudBlockProps {
    id: string;
    data: LogoCloudData;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: UpdateContent;
}

export default function LogoCloudBlock({ data, isEditMode, palette, updateContent }: LogoCloudBlockProps) {
    const context = useEditorContext();
    const pPrimary = palette.primary || '#1f2937';
    const bgColor = resolvePaletteColor(data.backgroundColor, palette, '');
    const fgOverride = resolvePaletteColor(data.foregroundColor, palette);

    const variant = readString(data.variant, 'inline'); // 'inline' | 'grid' | 'marquee'
    const logos: string[] = Array.isArray(data.logos)
        ? data.logos.map((logo: unknown) => typeof logo === 'string' ? logo : '')
            .filter((logo) => logo.trim())
        : [];
    const [pendingLogoSlots, setPendingLogoSlots] = React.useState(0);
    const logoSlots = isEditMode
        ? [...logos, ...Array.from({ length: pendingLogoSlots }, () => '')]
        : logos;

    React.useEffect(() => {
        setPendingLogoSlots(0);
    }, [logos.length]);

    const handleUpdateLogo = (index: number, value: string) => {
        const nextLogos = [...logos];
        if (!value) {
            updateContent('logos', nextLogos.filter((_, logoIndex) => logoIndex !== index));
            return;
        }
        while (nextLogos.length <= index) nextLogos.push('');
        nextLogos[index] = value;
        updateContent('logos', nextLogos.filter(Boolean));
    };

    const handleAddLogo = () => {
        setPendingLogoSlots((count) => count + 1);
    };

    const handleRemoveLogo = (index: number) => {
        if (index < logos.length) {
            updateContent('logos', logos.filter((_, logoIndex) => logoIndex !== index));
            return;
        }
        setPendingLogoSlots((count) => Math.max(0, count - 1));
    };

    const handleLogoSave = (index: number, key: string, value: unknown) => {
        if (key === `logo_${index}`) {
            handleUpdateLogo(index, typeof value === 'string' ? value : '');
            return;
        }
        updateContent(key, value);
    };

    const renderLogoImage = (
        index: number,
        logoUrl: string,
        {
            imageClassName,
            slotClassName,
            previewFrameClassName,
        }: {
            imageClassName: string;
            slotClassName: string;
            previewFrameClassName: string;
        },
    ) => (
        <div className={`group/logo-slot relative ${slotClassName}`}>
            <EditableImage
                contentKey={`logo_${index}`}
                initialSettings={readImageSettings(data[`logo_${index}__settings`])}
                imageUrl={logoUrl}
                isEditMode={isEditMode}
                onSave={(key, value) => handleLogoSave(index, key, value)}
                onUpload={context?.uploadImage}
                className={`h-full w-full object-contain ${imageClassName}`}
                emptyBackgroundClassName="bg-transparent"
                enableInlineCropControls
                showInlineCropZoomControl={false}
                inlineCropFrameClassName="h-full w-full object-contain"
                inlineCropImageClassName={imageClassName}
                editorPreviewFrameClassName={previewFrameClassName}
                placeholder="+ Logo"
                fallback={<LogoPlaceholder className={previewFrameClassName} />}
                allowUnsplash={false}
                editOverlayStyle="icon"
            />
            {isEditMode && (
                <button
                    type="button"
                    data-image-crop-control
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleRemoveLogo(index);
                    }}
                    className="absolute -right-2 -top-2 z-40 grid h-7 w-7 place-items-center border border-red-100 bg-white text-red-500 opacity-0 shadow-md transition-opacity hover:bg-red-50 group-hover/logo-slot:opacity-100 [@media(hover:none)]:opacity-100"
                    title="Remove logo"
                    aria-label="Remove logo"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            )}
        </div>
    );

    const renderAddLogoButton = (className = '') => (
        <button
            type="button"
            onClick={handleAddLogo}
            className={`flex items-center justify-center gap-2 border border-dashed border-slate-300 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-500 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
        >
            <Plus className="h-4 w-4" />
            Add Logo
        </button>
    );

    if (variant === 'grid') {
        return (
            <section className="py-20" style={{ backgroundColor: bgColor || '#ffffff' }}>
                <div className="max-w-6xl mx-auto px-4">
                    <EditableText
                        as="p"
                        contentKey="title"
                        content={readString(data.title)}
                        defaultValue="Trusted by leading brands"
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="text-center text-sm font-semibold uppercase tracking-widest mb-12"
                        style={{ color: fgOverride || pPrimary, opacity: 0.4 }}
                    />
                    <div className="ks-layout-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                        {logoSlots.map((logoUrl, index) => {
                            return (
                                <div key={index} className="flex min-h-28 items-center justify-center bg-gray-50 p-6">
                                    {renderLogoImage(index, logoUrl, {
                                        imageClassName: 'grayscale opacity-60 transition-all hover:grayscale-0 hover:opacity-100',
                                        slotClassName: 'h-12 w-40 max-w-full',
                                        previewFrameClassName: 'h-12 w-40 max-w-full',
                                    })}
                                </div>
                            );
                        })}
                        {isEditMode && (
                            <div className="flex min-h-28 items-center justify-center">
                                {renderAddLogoButton('h-full min-h-28 w-full')}
                            </div>
                        )}
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
                        content={readString(data.title)}
                        defaultValue="Trusted by leading brands"
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="text-center text-sm font-semibold uppercase tracking-widest mb-8"
                        style={{ color: fgOverride || pPrimary, opacity: 0.4 }}
                    />
                </div>
                {isEditMode ? (
                    <div className="flex flex-wrap items-center justify-center gap-12 px-4">
                        {logoSlots.map((logoUrl, index) => (
                            <div key={index} className="flex-shrink-0">
                                {renderLogoImage(index, logoUrl, {
                                    imageClassName: 'grayscale opacity-50',
                                    slotClassName: 'h-10 w-36 max-w-[140px]',
                                    previewFrameClassName: 'h-10 w-36 max-w-full',
                                })}
                            </div>
                        ))}
                        {renderAddLogoButton('h-10')}
                    </div>
                ) : (
                    <div className="overflow-hidden">
                        <div className="flex w-[200%] items-center animate-marquee">
                            {[0, 1].map((groupIndex) => (
                                <div
                                    key={groupIndex}
                                    className="flex w-1/2 items-center justify-center gap-16"
                                    aria-hidden={groupIndex === 1}
                                >
                                    {logos.map((logoUrl, logoIndex) => (
                                        <div key={`${groupIndex}-${logoUrl}-${logoIndex}`} className="flex-shrink-0">
                                            {renderLogoImage(logoIndex, logoUrl, {
                                                imageClassName: 'grayscale opacity-50',
                                                slotClassName: 'h-10 w-36 max-w-[140px]',
                                                previewFrameClassName: 'h-10 w-36 max-w-full',
                                            })}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {!isEditMode && logos.length > 0 && (
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
                    content={readString(data.title)}
                    defaultValue="Trusted by leading brands"
                    isEditMode={isEditMode}
                    onSave={(key, value) => updateContent(key, value)}
                    className="text-center text-sm font-semibold uppercase tracking-widest mb-10"
                    style={{ color: fgOverride || pPrimary, opacity: 0.4 }}
                />
                <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
                    {logoSlots.map((logoUrl, index) => {
                        return (
                            <React.Fragment key={index}>
                                {renderLogoImage(index, logoUrl, {
                                    imageClassName: 'grayscale opacity-50 transition-all hover:grayscale-0 hover:opacity-100',
                                    slotClassName: 'h-10 w-36 max-w-[140px]',
                                    previewFrameClassName: 'h-10 w-36 max-w-full',
                                })}
                            </React.Fragment>
                        );
                    })}
                    {isEditMode && renderAddLogoButton('h-10')}
                </div>
            </div>
        </section>
    );
}

function LogoPlaceholder({ className = '' }: { className?: string }) {
    return (
        <div className={`flex flex-col items-center justify-center gap-1 border border-dashed border-slate-300 bg-slate-50/70 text-center text-slate-400 transition-colors group-hover/editable-image:border-slate-400 group-hover/editable-image:bg-slate-50 ${className}`}>
            <ImageIcon className="h-4 w-4" />
            <span className="text-xs font-medium">+ Logo</span>
        </div>
    );
}

function readString(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
}

function readImageSettings(value: unknown): ImageSettings | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    return value as ImageSettings;
}
