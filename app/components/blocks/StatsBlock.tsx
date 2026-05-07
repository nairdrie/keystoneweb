'use client';

import React from 'react';
import EditableText from '../EditableText';
import { Plus, X } from 'lucide-react';
import { resolvePaletteColor } from '@/lib/palette-colors';

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
            { value: `${items.length + 1}00+`, label: `Metric ${items.length + 1}` },
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

    if (variant === 'cards') {
        return (
            <section className="py-20 md:py-12 xl:py-20" style={{ backgroundColor: configuredBackgroundColor || '#ffffff' }}>
                <div className="max-w-7xl mx-auto px-4">
                    {data.title && (
                        <EditableText
                            as="h2"
                            contentKey="title"
                            content={data.title}
                            defaultValue="Our Track Record"
                            isEditMode={isEditMode}
                            onSave={(key, value) => updateContent(key, value)}
                            className="text-4xl font-bold text-center mb-16 md:mb-10 xl:mb-16"
                            style={{ color: pPrimary }}
                        />
                    )}
                    <div className={`grid gap-6 ${items.length <= 3 ? 'md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4'}`}>
                        {items.map((item: any, index: number) => (
                            <div key={index} className="relative group text-center p-8 md:p-6 xl:p-8 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow">
                                {isEditMode && items.length > 1 && (
                                    <button
                                        onClick={() => handleRemoveItem(index)}
                                        className="absolute top-2 right-2 p-1 bg-red-100 hover:bg-red-200 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Remove stat"
                                    >
                                        <X className="w-3.5 h-3.5 text-red-600" />
                                    </button>
                                )}
                                <EditableText
                                    as="div"
                                    contentKey={`stat_${index}_value`}
                                    content={item.value}
                                    defaultValue="100+"
                                    isEditMode={isEditMode}
                                    onSave={(_key, value) => handleUpdateItem(index, 'value', value)}
                                    className="text-4xl xl:text-5xl font-black mb-2"
                                    style={{ color: pSecondary }}
                                />
                                <EditableText
                                    as="p"
                                    contentKey={`stat_${index}_label`}
                                    content={item.label}
                                    defaultValue="Metric"
                                    isEditMode={isEditMode}
                                    onSave={(_key, value) => handleUpdateItem(index, 'label', value)}
                                    className="font-medium text-sm uppercase tracking-wider"
                                    style={{ color: pPrimary, opacity: 0.7 }}
                                />
                            </div>
                        ))}
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
                    {items.map((item: any, index: number) => (
                        <div key={index} className="relative group text-center rounded-lg px-2 py-3">
                            {isEditMode && items.length > 1 && (
                                <button
                                    onClick={() => handleRemoveItem(index)}
                                    className="absolute top-0 right-0 p-1 bg-red-100 hover:bg-red-200 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Remove stat"
                                >
                                    <X className="w-3.5 h-3.5 text-red-600" />
                                </button>
                            )}
                            <EditableText
                                as="div"
                                contentKey={`stat_${index}_value`}
                                content={item.value}
                                defaultValue="100+"
                                isEditMode={isEditMode}
                                onSave={(_key, value) => handleUpdateItem(index, 'value', value)}
                                className="text-4xl xl:text-5xl font-black mb-1 text-white"
                            />
                            <EditableText
                                as="p"
                                contentKey={`stat_${index}_label`}
                                content={item.label}
                                defaultValue="Metric"
                                isEditMode={isEditMode}
                                onSave={(_key, value) => handleUpdateItem(index, 'label', value)}
                                className="text-white/70 font-medium text-sm uppercase tracking-wider"
                            />
                        </div>
                    ))}
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
