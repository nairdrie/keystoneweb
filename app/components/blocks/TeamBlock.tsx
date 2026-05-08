'use client';

import React from 'react';
import { Plus, User } from 'lucide-react';
import EditableText from '../EditableText';
import EditableImage from '../EditableImage';
import { useEditorContext } from '@/lib/editor-context';
import { resolvePaletteColor } from '@/lib/palette-colors';
import type { ImageSettings } from '../ImageEditorModal';
import InlineCardControls, { reorderItems } from './InlineCardControls';

interface TeamMember {
    name: string;
    role: string;
    image: string;
    bio: string;
}

interface TeamBlockData extends Record<string, unknown> {
    title?: string;
    subtitle?: string;
    backgroundColor?: string;
    variant?: string;
    showBio?: boolean;
    columns?: number | string;
    members?: TeamMember[];
}

interface TeamBlockProps {
    id: string;
    data: TeamBlockData;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: (key: string, value: unknown) => void;
}

const DEFAULT_TEAM_MEMBERS: TeamMember[] = [
    { name: 'Alex Johnson', role: 'Founder & CEO', image: '', bio: 'Leading our vision with 15+ years of industry experience.' },
    { name: 'Sarah Chen', role: 'Lead Designer', image: '', bio: 'Creating beautiful experiences that delight customers.' },
    { name: 'Mike Rodriguez', role: 'Head of Operations', image: '', bio: 'Ensuring everything runs smoothly, every single day.' },
];

