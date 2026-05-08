'use client';

import React from 'react';
import EditableText from '../EditableText';
import { ChevronLeft, ChevronRight, Plus, Star } from 'lucide-react';
import Reveal from '@/app/components/Reveal';
import { resolvePaletteColor } from '@/lib/palette-colors';
import InlineCardControls, { reorderItems } from './InlineCardControls';

interface TestimonialsBlockProps {
    id: string;
    data: any;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: (key: string, value: any) => void;
}

interface TestimonialItem {
    name?: string;
    role?: string;
    quote?: string;
    rating?: number;
}

const DEFAULT_TESTIMONIALS: TestimonialItem[] = [
    { name: 'Sarah M.', role: 'Homeowner', quote: 'Absolutely outstanding service! They arrived on time, explained everything clearly, and the quality of work exceeded our expectations.', rating: 5 },
    { name: 'James R.', role: 'Business Owner', quote: 'Professional, reliable, and reasonably priced. I\'ve been a loyal customer for years and always recommend them to everyone.', rating: 5 },
    { name: 'Lisa K.', role: 'Property Manager', quote: 'They handle all our properties and never disappoint. Quick response time and excellent craftsmanship on every job.', rating: 5 },
];

const TESTIMONIAL_CAROUSEL_PER_PAGE = 3;

