'use client';

import React from 'react';
import EditableText from '../EditableText';
import EditableImage from '../EditableImage';
import { useEditorContext } from '@/lib/editor-context';
import Reveal from '@/app/components/Reveal';
import { Plus, X } from 'lucide-react';

interface FeaturedQuoteBlockProps {
    id: string;
    data: any;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: (key: string, value: any) => void;
}

export default function FeaturedQuoteBlock({ id, data, isEditMode, palette, updateContent }: FeaturedQuoteBlockProps) {
    const context = useEditorContext();
    const pPrimary = palette.primary || '#1f2937';
    const pSecondary = palette.secondary || '#dc2626';
    const pAccent = palette.accent || '#f3f4f6';

    const variant = data.variant || 'centered';
    const bgColor = data.backgroundColor || pAccent;

    if (variant === 'multiGrid') {
        return (
            <MultiGridVariant
                data={data}
                isEditMode={isEditMode}
                updateContent={updateContent}
                uploadImage={context?.uploadImage}
                pPrimary={pPrimary}
                pSecondary={pSecondary}
                bgColor={bgColor}
            />
        );
    }

    if (variant === 'essay') {
        return (
            <EssayVariant
                data={data}
                isEditMode={isEditMode}
                updateContent={updateContent}
                uploadImage={context?.uploadImage}
                pPrimary={pPrimary}
                pSecondary={pSecondary}
                bgColor={bgColor}
            />
        );
    }

    if (variant === 'split') {
        return (
            <SplitVariant
                data={data}
                isEditMode={isEditMode}
                updateContent={updateContent}
                uploadImage={context?.uploadImage}
                pPrimary={pPrimary}
                pSecondary={pSecondary}
                bgColor={bgColor}
            />
        );
    }

    if (variant === 'minimal') {
        return (
            <MinimalVariant
                data={data}
                isEditMode={isEditMode}
                updateContent={updateContent}
                uploadImage={context?.uploadImage}
                pPrimary={pPrimary}
                pSecondary={pSecondary}
                bgColor={bgColor}
            />
        );
    }

    // Default: centered
    return (
        <CenteredVariant
            data={data}
            isEditMode={isEditMode}
            updateContent={updateContent}
            uploadImage={context?.uploadImage}
            pPrimary={pPrimary}
            pSecondary={pSecondary}
            bgColor={bgColor}
        />
    );
}

function QuoteLeft({ color, className = '' }: { color: string; className?: string }) {
    return (
        <svg aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className={className} style={{ color, display: 'block', flexShrink: 0 }}>
            <path fill="currentColor" d="M464 256h-80v-64c0-35.3 28.7-64 64-64h8c13.3 0 24-10.7 24-24V56c0-13.3-10.7-24-24-24h-8c-88.4 0-160 71.6-160 160v240c0 26.5 21.5 48 48 48h128c26.5 0 48-21.5 48-48V304c0-26.5-21.5-48-48-48zm-288 0H96v-64c0-35.3 28.7-64 64-64h8c13.3 0 24-10.7 24-24V56c0-13.3-10.7-24-24-24h-8C71.6 32 0 103.6 0 192v240c0 26.5 21.5 48 48 48h128c26.5 0 48-21.5 48-48V304c0-26.5-21.5-48-48-48z" />
        </svg>
    );
}

function QuoteRight({ color, className = '' }: { color: string; className?: string }) {
    return (
        <svg aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className={className} style={{ color, display: 'block', flexShrink: 0 }}>
            <path fill="currentColor" d="M464 32H336c-26.5 0-48 21.5-48 48v128c0 26.5 21.5 48 48 48h80v64c0 35.3-28.7 64-64 64h-8c-13.3 0-24 10.7-24 24v48c0 13.3 10.7 24 24 24h8c88.4 0 160-71.6 160-160V80c0-26.5-21.5-48-48-48zm-288 0H48C21.5 32 0 53.5 0 80v128c0 26.5 21.5 48 48 48h80v64c0 35.3-28.7 64-64 64h-8c-13.3 0-24 10.7-24 24v48c0 13.3 10.7 24 24 24h8c88.4 0 160-71.6 160-160V80c0-26.5-21.5-48-48-48z" />
        </svg>
    );
}

