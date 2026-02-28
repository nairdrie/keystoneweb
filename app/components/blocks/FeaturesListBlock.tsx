import React from 'react';
import EditableText from '../EditableText';

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

    const items = data.items || [
        "Licensed & Insured Experts",
        "100% Satisfaction Guarantee",
        "Upfront Honest Pricing",
        "24/7 Emergency Support"
    ];

    return (
        <section className="py-24" style={{ backgroundColor: data.backgroundColor || '#ffffff' }}>
            <div className="max-w-4xl mx-auto px-4">
                <EditableText
                    as="h2"
                    contentKey={`${id}.title`}
                    content={data.title}
                    defaultValue="Why Choose Us?"
                    isEditMode={isEditMode}
                    onSave={(key, value) => updateContent(key, value)}
                    className="text-4xl font-bold mb-10 text-center"
                    style={{ color: pPrimary }}
                />

                <ul className="space-y-6 text-lg text-gray-700 max-w-2xl mx-auto">
                    {items.map((item: string, index: number) => (
                        <li key={index} className="flex items-center gap-4 bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-100">
                            <span className="font-bold shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-white shadow-sm ring-1 ring-gray-100" style={{ color: pSecondary }}>✓</span>
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
        </section>
    );
}
