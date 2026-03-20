import React from 'react';
import EditableText from '../EditableText';
import { Plus, X } from 'lucide-react';
import Reveal from '@/app/components/Reveal';

interface ServicesGridBlockProps {
    id: string;
    data: any;
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

    const handleAddItem = () => {
        const newItems = [...items, { title: `Service ${items.length + 1}`, description: "Description of this service." }];
        updateContent('items', newItems);
    };

    const handleRemoveItem = (index: number) => {
        if (items.length <= 1) return;
        const newItems = items.filter((_: any, i: number) => i !== index);
        updateContent('items', newItems);
    };

    const handleUpdateItem = (index: number, field: string, value: string) => {
        const newItems = items.map((item: any, i: number) =>
            i === index ? { ...item, [field]: value } : item
        );
        updateContent('items', newItems);
    };

    return (
        <section className="py-24" style={{ backgroundColor: data.backgroundColor || '#ffffff' }}>
            <div className="max-w-7xl mx-auto px-4">
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <Reveal>
                        <EditableText
                            as="h2"
                            contentKey="title"
                            content={data.title}
                            defaultValue="Our Core Services"
                            isEditMode={isEditMode}
                            onSave={(key, value) => updateContent(key, value)}
                            className="text-4xl font-bold mb-4"
                            style={{ color: pPrimary }}
                        />
                    </Reveal>
                    {(data.subtitle || isEditMode) && (
                        <Reveal>
                            <EditableText
                                as="p"
                                contentKey="subtitle"
                                content={data.subtitle}
                                defaultValue="Professional expertise tailored to your needs."
                                isEditMode={isEditMode}
                                onSave={(key, value) => updateContent(key, value)}
                                className="text-xl mb-6"
                                style={{ color: pPrimary, opacity: 0.7 }}
                            />
                        </Reveal>
                    )}
                    <Reveal>
                        <div className="w-24 border-b-4 mx-auto" style={{ borderColor: pSecondary }}></div>
                    </Reveal>
                </div>

                {/* Dynamic Grid Layout */}
                <div className={`grid gap-8 ${items.length === 1 ? 'grid-cols-1 max-w-2xl mx-auto' :
                    items.length === 2 ? 'md:grid-cols-2 max-w-4xl mx-auto' :
                        items.length === 4 ? 'grid-cols-1 md:grid-cols-2 max-w-5xl mx-auto' :
                            'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                    }`}>
                    {items.map((item: any, index: number) => (
                        <Reveal
                            key={index}
                            className="bg-gray-50 p-8 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative group"
                        >
                            {isEditMode && items.length > 1 && (
                                <button
                                    onClick={() => handleRemoveItem(index)}
                                    className="absolute top-2 right-2 p-1 bg-red-100 hover:bg-red-200 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Remove service"
                                >
                                    <X className="w-3.5 h-3.5 text-red-600" />
                                </button>
                            )}

                            {/* Number Badge */}
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg mb-6 text-white" style={{ backgroundColor: pSecondary }}>
                                {index + 1}
                            </div>

                            <EditableText
                                as="h3"
                                contentKey={`item_${index}_title`}
                                content={item.title}
                                defaultValue={`Premium Service ${index + 1}`}
                                isEditMode={isEditMode}
                                onSave={(_key, value) => handleUpdateItem(index, 'title', value)}
                                className="text-xl font-bold mb-3"
                                style={{ color: pPrimary }}
                            />
                            <EditableText
                                as="p"
                                contentKey={`item_${index}_desc`}
                                content={item.description}
                                defaultValue="Comprehensive diagnostic, repair, and installation services handled by our certified professionals."
                                isEditMode={isEditMode}
                                onSave={(_key, value) => handleUpdateItem(index, 'description', value)}
                                className="leading-relaxed"
                                style={{ color: pPrimary, opacity: 0.7 }}
                            />
                        </Reveal>
                    ))}
                </div>

                {/* Add Service Button (edit mode only) */}
                {isEditMode && (
                    <div className="flex justify-center mt-6">
                        <button
                            onClick={handleAddItem}
                            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-dashed border-blue-300"
                        >
                            <Plus className="w-4 h-4" />
                            Add Service
                        </button>
                    </div>
                )}

                {/* Optional CTA Link */}
                {(data.ctaText || data.ctaUrl || isEditMode) && (
                    <Reveal className="text-center mt-12">
                        {isEditMode ? (
                            <div className="inline-flex flex-col items-center gap-2">
                                <EditableText
                                    as="span"
                                    contentKey="ctaText"
                                    content={data.ctaText}
                                    defaultValue="See All Services →"
                                    isEditMode={isEditMode}
                                    onSave={(key, value) => updateContent(key, value)}
                                    className="text-lg font-semibold cursor-text"
                                    style={{ color: pSecondary }}
                                />
                                <input
                                    type="text"
                                    value={data.ctaUrl || ''}
                                    onChange={(e) => updateContent('ctaUrl', e.target.value)}
                                    placeholder="Link URL (e.g. /services)"
                                    className="text-xs text-slate-900 placeholder:text-slate-400 bg-slate-50 border border-slate-200 rounded px-2 py-1 w-64 text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                        ) : data.ctaText && data.ctaUrl ? (
                            <a
                                href={data.ctaUrl}
                                className="text-lg font-semibold hover:underline transition-colors"
                                style={{ color: pSecondary }}
                            >
                                {data.ctaText}
                            </a>
                        ) : null}
                    </Reveal>
                )}
            </div>
        </section>
    );
}
