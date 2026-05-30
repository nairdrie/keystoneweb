'use client';

import React from 'react';
import EditableText from '../EditableText';
import BlockPretext from '../BlockPretext';
import { Plus } from 'lucide-react';
import Reveal from '@/app/components/Reveal';
import { resolvePaletteColor } from '@/lib/palette-colors';
import InlineCardControls, { reorderItems } from './InlineCardControls';
import {
    MARKER_STYLE_OPTIONS,
    SPACING_DENSITY_OPTIONS,
    getCardInlineStyle,
    getCardPresetShadowPaintBuffer,
    getCardShadowPaintBuffer,
    getCardShadowSafeContainerStyle,
    getCardStyleClass,
    getSurfaceStyle,
    getSurfaceTextColor,
    getTextAlignClass,
    getUniversalCardClassName,
    getUniversalCardInlineStyle,
    getUniversalCardPaddingClass,
    getUniversalCardTextColor,
    readStyleOption,
    resolveCardPresetId,
    resolveUniversalCardSettings,
    shouldLockCardTextToSurface,
    type CardStyle,
    type MarkerStyle,
    type SpacingDensity,
} from '@/lib/block-style-options';

interface FeaturesListBlockProps {
    id: string;
    data: Record<string, unknown>;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: (key: string, value: unknown) => void;
}

const DEFAULT_FEATURE_ITEMS = [
    "Licensed & Insured Experts",
    "100% Satisfaction Guarantee",
    "Upfront Honest Pricing",
    "24/7 Emergency Support"
];
const FEATURE_CARD_EDIT_PAINT_BUFFER = 18;

