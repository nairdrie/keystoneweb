'use client';

import React from 'react';
import EditableText from '../EditableText';
import EditableImage from '../EditableImage';
import { useEditorContext } from '@/lib/editor-context';

interface TeamBlockProps {
    id: string;
    data: any;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: (key: string, value: any) => void;
}

export default function TeamBlock({ id, data, isEditMode, palette, updateContent }: TeamBlockProps) {
    const context = useEditorContext();
    const pPrimary = palette.primary || '#1f2937';
    const pSecondary = palette.secondary || '#dc2626';

    const variant = data.variant || 'grid'; // 'grid' | 'cards' | 'minimal'

    const members = data.members || [
        { name: 'Alex Johnson', role: 'Founder & CEO', image: '', bio: 'Leading our vision with 15+ years of industry experience.' },
        { name: 'Sarah Chen', role: 'Lead Designer', image: '', bio: 'Creating beautiful experiences that delight customers.' },
        { name: 'Mike Rodriguez', role: 'Head of Operations', image: '', bio: 'Ensuring everything runs smoothly, every single day.' },
    ];

    if (variant === 'minimal') {
        return (
            <section className="py-24" style={{ backgroundColor: data.backgroundColor || '#ffffff' }}>
                <div className="max-w-5xl mx-auto px-4">
                    <EditableText
                        as="h2"
                        contentKey={`${id}.title`}
                        content={data.title}
                        defaultValue="Our Team"
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="text-4xl font-bold text-center mb-16"
                        style={{ color: pPrimary }}
                    />
                    <div className="space-y-8">
                        {members.map((member: any, index: number) => (
                            <div key={index} className="flex items-center gap-6 group">
                                <EditableImage
                                    contentKey={`${id}.members.${index}.image`}
                                    imageUrl={member.image}
                                    isEditMode={isEditMode}
                                    onSave={(key, value) => updateContent(key, value)}
                                    onUpload={context?.uploadImage}
                                    className="w-16 h-16 rounded-full object-cover bg-gray-200 flex-shrink-0"
                                    placeholder="Photo"
                                />
                                <div className="flex-1">
                                    <EditableText
                                        as="h3"
                                        contentKey={`${id}.members.${index}.name`}
                                        content={member.name}
                                        defaultValue={`Team Member ${index + 1}`}
                                        isEditMode={isEditMode}
                                        onSave={(key, value) => updateContent(key, value)}
                                        className="text-lg font-bold"
                                        style={{ color: pPrimary }}
                                    />
                                    <EditableText
                                        as="p"
                                        contentKey={`${id}.members.${index}.role`}
                                        content={member.role}
                                        defaultValue="Role"
                                        isEditMode={isEditMode}
                                        onSave={(key, value) => updateContent(key, value)}
                                        className="text-sm"
                                        style={{ color: pSecondary }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    if (variant === 'cards') {
        return (
            <section className="py-24" style={{ backgroundColor: data.backgroundColor || palette.accent || '#f8fafc' }}>
                <div className="max-w-7xl mx-auto px-4">
                    <EditableText
                        as="h2"
                        contentKey={`${id}.title`}
                        content={data.title}
                        defaultValue="Meet Our Team"
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="text-4xl font-bold text-center mb-4"
                        style={{ color: pPrimary }}
                    />
                    <EditableText
                        as="p"
                        contentKey={`${id}.subtitle`}
                        content={data.subtitle}
                        defaultValue="The people behind our success."
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="text-lg text-gray-500 text-center mb-16 max-w-2xl mx-auto"
                    />
                    <div className={`grid gap-8 ${members.length === 2 ? 'md:grid-cols-2 max-w-4xl mx-auto' : members.length >= 4 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'}`}>
                        {members.map((member: any, index: number) => (
                            <div key={index} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-lg transition-shadow">
                                <EditableImage
                                    contentKey={`${id}.members.${index}.image`}
                                    imageUrl={member.image}
                                    isEditMode={isEditMode}
                                    onSave={(key, value) => updateContent(key, value)}
                                    onUpload={context?.uploadImage}
                                    className="w-full h-64 object-cover bg-gray-200"
                                    placeholder="Team member photo"
                                />
                                <div className="p-6">
                                    <EditableText
                                        as="h3"
                                        contentKey={`${id}.members.${index}.name`}
                                        content={member.name}
                                        defaultValue={`Team Member ${index + 1}`}
                                        isEditMode={isEditMode}
                                        onSave={(key, value) => updateContent(key, value)}
                                        className="text-xl font-bold mb-1"
                                        style={{ color: pPrimary }}
                                    />
                                    <EditableText
                                        as="p"
                                        contentKey={`${id}.members.${index}.role`}
                                        content={member.role}
                                        defaultValue="Role"
                                        isEditMode={isEditMode}
                                        onSave={(key, value) => updateContent(key, value)}
                                        className="text-sm font-semibold mb-3"
                                        style={{ color: pSecondary }}
                                    />
                                    <EditableText
                                        as="p"
                                        contentKey={`${id}.members.${index}.bio`}
                                        content={member.bio}
                                        defaultValue="A brief bio about this team member."
                                        isEditMode={isEditMode}
                                        onSave={(key, value) => updateContent(key, value)}
                                        className="text-gray-500 text-sm leading-relaxed"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    // Grid variant (default) — centered circular photos
    return (
        <section className="py-24" style={{ backgroundColor: data.backgroundColor || '#ffffff' }}>
            <div className="max-w-7xl mx-auto px-4">
                <EditableText
                    as="h2"
                    contentKey={`${id}.title`}
                    content={data.title}
                    defaultValue="Meet Our Team"
                    isEditMode={isEditMode}
                    onSave={(key, value) => updateContent(key, value)}
                    className="text-4xl font-bold text-center mb-4"
                    style={{ color: pPrimary }}
                />
                <EditableText
                    as="p"
                    contentKey={`${id}.subtitle`}
                    content={data.subtitle}
                    defaultValue="The people behind our success."
                    isEditMode={isEditMode}
                    onSave={(key, value) => updateContent(key, value)}
                    className="text-lg text-gray-500 text-center mb-16 max-w-2xl mx-auto"
                />
                <div className={`grid gap-12 ${members.length === 2 ? 'md:grid-cols-2 max-w-3xl mx-auto' : members.length >= 4 ? 'grid-cols-2 md:grid-cols-4' : 'md:grid-cols-3'}`}>
                    {members.map((member: any, index: number) => (
                        <div key={index} className="text-center group">
                            <EditableImage
                                contentKey={`${id}.members.${index}.image`}
                                imageUrl={member.image}
                                isEditMode={isEditMode}
                                onSave={(key, value) => updateContent(key, value)}
                                onUpload={context?.uploadImage}
                                className="w-32 h-32 rounded-full object-cover bg-gray-200 mx-auto mb-4 ring-4 ring-white shadow-lg group-hover:scale-105 transition-transform"
                                placeholder="Photo"
                            />
                            <EditableText
                                as="h3"
                                contentKey={`${id}.members.${index}.name`}
                                content={member.name}
                                defaultValue={`Team Member ${index + 1}`}
                                isEditMode={isEditMode}
                                onSave={(key, value) => updateContent(key, value)}
                                className="text-lg font-bold mb-1"
                                style={{ color: pPrimary }}
                            />
                            <EditableText
                                as="p"
                                contentKey={`${id}.members.${index}.role`}
                                content={member.role}
                                defaultValue="Role"
                                isEditMode={isEditMode}
                                onSave={(key, value) => updateContent(key, value)}
                                className="text-sm font-medium"
                                style={{ color: pSecondary }}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
