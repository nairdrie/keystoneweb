'use client';

import React from 'react';
import EditableText from '../EditableText';
import EditableImage from '../EditableImage';
import { useEditorContext } from '@/lib/editor-context';
import Reveal from '@/app/components/Reveal';

interface FeaturedQuoteBlockProps {
    id: string;
    data: any;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: (key: string, value: any) => void;
}

export default function FeaturedQuoteBlock({ id, data, isEditMode, palette, updateContent }: FeaturedQuoteBlockProps) {
    const context = useEditorContext();
    const pPrimary = palette.primary || '#1f2937';
    const pSecondary = palette.secondary || '#dc2626';
    const pAccent = palette.accent || '#f3f4f6';

    const variant = data.variant || 'centered';
    const bgColor = data.backgroundColor || pAccent;

    if (variant === 'split') {
        return (
            <SplitVariant
                data={data}
                isEditMode={isEditMode}
                updateContent={updateContent}
                uploadImage={context?.uploadImage}
                pPrimary={pPrimary}
                pSecondary={pSecondary}
                bgColor={bgColor}
            />
        );
    }

    if (variant === 'minimal') {
        return (
            <MinimalVariant
                data={data}
                isEditMode={isEditMode}
                updateContent={updateContent}
                uploadImage={context?.uploadImage}
                pPrimary={pPrimary}
                pSecondary={pSecondary}
                bgColor={bgColor}
            />
        );
    }

    // Default: centered
    return (
        <CenteredVariant
            data={data}
            isEditMode={isEditMode}
            updateContent={updateContent}
            uploadImage={context?.uploadImage}
            pPrimary={pPrimary}
            pSecondary={pSecondary}
            bgColor={bgColor}
        />
    );
}

// ─── Centered Variant ────────────────────────────────────────────────────────
// Large quote mark, quote text centered, circular photo + name/title below.
// Adapts well to both short and very long quotes.