// ─── Essay / Longform Variant ────────────────────────────────────────────────

function EssayVariant({ data, isEditMode, updateContent, uploadImage, pPrimary, pSecondary, bgColor }: any) {
    const floatRight = data.imagePosition !== 'left';
    const separatorColor = `${pPrimary}22`;

    return (
        <section className="py-24" style={{ backgroundColor: bgColor }}>
            <div className="max-w-6xl mx-auto px-6">

                {/* Eyebrow + Title */}
                <Reveal>
                    <EditableText
                        as="p"
                        contentKey="eyebrow"
                        content={data.eyebrow}
                        defaultValue="Featured Voice"
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="text-xs font-bold uppercase tracking-[0.2em] mb-3"
                        style={{ color: pSecondary }}
                    />
                    <EditableText
                        as="h2"
                        contentKey="title"
                        content={data.title}
                        defaultValue="In Their Own Words"
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="text-3xl md:text-4xl font-bold leading-tight mb-8"
                        style={{ color: pPrimary }}
                    />
                </Reveal>

                {/* Opening quote mark */}
                <Reveal>
                    <QuoteLeft color={pSecondary} className="w-16 h-16 md:w-20 md:h-20 mb-4" />
                </Reveal>

                {/* Float container — photo wraps with essay text */}
                <Reveal>
                    <div className="overflow-hidden">
                        {/* Floating photo */}
                        <div
                            className={`
                                mb-6 w-full
                                md:w-64 lg:w-80
                                md:mb-4
                                ${floatRight ? 'md:float-right md:ml-10' : 'md:float-left md:mr-10'}
                            `}
                        >
                            <EditableImage
                                contentKey="personImage"
                                imageUrl={data.personImage}
                                isEditMode={isEditMode}
                                onSave={(key, value) => updateContent(key, value)}
                                onUpload={uploadImage}
                                className="w-full aspect-[3/4] object-cover rounded-2xl shadow-xl bg-gray-200"
                                placeholder="Click to upload photo"
                            />
                        </div>

                        {/* Essay / long quote text */}
                        <EditableText
                            as="p"
                            contentKey="quote"
                            content={data.quote}
                            defaultValue="Over the course of a lifetime, you encounter moments that quietly reshape the way you see the world. For me, this work has always been about more than results — it has been about people. The relationships built, the trust earned, the small acts of courage that accumulate into something much larger than any of us could have imagined alone. I have learned that the most enduring thing we can leave behind is not a product or a profit margin, but a culture — a way of treating one another with honesty and care, even when it is difficult, especially when it is difficult. That belief has guided every decision I have made, and I carry it with me still."
                            isEditMode={isEditMode}
                            onSave={(key, value) => updateContent(key, value)}
                            className="text-base md:text-lg leading-[1.85] italic"
                            style={{ color: pPrimary }}
                        />
                    </div>
                </Reveal>

                {/* Closing quote mark */}
                <Reveal>
                    <div className="mt-2 mb-8">
                        <QuoteRight color={pSecondary} className="w-16 h-16 md:w-20 md:h-20" />
                    </div>
                </Reveal>

                {/* Attribution */}
                <Reveal>
                    <div
                        className="pt-8 border-t flex items-center gap-5"
                        style={{ borderColor: separatorColor }}
                    >
                        <div
                            className="w-1 h-12 rounded-full flex-shrink-0"
                            style={{ backgroundColor: pSecondary }}
                        />
                        <div>
                            <EditableText
                                as="p"
                                contentKey="personName"
                                content={data.personName}
                                defaultValue="Jane Smith"
                                isEditMode={isEditMode}
                                onSave={(key, value) => updateContent(key, value)}
                                className="font-bold text-base"
                                style={{ color: pPrimary }}
                            />
                            <EditableText
                                as="p"
                                contentKey="personTitle"
                                content={data.personTitle}
                                defaultValue="CEO, Acme Corp"
                                isEditMode={isEditMode}
                                onSave={(key, value) => updateContent(key, value)}
                                className="text-sm mt-0.5"
                                style={{ color: pPrimary, opacity: 0.55 }}
                            />
                            <EditableText
                                as="p"
                                contentKey="personContext"
                                content={data.personContext}
                                defaultValue="From the 2024 Annual Letter"
                                isEditMode={isEditMode}
                                onSave={(key, value) => updateContent(key, value)}
                                className="text-xs mt-1 italic"
                                style={{ color: pSecondary, opacity: 0.8 }}
                            />
                        </div>
                    </div>
                </Reveal>

            </div>
        </section>
    );
}

