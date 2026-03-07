'use client';

import React from 'react';
import EditableText from '../EditableText';
import { Star } from 'lucide-react';

interface TestimonialsBlockProps {
    id: string;
    data: any;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: (key: string, value: any) => void;
}

export default function TestimonialsBlock({ id, data, isEditMode, palette, updateContent }: TestimonialsBlockProps) {
    const pPrimary = palette.primary || '#1f2937';
    const pSecondary = palette.secondary || '#dc2626';
    const pAccent = palette.accent || '#f3f4f6';

    const variant = data.variant || 'cards'; // 'cards' | 'single'
    const items = data.items || [
        { name: 'Sarah M.', role: 'Homeowner', quote: 'Absolutely outstanding service! They arrived on time, explained everything clearly, and the quality of work exceeded our expectations.', rating: 5 },
        { name: 'James R.', role: 'Business Owner', quote: 'Professional, reliable, and reasonably priced. I\'ve been a loyal customer for years and always recommend them to everyone.', rating: 5 },
        { name: 'Lisa K.', role: 'Property Manager', quote: 'They handle all our properties and never disappoint. Quick response time and excellent craftsmanship on every job.', rating: 5 },
    ];

    const renderStars = (rating: number) => (
        <div className="flex gap-0.5 mb-3">
            {Array.from({ length: 5 }).map((_, i) => (
                <Star
                    key={i}
                    className="w-4 h-4"
                    fill={i < rating ? '#facc15' : 'none'}
                    stroke={i < rating ? '#facc15' : '#d1d5db'}
                />
            ))}
        </div>
    );

    if (variant === 'single') {
        const item = items[0] || items[0];
        return (
            <section className="py-24" style={{ backgroundColor: data.backgroundColor || pAccent }}>
                <div className="max-w-3xl mx-auto px-4 text-center">
                    <EditableText
                        as="h2"
                        contentKey={`${id}.title`}
                        content={data.title}
                        defaultValue="What Our Clients Say"
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="text-4xl font-bold mb-12"
                        style={{ color: pPrimary }}
                    />
                    <div className="relative">
                        <div className="text-6xl leading-none mb-4" style={{ color: pSecondary }}>"</div>
                        <EditableText
                            as="p"
                            contentKey={`${id}.items.0.quote`}
                            content={item.quote}
                            defaultValue="Outstanding service from start to finish."
                            isEditMode={isEditMode}
                            onSave={(key, value) => updateContent(key, value)}
                            className="text-xl md:text-2xl italic text-gray-600 mb-8 leading-relaxed"
                        />
                        {renderStars(item.rating || 5)}
                        <EditableText
                            as="p"
                            contentKey={`${id}.items.0.name`}
                            content={item.name}
                            defaultValue="Happy Customer"
                            isEditMode={isEditMode}
                            onSave={(key, value) => updateContent(key, value)}
                            className="font-bold text-lg"
                            style={{ color: pPrimary }}
                        />
                        <EditableText
                            as="p"
                            contentKey={`${id}.items.0.role`}
                            content={item.role}
                            defaultValue="Homeowner"
                            isEditMode={isEditMode}
                            onSave={(key, value) => updateContent(key, value)}
                            className="text-sm text-gray-500"
                        />
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="py-24" style={{ backgroundColor: data.backgroundColor || '#ffffff' }}>
            <div className="max-w-7xl mx-auto px-4">
                <EditableText
                    as="h2"
                    contentKey={`${id}.title`}
                    content={data.title}
                    defaultValue="What Our Clients Say"
                    isEditMode={isEditMode}
                    onSave={(key, value) => updateContent(key, value)}
                    className="text-4xl font-bold text-center mb-4"
                    style={{ color: pPrimary }}
                />
                <EditableText
                    as="p"
                    contentKey={`${id}.subtitle`}
                    content={data.subtitle}
                    defaultValue="Don't just take our word for it — hear from our satisfied customers."
                    isEditMode={isEditMode}
                    onSave={(key, value) => updateContent(key, value)}
                    className="text-lg text-gray-500 text-center mb-16 max-w-2xl mx-auto"
                />

                <div className={`grid gap-8 ${items.length <= 2 ? 'md:grid-cols-2 max-w-4xl mx-auto' : 'md:grid-cols-3'}`}>
                    {items.map((item: any, index: number) => (
                        <div
                            key={index}
                            className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-lg transition-shadow relative"
                        >
                            <div className="text-4xl leading-none mb-3 opacity-20" style={{ color: pSecondary }}>"</div>
                            {renderStars(item.rating || 5)}
                            <EditableText
                                as="p"
                                contentKey={`${id}.items.${index}.quote`}
                                content={item.quote}
                                defaultValue="Great service and outstanding results!"
                                isEditMode={isEditMode}
                                onSave={(key, value) => updateContent(key, value)}
                                className="text-gray-600 leading-relaxed mb-6"
                            />
                            <div className="border-t border-gray-100 pt-4">
                                <EditableText
                                    as="p"
                                    contentKey={`${id}.items.${index}.name`}
                                    content={item.name}
                                    defaultValue={`Client ${index + 1}`}
                                    isEditMode={isEditMode}
                                    onSave={(key, value) => updateContent(key, value)}
                                    className="font-bold"
                                    style={{ color: pPrimary }}
                                />
                                <EditableText
                                    as="p"
                                    contentKey={`${id}.items.${index}.role`}
                                    content={item.role}
                                    defaultValue="Satisfied Customer"
                                    isEditMode={isEditMode}
                                    onSave={(key, value) => updateContent(key, value)}
                                    className="text-sm text-gray-500"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