function CenteredVariant({ data, isEditMode, updateContent, uploadImage, pPrimary, pSecondary, bgColor }: any) {
    return (
        <section className="py-24" style={{ backgroundColor: bgColor }}>
            <div className="max-w-3xl mx-auto px-6 text-center">
                <Reveal>
                    <div
                        className="text-8xl leading-none select-none mb-2 font-serif"
                        style={{ color: pSecondary, opacity: 0.25 }}
                        aria-hidden="true"
                    >
                        &ldquo;
                    </div>
                </Reveal>

                <Reveal>
                    <EditableText
                        as="p"
                        contentKey="quote"
                        content={data.quote}
                        defaultValue="The best investment you can make is in yourself. The more you learn, the more you earn."
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="text-xl md:text-2xl lg:text-3xl font-medium italic leading-relaxed mb-10"
                        style={{ color: pPrimary }}
                    />
                </Reveal>

                <Reveal>
                    <div className="flex flex-col items-center gap-4">
                        <div
                            className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 ring-2"
                            style={{ ringColor: pSecondary } as any}
                        >
                            <EditableImage
                                contentKey="personImage"
                                imageUrl={data.personImage}
                                isEditMode={isEditMode}
                                onSave={(key, value) => updateContent(key, value)}
                                onUpload={uploadImage}
                                className="w-full h-full object-cover"
                                placeholder="Photo"
                                editOverlayStyle="icon"
                            />
                        </div>
                        <div>
                            <EditableText
                                as="p"
                                contentKey="personName"
                                content={data.personName}
                                defaultValue="Jane Smith"
                                isEditMode={isEditMode}
                                onSave={(key, value) => updateContent(key, value)}
                                className="font-bold text-base"
                                style={{ color: pPrimary }}
                            />
                            <EditableText
                                as="p"
                                contentKey="personTitle"
                                content={data.personTitle}
                                defaultValue="CEO, Acme Corp"
                                isEditMode={isEditMode}
                                onSave={(key, value) => updateContent(key, value)}
                                className="text-sm mt-0.5"
                                style={{ color: pPrimary, opacity: 0.55 }}
                            />
                        </div>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

// ─── Split Variant ───────────────────────────────────────────────────────────
// Photo fills one half; quote text fills the other. Great for longer quotes or
// when you want the person's image to really anchor the section.

function SplitVariant({ data, isEditMode, updateContent, uploadImage, pPrimary, pSecondary, bgColor }: any) {
    const imageRight = data.imagePosition === 'right';

    const imageCol = (
        <Reveal className="relative h-full min-h-64">
            <EditableImage
                contentKey="personImage"
                imageUrl={data.personImage}
                isEditMode={isEditMode}
                onSave={(key, value) => updateContent(key, value)}
                onUpload={uploadImage}
                className="w-full h-full object-cover rounded-2xl min-h-64 bg-gray-200"
                placeholder="Click to upload photo"
            />
        </Reveal>
    );

    const textCol = (
        <Reveal className="flex flex-col justify-center py-4">
            <div
                className="text-7xl leading-none font-serif mb-2 select-none"
                style={{ color: pSecondary, opacity: 0.2 }}
                aria-hidden="true"
            >
                &ldquo;
            </div>
            <EditableText
                as="p"
                contentKey="quote"
                content={data.quote}
                defaultValue="The best investment you can make is in yourself. The more you learn, the more you earn."
                isEditMode={isEditMode}
                onSave={(key, value) => updateContent(key, value)}
                className="text-xl md:text-2xl font-medium italic leading-relaxed mb-8"
                style={{ color: pPrimary }}
            />
            <div className="flex items-center gap-4">
                <div
                    className="w-1 self-stretch rounded-full"
                    style={{ backgroundColor: pSecondary }}
                />
                <div>
                    <EditableText
                        as="p"
                        contentKey="personName"
                        content={data.personName}
                        defaultValue="Jane Smith"
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="font-bold text-base"
                        style={{ color: pPrimary }}
                    />
                    <EditableText
                        as="p"
                        contentKey="personTitle"
                        content={data.personTitle}
                        defaultValue="CEO, Acme Corp"
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="text-sm mt-0.5"
                        style={{ color: pPrimary, opacity: 0.55 }}
                    />
                </div>
            </div>
        </Reveal>
    );

    return (
        <section className="py-24" style={{ backgroundColor: bgColor }}>
            <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-stretch">
                {imageRight ? (
                    <>
                        {textCol}
                        {imageCol}
                    </>
                ) : (
                    <>
                        {imageCol}
                        {textCol}
                    </>
                )}
            </div>
        </section>
    );
}

// ─── Minimal Variant ─────────────────────────────────────────────────────────
// Understated bar layout: small circular photo inline with name, quote below.
// Works great when you want the quote to speak for itself without visual noise.

function MinimalVariant({ data, isEditMode, updateContent, uploadImage, pPrimary, pSecondary, bgColor }: any) {
    return (
        <section className="py-20" style={{ backgroundColor: bgColor }}>
            <div className="max-w-2xl mx-auto px-6">
                <Reveal>
                    <div
                        className="border-l-4 pl-6"
                        style={{ borderColor: pSecondary }}
                    >
                        <EditableText
                            as="p"
                            contentKey="quote"
                            content={data.quote}
                            defaultValue="The best investment you can make is in yourself."
                            isEditMode={isEditMode}
                            onSave={(key, value) => updateContent(key, value)}
                            className="text-lg md:text-xl italic leading-relaxed mb-6"
                            style={{ color: pPrimary }}
                        />
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                                <EditableImage
                                    contentKey="personImage"
                                    imageUrl={data.personImage}
                                    isEditMode={isEditMode}
                                    onSave={(key, value) => updateContent(key, value)}
                                    onUpload={uploadImage}
                                    className="w-full h-full object-cover"
                                    placeholder="Photo"
                                    editOverlayStyle="icon"
                                />
                            </div>
                            <div>
                                <EditableText
                                    as="p"
                                    contentKey="personName"
                                    content={data.personName}
                                    defaultValue="Jane Smith"
                                    isEditMode={isEditMode}
                                    onSave={(key, value) => updateContent(key, value)}
                                    className="font-semibold text-sm"
                                    style={{ color: pPrimary }}
                                />
                                <EditableText
                                    as="p"
                                    contentKey="personTitle"
                                    content={data.personTitle}
                                    defaultValue="CEO, Acme Corp"
                                    isEditMode={isEditMode}
                                    onSave={(key, value) => updateContent(key, value)}
                                    className="text-xs mt-0.5"
                                    style={{ color: pPrimary, opacity: 0.55 }}
                                />
                            </div>
                        </div>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}
