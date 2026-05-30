'use client';

import React from 'react';
import EditableText from '../EditableText';
import EditableButton, { type ButtonIconData, type ButtonLinkData } from '../EditableButton';
import BlockPretext from '../BlockPretext';
import { Plus } from 'lucide-react';
import Reveal from '@/app/components/Reveal';
import { resolvePaletteColor } from '@/lib/palette-colors';
import InlineCardControls, { reorderItems } from './InlineCardControls';
import {
    MARKER_STYLE_OPTIONS,
    SPACING_DENSITY_OPTIONS,
    type MarkerStyle,
    getCardInlineStyle,
    getCardPaddingClass,
    getCardPresetShadowPaintBuffer,
    getCardShadowPaintBuffer,
    getCardShadowSafeContainerStyle,
    getCardStyleClass,
    getSurfaceStyle,
    getSurfaceTextColor,
    getTextAlignClass,
    getUniversalCardInlineStyle,
    getUniversalCardPaddingClass,
    getUniversalCardTextPaddingStyle,
    getUniversalCardTextColor,
    getUniversalCardClassName,
    readStyleOption,
    resolveCardPresetId,
    resolveUniversalCardSettings,
    shouldLockCardTextToSurface,
} from '@/lib/block-style-options';

interface ServicesGridBlockProps {
    id: string;
    data: Record<string, unknown>;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: (key: string, value: unknown) => void;
}

type ServiceItem = {
    title: string;
    description: string;
};

