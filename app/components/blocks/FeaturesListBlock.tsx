'use client';

import React from 'react';
import EditableText from '../EditableText';
import BlockPretext from '../BlockPretext';
import { Plus } from 'lucide-react';
import Reveal from '@/app/components/Reveal';
import { resolvePaletteColor } from '@/lib/palette-colors';
import InlineCardControls, { reorderItems } from './InlineCardControls';

interface FeaturesListBlockProps {
    id: string;
    data: any;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: (key: string, value: any) => void;
}

export default function FeaturesListBlock({ id, data, isEditMode, palette, updateContent }: FeaturesListBlockProps) {
    const pPrimary = palette.primary || '#1f2937';
    const pSecondary = palette.secondary || '#dc2626';
    const bgColor = resolvePaletteColor(data.backgroundColor, palette, '#ffffff');
    const fgOverride = resolvePaletteColor(data.foregroundColor, palette);
    const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);

    const items = data.items || [
        "Licensed & Insured Experts",
        "100% Satisfaction Guarantee",
        "Upfront Honest Pricing",
        "24/7 Emergency Support"
    ];

    const handleAddItem = () => {
        updateContent('items', [...items, `New Feature ${items.length + 1}`]);
    };

    const handleRemoveItem = (index: number) => {
        if (items.length <= 1) return;
        updateContent('items', items.filter((_: string, i: number) => i !== index));
    };

    const handleUpdateItem = (index: number, value: string) => {
        const newItems = items.map((item: string, i: number) =>
            i === index ? value : item
        );
        updateContent('items', newItems);
    };

    const handleReorderItem = (fromIndex: number, toIndex: number) => {
        updateContent('items', reorderItems(items, fromIndex, toIndex));
    };

    return (
        <section className="py-24" style={{ backgroundColor: bgColor }}>
            <div className="max-w-4xl mx-auto px-4">
                <Reveal>
                    <BlockPretext
                        data={data}
                        isEditMode={isEditMode}
                        palette={palette}
                        updateContent={updateContent}
                        defaultText="Why Us"
                    />
                    <EditableText
                        as="h2"
                        contentKey="title"
                        content={data.title}
                        defaultValue="Why Choose Us?"
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="text-4xl font-bold mb-10 text-center"
                        style={{ color: fgOverride || pPrimary }}
                    />
                </Reveal>

                <ul className="space-y-6 text-lg max-w-2xl mx-auto">
                    {items.map((item: string, index: number) => {
                        const isDragging = draggedIndex === index;
                        const isDragTarget = dragOverIndex === index && draggedIndex !== index;
                        return (
                        <Reveal
                            key={index}
                            onDragOver={(event) => {
                                if (!isEditMode || draggedIndex === null) return;
                                event.preventDefault();
                                setDragOverIndex(index);
                            }}
                            onDrop={(event) => {
                                if (!isEditMode || draggedIndex === null) return;
                                event.preventDefault();
                                handleReorderItem(draggedIndex, index);
                                setDraggedIndex(null);
                                setDragOverIndex(null);
                            }}
                        >
                            <li className={`relative group/card flex items-center gap-4 bg-gray-50 p-4 rounded-lg shadow-sm border transition-[border-color,box-shadow,opacity,transform] ${
                                isDragTarget ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-100'
                            } ${isDragging ? 'scale-[0.99] opacity-60' : ''}`}>
                                {isEditMode && (
                                    <InlineCardControls
                                        canRemove={items.length > 1}
                                        dragData={`feature-${index}`}
                                        dragTitle="Drag to reorder feature"
                                        removeTitle="Delete feature"
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
                                <span className="font-bold shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-white shadow-sm ring-1 ring-gray-100" style={{ color: pSecondary }}>&#10003;</span>
                                <div className="flex-1 w-full">
                                    <EditableText
                                        as="span"
                                        contentKey={`feature_${index}`}
                                        content={item}
                                        defaultValue={item}
                                        isEditMode={isEditMode}
                                        onSave={(_key, value) => handleUpdateItem(index, value)}
                                        style={{ color: pPrimary }}
                                    />
                                </div>
                            </li>
                        </Reveal>
                        );
                    })}
                </ul>

                {isEditMode && (
                    <div className="flex justify-center mt-6">
                        <button
                            onClick={handleAddItem}
                            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-dashed border-blue-300"
                        >
                            <Plus className="w-4 h-4" />
                            Add Feature
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}
