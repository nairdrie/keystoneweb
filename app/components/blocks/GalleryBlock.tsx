'use client';

import React, { useState, useEffect, useCallback } from 'react';
import EditableImage from '../EditableImage';
import EditableText from '../EditableText';
import EditableButton from '../EditableButton';
import { useEditorContext } from '@/lib/editor-context';
import { X, ChevronLeft, ChevronRight, GripVertical } from 'lucide-react';
import { resolvePaletteColor } from '@/lib/palette-colors';

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
    const pAccent = palette.accent || '#3b82f6';
    const bgColor = resolvePaletteColor(data.backgroundColor, palette, '#ffffff');
    const fgOverride = resolvePaletteColor(data.foregroundColor, palette);

    // Pack images: drop any falsy entries so removed slots don't leave gaps.
    const rawImages: string[] = Array.isArray(data.images) ? data.images : [];
    const images: string[] = rawImages.filter(Boolean);

    const columns: number = data.columns || 3;
    const showLightboxNav: boolean = data.showLightboxNav !== false;
    const showLightboxThumbs: boolean = data.showLightboxThumbs !== false;
    const showSeeMore: boolean = data.showSeeMore === true;
    const autoScroll: boolean = data.autoScroll === true;
    const autoScrollRows: number = Math.max(1, data.autoScrollRows || 2);

    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    // Apply a set of updates as a batch when possible; otherwise fall back to per-key writes.
    const applyUpdates = useCallback((updates: Record<string, any>) => {
        if (context?.updateBlockDataBatch) {
            context.updateBlockDataBatch(id, updates);
            return;
        }
        for (const [k, v] of Object.entries(updates)) updateContent(k, v);
    }, [context, id, updateContent]);

    // Build an updates map that reorders __settings / __attribution keys to follow
    // a new image ordering (so settings stay attached to the right image).
    const remapMetaUpdates = useCallback((newImagesLength: number, oldIndexFor: (newIndex: number) => number | null) => {
        const updates: Record<string, any> = {};
        const suffixes = ['__settings', '__attribution'];
        for (let newIdx = 0; newIdx < newImagesLength; newIdx++) {
            const oldIdx = oldIndexFor(newIdx);
            for (const suffix of suffixes) {
                const newKey = `gallery_image_${newIdx}${suffix}`;
                const oldVal = oldIdx === null ? undefined : data[`gallery_image_${oldIdx}${suffix}`];
                if (oldVal !== undefined) updates[newKey] = oldVal;
                else updates[newKey] = null;
            }
        }
        // Clear any leftover keys past the new length (best-effort up to old length).
        const oldLen = images.length;
        for (let i = newImagesLength; i < oldLen; i++) {
            for (const suffix of suffixes) {
                updates[`gallery_image_${i}${suffix}`] = null;
            }
        }
        return updates;
    }, [data, images.length]);

    // Save URL for image at a given index (used by EditableImage).
    // - URL key writes/replaces images[index]; empty string removes the slot entirely
    //   AND shifts all per-index __settings/__attribution data to follow.
    // - Settings/attribution writes are stored under their own qualified keys verbatim.
    const handleImageSave = useCallback((index: number, key: string, value: any) => {
        const isUrlKey = key === `gallery_image_${index}`;
        if (!isUrlKey) {
            updateContent(key, value);
            return;
        }
        const url = typeof value === 'string' ? value : '';
        const next = [...images];
        if (!url) {
            if (index < next.length) next.splice(index, 1);
            const updates = remapMetaUpdates(next.length, (newIdx) => (newIdx < index ? newIdx : newIdx + 1));
            updates['images'] = next;
            applyUpdates(updates);
        } else {
            while (next.length <= index) next.push('');
            next[index] = url;
            updateContent('images', next);
        }
    }, [images, updateContent, remapMetaUpdates, applyUpdates]);

    const reorderImages = useCallback((from: number, to: number) => {
        if (from === to) return;
        const next = [...images];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);

        // Build a mapping new index -> old index to keep meta in sync.
        const oldOrder = images.map((_, i) => i);
        const [movedIdx] = oldOrder.splice(from, 1);
        oldOrder.splice(to, 0, movedIdx);
        const updates = remapMetaUpdates(next.length, (newIdx) => oldOrder[newIdx] ?? null);
        updates['images'] = next;
        applyUpdates(updates);
    }, [images, remapMetaUpdates, applyUpdates]);

    // Lightbox keyboard navigation
    useEffect(() => {
        if (lightboxIndex === null) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setLightboxIndex(null);
            if (!showLightboxNav || images.length < 2) return;
            if (e.key === 'ArrowLeft') {
                setLightboxIndex(i => (i === null ? null : (i - 1 + images.length) % images.length));
            }
            if (e.key === 'ArrowRight') {
                setLightboxIndex(i => (i === null ? null : (i + 1) % images.length));
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [lightboxIndex, images.length, showLightboxNav]);

    const colsClass = columns === 2
        ? 'grid-cols-2'
        : columns === 4
            ? 'grid-cols-2 md:grid-cols-4'
            : 'grid-cols-2 md:grid-cols-3';

    // In edit mode, always render one trailing "add" slot.
    const editSlotCount = images.length + 1;

    const handleDrop = (targetIndex: number) => {
        if (dragIndex === null) return;
        reorderImages(dragIndex, targetIndex);
        setDragIndex(null);
        setDragOverIndex(null);
    };

    const renderImageTile = (index: number, opts?: { lightbox?: boolean }) => {
        const imageUrl = images[index] || '';
        const isAddSlot = isEditMode && index === images.length;
        const isDraggable = isEditMode && !isAddSlot;

        return (
            <div
                key={`tile-${index}`}
                className={`relative group ${dragOverIndex === index && dragIndex !== null ? 'ring-2 ring-blue-500 ring-offset-2 rounded-xl' : ''}`}
                draggable={isDraggable}
                onDragStart={(e) => {
                    if (!isDraggable) return;
                    setDragIndex(index);
                    e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                    if (!isEditMode || dragIndex === null || isAddSlot) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dragOverIndex !== index) setDragOverIndex(index);
                }}
                onDragLeave={() => {
                    if (dragOverIndex === index) setDragOverIndex(null);
                }}
                onDrop={(e) => {
                    if (!isEditMode || isAddSlot) return;
                    e.preventDefault();
                    handleDrop(index);
                }}
                onDragEnd={() => {
                    setDragIndex(null);
                    setDragOverIndex(null);
                }}
            >
                <EditableImage
                    contentKey={`gallery_image_${index}`}
                    initialSettings={data[`gallery_image_${index}__settings`]}
                    initialAttribution={data[`gallery_image_${index}__attribution`]}
                    imageUrl={imageUrl}
                    isEditMode={isEditMode}
                    onSave={(key, value) => handleImageSave(index, key, value)}
                    onUpload={context?.uploadImage}
                    className="w-full aspect-square object-cover rounded-xl bg-gray-100 cursor-pointer hover:opacity-90 transition-opacity"
                    placeholder="+ Add image"
                />
                {isDraggable && imageUrl && (
                    <div
                        className="absolute top-2 left-2 z-30 p-1.5 bg-black/60 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
                        title="Drag to reorder"
                    >
                        <GripVertical className="w-4 h-4" />
                    </div>
                )}
                {!isEditMode && imageUrl && opts?.lightbox && (
                    <button
                        type="button"
                        className="absolute inset-0 appearance-none border-0 bg-black/0 p-0 group-hover:bg-black/20 rounded-xl transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-900"
                        onClick={() => setLightboxIndex(index)}
                        aria-label={`Open gallery image ${index + 1}`}
                    />
                )}
            </div>
        );
    };

    const goPrev = () => {
        if (lightboxIndex === null) return;
        setLightboxIndex((lightboxIndex - 1 + images.length) % images.length);
    };
    const goNext = () => {
        if (lightboxIndex === null) return;
        setLightboxIndex((lightboxIndex + 1) % images.length);
    };

    // In auto-scroll mode (preview), render images in N rows that scroll horizontally.
    const autoScrollPreview = autoScroll && !isEditMode && images.length > 0;
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const rowBuckets: string[][] = [];
    if (autoScrollPreview) {
        for (let r = 0; r < autoScrollRows; r++) rowBuckets.push([]);
        images.forEach((img, i) => rowBuckets[i % autoScrollRows].push(img));
    }

    return (
        <section className="py-24" style={{ backgroundColor: bgColor }}>
            <div className="max-w-7xl mx-auto px-4">
                <EditableText
                    as="h2"
                    contentKey="title"
                    content={data.title}
                    defaultValue="Our Work"
                    isEditMode={isEditMode}
                    onSave={(key, value) => updateContent(key, value)}
                    className="text-4xl font-bold text-center mb-4"
                    style={{ color: fgOverride || pPrimary }}
                />
                <EditableText
                    as="p"
                    contentKey="subtitle"
                    content={data.subtitle}
                    defaultValue="Browse our portfolio of recent projects."
                    isEditMode={isEditMode}
                    onSave={(key, value) => updateContent(key, value)}
                    className="text-lg text-center mb-12 max-w-2xl mx-auto"
                    style={{ color: fgOverride || pPrimary, opacity: 0.6 }}
                />

                {autoScrollPreview ? (
                    <div className="overflow-hidden flex flex-col gap-4">
                        <style>{`
                            @keyframes ks-gallery-scroll-${safeId} {
                                from { transform: translateX(0); }
                                to { transform: translateX(-50%); }
                            }
                            .ks-gallery-row-${safeId} {
                                animation: ks-gallery-scroll-${safeId} linear infinite;
                            }
                            .ks-gallery-row-${safeId}:hover {
                                animation-play-state: paused;
                            }
                        `}</style>
                        {rowBuckets.map((row, rIdx) => {
                            // Duplicate row contents so the translateX(-50%) loop is seamless.
                            const doubled = [...row, ...row];
                            // Reverse alternate rows so they drift in opposite directions for visual variety.
                            const reverse = rIdx % 2 === 1;
                            const duration = Math.max(20, row.length * 5);
                            return (
                                <div key={rIdx} className="overflow-hidden">
                                    <div
                                        className={`flex gap-4 ks-gallery-row-${safeId}`}
                                        style={{
                                            width: 'max-content',
                                            animationDuration: `${duration}s`,
                                            animationDirection: reverse ? 'reverse' : 'normal',
                                        }}
                                    >
                                        {doubled.map((url, i) => {
                                            // Map back to original index for the lightbox click target.
                                            const originalIdx = images.indexOf(url);
                                            return (
                                                <button
                                                    type="button"
                                                    key={`${rIdx}-${i}`}
                                                    className="relative group w-56 h-56 sm:w-64 sm:h-64 shrink-0 cursor-pointer appearance-none border-0 bg-transparent p-0 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-900"
                                                    onClick={() => setLightboxIndex(originalIdx >= 0 ? originalIdx : 0)}
                                                    aria-label={`Open gallery image ${(originalIdx >= 0 ? originalIdx : 0) + 1}`}
                                                >
                                                    <img
                                                        src={url}
                                                        alt=""
                                                        className="w-full h-full object-cover rounded-xl bg-gray-100 hover:opacity-90 transition-opacity"
                                                    />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className={`grid gap-4 ${colsClass}`}>
                        {isEditMode
                            ? Array.from({ length: editSlotCount }).map((_, index) => renderImageTile(index, { lightbox: false }))
                            : images.map((_, index) => renderImageTile(index, { lightbox: true }))
                        }
                    </div>
                )}

                {showSeeMore && (
                    <div className="flex justify-center mt-10">
                        <EditableButton
                            contentKey="seeMore"
                            label={data.seeMore}
                            linkData={data.seeMoreLink}
                            iconData={data.seeMoreIcon}
                            defaultLabel="See More"
                            isEditMode={isEditMode}
                            onSave={(key, value) => updateContent(key, value)}
                            className="px-6 py-3 rounded-lg font-semibold text-white transition-opacity hover:opacity-90"
                            style={{ backgroundColor: pAccent }}
                        />
                    </div>
                )}
            </div>

            {/* Lightbox */}
            {lightboxIndex !== null && images[lightboxIndex] && (
                <div
                    className="fixed inset-0 bg-black/90 z-[9999] flex flex-col items-center justify-center p-4 sm:p-8"
                    onClick={() => setLightboxIndex(null)}
                >
                    <button
                        className="absolute top-4 right-4 sm:top-6 sm:right-6 text-white/80 hover:text-white p-2 z-10"
                        onClick={(e) => { e.stopPropagation(); setLightboxIndex(null); }}
                        aria-label="Close"
                    >
                        <X className="w-8 h-8" />
                    </button>

                    {showLightboxNav && images.length > 1 && (
                        <>
                            <button
                                className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-black/40 hover:bg-black/60 rounded-full p-2 sm:p-3 z-10 transition-colors"
                                onClick={(e) => { e.stopPropagation(); goPrev(); }}
                                aria-label="Previous image"
                            >
                                <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8" />
                            </button>
                            <button
                                className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 text-white/80 hover:text-white bg-black/40 hover:bg-black/60 rounded-full p-2 sm:p-3 z-10 transition-colors"
                                onClick={(e) => { e.stopPropagation(); goNext(); }}
                                aria-label="Next image"
                            >
                                <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8" />
                            </button>
                        </>
                    )}

                    <div
                        className="flex-1 flex items-center justify-center w-full min-h-0"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img
                            src={images[lightboxIndex]}
                            alt={`Gallery image ${lightboxIndex + 1}`}
                            className="max-w-full max-h-full object-contain rounded-lg"
                        />
                    </div>

                    {showLightboxThumbs && images.length > 1 && (
                        <div
                            className="mt-4 flex gap-2 overflow-x-auto max-w-full px-2 pb-2"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {images.map((url, i) => (
                                <button
                                    key={i}
                                    onClick={() => setLightboxIndex(i)}
                                    className={`shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-md overflow-hidden border-2 transition-all ${
                                        i === lightboxIndex ? 'border-white opacity-100' : 'border-transparent opacity-60 hover:opacity-100'
                                    }`}
                                    aria-label={`View image ${i + 1}`}
                                >
                                    <img src={url} alt="" className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