export default function ServicesGridBlock({ data, isEditMode, palette, updateContent }: ServicesGridBlockProps) {
    const pPrimary = palette.primary || '#1f2937';
    const pSecondary = palette.secondary || '#dc2626';
    const bgColor = resolvePaletteColor(data.backgroundColor, palette, '#ffffff');
    const fgOverride = resolvePaletteColor(data.foregroundColor, palette);
    const showCta = data.ctaEnabled !== false;
    const universalCardSettings = resolveUniversalCardSettings(data, {
        fallbackPreset: 'soft',
        fallbackMarkerStyle: 'numbered',
        fallbackTextAlign: 'left',
    });
    const cardStyle = resolveCardPresetId(data, 'soft');
    const surfaceStyle = getSurfaceStyle(data.surfaceStyle, cardStyle);
    const markerStyle = universalCardSettings?.markerStyle || readStyleOption(data.markerStyle, MARKER_STYLE_OPTIONS, 'numbered');
    const spacingDensity = readStyleOption(data.spacingDensity, SPACING_DENSITY_OPTIONS, 'standard');
    const textAlignClass = universalCardSettings ? getTextAlignClass(universalCardSettings.textAlign) : getTextAlignClass(data.textAlign);
    const activeSurfaceStyle = universalCardSettings?.surface || surfaceStyle;
    const cardTextColor = universalCardSettings ? getUniversalCardTextColor(universalCardSettings, palette) : getSurfaceTextColor(surfaceStyle, palette);
    const lockCardTextToSurface = shouldLockCardTextToSurface(activeSurfaceStyle);
    const serviceTitleColor = lockCardTextToSurface ? cardTextColor : fgOverride || cardTextColor;
    const serviceDescriptionColor = lockCardTextToSurface
        ? cardTextColor
        : fgOverride || (activeSurfaceStyle === 'primary' || activeSurfaceStyle === 'secondary' ? cardTextColor : pPrimary);
    const cardClassName = universalCardSettings
        ? `${getUniversalCardClassName(universalCardSettings)} ${getUniversalCardPaddingClass(universalCardSettings)} ${textAlignClass} transition-[border-color,box-shadow,opacity,transform] relative group/card`
        : `${getCardStyleClass(cardStyle)} ${getCardPaddingClass(cardStyle, spacingDensity)} ${textAlignClass} transition-[border-color,box-shadow,opacity,transform] relative group/card`;
    const cardInlineStyle = universalCardSettings
        ? {
            ...getUniversalCardInlineStyle(universalCardSettings, palette),
            ...(getUniversalCardTextPaddingStyle(universalCardSettings) || {}),
        }
        : getCardInlineStyle(cardStyle, surfaceStyle, palette);
    const cardShadowBuffer = universalCardSettings
        ? getCardShadowPaintBuffer(universalCardSettings)
        : getCardPresetShadowPaintBuffer(cardStyle);
    const cardShadowSafeStyle = getCardShadowSafeContainerStyle(cardShadowBuffer);
    const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);

    const items = normalizeServiceItems(data.items) || [
        { title: "Service 1", description: "First service description." },
        { title: "Service 2", description: "Second service description." },
        { title: "Service 3", description: "Third service description." }
    ];

    const handleAddItem = () => {
        const newItems = [...items, { title: `Service ${items.length + 1}`, description: "Description of this service." }];
        updateContent('items', newItems);
    };

    const handleRemoveItem = (index: number) => {
        if (items.length <= 1) return;
        const newItems = items.filter((_, i) => i !== index);
        updateContent('items', newItems);
    };

    const handleUpdateItem = (index: number, field: string, value: string) => {
        const newItems = items.map((item, i) =>
            i === index ? { ...item, [field]: value } : item
        );
        updateContent('items', newItems);
    };

    const handleReorderItem = (fromIndex: number, toIndex: number) => {
        updateContent('items', reorderItems(items, fromIndex, toIndex));
    };

    return (
        <section className="py-24" style={{ backgroundColor: bgColor }}>
            <div className="max-w-7xl mx-auto px-4">
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <Reveal>
                        <BlockPretext
                            data={data}
                            isEditMode={isEditMode}
                            palette={palette}
                            updateContent={updateContent}
                            defaultText="Services"
                        />
                        <EditableText
                            as="h2"
                            contentKey="title"
                            content={readString(data.title)}
                            defaultValue="Our Core Services"
                            isEditMode={isEditMode}
                            onSave={(key, value) => updateContent(key, value)}
                            className="text-4xl font-bold mb-4"
                            style={{ color: fgOverride || pPrimary }}
                        />
                    </Reveal>
                    {(data.subtitle || isEditMode) && (
                        <Reveal>
                            <EditableText
                                as="p"
                                contentKey="subtitle"
                                content={readString(data.subtitle)}
                                defaultValue="Professional expertise tailored to your needs."
                                isEditMode={isEditMode}
                                onSave={(key, value) => updateContent(key, value)}
                                className="text-xl mb-6"
                                style={{ color: fgOverride || pPrimary, opacity: 0.7 }}
                            />
                        </Reveal>
                    )}
                    <Reveal>
                        <div className="w-24 border-b-4 mx-auto" style={{ borderColor: pSecondary }}></div>
                    </Reveal>
                </div>

                {/* Dynamic Grid Layout */}
                <div style={cardShadowSafeStyle}>
                    <div className={`ks-layout-grid grid gap-8 ${items.length === 1 ? 'grid-cols-1 max-w-2xl mx-auto' :
                        items.length === 2 ? 'md:grid-cols-2 max-w-4xl mx-auto' :
                            items.length === 4 ? 'grid-cols-1 md:grid-cols-2 max-w-5xl mx-auto' :
                                'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                        }`}>
                        {items.map((item, index) => {
                            const isDragging = draggedIndex === index;
                            const isDragTarget = dragOverIndex === index && draggedIndex !== index;
                            return (
                            <Reveal
                                key={index}
                                className="group/card relative flex h-full"
                                onDragOver={(event) => {
                                    if (!isEditMode || draggedIndex === null) return;
                                    event.preventDefault();
                                    setDragOverIndex(index);
                                }}
                                onDrop={(event) => {
                                    if (!isEditMode || draggedIndex === null) return;
                                    event.preventDefault();
                                    handleReorderItem(draggedIndex, index);
                                    setDraggedIndex(null);
                                    setDragOverIndex(null);
                                }}
                            >
                            {isEditMode && (
                                <InlineCardControls
                                    canRemove={items.length > 1}
                                    dragData={`service-${index}`}
                                    dragTitle="Drag to reorder service"
                                    removeTitle="Delete service"
                                    onDragStart={() => {
                                        setDraggedIndex(index);
                                        setDragOverIndex(null);
                                    }}
                                    onDragEnd={() => {
                                        setDraggedIndex(null);
                                        setDragOverIndex(null);
                                    }}
                                    onRemove={() => handleRemoveItem(index)}
                                />
                            )}

                            <div
                                className={`${cardClassName} w-full ${
                                    isDragTarget ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-100'
                                } ${isDragging ? 'scale-[0.99] opacity-60' : ''}`}
                                style={cardInlineStyle}
                            >
                            {markerStyle !== 'none' && markerStyle !== 'accentLine' && (
                                <div
                                    className={getServiceMarkerClass(markerStyle, textAlignClass)}
                                    style={getServiceMarkerStyle(markerStyle, pSecondary)}
                                >
                                    {index + 1}
                                </div>
                            )}
                            {markerStyle === 'accentLine' && (
                                <div
                                    className={`${textAlignClass === 'text-center' ? 'mx-auto' : ''} mb-6 h-1 w-16 rounded-full`}
                                    style={{ backgroundColor: pSecondary }}
                                />
                            )}

                            <EditableText
                                as="h3"
                                contentKey={`item_${index}_title`}
                                content={item.title}
                                defaultValue={`Premium Service ${index + 1}`}
                                isEditMode={isEditMode}
                                onSave={(_key, value) => handleUpdateItem(index, 'title', value)}
                                className="text-xl font-bold mb-3"
                                style={{ color: serviceTitleColor }}
                            />
                            <EditableText
                                as="p"
                                contentKey={`item_${index}_desc`}
                                content={item.description}
                                defaultValue="Comprehensive diagnostic, repair, and installation services handled by our certified professionals."
                                isEditMode={isEditMode}
                                onSave={(_key, value) => handleUpdateItem(index, 'description', value)}
                                className="leading-relaxed"
                                style={{ color: serviceDescriptionColor, opacity: 0.7 }}
                            />
                            </div>
                            </Reveal>
                            );
                        })}
                    </div>
                </div>

                {/* Add Service Button (edit mode only) */}
                {isEditMode && (
                    <div className="flex justify-center mt-6">
                        <button
                            onClick={handleAddItem}
                            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-dashed border-blue-300"
                        >
                            <Plus className="w-4 h-4" />
                            Add Service
                        </button>
                    </div>
                )}

                {/* Optional CTA Link */}
                {showCta && (readString(data.ctaText) || isEditMode) && (
                    <Reveal className="flex justify-center mt-12">
                        <EditableButton
                            contentKey="ctaText"
                            label={readString(data.ctaText)}
                            linkData={readButtonLink(data.ctaTextLink)}
                            iconData={readButtonIcon(data.ctaTextIcon)}
                            defaultLabel="See All Services →"
                            isEditMode={isEditMode}
                            onSave={(key, value) => updateContent(key, value)}
                            className="text-lg font-semibold hover:underline transition-colors"
                            style={{ color: pSecondary }}
                            palette={palette}
                        />
                    </Reveal>
                )}
            </div>
        </section>
    );
}

