import React from 'react';
import EditableText from '../EditableText';
import EditableImage from '../EditableImage';
import { useEditorContext } from '@/lib/editor-context';

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

    const items = data.items || [
        "Licensed & Insured Experts",
        "100% Satisfaction Guarantee",
        "Upfront Honest Pricing",
        "Decades of Experience"
    ];

    const handleUpdateItem = (index: number, value: string) => {
        const newItems = items.map((item: string, i: number) =>
            i === index ? value : item
        );
        updateContent('items', newItems);
    };

    return (
        <section className="py-24" style={{ backgroundColor: data.backgroundColor || palette.accent || '#f3f4f6' }}>
            <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-2 gap-16 items-center">
                {data.imagePosition === 'right' ? (
                    <>
                        <TextContent data={data} items={items} isEditMode={isEditMode} updateContent={updateContent} handleUpdateItem={handleUpdateItem} pPrimary={pPrimary} pSecondary={pSecondary} />
                        <ImageContent data={data} isEditMode={isEditMode} updateContent={updateContent} uploadImage={context?.uploadImage} />
                    </>
                ) : (
                    <>
                        <ImageContent data={data} isEditMode={isEditMode} updateContent={updateContent} uploadImage={context?.uploadImage} />
                        <TextContent data={data} items={items} isEditMode={isEditMode} updateContent={updateContent} handleUpdateItem={handleUpdateItem} pPrimary={pPrimary} pSecondary={pSecondary} />
                    </>
                )}
            </div>
        </section>
    );
}

function ImageContent({ data, isEditMode, updateContent, uploadImage }: any) {
    return (
        <EditableImage
            contentKey="image"
            imageUrl={data.image}
            isEditMode={isEditMode}
            onSave={(key, value) => updateContent(key, value)}
            onUpload={uploadImage}
            className="w-full h-96 rounded-lg shadow-xl object-cover bg-gray-300"
            placeholder="Click to upload about image"
        />
    );
}

function TextContent({ data, items, isEditMode, updateContent, handleUpdateItem, pPrimary, pSecondary }: any) {
    return (
        <div>
            <EditableText
                as="h2"
                contentKey="title"
                content={data.title}
                defaultValue="Why Choose Us?"
                isEditMode={isEditMode}
                onSave={(key, value) => updateContent(key, value)}
                className="text-4xl font-bold mb-6"
                style={{ color: pPrimary }}
            />
            {data.description && (
                <EditableText
                    as="p"
                    contentKey="description"
                    content={data.description}
                    defaultValue=""
                    isEditMode={isEditMode}
                    onSave={(key, value) => updateContent(key, value)}
                    className="text-lg mb-8 leading-relaxed"
                    style={{ color: pPrimary, opacity: 0.7 }}
                />
            )}
            <ul className="space-y-4 text-lg">
                {items.map((item: string, index: number) => (
                    <li key={index} className="flex items-center gap-3">
                        <span className="font-bold flex-shrink-0" style={{ color: pSecondary }}>✓</span>
                        <div className="flex-1 w-full">
                            <EditableText
                                as="span"
                                contentKey={`about_item_${index}`}
                                content={item}
                                defaultValue={item}
                                isEditMode={isEditMode}
                                onSave={(_key, value) => handleUpdateItem(index, value)}
                                style={{ color: pPrimary }}
                            />
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
