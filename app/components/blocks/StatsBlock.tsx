'use client';

import React from 'react';
import EditableText from '../EditableText';

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

    const items = data.items || [
        { value: '500+', label: 'Happy Clients' },
        { value: '15+', label: 'Years Experience' },
        { value: '24/7', label: 'Emergency Support' },
        { value: '100%', label: 'Satisfaction Rate' },
    ];

    const variant = data.variant || 'banner'; // 'banner' | 'cards'

    const handleUpdateItem = (index: number, field: string, value: string) => {
        const newItems = items.map((item: any, i: number) =>
            i === index ? { ...item, [field]: value } : item
        );
        updateContent('items', newItems);
    };

    if (variant === 'cards') {
        return (
            <section className="py-20" style={{ backgroundColor: data.backgroundColor || '#ffffff' }}>
                <div className="max-w-7xl mx-auto px-4">
                    {data.title && (
                        <EditableText
                            as="h2"
                            contentKey="title"
                            content={data.title}
                            defaultValue="Our Track Record"
                            isEditMode={isEditMode}
                            onSave={(key, value) => updateContent(key, value)}
                            className="text-4xl font-bold text-center mb-16"
                            style={{ color: pPrimary }}
                        />
                    )}
                    <div className={`grid gap-6 ${items.length <= 3 ? 'md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4'}`}>
                        {items.map((item: any, index: number) => (
                            <div key={index} className="text-center p-8 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow">
                                <EditableText
                                    as="div"
                                    contentKey={`stat_${index}_value`}
                                    content={item.value}
                                    defaultValue="100+"
                                    isEditMode={isEditMode}
                                    onSave={(_key, value) => handleUpdateItem(index, 'value', value)}
                                    className="text-4xl md:text-5xl font-black mb-2"
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
                </div>
            </section>
        );
    }

    // Banner variant (default) — full-width colored band
    return (
        <section className="py-16" style={{ backgroundColor: data.backgroundColor || pPrimary }}>
            <div className="max-w-7xl mx-auto px-4">
                <div className={`grid gap-8 ${items.length <= 3 ? 'md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4'}`}>
                    {items.map((item: any, index: number) => (
                        <div key={index} className="text-center">
                            <EditableText
                                as="div"
                                contentKey={`stat_${index}_value`}
                                content={item.value}
                                defaultValue="100+"
                                isEditMode={isEditMode}
                                onSave={(_key, value) => handleUpdateItem(index, 'value', value)}
                                className="text-4xl md:text-5xl font-black mb-1 text-white"
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
            </div>
        </section>
    );
}