export default function TeamBlock({ data, isEditMode, palette, updateContent }: TeamBlockProps) {
    const context = useEditorContext();
    const pPrimary = palette.primary || '#1f2937';
    const pSecondary = palette.secondary || '#dc2626';
    const bgColor = resolvePaletteColor(data.backgroundColor, palette, '#ffffff');
    const cardBgColor = resolvePaletteColor(data.backgroundColor, palette, palette.accent || '#f8fafc');
    const fgOverride = resolvePaletteColor(data.foregroundColor, palette);

    const variant = typeof data.variant === 'string' ? data.variant : 'grid'; // 'grid' | 'cards' | 'minimal'
    const showBio = data.showBio !== false; // Default to true if not specified
    const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);

    const members = Array.isArray(data.members) ? data.members : DEFAULT_TEAM_MEMBERS;

    const parsedColumns = Number(data.columns || 0);
    const columns = Number.isFinite(parsedColumns) ? parsedColumns : 0; // 0 = auto

    const handleUpdateMember = (index: number, field: keyof TeamMember, value: string) => {
        const newMembers = members.map((member, i) =>
            i === index ? { ...member, [field]: value } : member
        );
        updateContent('members', newMembers);
    };

    const handleAddMember = () => {
        updateContent('members', [...members, { name: 'New Member', role: 'Role', image: '', bio: 'A brief bio about this team member.' }]);
    };

    const handleRemoveMember = (index: number) => {
        updateContent('members', members.filter((_, i) => i !== index));
    };

    const handleReorderMember = (fromIndex: number, toIndex: number) => {
        updateContent('members', reorderItems(members, fromIndex, toIndex));
    };

    const getMemberDragHandlers = (index: number) => ({
        onDragOver: (event: React.DragEvent) => {
            if (!isEditMode || draggedIndex === null) return;
            event.preventDefault();
            setDragOverIndex(index);
        },
        onDrop: (event: React.DragEvent) => {
            if (!isEditMode || draggedIndex === null) return;
            event.preventDefault();
            handleReorderMember(draggedIndex, index);
            setDraggedIndex(null);
            setDragOverIndex(null);
        },
    });

    const renderMemberControls = (index: number) => isEditMode ? (
        <InlineCardControls
            canRemove={members.length > 1}
            dragData={`member-${index}`}
            dragTitle="Drag to reorder team member"
            removeTitle="Delete team member"
            onDragStart={() => {
                setDraggedIndex(index);
                setDragOverIndex(null);
            }}
            onDragEnd={() => {
                setDraggedIndex(null);
                setDragOverIndex(null);
            }}
            onRemove={() => handleRemoveMember(index)}
        />
    ) : null;

    const getMemberCardStateClass = (index: number) => {
        const isDragging = draggedIndex === index;
        const isDragTarget = dragOverIndex === index && draggedIndex !== index;
        return `${isDragTarget ? 'ring-2 ring-blue-100 border-blue-300' : ''} ${isDragging ? 'scale-[0.99] opacity-60' : ''}`;
    };

    const getGridCols = (fallback2: string, fallback3: string, fallback4: string) => {
        if (columns === 2) return 'grid-cols-2';
        if (columns === 3) return 'md:grid-cols-3';
        if (columns === 4) return 'grid-cols-2 md:grid-cols-4';
        // auto
        if (members.length === 2) return fallback2;
        if (members.length >= 4) return fallback4;
        return fallback3;
    };

    if (variant === 'minimal') {
        return (
            <section className="py-24" style={{ backgroundColor: bgColor }}>
                <div className="max-w-5xl mx-auto px-4">
                    <EditableText
                        as="h2"
                        contentKey="title"
                        content={data.title}
                        defaultValue="Our Team"
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="text-4xl font-bold text-center mb-16"
                        style={{ color: fgOverride || pPrimary }}
                    />
                    <div className="space-y-8">
                        {members.map((member, index) => (
                            <div
                                key={index}
                                className={`flex items-center gap-6 group/card relative rounded-xl border border-transparent p-2 transition-[border-color,box-shadow,opacity,transform] ${getMemberCardStateClass(index)}`}
                                {...getMemberDragHandlers(index)}
                            >
                                {renderMemberControls(index)}
                                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-full">
                                    <EditableImage
                                        contentKey={`member_${index}_image`}
                                        initialSettings={getImageSettings(data, `member_${index}_image__settings`)}
                                        imageUrl={member.image}
                                        isEditMode={isEditMode}
                                        onSave={(key, value) => { if (key === `member_${index}_image`) handleUpdateMember(index, 'image', value); }}
                                        onUpload={context?.uploadImage}
                                        className="h-full w-full object-cover bg-gray-200"
                                        placeholder="Photo"
                                        editOverlayStyle="icon"
                                        fallback={
                                            <div className="flex h-16 w-16 items-center justify-center bg-gray-200">
                                                <User className="w-8 h-8 text-gray-400" />
                                            </div>
                                        }
                                    />
                                </div>
                                <div className="flex-1">
                                    <EditableText
                                        as="h3"
                                        contentKey={`member_${index}_name`}
                                        content={member.name}
                                        defaultValue={`Team Member ${index + 1}`}
                                        isEditMode={isEditMode}
                                        onSave={(_key, value) => handleUpdateMember(index, 'name', value)}
                                        className="text-lg font-bold"
                                        style={{ color: fgOverride || pPrimary }}
                                    />
                                    <EditableText
                                        as="p"
                                        contentKey={`member_${index}_role`}
                                        content={member.role}
                                        defaultValue="Role"
                                        isEditMode={isEditMode}
                                        onSave={(_key, value) => handleUpdateMember(index, 'role', value)}
                                        className="text-sm"
                                        style={{ color: pSecondary }}
                                    />
                                    {showBio && (
                                        <EditableText
                                            as="p"
                                            contentKey={`member_${index}_bio`}
                                            content={member.bio}
                                            defaultValue="A brief bio..."
                                            isEditMode={isEditMode}
                                            onSave={(_key, value) => handleUpdateMember(index, 'bio', value)}
                                            className="text-sm mt-2 max-w-2xl"
                                            style={{ color: fgOverride || pPrimary, opacity: 0.6 }}
                                        />
                                    )}
                                </div>
                            </div>
                        ))}
                        {isEditMode && (
                            <button
                                onClick={handleAddMember}
                                className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 hover:border-gray-400 rounded-lg text-sm text-gray-500 hover:text-gray-700 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Add Team Member
                            </button>
                        )}
                    </div>
                </div>
            </section>
        );
    }

    if (variant === 'cards') {
        return (
            <section className="py-24" style={{ backgroundColor: cardBgColor }}>
                <div className="max-w-7xl mx-auto px-4">
                    <EditableText
                        as="h2"
                        contentKey="title"
                        content={data.title}
                        defaultValue="Meet Our Team"
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="text-4xl font-bold text-center mb-4"
                        style={{ color: fgOverride || pPrimary }}
                    />
                    <EditableText
                        as="p"
                        contentKey="subtitle"
                        content={data.subtitle}
                        defaultValue="The people behind our success."
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="text-lg text-center mb-16 max-w-2xl mx-auto"
                        style={{ color: fgOverride || pPrimary, opacity: 0.6 }}
                    />
                    <div className={`grid gap-8 ${getGridCols('md:grid-cols-2 max-w-4xl mx-auto', 'md:grid-cols-3', 'md:grid-cols-2 lg:grid-cols-4')}`}>
                        {members.map((member, index) => (
                            <div
                                key={index}
                                className={`relative group/card bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-lg transition-[border-color,box-shadow,opacity,transform] ${getMemberCardStateClass(index)}`}
                                {...getMemberDragHandlers(index)}
                            >
                                {renderMemberControls(index)}
                                <div className="h-64 w-full flex-shrink-0">
                                    <EditableImage
                                        contentKey={`member_${index}_image`}
                                        initialSettings={getImageSettings(data, `member_${index}_image__settings`)}
                                        imageUrl={member.image}
                                        isEditMode={isEditMode}
                                        onSave={(key, value) => { if (key === `member_${index}_image`) handleUpdateMember(index, 'image', value); }}
                                        onUpload={context?.uploadImage}
                                        className="w-full h-full object-cover bg-gray-200"
                                        placeholder="Team member photo"
                                        fallback={
                                            <div className="flex h-64 w-full items-center justify-center bg-gray-200">
                                                <User className="w-16 h-16 text-gray-400" />
                                            </div>
                                        }
                                    />
                                </div>
                                <div className="p-6">
                                    <EditableText
                                        as="h3"
                                        contentKey={`member_${index}_name`}
                                        content={member.name}
                                        defaultValue={`Team Member ${index + 1}`}
                                        isEditMode={isEditMode}
                                        onSave={(_key, value) => handleUpdateMember(index, 'name', value)}
                                        className="text-xl font-bold mb-1"
                                        style={{ color: pPrimary }}
                                    />
                                    <EditableText
                                        as="p"
                                        contentKey={`member_${index}_role`}
                                        content={member.role}
                                        defaultValue="Role"
                                        isEditMode={isEditMode}
                                        onSave={(_key, value) => handleUpdateMember(index, 'role', value)}
                                        className="text-sm font-semibold mb-3"
                                        style={{ color: pSecondary }}
                                    />
                                    {showBio && (
                                        <EditableText
                                            as="p"
                                            contentKey={`member_${index}_bio`}
                                            content={member.bio}
                                            defaultValue="A brief bio about this team member."
                                            isEditMode={isEditMode}
                                            onSave={(_key, value) => handleUpdateMember(index, 'bio', value)}
                                            className="text-sm leading-relaxed"
                                            style={{ color: pPrimary, opacity: 0.6 }}
                                        />
                                    )}
                                </div>
                            </div>
                        ))}
                        {isEditMode && (
                            <button
                                onClick={handleAddMember}
                                className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 hover:border-gray-400 rounded-2xl p-8 text-gray-400 hover:text-gray-600 transition-colors min-h-[200px]"
                            >
                                <Plus className="w-6 h-6" />
                                <span className="text-sm font-medium">Add Member</span>
                            </button>
                        )}
                    </div>
                </div>
            </section>
        );
    }

    // Grid variant (default) — centered circular photos
    return (
        <section className="py-24" style={{ backgroundColor: bgColor }}>
            <div className="max-w-7xl mx-auto px-4">
                <EditableText
                    as="h2"
                    contentKey="title"
                    content={data.title}
                    defaultValue="Meet Our Team"
                    isEditMode={isEditMode}
                    onSave={(key, value) => updateContent(key, value)}
                    className="text-4xl font-bold text-center mb-4"
                    style={{ color: fgOverride || pPrimary }}
                />
                <EditableText
                    as="p"
                    contentKey="subtitle"
                    content={data.subtitle}
                    defaultValue="The people behind our success."
                    isEditMode={isEditMode}
                    onSave={(key, value) => updateContent(key, value)}
                    className="text-lg text-center mb-16 max-w-2xl mx-auto"
                    style={{ color: fgOverride || pPrimary, opacity: 0.6 }}
                />
                <div className={`grid gap-12 ${getGridCols('md:grid-cols-2 max-w-3xl mx-auto', 'md:grid-cols-3', 'grid-cols-2 md:grid-cols-4')}`}>
                    {members.map((member, index) => (
                        <div
                            key={index}
                            className={`text-center group/card relative rounded-2xl border border-transparent p-2 transition-[border-color,box-shadow,opacity,transform] ${getMemberCardStateClass(index)}`}
                            {...getMemberDragHandlers(index)}
                        >
                            {renderMemberControls(index)}
                            <div className="mx-auto mb-4 h-32 w-32 overflow-hidden rounded-full bg-gray-200 ring-4 ring-white shadow-lg transition-transform group-hover/card:scale-105">
                                <EditableImage
                                    contentKey={`member_${index}_image`}
                                    initialSettings={getImageSettings(data, `member_${index}_image__settings`)}
                                    imageUrl={member.image}
                                    isEditMode={isEditMode}
                                    onSave={(key, value) => { if (key === `member_${index}_image`) handleUpdateMember(index, 'image', value); }}
                                    onUpload={context?.uploadImage}
                                    className="h-full w-full object-cover bg-gray-200"
                                    placeholder="Photo"
                                    fallback={
                                        <div className="flex h-32 w-32 items-center justify-center bg-gray-200">
                                            <User className="w-12 h-12 text-gray-400" />
                                        </div>
                                    }
                                />
                            </div>
                            <EditableText
                                as="h3"
                                contentKey={`member_${index}_name`}
                                content={member.name}
                                defaultValue={`Team Member ${index + 1}`}
                                isEditMode={isEditMode}
                                onSave={(_key, value) => handleUpdateMember(index, 'name', value)}
                                className="text-lg font-bold mb-1"
                                style={{ color: fgOverride || pPrimary }}
                            />
                            <EditableText
                                as="p"
                                contentKey={`member_${index}_role`}
                                content={member.role}
                                defaultValue="Role"
                                isEditMode={isEditMode}
                                onSave={(_key, value) => handleUpdateMember(index, 'role', value)}
                                className="text-sm font-medium"
                                style={{ color: pSecondary }}
                            />
                            {showBio && (
                                <EditableText
                                    as="p"
                                    contentKey={`member_${index}_bio`}
                                    content={member.bio}
                                    defaultValue="A brief bio..."
                                    isEditMode={isEditMode}
                                    onSave={(_key, value) => handleUpdateMember(index, 'bio', value)}
                                    className={`text-xs mt-2 opacity-60 ${isEditMode ? 'relative z-20 overflow-visible' : 'line-clamp-3'}`}
                                    style={{ color: fgOverride || pPrimary }}
                                />
                            )}
                        </div>
                    ))}
                    {isEditMode && (
                        <div className="text-center">
                            <button
                                onClick={handleAddMember}
                                className="w-32 h-32 rounded-full border-2 border-dashed border-gray-300 hover:border-gray-400 mx-auto mb-4 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <Plus className="w-6 h-6" />
                            </button>
                            <span className="text-sm text-gray-400">Add Member</span>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

function getImageSettings(data: TeamBlockData, key: string): ImageSettings | undefined {
    const value = data[key];
    return typeof value === 'object' && value !== null ? value as ImageSettings : undefined;
}
