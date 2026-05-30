'use client';

import React from 'react';
import { Building2, Calendar, Plus, X } from 'lucide-react';
import EditableText from '../EditableText';
import BlockPretext from '../BlockPretext';
import { resolvePaletteColor } from '@/lib/palette-colors';
import InlineCardControls, { reorderItems } from './InlineCardControls';
import Reveal, { useStaggerSec } from '@/app/components/Reveal';
import {
    SPACING_DENSITY_OPTIONS,
    getCardInlineStyle,
    getCardPaddingClass,
    getCardStyleClass,
    getSurfaceStyle,
    getSurfaceTextColor,
    getUniversalCardClassName,
    getUniversalCardInlineStyle,
    getUniversalCardPaddingClass,
    getUniversalCardTextColor,
    getUniversalCardTextPaddingStyle,
    readStyleOption,
    resolveCardPresetId,
    resolveUniversalCardSettings,
    shouldLockCardTextToSurface,
} from '@/lib/block-style-options';

interface TimelineItem {
    title: string;
    organization: string;
    dateRange: string;
    description: string;
    tags: string[];
}

interface TimelineBlockData extends Record<string, unknown> {
    title?: string;
    subtitle?: string;
    backgroundColor?: string;
    foregroundColor?: string;
    variant?: string;
    items?: TimelineItem[];
}

interface TimelineBlockProps {
    id: string;
    data: TimelineBlockData;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: (key: string, value: unknown) => void;
}

const DEFAULT_TIMELINE_ITEMS: TimelineItem[] = [
    {
        title: 'Milestone Title',
        organization: 'Organization',
        dateRange: 'Year - Present',
        description: 'Describe what happened during this period and the impact it had.',
        tags: ['Tag 1', 'Tag 2', 'Tag 3'],
    },
    {
        title: 'Milestone Title',
        organization: 'Organization',
        dateRange: 'Year - Year',
        description: 'Describe what happened during this period and the impact it had.',
        tags: ['Tag 1', 'Tag 2'],
    },
    {
        title: 'Milestone Title',
        organization: 'Organization',
        dateRange: 'Year',
        description: 'Describe what happened during this period and the impact it had.',
        tags: ['Tag 1'],
    },
];

const TIMELINE_CARD_PADDING_PX = 24;
const TIMELINE_COMPACT_CARD_PADDING_PX = 16;
const TIMELINE_CARD_MIN_HEIGHT_PX = 180;

function normalizeTags(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.map((tag) => String(tag).trim()).filter(Boolean);
    }
    if (typeof value === 'string') {
        return value.split(',').map((t) => t.trim()).filter(Boolean);
    }
    return [];
}

function normalizeItems(value: unknown): TimelineItem[] {
    if (!Array.isArray(value) || value.length === 0) return DEFAULT_TIMELINE_ITEMS;
    return value.map((raw) => {
        const item = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
        return {
            title: typeof item.title === 'string' ? item.title : '',
            organization: typeof item.organization === 'string' ? item.organization : '',
            dateRange: typeof item.dateRange === 'string' ? item.dateRange : '',
            description: typeof item.description === 'string' ? item.description : '',
            tags: normalizeTags(item.tags),
        };
    });
}

