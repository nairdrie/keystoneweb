'use client';

import React, { useState } from 'react';
import EditableText from '../EditableText';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';

interface FAQBlockProps {
    id: string;
    data: any;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: (key: string, value: any) => void;
}

export default function FAQBlock({ id, data, isEditMode, palette, updateContent }: FAQBlockProps) {
    const pPrimary = palette.primary || '#1f2937';
    const pSecondary = palette.secondary || '#dc2626';
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    const items = data.items || [
        { question: 'How quickly can you respond to an emergency?', answer: 'We offer 24/7 emergency services and can typically be at your location within 60 minutes of your call.' },
        { question: 'Do you provide free estimates?', answer: 'Yes! We provide free, no-obligation estimates for all our services. Contact us to schedule yours.' },
        { question: 'Are you licensed and insured?', answer: 'Absolutely. We are fully licensed, bonded, and insured for your complete peace of mind.' },
        { question: 'What areas do you serve?', answer: 'We serve the greater metro area and surrounding communities within a 30-mile radius.' },
    ];

    const handleUpdateItem = (index: number, field: string, value: string) => {
        const newItems = items.map((item: any, i: number) =>
            i === index ? { ...item, [field]: value } : item
        );
        updateContent('items', newItems);
    };

    const handleAddItem = () => {
        const newItems = [...items, { question: 'New Question', answer: 'Answer goes here.' }];
        updateContent('items', newItems);
        setOpenIndex(newItems.length - 1);
    };

    const handleRemoveItem = (index: number) => {
        const newItems = items.filter((_: any, i: number) => i !== index);
        updateContent('items', newItems);
        setOpenIndex(null);
    };

    return (
        <section className="py-24" style={{ backgroundColor: data.backgroundColor || '#ffffff' }}>
            <div className="max-w-3xl mx-auto px-4">
                <EditableText
                    as="h2"
                    contentKey="title"
                    content={data.title}
                    defaultValue="Frequently Asked Questions"
                    isEditMode={isEditMode}
                    onSave={(key, value) => updateContent(key, value)}
                    className="text-4xl font-bold text-center mb-4"
                    style={{ color: pPrimary }}
                />
                <EditableText
                    as="p"
                    contentKey="subtitle"
                    content={data.subtitle}
                    defaultValue="Everything you need to know about our services."
                    isEditMode={isEditMode}
                    onSave={(key, value) => updateContent(key, value)}
                    className="text-lg text-center mb-12"
                    style={{ color: pPrimary, opacity: 0.6 }}
                />

                <div className="space-y-3">
                    {items.map((item: any, index: number) => {
                        const isOpen = openIndex === index;
                        return (
                            <div
                                key={index}
                                className="border border-gray-200 rounded-xl overflow-hidden bg-white"
                            >
                                <div className="flex items-stretch">
                                    <button
                                        onClick={() => setOpenIndex(isOpen ? null : index)}
                                        className="flex-1 flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
                                    >
                                        <EditableText
                                            as="span"
                                            contentKey={`faq_${index}_question`}
                                            content={item.question}
                                            defaultValue={`Question ${index + 1}`}
                                            isEditMode={isEditMode}
                                            onSave={(_key, value) => handleUpdateItem(index, 'question', value)}
                                            className="font-semibold text-left pr-4 flex-1"
                                            style={{ color: pPrimary }}
                                        />
                                        <ChevronDown
                                            className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                                        />
                                    </button>
                                    {isEditMode && (
                                        <button
                                            onClick={() => handleRemoveItem(index)}
                                            className="px-3 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors border-l border-gray-200"
                                            title="Remove FAQ"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                <div
                                    className={`overflow-hidden transition-all duration-200 ${isOpen ? 'max-h-96' : 'max-h-0'}`}
                                >
                                    <div className="px-5 pb-5 pt-0">
                                        <EditableText
                                            as="p"
                                            contentKey={`faq_${index}_answer`}
                                            content={item.answer}
                                            defaultValue="Answer goes here."
                                            isEditMode={isEditMode}
                                            onSave={(_key, value) => handleUpdateItem(index, 'answer', value)}
                                            className="leading-relaxed"
                                            style={{ color: pPrimary, opacity: 0.7 }}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                {isEditMode && (
                    <button
                        onClick={handleAddItem}
                        className="mt-3 flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 border border-dashed border-slate-300 rounded-xl hover:border-slate-400 hover:text-slate-800 hover:bg-slate-50 transition-colors w-full justify-center"
                    >
                        <Plus className="w-4 h-4" />
                        Add FAQ
                    </button>
                )}
            </div>
        </section>
    );
}
