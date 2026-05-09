import React from 'react';
import EditableText from '../EditableText';
import EditableImage from '../EditableImage';
import BlockPretext from '../BlockPretext';
import { useEditorContext } from '@/lib/editor-context';
import Reveal from '@/app/components/Reveal';
import { resolvePaletteColor } from '@/lib/palette-colors';
import { Plus, X } from 'lucide-react';

interface AboutImageTextBlockProps {
    id: string;
    data: any;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: (key: string, value: any) => void;
}

export default function AboutImageTextBlock({ id, data, isEditMode, palette, updateContent }: AboutImageTextBlockProps) {
    const context = useEditorContext();
    const pPrimary = palette.primary || '#1f2937';
    const pSecondary = palette.secondary || '#dc2626';
    const bgColor = resolvePaletteColor(data.backgroundColor, palette, palette.accent || '#f3f4f6');
    const fgOverride = resolvePaletteColor(data.foregroundColor, palette);

    const items = data.items || [
        "Licensed & Insured Experts",
        "100% Satisfaction Guarantee",
        "Upfront Honest Pricing",
        "Decades of Experience"
    ];

    const handleAddItem = () => {
        updateContent('items', [...items, `New Benefit ${getNextBenefitNumber(items)}`]);
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
            <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-2 gap-16 items-center">
                {data.imagePosition === 'right' ? (
                    <>
                        <TextContent data={data} items={items} isEditMode={isEditMode} palette={palette} updateContent={updateContent} handleAddItem={handleAddItem} handleRemoveItem={handleRemoveItem} handleUpdateItem={handleUpdateItem} pPrimary={pPrimary} pSecondary={pSecondary} fgOverride={fgOverride} />
                        <ImageContent data={data} isEditMode={isEditMode} updateContent={updateContent} uploadImage={context?.uploadImage} />
                    </>
                ) : (
                    <>
                        <ImageContent data={data} isEditMode={isEditMode} updateContent={updateContent} uploadImage={context?.uploadImage} />
                        <TextContent data={data} items={items} isEditMode={isEditMode} palette={palette} updateContent={updateContent} handleAddItem={handleAddItem} handleRemoveItem={handleRemoveItem} handleUpdateItem={handleUpdateItem} pPrimary={pPrimary} pSecondary={pSecondary} fgOverride={fgOverride} />
                    </>
                )}
            </div>
        </section>
    );
}

function getNextBenefitNumber(items: string[]): number {
    const existingNumbers = items
        .map((item) => item.match(/^New Benefit (\d+)$/)?.[1])
        .filter((value): value is string => Boolean(value))
        .map((value) => Number(value))
        .filter(Number.isFinite);

    return existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : items.length + 1;
}

function ImageContent({ data, isEditMode, updateContent, uploadImage }: any) {
    const variant = data.variant || 'landscape';
    const aspectClass = variant === 'tall' ? 'aspect-[3/4]' : variant === 'square' ? 'aspect-square' : 'aspect-[4/3]';

    return (
        <Reveal>
            <EditableImage
                contentKey="image"
                initialSettings={data.image__settings}
                imageUrl={data.image}
                isEditMode={isEditMode}
                onSave={(key, value) => updateContent(key, value)}
                onUpload={uploadImage}
                className={`w-full ${aspectClass} rounded-lg shadow-xl object-cover`}
                emptyBackgroundClassName="bg-transparent"
                placeholder="Click to upload about image"
            />
        </Reveal>
    );
}

function TextContent({ data, items, isEditMode, palette, updateContent, handleAddItem, handleRemoveItem, handleUpdateItem, pPrimary, pSecondary, fgOverride }: any) {
    return (
        <div>
            <Reveal>
                <BlockPretext
                    data={data}
                    isEditMode={isEditMode}
                    palette={palette}
                    updateContent={updateContent}
                    defaultText="About"
                />
                <EditableText
                    as="h2"
                    contentKey="title"
                    content={data.title}
                    defaultValue="Why Choose Us?"
                    isEditMode={isEditMode}
                    onSave={(key, value) => updateContent(key, value)}
                    className="text-4xl font-bold mb-6"
                    style={{ color: fgOverride || pPrimary }}
                />
            </Reveal>
            {(data.description || isEditMode) && (
                <Reveal>
                    <EditableText
                        as="p"
                        contentKey="description"
                        content={data.description}
                        defaultValue=""
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="text-lg mb-8 leading-relaxed"
                        style={{ color: fgOverride || pPrimary, opacity: 0.7 }}
                    />
                </Reveal>
            )}
            <ul className="space-y-4 text-lg">
                {items.map((item: string, index: number) => (
                    <Reveal key={index}>
                        <li className="relative group flex items-center gap-3 rounded-lg py-1 pr-9">
                            {isEditMode && items.length > 1 && (
                                <button
                                    onClick={() => handleRemoveItem(index)}
                                    className="absolute right-0 top-1/2 -translate-y-1/2 p-1 bg-red-100 hover:bg-red-200 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Remove item"
                                >
                                    <X className="w-3.5 h-3.5 text-red-600" />
                                </button>
                            )}
                            <span className="font-bold flex-shrink-0" style={{ color: pSecondary }}>✓</span>
                            <div className="flex-1 w-full">
                                <EditableText
                                    as="span"
                                    contentKey={`about_item_${index}`}
                                    content={item}
                                    defaultValue={item}
                                    isEditMode={isEditMode}
                                    onSave={(_key, value) => handleUpdateItem(index, value)}
                                    style={{ color: fgOverride || pPrimary }}
                                />
                            </div>
                        </li>
                    </Reveal>
                ))}
            </ul>
            {isEditMode && (
                <div className="flex justify-start mt-5">
                    <button
                        onClick={handleAddItem}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-dashed border-blue-300"
                    >
                        <Plus className="w-4 h-4" />
                        Add Item
                    </button>
                </div>
            )}
        </div>
    );
}