export default function TimelineBlock({ data, isEditMode, palette, updateContent }: TimelineBlockProps) {
    const pPrimary = palette.primary || '#1f2937';
    const pSecondary = palette.secondary || '#dc2626';
    const lineColor = pSecondary;
    const bgColor = resolvePaletteColor(data.backgroundColor, palette, '#ffffff');
    const fgOverride = resolvePaletteColor(data.foregroundColor, palette);
    const fgColor = fgOverride || pPrimary;

    const variant = typeof data.variant === 'string' ? data.variant : 'cards';
    const items = normalizeItems(data.items);
    const staggerSec = useStaggerSec();
    const hasCardDesignOverride = hasTimelineCardDesignOverride(data);
    const universalCardSettings = hasCardDesignOverride
        ? resolveUniversalCardSettings(data, {
            fallbackPreset: 'soft',
            fallbackTextAlign: 'left',
        })
        : null;
    const cardStyle = resolveCardPresetId(data, 'soft');
    const surfaceStyle = getSurfaceStyle(data.surfaceStyle, cardStyle);
    const spacingDensity = readStyleOption(data.spacingDensity, SPACING_DENSITY_OPTIONS, 'standard');
    const activeSurfaceStyle = universalCardSettings?.surface || surfaceStyle;
    const surfaceCardTextColor = universalCardSettings ? getUniversalCardTextColor(universalCardSettings, palette) : getSurfaceTextColor(surfaceStyle, palette);
    const lockCardTextToSurface = shouldLockCardTextToSurface(activeSurfaceStyle);
    const timelineTitleColor = hasCardDesignOverride
        ? lockCardTextToSurface ? surfaceCardTextColor : fgOverride || surfaceCardTextColor
        : fgColor;
    const timelineBodyColor = hasCardDesignOverride
        ? lockCardTextToSurface ? surfaceCardTextColor : fgOverride || pPrimary
        : fgColor;
    const cardClassName = hasCardDesignOverride
        ? universalCardSettings
            ? `${getUniversalCardClassName(universalCardSettings)} ${getUniversalCardPaddingClass(universalCardSettings)} relative group/card transition-[border-color,box-shadow,opacity,transform]`
            : `${getCardStyleClass(cardStyle)} ${getCardPaddingClass(cardStyle, spacingDensity)} relative group/card transition-[border-color,box-shadow,opacity,transform]`
        : '';
    const cardInlineStyle = hasCardDesignOverride
        ? universalCardSettings
            ? {
                ...getUniversalCardInlineStyle(universalCardSettings, palette),
                ...(getUniversalCardTextPaddingStyle(universalCardSettings) || {}),
            }
            : getCardInlineStyle(cardStyle, surfaceStyle, palette)
        : undefined;
    const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);

    const updateItem = (index: number, field: keyof TimelineItem, value: TimelineItem[keyof TimelineItem]) => {
        updateContent('items', items.map((item, i) => i === index ? { ...item, [field]: value } : item));
    };

    const handleAddItem = () => {
        updateContent('items', [
            ...items,
            {
                title: 'New Role',
                organization: 'Company Name',
                dateRange: 'Year - Year',
                description: 'Describe what you accomplished here.',
                tags: [],
            },
        ]);
    };

    const handleRemoveItem = (index: number) => {
        if (items.length <= 1) return;
        updateContent('items', items.filter((_, i) => i !== index));
    };

    const handleReorderItem = (fromIndex: number, toIndex: number) => {
        updateContent('items', reorderItems(items, fromIndex, toIndex));
    };

    const addTag = (index: number) => {
        const item = items[index];
        const next = [...item.tags, 'New Tag'];
        updateItem(index, 'tags', next);
    };

    const updateTag = (itemIndex: number, tagIndex: number, value: string) => {
        const item = items[itemIndex];
        const next = item.tags.map((tag, i) => i === tagIndex ? value : tag);
        updateItem(itemIndex, 'tags', next);
    };

    const removeTag = (itemIndex: number, tagIndex: number) => {
        const item = items[itemIndex];
        const next = item.tags.filter((_, i) => i !== tagIndex);
        updateItem(itemIndex, 'tags', next);
    };

    const renderItemControls = (index: number) => isEditMode ? (
        <InlineCardControls
            canRemove={items.length > 1}
            dragData={`timeline-${index}`}
            dragTitle="Drag to reorder timeline entry"
            removeTitle="Delete timeline entry"
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
    ) : null;

    const getDragHandlers = (index: number) => ({
        onDragOver: (event: React.DragEvent) => {
            if (!isEditMode || draggedIndex === null) return;
            event.preventDefault();
            setDragOverIndex(index);
        },
        onDrop: (event: React.DragEvent) => {
            if (!isEditMode || draggedIndex === null) return;
            event.preventDefault();
            handleReorderItem(draggedIndex, index);
            setDraggedIndex(null);
            setDragOverIndex(null);
        },
    });

    const getCardStateClass = (index: number) => {
        const isDragging = draggedIndex === index;
        const isDragTarget = dragOverIndex === index && draggedIndex !== index;
        return `${isDragTarget ? 'ring-2 ring-blue-100 border-blue-300' : ''} ${isDragging ? 'scale-[0.99] opacity-60' : ''}`;
    };

    const renderCard = (item: TimelineItem, index: number, options?: { compact?: boolean }) => {
        const compact = options?.compact === true;
        const timelineCardStyle = hasCardDesignOverride
            ? {
                ...(cardInlineStyle || {}),
                padding: compact ? TIMELINE_COMPACT_CARD_PADDING_PX : TIMELINE_CARD_PADDING_PX,
                minHeight: compact ? undefined : TIMELINE_CARD_MIN_HEIGHT_PX,
            }
            : cardInlineStyle;
        return (
            <div
                className={`${hasCardDesignOverride ? cardClassName : `relative rounded-2xl border bg-white ${compact ? 'border-transparent shadow-none p-4' : 'border-slate-200 shadow-sm p-6 md:p-7'} group/card transition-[border-color,box-shadow,opacity,transform]`} ${getCardStateClass(index)}`}
                style={timelineCardStyle}
                {...getDragHandlers(index)}
            >
                {renderItemControls(index)}
                <div className={`flex flex-col gap-3 md:flex-row md:items-start md:justify-between ${isEditMode ? 'pr-16' : ''}`}>
                    <div className="min-w-0 flex-1">
                        <EditableText
                            as="h3"
                            contentKey={`timeline_${index}_title`}
                            content={item.title}
                            defaultValue={`Role ${index + 1}`}
                            isEditMode={isEditMode}
                            onSave={(_key, value) => updateItem(index, 'title', value)}
                            className="text-lg md:text-xl font-bold leading-tight"
                            style={{ color: timelineTitleColor }}
                        />
                        <div
                            className="mt-1 flex items-center gap-1.5 text-sm"
                            style={{ color: timelineBodyColor, opacity: 0.7 }}
                        >
                            <Building2 className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                            <EditableText
                                as="span"
                                contentKey={`timeline_${index}_organization`}
                                content={item.organization}
                                defaultValue="Company"
                                isEditMode={isEditMode}
                                onSave={(_key, value) => updateItem(index, 'organization', value)}
                                className="truncate"
                            />
                        </div>
                    </div>
                    <div className="md:flex-shrink-0">
                        <span
                            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold"
                            style={{
                                color: timelineBodyColor,
                                opacity: 0.85,
                                backgroundColor: lockCardTextToSurface ? 'rgba(255,255,255,0.12)' : '#ffffff',
                                borderColor: lockCardTextToSurface ? 'rgba(255,255,255,0.24)' : '#e2e8f0',
                            }}
                        >
                            <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                            <EditableText
                                as="span"
                                contentKey={`timeline_${index}_dateRange`}
                                content={item.dateRange}
                                defaultValue="Year - Year"
                                isEditMode={isEditMode}
                                onSave={(_key, value) => updateItem(index, 'dateRange', value)}
                            />
                        </span>
                    </div>
                </div>

                <EditableText
                    as="p"
                    contentKey={`timeline_${index}_description`}
                    content={item.description}
                    defaultValue="Describe what you accomplished here."
                    isEditMode={isEditMode}
                    onSave={(_key, value) => updateItem(index, 'description', value)}
                    className="mt-4 leading-relaxed"
                    style={{ color: timelineBodyColor, opacity: 0.75 }}
                />

                {(item.tags.length > 0 || isEditMode) && (
                    <div className="mt-5 flex flex-wrap items-center gap-2">
                        {item.tags.map((tag, tagIndex) => (
                            <TagChip
                                key={tagIndex}
                                tag={tag}
                                isEditMode={isEditMode}
                                accentColor={pSecondary}
                                onChange={(value) => updateTag(index, tagIndex, value)}
                                onRemove={() => removeTag(index, tagIndex)}
                            />
                        ))}
                        {isEditMode && (
                            <button
                                type="button"
                                onClick={() => addTag(index)}
                                className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs font-semibold text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-700 hover:bg-slate-50"
                            >
                                <Plus className="w-3 h-3" />
                                Add tag
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const renderHeader = (defaults: { title: string; subtitle: string; pretext?: string }) => (
        <>
            <BlockPretext
                data={data}
                isEditMode={isEditMode}
                palette={palette}
                updateContent={updateContent}
                defaultText={defaults.pretext || 'Timeline'}
            />
            <EditableText
                as="h2"
                contentKey="title"
                content={data.title}
                defaultValue={defaults.title}
                isEditMode={isEditMode}
                onSave={(key, value) => updateContent(key, value)}
                className="text-4xl md:text-5xl font-bold text-center"
                style={{ color: fgColor }}
            />
            <EditableText
                as="p"
                contentKey="subtitle"
                content={data.subtitle}
                defaultValue={defaults.subtitle}
                isEditMode={isEditMode}
                onSave={(key, value) => updateContent(key, value)}
                className="text-lg text-center mt-3 mb-12 max-w-2xl mx-auto"
                style={{ color: fgColor, opacity: 0.6 }}
            />
        </>
    );

    if (variant === 'compact') {
        return (
            <section className="py-20" style={{ backgroundColor: bgColor }}>
                <div className="max-w-4xl mx-auto px-4">
                    {renderHeader({ title: 'Timeline', subtitle: 'A chronological overview.' })}
                    <ol className="space-y-3">
                        {items.map((item, index) => (
                            <Reveal key={index} delay={index * staggerSec}>
                            <li className="grid grid-cols-1 gap-3 md:grid-cols-[160px_1fr] md:gap-6">
                                <div className="text-sm font-semibold tabular-nums" style={{ color: pSecondary }}>
                                    <EditableText
                                        as="span"
                                        contentKey={`timeline_${index}_dateRange`}
                                        content={item.dateRange}
                                        defaultValue="Year - Year"
                                        isEditMode={isEditMode}
                                        onSave={(_key, value) => updateItem(index, 'dateRange', value)}
                                    />
                                </div>
                                <div className="border-l-2 pl-5" style={{ borderColor: lineColor }}>
                                    {renderCard(item, index, { compact: true })}
                                </div>
                            </li>
                            </Reveal>
                        ))}
                    </ol>
                    {isEditMode && (
                        <button
                            type="button"
                            onClick={handleAddItem}
                            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50"
                        >
                            <Plus className="w-4 h-4" />
                            Add Timeline Entry
                        </button>
                    )}
                </div>
            </section>
        );
    }

    if (variant === 'centered') {
        return (
            <section className="py-20" style={{ backgroundColor: bgColor }}>
                <div className="max-w-5xl mx-auto px-4">
                    {renderHeader({ title: 'Timeline', subtitle: 'A chronological overview.' })}
                    <div className="relative">
                        <div
                            className="absolute left-1/2 top-2 bottom-2 hidden w-0.5 -translate-x-1/2 md:block"
                            style={{ backgroundColor: lineColor }}
                            aria-hidden="true"
                        />
                        <div className="space-y-6 md:space-y-10">
                            {items.map((item, index) => {
                                const isLeft = index % 2 === 0;
                                return (
                                    <Reveal key={index} delay={index * staggerSec}>
                                    <div className="relative md:grid md:grid-cols-2 md:gap-10">
                                        <div
                                            className="absolute left-1/2 top-6 hidden h-3.5 w-3.5 -translate-x-1/2 rounded-full ring-4 ring-white md:block"
                                            style={{ backgroundColor: pSecondary }}
                                            aria-hidden="true"
                                        />
                                        <div className={`${isLeft ? 'md:col-start-1' : 'md:col-start-2'}`}>
                                            {renderCard(item, index)}
                                        </div>
                                    </div>
                                    </Reveal>
                                );
                            })}
                        </div>
                    </div>
                    {isEditMode && (
                        <button
                            type="button"
                            onClick={handleAddItem}
                            className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50"
                        >
                            <Plus className="w-4 h-4" />
                            Add Timeline Entry
                        </button>
                    )}
                </div>
            </section>
        );
    }

    // Default: cards variant — vertical line with bullets aligned to each card
    return (
        <section className="py-20" style={{ backgroundColor: bgColor }}>
            <div className="max-w-5xl mx-auto px-4">
                {renderHeader({ title: 'Work Experience', subtitle: 'My professional journey building products at companies of all sizes.', pretext: 'Career' })}
                <div className="relative pl-8 md:pl-14">
                    <div
                        className="absolute left-[14px] md:left-[26px] top-2 bottom-2 w-0.5"
                        style={{ backgroundColor: lineColor }}
                        aria-hidden="true"
                    />
                    <ol className="space-y-6">
                        {items.map((item, index) => (
                            <Reveal key={index} delay={index * staggerSec}>
                            <li className="relative">
                                <span
                                    className="absolute -left-6 top-6 h-3.5 w-3.5 rounded-full ring-4 ring-white md:-left-9"
                                    style={{ backgroundColor: pSecondary }}
                                    aria-hidden="true"
                                />
                                {renderCard(item, index)}
                            </li>
                            </Reveal>
                        ))}
                    </ol>
                </div>
                {isEditMode && (
                    <button
                        type="button"
                        onClick={handleAddItem}
                        className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50"
                    >
                        <Plus className="w-4 h-4" />
                        Add Timeline Entry
                    </button>
                )}
            </div>
        </section>
    );
}

function hasTimelineCardDesignOverride(data: Record<string, unknown>): boolean {
    if (data.cardSettings && typeof data.cardSettings === 'object' && !Array.isArray(data.cardSettings)) {
        return Object.keys(data.cardSettings).length > 0;
    }
    return typeof data.cardStyle === 'string' && data.cardStyle.trim() !== '';
}

function TagChip({
    tag,
    isEditMode,
    accentColor,
    onChange,
    onRemove,
}: {
    tag: string;
    isEditMode: boolean;
    accentColor: string;
    onChange: (value: string) => void;
    onRemove: () => void;
}) {
    const tinted = hexToRgba(accentColor, 0.12);
    if (!isEditMode) {
        return (
            <span
                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
                style={{ backgroundColor: tinted, color: accentColor }}
            >
                {tag}
            </span>
        );
    }
    return (
        <span
            className="group/chip inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{ backgroundColor: tinted, color: accentColor }}
        >
            <input
                type="text"
                value={tag}
                onChange={(event) => onChange(event.target.value)}
                className="bg-transparent border-none outline-none w-auto min-w-[2ch] max-w-[14ch] text-xs font-semibold focus:ring-0 focus:outline-none"
                style={{ color: accentColor, width: `${Math.max(2, tag.length)}ch` }}
                aria-label="Edit tag"
            />
            <button
                type="button"
                onClick={onRemove}
                className="rounded-full p-0.5 opacity-50 transition-opacity hover:bg-white/40 hover:opacity-100"
                aria-label="Remove tag"
                title="Remove tag"
            >
                <X className="h-3 w-3" />
            </button>
        </span>
    );
}

function hexToRgba(hex: string, alpha: number): string {
    const value = hex.trim().replace('#', '');
    if (value.length !== 3 && value.length !== 6) return `rgba(99, 102, 241, ${alpha})`;
    const expanded = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
    const r = parseInt(expanded.slice(0, 2), 16);
    const g = parseInt(expanded.slice(2, 4), 16);
    const b = parseInt(expanded.slice(4, 6), 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) return `rgba(99, 102, 241, ${alpha})`;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
