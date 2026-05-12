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

interface StatsBlockProps {
    id: string;
    data: any;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: (key: string, value: any) => void;
}

export default function StatsBlock({ id, data, isEditMode, palette, updateContent }: StatsBlockProps) {
    const pPrimary = palette.primary || '#1f2937';
    const pSecondary = palette.secondary || '#dc2626';
    const pAccent = palette.accent || '#f3f4f6';
    const configuredBackgroundColor = resolvePaletteColor(data.backgroundColor, palette, '');
    const fgOverride = resolvePaletteColor(data.foregroundColor, palette);
    const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);
    const editorContext = useEditorContext();
    const animationConfig = resolveAnimation(editorContext?.siteContent);
    const staggerSec = useStaggerSec();
    const durationSec = Math.max(0, speedToMs(animationConfig) / 1000);

    const items = data.items || [
        { value: '500+', label: 'Happy Clients' },
        { value: '15+', label: 'Years Experience' },
        { value: '24/7', label: 'Emergency Support' },
        { value: '100%', label: 'Satisfaction Rate' },
    ];

    const variant = data.variant || 'banner'; // 'banner' | 'cards' | 'progress'
    const separator: 'none' | 'line' | 'dot' =
        data.separator === 'line' || data.separator === 'dot' ? data.separator : 'none';

    const handleAddItem = () => {
        updateContent('items', [
            ...items,
            { value: '100+', label: `New Stat ${getNextStatNumber(items)}` },
        ]);
    };

    const handleRemoveItem = (index: number) => {
        if (items.length <= 1) return;
        updateContent('items', items.filter((_: any, i: number) => i !== index));
    };

    const handleUpdateItem = (index: number, field: string, value: string) => {
        const newItems = items.map((item: any, i: number) =>
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
                                content={data.title}
                                defaultValue="Technical Skills"
                                isEditMode={isEditMode}
                                onSave={(key, value) => updateContent(key, value)}
                                className="text-xl font-bold mb-8"
                                style={{ color: pPrimary }}
                            />
                        )}
                        <div className="space-y-6">
                            {items.map((item: any, index: number) => {
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
                            content={data.title}
                            defaultValue="Our Track Record"
                            isEditMode={isEditMode}
                            onSave={(key, value) => updateContent(key, value)}
                            className="text-4xl font-bold text-center mb-16 md:mb-10 xl:mb-16"
                            style={{ color: fgOverride || pPrimary }}
                        />
                    )}
                    <div className={`grid gap-6 ${items.length <= 3 ? 'md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4'}`}>
                        {items.map((item: any, index: number) => {
                            const isDragging = draggedIndex === index;
                            const isDragTarget = dragOverIndex === index && draggedIndex !== index;
                            return (
                            <Reveal key={index} delay={index * staggerSec} className={`relative group/card text-center p-8 md:p-6 xl:p-8 rounded-2xl border bg-white shadow-sm hover:shadow-md transition-[border-color,box-shadow,opacity,transform] ${
                                    isDragTarget ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-100'
                                } ${isDragging ? 'scale-[0.99] opacity-60' : ''}`}>
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
                                    style={{ color: fgOverride || pSecondary }}
                                />
                                <EditableText
                                    as="p"
                                    contentKey={`stat_${index}_label`}
                                    content={item.label}
                                    defaultValue="Metric"
                                    isEditMode={isEditMode}
                                    onSave={(_key, value) => handleUpdateItem(index, 'label', value)}
                                    className="font-medium text-sm uppercase tracking-wider"
                                    style={{ color: fgOverride || pPrimary, opacity: 0.7 }}
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
                    {items.map((item: any, index: number) => {
                        const isDragging = draggedIndex === index;
                        const isDragTarget = dragOverIndex === index && draggedIndex !== index;
                        const showSeparator = separator !== 'none' && index > 0 && index % bannerMdCols !== 0;
                        return (
                        <Reveal key={index} delay={index * staggerSec} className={`relative group/card text-center rounded-lg px-2 py-3 transition-[box-shadow,opacity,transform] ${
                                isDragTarget ? 'ring-2 ring-blue-100' : ''
                            } ${isDragging ? 'scale-[0.99] opacity-60' : ''}`}>
                        <div
                            {...getDragHandlers(index)}
                        >
                            {showSeparator && (
                                <span
                                    aria-hidden
                                    className="pointer-events-none absolute inset-y-0 hidden md:flex items-center justify-center"
                                    style={{ left: -16, width: 0 }}
                                >
                                    {separator === 'line' ? (
                                        <span
                                            style={{
                                                width: 1,
                                                height: '60%',
                                                backgroundColor: separatorColor,
                                                opacity: fgOverride ? 0.35 : 0.25,
                                            }}
                                        />
                                    ) : (
                                        <span
                                            style={{
                                                width: 5,
                                                height: 5,
                                                borderRadius: 9999,
                                                backgroundColor: separatorColor,
                                                opacity: fgOverride ? 0.6 : 0.5,
                                            }}
                                        />
                                    )}
                                </span>
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
