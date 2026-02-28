import React from 'react';
import EditableText from '../EditableText';
import { Palette } from 'lucide-react';

interface ServicesGridBlockProps {
    id: string; // The block UUID
    data: any;  // The dynamic block data payload
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: (key: string, value: any) => void;
}

export default function ServicesGridBlock({ id, data, isEditMode, palette, updateContent }: ServicesGridBlockProps) {
    const pPrimary = palette.primary || '#1f2937';
    const pSecondary = palette.secondary || '#dc2626';
    const pAccent = palette.accent || '#f3f4f6';

    const items = data.items || [
        { title: "Service 1", description: "First service description." },
        { title: "Service 2", description: "Second service description." },
        { title: "Service 3", description: "Third service description." }
    ];

    return (
        <section className="py-24" style={{ backgroundColor: data.backgroundColor || '#ffffff' }}>
            <div className="max-w-7xl mx-auto px-4">
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <EditableText
                        as="h2"
                        contentKey={`${id}.title`}
                        content={data.title}
                        defaultValue="Our Core Services"
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="text-4xl font-bold mb-4"
                        style={{ color: pPrimary }}
                    />
                    {data.subtitle && (
                        <EditableText
                            as="p"
                            contentKey={`${id}.subtitle`}
                            content={data.subtitle}
                            defaultValue="Professional expertise tailored to your needs."
                            isEditMode={isEditMode}
                            onSave={(key, value) => updateContent(key, value)}
                            className="text-xl text-gray-500 mb-6"
                        />
                    )}
                    <div className="w-24 border-b-4 mx-auto" style={{ borderColor: pSecondary }}></div>
                </div>

                {/* Dynamic Grid Layout */}
                <div className={`grid gap-8 ${items.length === 1 ? 'grid-cols-1 max-w-2xl mx-auto' :
                    items.length === 2 ? 'md:grid-cols-2 max-w-4xl mx-auto' :
                        items.length === 4 ? 'grid-cols-1 md:grid-cols-2 max-w-5xl mx-auto' :
                            'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                    }`}>
                    {items.map((item: any, index: number) => (
                        <div
                            key={index}
                            className="bg-gray-50 p-8 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative group"
                        >
                            {/* Number Badge or Icon Placeholder */}
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg mb-6 text-white" style={{ backgroundColor: pSecondary }}>
                                {index + 1}
                            </div>

                            <EditableText
                                as="h3"
                                contentKey={`${id}.items.${index}.title`}
                                content={item.title}
                                defaultValue={`Premium Service ${index + 1}`}
                                isEditMode={isEditMode}
                                onSave={(key, value) => updateContent(key, value)}
                                className="text-xl font-bold mb-3"
                                style={{ color: pPrimary }}
                            />
                            <EditableText
                                as="p"
                                contentKey={`${id}.items.${index}.description`}
                                content={item.description}
                                defaultValue="Comprehensive diagnostic, repair, and installation services handled by our certified professionals."
                                isEditMode={isEditMode}
                                onSave={(key, value) => updateContent(key, value)}
                                className="text-gray-600 leading-relaxed"
                            />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
