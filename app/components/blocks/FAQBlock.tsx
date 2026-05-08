'use client';

import React, { useState } from 'react';
import EditableText from '../EditableText';
import { ChevronDown, Plus } from 'lucide-react';
import { resolvePaletteColor } from '@/lib/palette-colors';
import InlineCardControls from './InlineCardControls';

interface FAQItem {
    question: string;
    answer: string;
}

interface FAQBlockData {
    title?: string;
    subtitle?: string;
    backgroundColor?: string;
    items?: FAQItem[];
}

interface FAQBlockProps {
    id: string;
    data: FAQBlockData;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: (key: string, value: unknown) => void;
}

const DEFAULT_FAQ_ITEMS: FAQItem[] = [
    { question: 'How quickly can you respond to an emergency?', answer: 'We offer 24/7 emergency services and can typically be at your location within 60 minutes of your call.' },
    { question: 'Do you provide free estimates?', answer: 'Yes! We provide free, no-obligation estimates for all our services. Contact us to schedule yours.' },
    { question: 'Are you licensed and insured?', answer: 'Absolutely. We are fully licensed, bonded, and insured for your complete peace of mind.' },
    { question: 'What areas do you serve?', answer: 'We serve the greater metro area and surrounding communities within a 30-mile radius.' },
];

export default function FAQBlock({ data, isEditMode, palette, updateContent }: FAQBlockProps) {
    const pPrimary = palette.primary || '#1f2937';
    const bgColor = resolvePaletteColor(data.backgroundColor, palette, '#ffffff');
    const [openIndex, setOpenIndex] = useState<number | null>(0);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    const items = Array.isArray(data.items) ? data.items : DEFAULT_FAQ_ITEMS;

    const handleUpdateItem = (index: number, field: keyof FAQItem, value: string) => {
        const newItems = items.map((item, i) =>
            i === index ? { ...item, [field]: value } : item
        );
        updateContent('items', newItems);
    };

    const handleAddItem = () => {
        const nextQuestionNumber = getNextQuestionNumber(items);
        const newItems = [...items, { question: `New Question ${nextQuestionNumber}`, answer: 'Answer goes here.' }];
        updateContent('items', newItems);
        setOpenIndex(newItems.length - 1);
    };

    const handleRemoveItem = (index: number) => {
        const newItems = items.filter((_, i) => i !== index);
        updateContent('items', newItems);
        setOpenIndex(null);
    };

    const handleReorderItem = (fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
        if (fromIndex >= items.length || toIndex >= items.length) return;

        const newItems = [...items];
        const [movedItem] = newItems.splice(fromIndex, 1);
        newItems.splice(toIndex, 0, movedItem);
        updateContent('items', newItems);
        setOpenIndex((current) => remapIndexAfterMove(current, fromIndex, toIndex));
    };

    return (
        <section className="py-24" style={{ backgroundColor: bgColor }}>
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
                    {items.map((item, index) => {
                        const isOpen = openIndex === index;
                        const isDragging = draggedIndex === index;
                        const isDragTarget = dragOverIndex === index && draggedIndex !== index;
                        return (
                            <div
                                key={index}
                                className={`faq-item group/card relative border rounded-xl bg-white transition-[border-color,box-shadow,opacity,transform] ${
                                    isDragTarget ? 'border-blue-300 shadow-md ring-2 ring-blue-100' : 'border-gray-200'
                                } ${isDragging ? 'scale-[0.99] opacity-60' : ''} ${isEditMode ? 'overflow-visible' : 'overflow-hidden'}`}
                                onDragOver={(event) => {
                                    if (!isEditMode) return;
                                    event.preventDefault();
                                    setDragOverIndex(index);
                                }}
                                onDrop={(event) => {
                                    if (!isEditMode) return;
                                    event.preventDefault();
                                    if (draggedIndex !== null) handleReorderItem(draggedIndex, index);
                                    setDraggedIndex(null);
                                    setDragOverIndex(null);
                                }}
                            >
                                {isEditMode && (
                                    <InlineCardControls
                                        canRemove={items.length > 1}
                                        dragData={`faq-${index}`}
                                        dragTitle="Drag to reorder FAQ"
                                        removeTitle="Delete FAQ"
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
                                <div className="relative z-10 flex items-stretch overflow-visible">
                                    <button
                                        onClick={() => setOpenIndex(isOpen ? null : index)}
                                        className={`flex-1 flex items-center justify-between overflow-visible p-5 text-left hover:bg-gray-50 transition-colors ${isEditMode ? 'pr-20' : ''}`}
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
                                </div>
                                <div
                                    className={`transition-all duration-200 ${isOpen ? `max-h-96 ${isEditMode ? 'overflow-visible' : 'overflow-hidden'}` : 'max-h-0 overflow-hidden'}`}
                                >
                                    <div className="relative z-20 px-5 pb-5 pt-0">
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

function getNextQuestionNumber(items: Array<{ question?: string }>): number {
    const existingNumbers = items
        .map((item) => String(item.question || '').match(/^(?:New\s+)?Question\s+(\d+)$/i)?.[1])
        .filter(Boolean)
        .map((value) => parseInt(value as string, 10))
        .filter(Number.isFinite);

    return existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : items.length + 1;
}

function remapIndexAfterMove(currentIndex: number | null, fromIndex: number, toIndex: number): number | null {
    if (currentIndex === null) return null;
    if (currentIndex === fromIndex) return toIndex;
    if (fromIndex < toIndex && currentIndex > fromIndex && currentIndex <= toIndex) return currentIndex - 1;
    if (fromIndex > toIndex && currentIndex >= toIndex && currentIndex < fromIndex) return currentIndex + 1;
    return currentIndex;
}