export default function TestimonialsBlock({ id, data, isEditMode, palette, updateContent }: TestimonialsBlockProps) {
    const pPrimary = palette.primary || '#1f2937';
    const pSecondary = palette.secondary || '#dc2626';
    const pAccent = palette.accent || '#f3f4f6';
    const bgColor = resolvePaletteColor(data.backgroundColor, palette, '');

    const variant = data.variant || 'cards'; // 'cards' | 'scroll' | 'single'
    const items: TestimonialItem[] = Array.isArray(data.items) && data.items.length ? data.items : DEFAULT_TESTIMONIALS;
    const [showAllTestimonials, setShowAllTestimonials] = React.useState(false);
    const [testimonialScrollIndex, setTestimonialScrollIndex] = React.useState(0);
    const [isLoopResetting, setIsLoopResetting] = React.useState(false);
    const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);
    const isScrollLayout = variant === 'scroll';
    const autoScrollTestimonials = data.autoScroll === true;
    const infiniteScrollTestimonials = data.infiniteScroll === true;
    const loopScrollTestimonials = data.loopScroll === true;
    const requestedInterval = Number(data.interval);
    const autoScrollIntervalSec = Math.max(2, Math.min(15, Number.isFinite(requestedInterval) ? requestedInterval : 5));
    const autoScrollIntervalMs = autoScrollIntervalSec * 1000;
    const requestedVisibleCount = Number(data.visibleCount);
    const visibleCount = Number.isFinite(requestedVisibleCount)
        ? Math.max(1, Math.min(items.length || 1, Math.floor(requestedVisibleCount)))
        : Math.min(3, items.length || 3);
    const shouldLimitCards = data.showMoreEnabled === true && !isScrollLayout && items.length > visibleCount;
    const testimonialEntries: Array<{ item: TestimonialItem; index: number }> = items.map((item, index) => ({ item, index }));
    const visibleEntries = shouldLimitCards && !showAllTestimonials
        ? testimonialEntries.slice(0, visibleCount)
        : testimonialEntries;
    const carouselPerPage = items.length <= 1
        ? 1
        : Math.min(TESTIMONIAL_CAROUSEL_PER_PAGE, items.length - 1);
    const maxScrollIndex = Math.max(0, items.length - carouselPerPage);
    const currentScrollIndex = Math.min(testimonialScrollIndex, maxScrollIndex);
    const showScrollNav = items.length > carouselPerPage;
    const useInfiniteScroll = isScrollLayout && autoScrollTestimonials && infiniteScrollTestimonials && items.length > 1;
    const useLoopScroll = isScrollLayout && autoScrollTestimonials && loopScrollTestimonials && !infiniteScrollTestimonials && items.length > 1;
    const loopTrackEntries: Array<{ item: TestimonialItem; index: number; isClone: boolean; key: string }> = useLoopScroll
        ? [
            ...testimonialEntries.map(({ item, index }) => ({ item, index, isClone: false, key: `original-${index}` })),
            ...testimonialEntries.slice(0, carouselPerPage).map(({ item, index }) => ({ item, index, isClone: true, key: `clone-${index}` })),
        ]
        : testimonialEntries.map(({ item, index }) => ({ item, index, isClone: false, key: `original-${index}` }));
    const loopMaxScrollIndex = Math.max(0, items.length - 1);
    const displayScrollIndex = useLoopScroll
        ? (testimonialScrollIndex >= items.length ? 0 : Math.min(testimonialScrollIndex, loopMaxScrollIndex))
        : currentScrollIndex;
    const trackScrollIndex = useLoopScroll
        ? Math.min(testimonialScrollIndex, items.length)
        : currentScrollIndex;
    const carouselTrackItemCount = useLoopScroll ? loopTrackEntries.length : items.length;
    const safeAnimationId = id.replace(/[^a-zA-Z0-9_-]/g, '') || 'testimonials';
    const infiniteTrackClassName = `ks-testimonials-infinite-${safeAnimationId}`;
    const infiniteAnimationName = `ksTestimonialsInfinite${safeAnimationId}`;
    const infiniteAnimationDurationSec = Math.max(18, Math.min(90, items.length * autoScrollIntervalSec * 1.5));
    const carouselTrackStyle: React.CSSProperties = {
        display: 'flex',
        width: `${carouselTrackItemCount * 100 / carouselPerPage}%`,
        transform: `translateX(-${trackScrollIndex * 100 / carouselTrackItemCount}%)`,
        transition: useLoopScroll && isLoopResetting ? 'none' : 'transform 500ms cubic-bezier(0.22,1,0.36,1)',
    };
    const carouselItemStyle: React.CSSProperties = {
        width: `${100 / carouselTrackItemCount}%`,
        flexShrink: 0,
    };

    React.useEffect(() => {
        if (!isScrollLayout || useInfiniteScroll || !autoScrollTestimonials || !showScrollNav) return;

        const intervalId = window.setInterval(() => {
            setTestimonialScrollIndex((current) => {
                if (useLoopScroll) return current >= loopMaxScrollIndex ? items.length : current + 1;
                return current >= maxScrollIndex ? 0 : current + 1;
            });
        }, autoScrollIntervalMs);

        return () => window.clearInterval(intervalId);
    }, [autoScrollIntervalMs, autoScrollTestimonials, isScrollLayout, items.length, loopMaxScrollIndex, maxScrollIndex, showScrollNav, useInfiniteScroll, useLoopScroll]);

    React.useEffect(() => {
        if (!useLoopScroll || testimonialScrollIndex !== items.length) return;

        const resetTimeout = window.setTimeout(() => {
            setIsLoopResetting(true);
            setTestimonialScrollIndex(0);
            window.requestAnimationFrame(() => {
                window.requestAnimationFrame(() => setIsLoopResetting(false));
            });
        }, 520);

        return () => window.clearTimeout(resetTimeout);
    }, [items.length, testimonialScrollIndex, useLoopScroll]);

    const handleAddItem = () => {
        const nextItems = [
            ...items,
            {
                name: `Client ${items.length + 1}`,
                role: 'Satisfied Customer',
                quote: 'Share what this customer loved about working with you.',
                rating: 5,
            },
        ];
        updateContent('items', nextItems);
        setTestimonialScrollIndex(Math.max(0, nextItems.length - carouselPerPage));
    };

    const handleRemoveItem = (index: number) => {
        if (items.length <= 1) return;
        const nextItems = items.filter((_: any, i: number) => i !== index);
        updateContent('items', nextItems);
        setTestimonialScrollIndex((current) => Math.min(current, Math.max(0, nextItems.length - carouselPerPage)));
    };

    const handleUpdateItem = (index: number, field: string, value: string) => {
        const newItems = items.map((item, i: number) =>
            i === index ? { ...item, [field]: value } : item
        );
        updateContent('items', newItems);
    };

    const handleReorderItem = (fromIndex: number, toIndex: number) => {
        updateContent('items', reorderItems(items, fromIndex, toIndex));
        setTestimonialScrollIndex((current) => Math.min(current, Math.max(0, items.length - carouselPerPage)));
    };

    const renderStars = (rating: number) => (
        <div className="flex gap-0.5 mb-3">
            {Array.from({ length: 5 }).map((_, i) => (
                <Star
                    key={i}
                    className="w-4 h-4"
                    fill={i < rating ? '#facc15' : 'none'}
                    stroke={i < rating ? '#facc15' : '#d1d5db'}
                />
            ))}
        </div>
    );

    const renderCarouselDots = (count: number) => (
        <div className="flex items-center gap-2">
            {Array.from({ length: count }).map((_, i) => (
                <button
                    key={i}
                    type="button"
                    aria-label={`Show testimonial group ${i + 1}`}
                    onClick={() => setTestimonialScrollIndex(i)}
                    className="rounded-full transition-all duration-300"
                    style={{
                        width: i === displayScrollIndex ? '20px' : '8px',
                        height: '8px',
                        opacity: i === displayScrollIndex ? 1 : 0.3,
                        backgroundColor: pSecondary,
                    }}
                />
            ))}
        </div>
    );

    const renderCarouselArrow = (dir: 'prev' | 'next', disabled: boolean) => (
        <button
            type="button"
            aria-label={dir === 'prev' ? 'Previous testimonials' : 'Next testimonials'}
            disabled={disabled}
            onClick={() => {
                setTestimonialScrollIndex((current) => {
                    if (useLoopScroll) {
                        if (dir === 'prev') return Math.max(0, displayScrollIndex - 1);
                        return current >= loopMaxScrollIndex ? items.length : current + 1;
                    }
                    return dir === 'prev'
                        ? Math.max(0, currentScrollIndex - 1)
                        : Math.min(maxScrollIndex, currentScrollIndex + 1);
                });
            }}
            className={`flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 transition-all ${disabled ? 'cursor-not-allowed opacity-25' : 'bg-white shadow-sm hover:bg-slate-50 hover:shadow'}`}
            style={{ color: pPrimary }}
        >
            {dir === 'prev' ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </button>
    );

    const renderTestimonialCard = (item: TestimonialItem, index: number, extraClassName = '', isClone = false) => {
        const quote = item.quote || 'Great service and outstanding results!';
        const name = item.name || `Client ${index + 1}`;
        const role = item.role || 'Satisfied Customer';
        const isDragging = draggedIndex === index;
        const isDragTarget = dragOverIndex === index && draggedIndex !== index && !isClone;

        return (
        <Reveal
            key={index}
            className={`bg-white rounded-2xl p-8 shadow-sm border hover:shadow-lg transition-[border-color,box-shadow,opacity,transform] relative group/card ${
                isDragTarget ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-100'
            } ${isDragging && !isClone ? 'scale-[0.99] opacity-60' : ''} ${extraClassName}`}
            onDragOver={(event) => {
                if (!isEditMode || isClone || draggedIndex === null) return;
                event.preventDefault();
                setDragOverIndex(index);
            }}
            onDrop={(event) => {
                if (!isEditMode || isClone || draggedIndex === null) return;
                event.preventDefault();
                handleReorderItem(draggedIndex, index);
                setDraggedIndex(null);
                setDragOverIndex(null);
            }}
        >
            {isEditMode && !isClone && (
                <InlineCardControls
                    canRemove={items.length > 1}
                    dragData={`testimonial-${index}`}
                    dragTitle="Drag to reorder testimonial"
                    removeTitle="Delete testimonial"
                    onDragStart={() => {
                        setDraggedIndex(index);
                        setDragOverIndex(null);
                    }}
                    onDragEnd={() => {
                        setDraggedIndex(null);
                        setDragOverIndex(null);
                    }}
                    onRemove={() => handleRemoveItem(index)}
                />
            )}
            <div className="text-4xl leading-none mb-3 opacity-20" style={{ color: pSecondary }}>"</div>
            {renderStars(item.rating || 5)}
            {isClone ? (
                <p className="leading-relaxed mb-6" style={{ color: pPrimary, opacity: 0.7 }}>{quote}</p>
            ) : (
                <EditableText
                    as="p"
                    contentKey={`testimonial_${index}_quote`}
                    content={item.quote}
                    defaultValue="Great service and outstanding results!"
                    isEditMode={isEditMode}
                    onSave={(_key, value) => handleUpdateItem(index, 'quote', value)}
                    className="leading-relaxed mb-6"
                    style={{ color: pPrimary, opacity: 0.7 }}
                />
            )}
            <div className="border-t border-gray-100 pt-4">
                {isClone ? (
                    <>
                        <p className="font-bold" style={{ color: pPrimary }}>{name}</p>
                        <p className="text-sm" style={{ color: pPrimary, opacity: 0.6 }}>{role}</p>
                    </>
                ) : (
                    <>
                        <EditableText
                            as="p"
                            contentKey={`testimonial_${index}_name`}
                            content={item.name}
                            defaultValue={`Client ${index + 1}`}
                            isEditMode={isEditMode}
                            onSave={(_key, value) => handleUpdateItem(index, 'name', value)}
                            className="font-bold"
                            style={{ color: pPrimary }}
                        />
                        <EditableText
                            as="p"
                            contentKey={`testimonial_${index}_role`}
                            content={item.role}
                            defaultValue="Satisfied Customer"
                            isEditMode={isEditMode}
                            onSave={(_key, value) => handleUpdateItem(index, 'role', value)}
                            className="text-sm"
                            style={{ color: pPrimary, opacity: 0.6 }}
                        />
                    </>
                )}
            </div>
        </Reveal>
        );
    };

    if (variant === 'single') {
        const item = items[0] || items[0];
        return (
            <section className="py-24" style={{ backgroundColor: bgColor || pAccent }}>
                <div className="max-w-3xl mx-auto px-4 text-center">
                    <Reveal>
                        <EditableText
                            as="h2"
                            contentKey="title"
                            content={data.title}
                            defaultValue="What Our Clients Say"
                            isEditMode={isEditMode}
                            onSave={(key, value) => updateContent(key, value)}
                            className="text-4xl font-bold mb-12"
                            style={{ color: pPrimary }}
                        />
                    </Reveal>
                    <div className="relative">
                        <Reveal>
                            <div className="text-6xl leading-none mb-4" style={{ color: pSecondary }}>"</div>
                        </Reveal>
                        <Reveal>
                            <EditableText
                                as="p"
                                contentKey="testimonial_0_quote"
                                content={item.quote}
                                defaultValue="Outstanding service from start to finish."
                                isEditMode={isEditMode}
                                onSave={(_key, value) => handleUpdateItem(0, 'quote', value)}
                                className="text-xl md:text-2xl italic mb-8 leading-relaxed"
                                style={{ color: pPrimary, opacity: 0.7 }}
                            />
                        </Reveal>
                        <Reveal>
                            <div className="flex justify-center mb-4">
                                {renderStars(item.rating || 5)}
                            </div>
                        </Reveal>
                        <Reveal>
                            <EditableText
                                as="p"
                                contentKey="testimonial_0_name"
                                content={item.name}
                                defaultValue="Happy Customer"
                                isEditMode={isEditMode}
                                onSave={(_key, value) => handleUpdateItem(0, 'name', value)}
                                className="font-bold text-lg"
                                style={{ color: pPrimary }}
                            />
                        </Reveal>
                        <Reveal>
                            <EditableText
                                as="p"
                                contentKey="testimonial_0_role"
                                content={item.role}
                                defaultValue="Homeowner"
                                isEditMode={isEditMode}
                                onSave={(_key, value) => handleUpdateItem(0, 'role', value)}
                                className="text-sm"
                                style={{ color: pPrimary, opacity: 0.6 }}
                            />
                        </Reveal>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="py-24" style={{ backgroundColor: bgColor || '#ffffff' }}>
            <div className="max-w-7xl mx-auto px-4">
                <Reveal>
                    <EditableText
                        as="h2"
                        contentKey="title"
                        content={data.title}
                        defaultValue="What Our Clients Say"
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="text-4xl font-bold text-center mb-4"
                        style={{ color: pPrimary }}
                    />
                </Reveal>
                <Reveal className="max-w-2xl mx-auto mb-16">
                    <EditableText
                        as="p"
                        contentKey="subtitle"
                        content={data.subtitle}
                        defaultValue="Don't just take our word for it — hear from our satisfied customers."
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="text-lg text-center"
                        style={{ color: pPrimary, opacity: 0.6 }}
                    />
                </Reveal>

                {isScrollLayout ? (
                    <>
                        <div className="space-y-6 md:hidden">
                            {testimonialEntries.map(({ item, index }) => renderTestimonialCard(item, index))}
                        </div>

                        <div className="hidden overflow-hidden md:block">
                            {useInfiniteScroll ? (
                                <>
                                    <style>{`
                                        @keyframes ${infiniteAnimationName} {
                                            from { transform: translateX(0); }
                                            to { transform: translateX(-50%); }
                                        }
                                        .${infiniteTrackClassName} {
                                            animation: ${infiniteAnimationName} ${infiniteAnimationDurationSec}s linear infinite;
                                        }
                                        .${infiniteTrackClassName}:hover,
                                        .${infiniteTrackClassName}:focus-within {
                                            animation-play-state: paused;
                                        }
                                        @media (prefers-reduced-motion: reduce) {
                                            .${infiniteTrackClassName} {
                                                animation: none;
                                            }
                                        }
                                    `}</style>
                                    <div className={`flex ${infiniteTrackClassName}`} style={{ width: 'max-content' }}>
                                        {[0, 1].map((groupIndex) => (
                                            <div
                                                key={groupIndex}
                                                className="flex gap-6 pr-6"
                                                aria-hidden={groupIndex === 1}
                                            >
                                                {testimonialEntries.map(({ item, index }) => (
                                                    <div
                                                        key={`${groupIndex}-${index}`}
                                                        className={`w-[22rem] shrink-0 lg:w-[24rem] ${groupIndex === 1 ? 'pointer-events-none' : ''}`}
                                                    >
                                                        {renderTestimonialCard(item, index, 'h-full', groupIndex === 1)}
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div style={carouselTrackStyle}>
                                    {loopTrackEntries.map(({ item, index, isClone, key }) => (
                                        <div
                                            key={key}
                                            style={carouselItemStyle}
                                            className={`px-3 ${isClone ? 'pointer-events-none' : ''}`}
                                            aria-hidden={isClone}
                                        >
                                            {renderTestimonialCard(item, index, 'h-full', isClone)}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {showScrollNav && !useInfiniteScroll && (
                            <div className="mt-8 hidden items-center justify-center gap-4 md:flex">
                                {renderCarouselArrow('prev', displayScrollIndex === 0)}
                                {renderCarouselDots(useLoopScroll ? items.length : maxScrollIndex + 1)}
                                {renderCarouselArrow('next', useLoopScroll ? false : currentScrollIndex >= maxScrollIndex)}
                            </div>
                        )}
                    </>
                ) : (
                    <div className={`grid gap-8 ${visibleEntries.length <= 2 ? 'md:grid-cols-2 max-w-4xl mx-auto' : 'md:grid-cols-3'}`}>
                        {visibleEntries.map(({ item, index }) => renderTestimonialCard(item, index))}
                    </div>
                )}

                {(isEditMode || shouldLimitCards) && (
                    <div className="flex flex-wrap justify-center gap-3 mt-6">
                        {isEditMode && (
                            <button
                                onClick={handleAddItem}
                                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-dashed border-blue-300"
                            >
                                <Plus className="w-4 h-4" />
                                Add Testimonial
                            </button>
                        )}
                        {shouldLimitCards && (
                            <button
                                type="button"
                                onClick={() => setShowAllTestimonials((current) => !current)}
                                className="px-4 py-2 text-sm font-semibold text-slate-700 transition-colors rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
                            >
                                {showAllTestimonials ? 'Show Less' : 'Show More'}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