export default function FeaturesListBlock({ data, isEditMode, palette, updateContent }: FeaturesListBlockProps) {
    const pPrimary = palette.primary || '#1f2937';
    const pSecondary = palette.secondary || '#dc2626';
    const bgColor = resolvePaletteColor(data.backgroundColor, palette, '#ffffff');
    const fgOverride = resolvePaletteColor(data.foregroundColor, palette);
    const hasCardDesignOverride = hasFeatureCardDesignOverride(data);
    const universalCardSettings = hasCardDesignOverride
        ? resolveUniversalCardSettings(data, {
            fallbackPreset: 'soft',
            fallbackMarkerStyle: 'framed',
            fallbackTextAlign: 'left',
        })
        : null;
    const cardStyle = resolveCardPresetId(data, 'soft');
    const surfaceStyle = getSurfaceStyle(data.surfaceStyle, cardStyle);
    const spacingDensity = readStyleOption(data.spacingDensity, SPACING_DENSITY_OPTIONS, 'standard');
    const markerStyle = universalCardSettings?.markerStyle || readStyleOption(data.markerStyle, MARKER_STYLE_OPTIONS, 'framed');
    const textAlignClass = universalCardSettings ? getTextAlignClass(universalCardSettings.textAlign) : getTextAlignClass(data.textAlign);
    const activeSurfaceStyle = universalCardSettings?.surface || surfaceStyle;
    const surfaceCardTextColor = universalCardSettings ? getUniversalCardTextColor(universalCardSettings, palette) : getSurfaceTextColor(surfaceStyle, palette);
    const lockCardTextToSurface = shouldLockCardTextToSurface(activeSurfaceStyle);
    const cardTextColor = lockCardTextToSurface ? surfaceCardTextColor : fgOverride || surfaceCardTextColor;
    const mutedCardColor = lockCardTextToSurface ? surfaceCardTextColor : fgOverride || pPrimary;
    const presetCardClassName = universalCardSettings
        ? `${getUniversalCardClassName(universalCardSettings)} ${getUniversalCardPaddingClass(universalCardSettings)} ${textAlignClass}`
        : `${getCardStyleClass(cardStyle)} ${getFeatureCardPaddingClass(cardStyle, spacingDensity)} ${textAlignClass}`;
    const legacyCardClassName = 'bg-gray-50 p-4 rounded-lg shadow-sm border';
    const cardClassName = `${hasCardDesignOverride ? presetCardClassName : legacyCardClassName} relative group/card flex ${textAlignClass === 'text-center' ? 'flex-col justify-center text-center' : 'items-center'} gap-4 transition-[border-color,box-shadow,opacity,transform]`;
    const baseCardInlineStyle = hasCardDesignOverride
        ? universalCardSettings
            ? getUniversalCardInlineStyle(universalCardSettings, palette)
            : getCardInlineStyle(cardStyle, surfaceStyle, palette)
        : undefined;
    const cardInlineStyle = universalCardSettings
        ? getFeatureCardInlineStyle(baseCardInlineStyle, universalCardSettings.paddingPx)
        : baseCardInlineStyle;
    const cardShadowBuffer = hasCardDesignOverride
        ? universalCardSettings
            ? getCardShadowPaintBuffer(universalCardSettings)
            : getCardPresetShadowPaintBuffer(cardStyle)
        : 0;
    const cardPaintBuffer = Math.max(cardShadowBuffer, isEditMode ? FEATURE_CARD_EDIT_PAINT_BUFFER : 0);
    const cardShadowSafeStyle = hasCardDesignOverride ? getCardShadowSafeContainerStyle(cardPaintBuffer) : undefined;
    const editModeCardInlineStyle = isEditMode && hasCardDesignOverride
        ? { ...(cardInlineStyle || {}), overflow: 'visible' as const }
        : cardInlineStyle;
    const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);

    const items = normalizeFeatureItems(data.items);

    const handleAddItem = () => {
        updateContent('items', [...items, `New Feature ${items.length + 1}`]);
    };

    const handleRemoveItem = (index: number) => {
        if (items.length <= 1) return;
        updateContent('items', items.filter((_: string, i: number) => i !== index));
    };

    const handleUpdateItem = (index: number, value: string) => {
        const newItems = items.map((item: string, i: number) =>
            i === index ? value : item
        );
        updateContent('items', newItems);
    };

    const handleReorderItem = (fromIndex: number, toIndex: number) => {
        updateContent('items', reorderItems(items, fromIndex, toIndex));
    };

    return (
        <section className="py-24" style={{ backgroundColor: bgColor }}>
            <div className="max-w-4xl mx-auto px-4">
                <Reveal>
                    <BlockPretext
                        data={data}
                        isEditMode={isEditMode}
                        palette={palette}
                        updateContent={updateContent}
                        defaultText="Why Us"
                    />
                    <EditableText
                        as="h2"
                        contentKey="title"
                        content={readString(data.title)}
                        defaultValue="Why Choose Us?"
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="text-4xl font-bold mb-10 text-center"
                        style={{ color: fgOverride || pPrimary }}
                    />
                </Reveal>

                <div style={cardShadowSafeStyle}>
                    <ul className="space-y-6 text-lg max-w-2xl mx-auto">
                        {items.map((item, index) => {
                            const isDragging = draggedIndex === index;
                            const isDragTarget = dragOverIndex === index && draggedIndex !== index;
                            return (
                            <Reveal
                                key={index}
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
                                <li
                                    className={`${cardClassName} ${
                                        isDragTarget ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-100'
                                    } ${isDragging ? 'scale-[0.99] opacity-60' : ''}`}
                                    style={editModeCardInlineStyle}
                                >
                                    {isEditMode && (
                                        <InlineCardControls
                                            canRemove={items.length > 1}
                                            dragData={`feature-${index}`}
                                            dragTitle="Drag to reorder feature"
                                            removeTitle="Delete feature"
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
                                    {markerStyle !== 'none' && (
                                        <span
                                            className={getFeatureMarkerClass(markerStyle)}
                                            style={getFeatureMarkerStyle(markerStyle, pSecondary)}
                                        >
                                            {markerStyle === 'numbered' ? index + 1 : markerStyle === 'accentLine' ? '' : '\u2713'}
                                        </span>
                                    )}
                                    <div className="flex-1 w-full">
                                        <EditableText
                                            as="span"
                                            contentKey={`feature_${index}`}
                                            content={item}
                                            defaultValue={item}
                                            isEditMode={isEditMode}
                                            onSave={(_key, value) => handleUpdateItem(index, value)}
                                            style={{ color: hasCardDesignOverride ? cardTextColor : fgOverride || mutedCardColor }}
                                        />
                                    </div>
                                </li>
                            </Reveal>
                            );
                        })}
                    </ul>
                </div>

                {isEditMode && (
                    <div className="flex justify-center mt-6">
                        <button
                            onClick={handleAddItem}
                            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-dashed border-blue-300"
                        >
                            <Plus className="w-4 h-4" />
                            Add Feature
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}

function hasFeatureCardDesignOverride(data: Record<string, unknown>): boolean {
    if (data.cardSettings && typeof data.cardSettings === 'object' && !Array.isArray(data.cardSettings)) {
        return Object.keys(data.cardSettings).length > 0;
    }
    return typeof data.cardStyle === 'string' && data.cardStyle.trim() !== '' && data.cardStyle !== 'soft';
}

function normalizeFeatureItems(value: unknown): string[] {
    if (!Array.isArray(value)) return DEFAULT_FEATURE_ITEMS;
    const items = value.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
    return items.length ? items : DEFAULT_FEATURE_ITEMS;
}

function readString(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
}

function getFeatureCardPaddingClass(style: CardStyle, density: SpacingDensity): string {
    if (style === 'poster' || style === 'minimal') {
        if (density === 'compact') return 'px-5 py-3';
        if (density === 'spacious') return 'px-8 py-5';
        return 'px-6 py-4';
    }
    if (density === 'compact') return 'px-5 py-3';
    if (density === 'spacious') return style === 'bordered' ? 'px-9 py-6' : 'px-10 py-6';
    if (style === 'bordered') return 'px-7 py-4';
    return 'px-8 py-5';
}

function getFeatureCardInlineStyle(
    baseStyle: React.CSSProperties | undefined,
    paddingPx: number,
): React.CSSProperties {
    const verticalPaddingPx = Math.min(26, Math.max(14, Math.round(paddingPx * 0.58)));
    return {
        ...(baseStyle || {}),
        padding: `${verticalPaddingPx}px ${paddingPx}px`,
    };
}

function getFeatureMarkerClass(markerStyle: MarkerStyle): string {
    if (markerStyle === 'plain') return 'shrink-0 text-lg font-black leading-none';
    if (markerStyle === 'badge') return 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white';
    if (markerStyle === 'framed') return 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold shadow-sm ring-1';
    if (markerStyle === 'accentLine') return 'h-10 w-1 shrink-0 rounded-full';
    return 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white';
}

function getFeatureMarkerStyle(markerStyle: MarkerStyle, secondaryColor: string): React.CSSProperties {
    if (markerStyle === 'plain') return { color: secondaryColor };
    if (markerStyle === 'framed') return { color: secondaryColor, '--tw-ring-color': `${secondaryColor}40` } as React.CSSProperties;
    if (markerStyle === 'accentLine') return { backgroundColor: secondaryColor };
    return { backgroundColor: secondaryColor };
}
