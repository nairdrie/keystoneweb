'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import EditableText from '../EditableText';
import BlockPretext from '../BlockPretext';
import Reveal, { useStaggerSec } from '@/app/components/Reveal';
import { Plus } from 'lucide-react';
import { resolvePaletteColor } from '@/lib/palette-colors';
import { useEditorContext } from '@/lib/editor-context';
import { resolveAnimation, speedToMs } from '@/lib/animations';
import InlineCardControls, { reorderItems } from './InlineCardControls';
import {
    SPACING_DENSITY_OPTIONS,
    getCardInlineStyle,
    getCardPaddingClass,
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
} from '@/lib/block-style-options';

interface StatsBlockProps {
    id: string;
    data: Record<string, unknown>;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: (key: string, value: unknown) => void;
}

type StatItem = {
    value: string;
    label: string;
};

export default function StatsBlock({ data, isEditMode, palette, updateContent }: StatsBlockProps) {
    const pPrimary = palette.primary || '#1f2937';
    const pSecondary = palette.secondary || '#dc2626';
    const configuredBackgroundColor = resolvePaletteColor(data.backgroundColor, palette, '');
    const fgOverride = resolvePaletteColor(data.foregroundColor, palette);
    const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);
    const editorContext = useEditorContext();
    const animationConfig = resolveAnimation(editorContext?.siteContent);
    const staggerSec = useStaggerSec();
    const durationSec = Math.max(0, speedToMs(animationConfig) / 1000);

    const items = normalizeStatItems(data.items) || [
        { value: '500+', label: 'Happy Clients' },
        { value: '15+', label: 'Years Experience' },
        { value: '24/7', label: 'Emergency Support' },
        { value: '100%', label: 'Satisfaction Rate' },
    ];

    const variant = data.variant || 'banner'; // 'banner' | 'cards' | 'progress'
    const separator: 'none' | 'line' | 'dot' =
        data.separator === 'line' || data.separator === 'dot' ? data.separator : 'none';
    const universalCardSettings = resolveUniversalCardSettings(data, {
        fallbackPreset: 'soft',
        fallbackTextAlign: 'center',
    });
    const cardStyle = resolveCardPresetId(data, 'soft');
    const surfaceStyle = getSurfaceStyle(data.surfaceStyle, cardStyle);
    const activeSurfaceStyle = universalCardSettings?.surface || surfaceStyle;
    const spacingDensity = readStyleOption(data.spacingDensity, SPACING_DENSITY_OPTIONS, 'standard');
    const cardTextColor = universalCardSettings ? getUniversalCardTextColor(universalCardSettings, palette) : getSurfaceTextColor(surfaceStyle, palette);
    const lockCardTextToSurface = shouldLockCardTextToSurface(activeSurfaceStyle);
    const statValueColor = lockCardTextToSurface
        ? cardTextColor
        : fgOverride || (activeSurfaceStyle === 'primary' || activeSurfaceStyle === 'secondary' ? cardTextColor : pSecondary);
    const statLabelColor = lockCardTextToSurface ? cardTextColor : fgOverride || cardTextColor;
    const textAlignClass = universalCardSettings ? getTextAlignClass(universalCardSettings.textAlign) : getTextAlignClass(data.textAlign || 'center');
    const cardClassName = universalCardSettings
        ? `${getUniversalCardClassName(universalCardSettings)} ${getUniversalCardPaddingClass(universalCardSettings)} ${textAlignClass} transition-[border-color,box-shadow,opacity,transform] relative group/card`
        : `${getCardStyleClass(cardStyle)} ${getCardPaddingClass(cardStyle, spacingDensity)} ${textAlignClass} transition-[border-color,box-shadow,opacity,transform] relative group/card`;
    const cardInlineStyle = universalCardSettings
        ? getUniversalCardInlineStyle(universalCardSettings, palette)
        : getCardInlineStyle(cardStyle, surfaceStyle, palette);
    const cardShadowBuffer = universalCardSettings
        ? getCardShadowPaintBuffer(universalCardSettings)
        : getCardPresetShadowPaintBuffer(cardStyle);
    const cardShadowSafeStyle = getCardShadowSafeContainerStyle(cardShadowBuffer);

    const handleAddItem = () => {
        updateContent('items', [
            ...items,
            { value: '100+', label: `New Stat ${getNextStatNumber(items)}` },
        ]);
    };

    const handleRemoveItem = (index: number) => {
        if (items.length <= 1) return;
        updateContent('items', items.filter((_, i) => i !== index));
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

    const renderStatControls = (index: number, title = 'stat') => isEditMode ? (
        <InlineCardControls
            canRemove={items.length > 1}
            dragData={`${title}-${index}`}
            dragTitle={`Drag to reorder ${title}`}
            removeTitle={`Delete ${title}`}
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

    if (variant === 'progress') {
        return (
            <section className="py-16 md:py-12 xl:py-16" style={{ backgroundColor: configuredBackgroundColor || '#ffffff' }}>
                <div className="max-w-3xl mx-auto px-4">
                    <div
                        className="rounded-2xl border border-gray-100 bg-white shadow-sm p-8 md:p-10"
                    >
                        <BlockPretext
                            data={data}
                            isEditMode={isEditMode}
                            palette={palette}
                            updateContent={updateContent}
                            defaultText="Skills"
                        />
                        {(data.title || isEditMode) && (
                            <EditableText
                                as="h2"
                                contentKey="title"
                                content={readString(data.title)}
                                defaultValue="Technical Skills"
                                isEditMode={isEditMode}
                                onSave={(key, value) => updateContent(key, value)}
                                className="text-xl font-bold mb-8"
                                style={{ color: pPrimary }}
                            />
                        )}
                        <div className="space-y-6">
                            {items.map((item, index) => {
                                const isDragging = draggedIndex === index;
                                const isDragTarget = dragOverIndex === index && draggedIndex !== index;
                                const percent = parsePercent(item.value);
                                const delay = index * staggerSec;
                                return (
                                    <Reveal key={index} delay={delay}>
                                        <div
                                            className={`relative group/card transition-[opacity,transform] ${
                                                isDragTarget ? 'ring-2 ring-blue-100 rounded-md' : ''
                                            } ${isDragging ? 'scale-[0.99] opacity-60' : ''}`}
                                            {...getDragHandlers(index)}
                                        >
                                            {renderStatControls(index, 'skill')}
                                            <div className="flex items-center justify-between mb-2 gap-3">
                                                <EditableText
                                                    as="span"
                                                    contentKey={`stat_${index}_label`}
                                                    content={item.label}
                                                    defaultValue="Skill"
                                                    isEditMode={isEditMode}
                                                    onSave={(_key, value) => handleUpdateItem(index, 'label', value)}
                                                    className="text-base font-semibold"
                                                    style={{ color: pPrimary }}
                                                />
                                                <EditableText
                                                    as="span"
                                                    contentKey={`stat_${index}_value`}
                                                    content={item.value}
                                                    defaultValue="90%"
                                                    isEditMode={isEditMode}
                                                    onSave={(_key, value) => handleUpdateItem(index, 'value', value)}
                                                    className="text-sm font-medium tabular-nums"
                                                    style={{ color: pPrimary, opacity: 0.6 }}
                                                />
                                            </div>
                                            <ProgressBarFill
                                                percent={percent}
                                                color={pSecondary}
                                                ariaLabel={typeof item.label === 'string' ? item.label : undefined}
                                                isEditMode={isEditMode}
                                                delaySec={delay}
                                                durationSec={Math.max(durationSec, 0.6)}
                                            />
                                        </div>
                                    </Reveal>
                                );
                            })}
                        </div>
                        {isEditMode && (
                            <div className="flex justify-center mt-8">
                                <button
                                    onClick={handleAddItem}
                                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-dashed border-blue-300"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add Skill
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </section>
        );
    }

    if (variant === 'cards') {
        return (
            <section className="py-20 md:py-12 xl:py-20" style={{ backgroundColor: configuredBackgroundColor || '#ffffff' }}>
                <div className="max-w-7xl mx-auto px-4">
                    <BlockPretext
                        data={data}
                        isEditMode={isEditMode}
                        palette={palette}
                        updateContent={updateContent}
                        defaultText="By the Numbers"
                    />
                    {(data.title || isEditMode) && (
                        <EditableText
                            as="h2"
                            contentKey="title"
                            content={readString(data.title)}
                            defaultValue="Our Track Record"
                            isEditMode={isEditMode}
                            onSave={(key, value) => updateContent(key, value)}
                            className="text-4xl font-bold text-center mb-16 md:mb-10 xl:mb-16"
                            style={{ color: fgOverride || pPrimary }}
                        />
                    )}
                    <div style={cardShadowSafeStyle}>
                        <div className={`ks-layout-grid grid gap-6 ${items.length <= 3 ? 'md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4'}`}>
                            {items.map((item, index) => {
                                const isDragging = draggedIndex === index;
                                const isDragTarget = dragOverIndex === index && draggedIndex !== index;
                                return (
                                <Reveal key={index} delay={index * staggerSec} className={`${cardClassName} ${
                                        isDragTarget ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-100'
                                    } ${isDragging ? 'scale-[0.99] opacity-60' : ''}`} style={cardInlineStyle}>
                                <div
                                    {...getDragHandlers(index)}
                                >
                                    {renderStatControls(index)}
                                    <EditableText
                                        as="div"
                                        contentKey={`stat_${index}_value`}
                                        content={item.value}
                                        defaultValue="100+"
                                        isEditMode={isEditMode}
                                        onSave={(_key, value) => handleUpdateItem(index, 'value', value)}
                                        className="text-4xl xl:text-5xl font-black mb-2"
                                        style={{ color: statValueColor }}
                                    />
                                    <EditableText
                                        as="p"
                                        contentKey={`stat_${index}_label`}
                                        content={item.label}
                                        defaultValue="Metric"
                                        isEditMode={isEditMode}
                                        onSave={(_key, value) => handleUpdateItem(index, 'label', value)}
                                        className="font-medium text-sm uppercase tracking-wider"
                                        style={{ color: statLabelColor, opacity: 0.7 }}
                                    />
                                </div>
                                </Reveal>
                                );
                            })}
                        </div>
                    </div>
                    {isEditMode && (
                        <div className="flex justify-center mt-6">
                            <button
                                onClick={handleAddItem}
                                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-dashed border-blue-300"
                            >
                                <Plus className="w-4 h-4" />
                                Add Stat
                            </button>
                        </div>
                    )}
                </div>
            </section>
        );
    }

    // Banner variant (default) — full-width colored band
    const bannerMdCols = items.length <= 3 ? 3 : 4;
    const separatorColor = fgOverride || '#ffffff';
    return (
        <section className="py-16 md:py-10 xl:py-16" style={{ backgroundColor: configuredBackgroundColor || pPrimary }}>
            <div className="max-w-7xl mx-auto px-4">
                <div className={`grid gap-8 ${items.length <= 3 ? 'md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4'}`}>
                    {items.map((item, index) => {
                        const isDragging = draggedIndex === index;
                        const isDragTarget = dragOverIndex === index && draggedIndex !== index;
                        const inMdColumn = index > 0 && index % bannerMdCols !== 0;
                        const inMobileRightColumn = items.length > 3 && index > 0 && index % 2 !== 0;
                        const showSeparator = separator !== 'none' && inMdColumn;
                        const separatorVisibilityClass = inMobileRightColumn ? '' : 'hidden md:block';
                        return (
                        <Reveal key={index} delay={index * staggerSec} className={`relative group/card text-center rounded-lg px-2 py-3 transition-[box-shadow,opacity,transform] ${
                                isDragTarget ? 'ring-2 ring-blue-100' : ''
                            } ${isDragging ? 'scale-[0.99] opacity-60' : ''}`}>
                        <div
                            {...getDragHandlers(index)}
                        >
                            {showSeparator && separator === 'line' && (
                                <div
                                    aria-hidden
                                    className={`pointer-events-none absolute ${separatorVisibilityClass}`}
                                    style={{
                                        left: -16,
                                        top: '20%',
                                        bottom: '20%',
                                        width: 1,
                                        backgroundColor: separatorColor,
                                        opacity: fgOverride ? 0.35 : 0.3,
                                    }}
                                />
                            )}
                            {showSeparator && separator === 'dot' && (
                                <div
                                    aria-hidden
                                    className={`pointer-events-none absolute ${separatorVisibilityClass}`}
                                    style={{
                                        left: -18,
                                        top: '50%',
                                        width: 5,
                                        height: 5,
                                        marginTop: -2.5,
                                        borderRadius: 9999,
                                        backgroundColor: separatorColor,
                                        opacity: 0.55,
                                    }}
                                />
                            )}
                            {renderStatControls(index)}
                            <EditableText
                                as="div"
                                contentKey={`stat_${index}_value`}
                                content={item.value}
                                defaultValue="100+"
                                isEditMode={isEditMode}
                                onSave={(_key, value) => handleUpdateItem(index, 'value', value)}
                                className="text-4xl xl:text-5xl font-black mb-1"
                                style={{ color: fgOverride || '#ffffff' }}
                            />
                            <EditableText
                                as="p"
                                contentKey={`stat_${index}_label`}
                                content={item.label}
                                defaultValue="Metric"
                                isEditMode={isEditMode}
                                onSave={(_key, value) => handleUpdateItem(index, 'label', value)}
                                className="font-medium text-sm uppercase tracking-wider"
                                style={{ color: fgOverride || '#ffffff', opacity: fgOverride ? 1 : 0.7 }}
                            />
                        </div>
                        </Reveal>
                        );
                    })}
                </div>
                {isEditMode && (
                    <div className="flex justify-center mt-6">
                        <button
                            onClick={handleAddItem}
                            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 bg-white/95 hover:bg-blue-50 rounded-lg transition-colors border border-dashed border-blue-300"
                        >
                            <Plus className="w-4 h-4" />
                            Add Stat
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}

function normalizeStatItems(value: unknown): StatItem[] | null {
    if (!Array.isArray(value)) return null;
    const items = value
        .map((item) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
            const record = item as Record<string, unknown>;
            return {
                value: typeof record.value === 'string' ? record.value : '100+',
                label: typeof record.label === 'string' ? record.label : 'Metric',
            };
        })
        .filter((item): item is StatItem => Boolean(item));
    return items.length ? items : null;
}

function readString(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
}

interface ProgressBarFillProps {
    percent: number;
    color: string;
    ariaLabel?: string;
    isEditMode: boolean;
    delaySec: number;
    durationSec: number;
}

function ProgressBarFill({ percent, color, ariaLabel, isEditMode, delaySec, durationSec }: ProgressBarFillProps) {
    const prefersReducedMotion = useReducedMotion();
    const animate = !isEditMode && !prefersReducedMotion;
    return (
        <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ backgroundColor: '#f1f5f9' }}
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={ariaLabel}
        >
            <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: color }}
                initial={animate ? { width: '0%' } : false}
                whileInView={animate ? { width: `${percent}%` } : undefined}
                animate={animate ? undefined : { width: `${percent}%` }}
                viewport={animate ? { once: true, margin: '-50px' } : undefined}
                transition={{ duration: durationSec, ease: [0.22, 1, 0.36, 1], delay: delaySec }}
            />
        </div>
    );
}

function parsePercent(value: unknown): number {
    const match = String(value ?? '').match(/-?\d+(?:\.\d+)?/);
    if (!match) return 0;
    const parsed = parseFloat(match[0]);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(100, parsed));
}

function getNextStatNumber(items: Array<{ label?: string }>): number {
    const existingNumbers = items
        .map((item) => item.label?.match(/^New Stat (\d+)$/)?.[1])
        .filter((value): value is string => Boolean(value))
        .map((value) => Number(value))
        .filter(Number.isFinite);

    return existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : items.length + 1;
}
