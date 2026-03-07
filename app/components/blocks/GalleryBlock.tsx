'use client';

import React, { useState } from 'react';
import EditableImage from '../EditableImage';
import EditableText from '../EditableText';
import { useEditorContext } from '@/lib/editor-context';
import { X } from 'lucide-react';

interface GalleryBlockProps {
    id: string;
    data: any;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: (key: string, value: any) => void;
}

export default function GalleryBlock({ id, data, isEditMode, palette, updateContent }: GalleryBlockProps) {
    const context = useEditorContext();
    const pPrimary = palette.primary || '#1f2937';

    const images: string[] = data.images || [];
    const columns = data.columns || 3;
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

    // Placeholder slots in edit mode
    const slots = isEditMode ? Math.max(images.length + 1, columns * 2) : images.length;

    return (
        <section className="py-24" style={{ backgroundColor: data.backgroundColor || '#ffffff' }}>
            <div className="max-w-7xl mx-auto px-4">
                <EditableText
                    as="h2"
                    contentKey={`${id}.title`}
                    content={data.title}
                    defaultValue="Our Work"
                    isEditMode={isEditMode}
                    onSave={(key, value) => updateContent(key, value)}
                    className="text-4xl font-bold text-center mb-4"
                    style={{ color: pPrimary }}
                />
                <EditableText
                    as="p"
                    contentKey={`${id}.subtitle`}
                    content={data.subtitle}
                    defaultValue="Browse our portfolio of recent projects."
                    isEditMode={isEditMode}
                    onSave={(key, value) => updateContent(key, value)}
                    className="text-lg text-gray-500 text-center mb-12 max-w-2xl mx-auto"
                />

                <div className={`grid gap-4 ${columns === 2 ? 'grid-cols-2' :
                        columns === 4 ? 'grid-cols-2 md:grid-cols-4' :
                            'grid-cols-2 md:grid-cols-3'
                    }`}>
                    {Array.from({ length: slots }).map((_, index) => {
                        const imageUrl = images[index] || '';

                        if (!isEditMode && !imageUrl) return null;

                        return (
                            <div key={index} className="relative group">
                                <EditableImage
                                    contentKey={`${id}.images.${index}`}
                                    imageUrl={imageUrl}
                                    isEditMode={isEditMode}
                                    onSave={(key, value) => updateContent(key, value)}
                                    onUpload={context?.uploadImage}
                                    className="w-full aspect-square object-cover rounded-xl bg-gray-100 cursor-pointer hover:opacity-90 transition-opacity"
                                    placeholder="+ Add image"
                                />
                                {!isEditMode && imageUrl && (
                                    <div
                                        className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-xl transition-colors cursor-pointer"
                                        onClick={() => setLightboxIndex(index)}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Lightbox */}
            {lightboxIndex !== null && images[lightboxIndex] && (
                <div
                    className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-8"
                    onClick={() => setLightboxIndex(null)}
                >
                    <button
                        className="absolute top-6 right-6 text-white/80 hover:text-white p-2"
                        onClick={() => setLightboxIndex(null)}
                    >
                        <X className="w-8 h-8" />
                    </button>
                    <img
                        src={images[lightboxIndex]}
                        alt=""
                        className="max-w-full max-h-full object-contain rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </section>
    );
}
