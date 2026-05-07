import React from 'react';
import EditableText from '../EditableText';
import { Plus, X } from 'lucide-react';
import Reveal from '@/app/components/Reveal';
import { resolvePaletteColor } from '@/lib/palette-colors';

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

    return (
        <section className="py-24" style={{ backgroundColor: bgColor }}>
            <div className="max-w-4xl mx-auto px-4">
                <Reveal>
                    <EditableText
                        as="h2"
                        contentKey="title"
                        content={data.title}
                        defaultValue="Why Choose Us?"
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="text-4xl font-bold mb-10 text-center"
                        style={{ color: pPrimary }}
                    />
                </Reveal>

                <ul className="space-y-6 text-lg max-w-2xl mx-auto">
                    {items.map((item: string, index: number) => (
                        <Reveal key={index}>
                            <li className="relative group flex items-center gap-4 bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-100">
                                {isEditMode && items.length > 1 && (
                                    <button
                                        onClick={() => handleRemoveItem(index)}
                                        className="absolute top-2 right-2 p-1 bg-red-100 hover:bg-red-200 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Remove feature"
                                    >
                                        <X className="w-3.5 h-3.5 text-red-600" />
                                    </button>
                                )}
                                <span className="font-bold shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-white shadow-sm ring-1 ring-gray-100" style={{ color: pSecondary }}>✓</span>
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
                    ))}
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