function getServiceMarkerClass(markerStyle: MarkerStyle, textAlignClass: string): string {
    const alignClass = textAlignClass === 'text-center' ? 'mx-auto' : '';
    if (markerStyle === 'plain') return `${alignClass} mb-5 text-sm font-black uppercase tracking-widest`;
    if (markerStyle === 'badge') return `${alignClass} mb-6 flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white`;
    if (markerStyle === 'framed') return `${alignClass} mb-6 flex h-12 w-12 items-center justify-center rounded-xl border text-lg font-bold`;
    return `${alignClass} mb-6 flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold text-white`;
}

function getServiceMarkerStyle(markerStyle: MarkerStyle, secondaryColor: string): React.CSSProperties {
    if (markerStyle === 'plain') return { color: secondaryColor };
    if (markerStyle === 'framed') return { borderColor: secondaryColor, color: secondaryColor };
    return { backgroundColor: secondaryColor };
}

function normalizeServiceItems(value: unknown): ServiceItem[] | null {
    if (!Array.isArray(value)) return null;
    const items = value
        .map((item) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
            const record = item as Record<string, unknown>;
            return {
                title: typeof record.title === 'string' ? record.title : 'Service',
                description: typeof record.description === 'string' ? record.description : '',
            };
        })
        .filter((item): item is ServiceItem => Boolean(item));
    return items.length ? items : null;
}

function readString(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
}

function readButtonLink(value: unknown): Partial<ButtonLinkData> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    return value as Partial<ButtonLinkData>;
}

function readButtonIcon(value: unknown): ButtonIconData | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    return value as ButtonIconData;
}
