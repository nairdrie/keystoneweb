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

    return (
        <section className="py-24" style={{ backgroundColor: data.backgroundColor || palette.accent || '#f3f4f6' }}>
            <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-2 gap-16 items-center">
                {data.imagePosition === 'right' ? (
                    <>
                        <TextContent id={id} data={data} items={items} isEditMode={isEditMode} updateContent={updateContent} pPrimary={pPrimary} pSecondary={pSecondary} />
                        <ImageContent id={id} data={data} isEditMode={isEditMode} updateContent={updateContent} uploadImage={context?.uploadImage} />
                    </>
                ) : (
                    <>
                        <ImageContent id={id} data={data} isEditMode={isEditMode} updateContent={updateContent} uploadImage={context?.uploadImage} />
                        <TextContent id={id} data={data} items={items} isEditMode={isEditMode} updateContent={updateContent} pPrimary={pPrimary} pSecondary={pSecondary} />
                    </>
                )}
            </div>
        </section>
    );
}

function ImageContent({ id, data, isEditMode, updateContent, uploadImage }: any) {
    return (
        <EditableImage
            contentKey={`${id}.image`}
            imageUrl={data.image}
            isEditMode={isEditMode}
            onSave={(key, value) => updateContent(key, value)}
            onUpload={uploadImage}
            className="w-full h-96 rounded-lg shadow-xl object-cover bg-gray-300"
            placeholder="Click to upload about image"
        />
    );
}

function TextContent({ id, data, items, isEditMode, updateContent, pPrimary, pSecondary }: any) {
    return (
        <div>
            <EditableText
                as="h2"
                contentKey={`${id}.title`}
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
                    contentKey={`${id}.description`}
                    content={data.description}
                    defaultValue=""
                    isEditMode={isEditMode}
                    onSave={(key, value) => updateContent(key, value)}
                    className="text-lg text-gray-600 mb-8 leading-relaxed"
                />
            )}
            <ul className="space-y-4 text-lg text-gray-700">
                {items.map((item: string, index: number) => (
                    <li key={index} className="flex items-center gap-3">
                        <span className="font-bold flex-shrink-0" style={{ color: pSecondary }}>✓</span>
                        <div className="flex-1 w-full">
                            <EditableText
                                as="span"
                                contentKey={`${id}.items.${index}`}
                                content={item}
                                defaultValue={item}
                                isEditMode={isEditMode}
                                onSave={(key, value) => updateContent(key, value)}
                            />
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
