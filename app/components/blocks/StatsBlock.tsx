'use client';

import React from 'react';
import EditableText from '../EditableText';
import { Plus } from 'lucide-react';
import { resolvePaletteColor } from '@/lib/palette-colors';
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

    const items = data.items || [
        { value: '500+', label: 'Happy Clients' },
        { value: '15+', label: 'Years Experience' },
        { value: '24/7', label: 'Emergency Support' },
        { value: '100%', label: 'Satisfaction Rate' },
    ];

    const variant = data.variant || 'banner'; // 'banner' | 'cards'

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

    if (variant === 'cards') {
        return (
            <section className="py-20 md:py-12 xl:py-20" style={{ backgroundColor: configuredBackgroundColor || '#ffffff' }}>
                <div className="max-w-7xl mx-auto px-4">
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
                            <div
                                key={index}
                                className={`relative group/card text-center p-8 md:p-6 xl:p-8 rounded-2xl border bg-white shadow-sm hover:shadow-md transition-[border-color,box-shadow,opacity,transform] ${
                                    isDragTarget ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-100'
                                } ${isDragging ? 'scale-[0.99] opacity-60' : ''}`}
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
    return (
        <section className="py-16 md:py-10 xl:py-16" style={{ backgroundColor: configuredBackgroundColor || pPrimary }}>
            <div className="max-w-7xl mx-auto px-4">
                <div className={`grid gap-8 ${items.length <= 3 ? 'md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4'}`}>
                    {items.map((item: any, index: number) => {
                        const isDragging = draggedIndex === index;
                        const isDragTarget = dragOverIndex === index && draggedIndex !== index;
                        return (
                        <div
                            key={index}
                            className={`relative group/card text-center rounded-lg px-2 py-3 transition-[box-shadow,opacity,transform] ${
                                isDragTarget ? 'ring-2 ring-blue-100' : ''
                            } ${isDragging ? 'scale-[0.99] opacity-60' : ''}`}
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

function getNextStatNumber(items: Array<{ label?: string }>): number {
    const existingNumbers = items
        .map((item) => item.label?.match(/^New Stat (\d+)$/)?.[1])
        .filter((value): value is string => Boolean(value))
        .map((value) => Number(value))
        .filter(Number.isFinite);

    return existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : items.length + 1;
}
