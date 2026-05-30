'use client';

import React, { useState } from 'react';
import EditableText from '../EditableText';
import BlockPretext from '../BlockPretext';
import Reveal, { useStaggerSec } from '@/app/components/Reveal';
import { ChevronDown, Plus } from 'lucide-react';
import { resolvePaletteColor } from '@/lib/palette-colors';
import InlineCardControls from './InlineCardControls';
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

interface FAQItem {
    question: string;
    answer: string;
}

interface FAQBlockData extends Record<string, unknown> {
    title?: string;
    subtitle?: string;
    backgroundColor?: string;
    foregroundColor?: string;
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
    const fgOverride = resolvePaletteColor(data.foregroundColor, palette);
    const [openIndex, setOpenIndex] = useState<number | null>(0);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const hasCardDesignOverride = hasFaqCardDesignOverride(data);
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
    const faqQuestionColor = hasCardDesignOverride
        ? lockCardTextToSurface ? surfaceCardTextColor : fgOverride || surfaceCardTextColor
        : pPrimary;
    const faqAnswerColor = hasCardDesignOverride
        ? lockCardTextToSurface ? surfaceCardTextColor : fgOverride || pPrimary
        : pPrimary;
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
    const cardShadowBuffer = hasCardDesignOverride
        ? universalCardSettings
            ? getCardShadowPaintBuffer(universalCardSettings)
            : getCardPresetShadowPaintBuffer(cardStyle)
        : 0;
    const cardShadowSafeStyle = hasCardDesignOverride ? getCardShadowSafeContainerStyle(cardShadowBuffer) : undefined;

    const items = Array.isArray(data.items) ? data.items : DEFAULT_FAQ_ITEMS;
    const staggerSec = useStaggerSec();

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
                <BlockPretext
                    data={data}
                    isEditMode={isEditMode}
                    palette={palette}
                    updateContent={updateContent}
                    defaultText="FAQ"
                />
                <EditableText
                    as="h2"
                    contentKey="title"
                    content={data.title}
                    defaultValue="Frequently Asked Questions"
                    isEditMode={isEditMode}
                    onSave={(key, value) => updateContent(key, value)}
                    className="text-4xl font-bold text-center mb-4"
                    style={{ color: fgOverride || pPrimary }}
                />
                <EditableText
                    as="p"
                    contentKey="subtitle"
                    content={data.subtitle}
                    defaultValue="Everything you need to know about our services."
                    isEditMode={isEditMode}
                    onSave={(key, value) => updateContent(key, value)}
                    className="text-lg text-center mb-12"
                    style={{ color: fgOverride || pPrimary, opacity: 0.6 }}
                />

                <div style={cardShadowSafeStyle}>
                <div className="space-y-3">
                    {items.map((item, index) => {
                        const isOpen = openIndex === index;
                        const isDragging = draggedIndex === index;
                        const isDragTarget = dragOverIndex === index && draggedIndex !== index;
                        return (
                            <Reveal key={index} delay={index * staggerSec}>
                            <div
                                className={`${hasCardDesignOverride ? cardClassName : 'faq-item group/card relative rounded-xl border bg-white'} ${
                                    isDragTarget ? 'border-blue-300 shadow-md ring-2 ring-blue-100' : 'border-gray-200'
                                } ${isDragging ? 'scale-[0.99] opacity-60' : ''} ${isEditMode ? 'overflow-visible' : 'overflow-hidden'}`}
                                style={cardInlineStyle}
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
                                        className={`flex-1 flex items-center justify-between overflow-visible text-left transition-colors ${hasCardDesignOverride ? 'p-0' : 'p-5'} ${lockCardTextToSurface ? 'hover:bg-white/10' : 'hover:bg-gray-50'} ${isEditMode ? 'pr-20' : ''}`}
                                    >
                                        <EditableText
                                            as="span"
                                            contentKey={`faq_${index}_question`}
                                            content={item.question}
                                            defaultValue={`Question ${index + 1}`}
                                            isEditMode={isEditMode}
                                            onSave={(_key, value) => handleUpdateItem(index, 'question', value)}
                                            className="font-semibold text-left pr-4 flex-1"
                                            style={{ color: faqQuestionColor }}
                                        />
                                        <ChevronDown
                                            className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                                            style={{ color: faqQuestionColor, opacity: 0.45 }}
                                        />
                                    </button>
                                </div>
                                <div
                                    className={`transition-all duration-200 ${isOpen ? `max-h-96 ${isEditMode ? 'overflow-visible' : 'overflow-hidden'}` : 'max-h-0 overflow-hidden'}`}
                                >
                                    <div className={hasCardDesignOverride ? 'relative z-20 pt-4' : 'relative z-20 px-5 pb-5 pt-0'}>
                                        <EditableText
                                            as="p"
                                            contentKey={`faq_${index}_answer`}
                                            content={item.answer}
                                            defaultValue="Answer goes here."
                                            isEditMode={isEditMode}
                                            onSave={(_key, value) => handleUpdateItem(index, 'answer', value)}
                                            className="leading-relaxed"
                                            style={{ color: faqAnswerColor, opacity: 0.7 }}
                                        />
                                    </div>
                                </div>
                            </div>
                            </Reveal>
                        );
                    })}
                </div>
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

function hasFaqCardDesignOverride(data: Record<string, unknown>): boolean {
    if (data.cardSettings && typeof data.cardSettings === 'object' && !Array.isArray(data.cardSettings)) {
        return Object.keys(data.cardSettings).length > 0;
    }
    return typeof data.cardStyle === 'string' && data.cardStyle.trim() !== '';
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