// ─── Centered Variant ────────────────────────────────────────────────────────

function CenteredVariant({ data, isEditMode, updateContent, uploadImage, pPrimary, pSecondary, bgColor }: any) {
    return (
        <section className="py-24" style={{ backgroundColor: bgColor }}>
            <div className="max-w-5xl mx-auto px-6 text-center">
                <Reveal>
                    <div className="flex justify-center mb-4">
                        <QuoteLeft color={pSecondary} className="w-14 h-14 md:w-16 md:h-16" />
                    </div>
                </Reveal>

                <Reveal>
                    <EditableText
                        as="p"
                        contentKey="quote"
                        content={data.quote}
                        defaultValue="The best investment you can make is in yourself. The more you learn, the more you earn."
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="text-xl md:text-2xl lg:text-3xl font-medium italic leading-relaxed mb-10"
                        style={{ color: pPrimary }}
                    />
                </Reveal>

                <Reveal>
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                            <EditableImage
                                contentKey="personImage"
                                imageUrl={data.personImage}
                                isEditMode={isEditMode}
                                onSave={(key, value) => updateContent(key, value)}
                                onUpload={uploadImage}
                                className="w-full h-full object-cover"
                                placeholder="Photo"
                                editOverlayStyle="icon"
                            />
                        </div>
                        <div>
                            <EditableText
                                as="p"
                                contentKey="personName"
                                content={data.personName}
                                defaultValue="Jane Smith"
                                isEditMode={isEditMode}
                                onSave={(key, value) => updateContent(key, value)}
                                className="font-bold text-base"
                                style={{ color: pPrimary }}
                            />
                            <EditableText
                                as="p"
                                contentKey="personTitle"
                                content={data.personTitle}
                                defaultValue="CEO, Acme Corp"
                                isEditMode={isEditMode}
                                onSave={(key, value) => updateContent(key, value)}
                                className="text-sm mt-0.5"
                                style={{ color: pPrimary, opacity: 0.55 }}
                            />
                        </div>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

// ─── Split Variant ───────────────────────────────────────────────────────────

function SplitVariant({ data, isEditMode, updateContent, uploadImage, pPrimary, pSecondary, bgColor }: any) {
    const imageRight = data.imagePosition === 'right';

    const imageCol = (
        <Reveal className="relative h-full min-h-64">
            <EditableImage
                contentKey="personImage"
                imageUrl={data.personImage}
                isEditMode={isEditMode}
                onSave={(key, value) => updateContent(key, value)}
                onUpload={uploadImage}
                className="w-full h-full object-cover rounded-2xl min-h-64 bg-gray-200"
                placeholder="Click to upload photo"
            />
        </Reveal>
    );

    const textCol = (
        <Reveal className="flex flex-col justify-center py-4">
            <QuoteLeft color={pSecondary} className="w-12 h-12 mb-4" />
            <EditableText
                as="p"
                contentKey="quote"
                content={data.quote}
                defaultValue="The best investment you can make is in yourself. The more you learn, the more you earn."
                isEditMode={isEditMode}
                onSave={(key, value) => updateContent(key, value)}
                className="text-xl md:text-2xl font-medium italic leading-relaxed mb-8"
                style={{ color: pPrimary }}
            />
            <div className="flex items-center gap-4">
                <div className="w-1 self-stretch rounded-full" style={{ backgroundColor: pSecondary }} />
                <div>
                    <EditableText
                        as="p"
                        contentKey="personName"
                        content={data.personName}
                        defaultValue="Jane Smith"
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="font-bold text-base"
                        style={{ color: pPrimary }}
                    />
                    <EditableText
                        as="p"
                        contentKey="personTitle"
                        content={data.personTitle}
                        defaultValue="CEO, Acme Corp"
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="text-sm mt-0.5"
                        style={{ color: pPrimary, opacity: 0.55 }}
                    />
                </div>
            </div>
        </Reveal>
    );

    return (
        <section className="py-24" style={{ backgroundColor: bgColor }}>
            <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-stretch">
                {imageRight ? <>{textCol}{imageCol}</> : <>{imageCol}{textCol}</>}
            </div>
        </section>
    );
}

// ─── Multi-Person Grid Variant ───────────────────────────────────────────────

const DEFAULT_MULTI_PEOPLE = [
    {
        name: 'Jane Smith',
        title: 'CEO, Acme Corp',
        quote: '"The best investment you can make is in yourself. The more you learn, the more you earn."',
        image: '',
    },
    {
        name: 'John Doe',
        title: 'Lead Engineer',
        quote: '"Great things in business are never done by one person — they\'re done by a team of people."',
        image: '',
    },
    {
        name: 'Maria Garcia',
        title: 'Head of Design',
        quote: '"Design is not just what it looks like. Design is how it works."',
        image: '',
    },
    {
        name: 'Alex Kim',
        title: 'Product Manager',
        quote: '"Every product decision is ultimately a bet on what your users value most."',
        image: '',
    },
];

function MultiGridVariant({ data, isEditMode, updateContent, uploadImage, pPrimary, pSecondary, bgColor }: any) {
    const people: any[] = data.people || DEFAULT_MULTI_PEOPLE;

    const handleUpdatePerson = (index: number, field: string, value: string) => {
        const updated = people.map((p: any, i: number) =>
            i === index ? { ...p, [field]: value } : p
        );
        updateContent('people', updated);
    };

    const handleAddPerson = () => {
        updateContent('people', [
            ...people,
            {
                name: 'New Person',
                title: 'Title / Role',
                quote: '"Add a quote here."',
                image: '',
            },
        ]);
    };

    const handleRemovePerson = (index: number) => {
        if (people.length <= 1) return;
        updateContent('people', people.filter((_: any, i: number) => i !== index));
    };

    return (
        <section className="py-20" style={{ backgroundColor: bgColor }}>
            <div className="max-w-6xl mx-auto px-6">

                {/* Section heading */}
                <Reveal>
                    <EditableText
                        as="h2"
                        contentKey="title"
                        content={data.title}
                        defaultValue="Our Members Talk About Nursing"
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="text-3xl md:text-4xl font-bold text-center mb-14"
                        style={{ color: pPrimary }}
                    />
                </Reveal>

                {/* 2-column grid */}
                <div className="grid md:grid-cols-2 gap-x-16 gap-y-12">
                    {people.map((person: any, index: number) => (
                        <Reveal key={index}>
                            <div className="relative flex gap-5 items-start">
                                {/* Remove button */}
                                {isEditMode && people.length > 1 && (
                                    <button
                                        onClick={() => handleRemovePerson(index)}
                                        className="absolute -top-2 -right-2 z-10 p-1 rounded-full bg-red-100 hover:bg-red-200 transition-colors"
                                        title="Remove person"
                                    >
                                        <X className="w-3.5 h-3.5 text-red-600" />
                                    </button>
                                )}

                                {/* Circle photo */}
                                <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 mt-1">
                                    <EditableImage
                                        contentKey={`people[${index}].image`}
                                        imageUrl={person.image}
                                        isEditMode={isEditMode}
                                        onSave={(_key, value) => handleUpdatePerson(index, 'image', value)}
                                        onUpload={uploadImage}
                                        className="w-full h-full object-cover"
                                        placeholder="Photo"
                                        editOverlayStyle="icon"
                                    />
                                </div>

                                {/* Text */}
                                <div className="flex-1 min-w-0">
                                    <EditableText
                                        as="p"
                                        contentKey={`people[${index}].name`}
                                        content={person.name}
                                        defaultValue="Name"
                                        isEditMode={isEditMode}
                                        onSave={(_key, value) => handleUpdatePerson(index, 'name', value)}
                                        className="font-bold text-base leading-tight"
                                        style={{ color: pPrimary }}
                                    />
                                    <EditableText
                                        as="p"
                                        contentKey={`people[${index}].title`}
                                        content={person.title}
                                        defaultValue="Title"
                                        isEditMode={isEditMode}
                                        onSave={(_key, value) => handleUpdatePerson(index, 'title', value)}
                                        className="text-sm italic font-medium mt-0.5 mb-3"
                                        style={{ color: pSecondary }}
                                    />
                                    <EditableText
                                        as="p"
                                        contentKey={`people[${index}].quote`}
                                        content={person.quote}
                                        defaultValue='"Quote goes here."'
                                        isEditMode={isEditMode}
                                        onSave={(_key, value) => handleUpdatePerson(index, 'quote', value)}
                                        className="text-sm leading-relaxed"
                                        style={{ color: pPrimary }}
                                    />
                                </div>
                            </div>
                        </Reveal>
                    ))}
                </div>

                {/* Add person button */}
                {isEditMode && (
                    <div className="flex justify-center mt-10">
                        <button
                            onClick={handleAddPerson}
                            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg border-2 border-dashed transition-colors"
                            style={{ borderColor: pSecondary, color: pSecondary }}
                        >
                            <Plus className="w-4 h-4" />
                            Add Person
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}

// ─── Minimal Variant ─────────────────────────────────────────────────────────

function MinimalVariant({ data, isEditMode, updateContent, uploadImage, pPrimary, pSecondary, bgColor }: any) {
    return (
        <section className="py-20" style={{ backgroundColor: bgColor }}>
            <div className="max-w-4xl mx-auto px-6">
                <Reveal>
                    <div className="border-l-4 pl-6" style={{ borderColor: pSecondary }}>
                        <EditableText
                            as="p"
                            contentKey="quote"
                            content={data.quote}
                            defaultValue="The best investment you can make is in yourself."
                            isEditMode={isEditMode}
                            onSave={(key, value) => updateContent(key, value)}
                            className="text-lg md:text-xl italic leading-relaxed mb-6"
                            style={{ color: pPrimary }}
                        />
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                                <EditableImage
                                    contentKey="personImage"
                                    imageUrl={data.personImage}
                                    isEditMode={isEditMode}
                                    onSave={(key, value) => updateContent(key, value)}
                                    onUpload={uploadImage}
                                    className="w-full h-full object-cover"
                                    placeholder="Photo"
                                    editOverlayStyle="icon"
                                />
                            </div>
                            <div>
                                <EditableText
                                    as="p"
                                    contentKey="personName"
                                    content={data.personName}
                                    defaultValue="Jane Smith"
                                    isEditMode={isEditMode}
                                    onSave={(key, value) => updateContent(key, value)}
                                    className="font-semibold text-sm"
                                    style={{ color: pPrimary }}
                                />
                                <EditableText
                                    as="p"
                                    contentKey="personTitle"
                                    content={data.personTitle}
                                    defaultValue="CEO, Acme Corp"
                                    isEditMode={isEditMode}
                                    onSave={(key, value) => updateContent(key, value)}
                                    className="text-xs mt-0.5"
                                    style={{ color: pPrimary, opacity: 0.55 }}
                                />
                            </div>
                        </div>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}
