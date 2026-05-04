'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    AlignCenter, AlignLeft, AlignRight, Crown, Image as ImageIcon, MoveLeft, MoveRight,
    Plus, Trash2, Copy, ChevronUp, ChevronDown, Video, Palette as PaletteIcon, Sparkles,
    Monitor, Tablet, Smartphone,
} from 'lucide-react';
import { useEditorContext } from '@/lib/editor-context';
import BlockSettingsPanel from '../BlockSettingsPanel';
import {
    InspectorSection,
    InspectorToggle,
    PaletteTokenButtons,
    getColorInputValue,
    useInspectorSectionState,
} from '../panel-shared';
import type { BlockPanelProps } from '../block-panel-registry';
import {
    Align,
    BgType,
    HeroBackground,
    HeroBreakpoint,
    HeroCard,
    HeroData,
    HeroHeight,
    HeroHeightConfig,
    HeroTransition,
    ImageSide,
    makeCardId,
    makeDefaultCard,
    migrateLegacyHeroData,
    VideoSource,
} from './hero-schema';
import { HERO_BG_ANIMATION_LIST, type HeroBgAnimationId } from './HeroBgAnimations';
import ImageEditorModal, { type ImageSettings, type UnsplashAttribution } from '@/app/components/ImageEditorModal';
import PexelsVideoPickerModal from '@/app/components/PexelsVideoPickerModal';

const SECTION_IDS = ['cards', 'transition', 'content-layout', 'background', 'height', 'advanced'];

const ALIGN_OPTIONS: { id: Align; label: string; Icon: typeof AlignLeft }[] = [
    { id: 'left', label: 'Left', Icon: AlignLeft },
    { id: 'center', label: 'Center', Icon: AlignCenter },
    { id: 'right', label: 'Right', Icon: AlignRight },
];

const BG_TYPE_OPTIONS: { id: BgType; label: string; Icon: typeof ImageIcon }[] = [
    { id: 'image', label: 'Image', Icon: ImageIcon },
    { id: 'video', label: 'Video', Icon: Video },
    { id: 'gradient', label: 'Gradient', Icon: PaletteIcon },
    { id: 'animation', label: 'Animation', Icon: Sparkles },
];

const HEIGHT_OPTIONS: { id: HeroHeightConfig['mode']; label: string }[] = [
    { id: 'fitContent', label: 'Fit content' },
    { id: 'fitScreen', label: 'Fit screen' },
    { id: 'manual', label: 'Manual' },
];

export default function HeroSettingsPanel({
    blockId,
    blockData,
    palette,
    isProUser,
    customCss,
    onClose,
    onDraftBlockDataChange,
}: BlockPanelProps) {
    const context = useEditorContext();
    const persistedData = useMemo(() => migrateLegacyHeroData(blockData), [blockData]);

    const [cards, setCards] = useState<HeroCard[]>(persistedData.cards);
    const [transition, setTransition] = useState<HeroTransition>(persistedData.transition);
    const [height, setHeight] = useState<HeroHeight>(persistedData.height);
    const [activeHeightBp, setActiveHeightBp] = useState<HeroBreakpoint>('desktop');
    const [activeIndex, setActiveIndex] = useState<number>(0);
    const [localCss, setLocalCss] = useState<string>(customCss);

    const [imageEditorOpen, setImageEditorOpen] = useState<null | 'foreground' | 'background'>(null);
    const [pexelsOpen, setPexelsOpen] = useState(false);

    const sectionState = useInspectorSectionState(SECTION_IDS, true);

    const activeCard = cards[Math.max(0, Math.min(activeIndex, cards.length - 1))] ?? cards[0];

    // Forward draft to canvas for live preview
    useEffect(() => {
        if (!onDraftBlockDataChange) return;
        const draft: HeroData & Record<string, unknown> = {
            ...(blockData || {}),
            cards,
            transition,
            height,
            __activeCardIndex: activeIndex,
            __pauseRotation: true,
            __customCss: localCss,
        };
        onDraftBlockDataChange(draft);
    }, [cards, transition, height, activeIndex, localCss, blockData, onDraftBlockDataChange]);

    const updateActiveCard = (mutator: (card: HeroCard) => HeroCard) => {
        setCards((prev) => prev.map((c, i) => (i === activeIndex ? mutator(c) : c)));
    };

    const updateContent = <K extends keyof HeroCard['content']>(
        key: K,
        patch: Partial<HeroCard['content'][K]>,
    ) => {
        updateActiveCard((card) => ({
            ...card,
            content: {
                ...card.content,
                [key]: { ...card.content[key], ...patch },
            },
        }));
    };

    const updateBackground = (patch: Partial<HeroBackground>) => {
        updateActiveCard((card) => ({
            ...card,
            background: { ...card.background, ...patch },
        }));
    };

    const addCard = () => {
        setCards((prev) => {
            const next = [...prev, makeDefaultCard(makeCardId())];
            setActiveIndex(next.length - 1);
            return next;
        });
    };

    const duplicateCard = (idx: number) => {
        setCards((prev) => {
            const copy: HeroCard = JSON.parse(JSON.stringify(prev[idx]));
            copy.id = makeCardId();
            const next = [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)];
            setActiveIndex(idx + 1);
            return next;
        });
    };

    const deleteCard = (idx: number) => {
        setCards((prev) => {
            if (prev.length <= 1) return prev;
            const next = prev.filter((_, i) => i !== idx);
            setActiveIndex(Math.min(activeIndex, next.length - 1));
            return next;
        });
    };

    const moveCard = (idx: number, dir: -1 | 1) => {
        setCards((prev) => {
            const target = idx + dir;
            if (target < 0 || target >= prev.length) return prev;
            const next = [...prev];
            const [item] = next.splice(idx, 1);
            next.splice(target, 0, item);
            if (activeIndex === idx) setActiveIndex(target);
            return next;
        });
    };

    const hasUnsavedChanges = useMemo(() => (
        JSON.stringify({ cards, transition, height }) !== JSON.stringify({
            cards: persistedData.cards,
            transition: persistedData.transition,
            height: persistedData.height,
        }) || localCss !== customCss
    ), [cards, transition, height, persistedData, localCss, customCss]);

    const handleSave = () => {
        const updates: Record<string, unknown> = {
            cards,
            transition,
            height,
        };
        if (localCss !== customCss) {
            updates['__customCss'] = localCss;
        }
        // Clear legacy fields so the new schema is the source of truth.
        // NOTE: title__styles / subtitle__styles / buttonText__styles are NOT
        // legacy — they're typography metadata still consumed by EditableText
        // via blockData['<key>__styles']. Don't clear them.
        const legacyKeys = [
            'variant', 'showButton',
            'title', 'subtitle', 'buttonText', 'buttonTextLink', 'buttonTextIcon',
            'image', 'image__settings', 'image__attribution',
            'videoUrl',
            'bgType', 'bgImage', 'bgCarouselImages', 'bgCarouselTiming', 'bgCarouselTransition',
            'backgroundColor',
        ];
        for (const key of legacyKeys) {
            if (key in (blockData || {})) updates[key] = undefined;
        }
        if (context?.updateBlockDataBatch) {
            context.updateBlockDataBatch(blockId, updates);
        }
        onClose();
    };

    const handleReset = () => {
        setCards(persistedData.cards);
        setTransition(persistedData.transition);
        setHeight(persistedData.height);
        setActiveIndex(0);
        setLocalCss(customCss);
    };

    const siteCategory = context?.siteCategory;
    const siteId = context?.siteId || '';
    const uploadImage = context?.uploadImage;

    // Image picker
    const imagePickerInitialUrl = imageEditorOpen === 'foreground'
        ? activeCard.content.image.url
        : (activeCard.background.type === 'image' ? activeCard.background.image?.url || '' : '');
    const imagePickerInitialSettings = imageEditorOpen === 'foreground'
        ? activeCard.content.image.settings
        : activeCard.background.image?.settings;
    const handleImagePickerSave = (url: string, settings: ImageSettings, attribution?: UnsplashAttribution) => {
        if (imageEditorOpen === 'foreground') {
            updateContent('image', { url, settings, attribution, enabled: true });
        } else if (imageEditorOpen === 'background') {
            updateBackground({
                type: 'image',
                image: { url, settings, attribution },
            });
        }
        setImageEditorOpen(null);
    };

    return (
        <>
            <BlockSettingsPanel
                isOpen
                title="Hero Settings"
                subtitle="Build the hero with cards, layout, and a custom background."
                blockId={blockId}
                blockType="hero"
                hasUnsavedChanges={hasUnsavedChanges}
                onClose={onClose}
                onSave={handleSave}
                onReset={handleReset}
                allCollapsed={sectionState.allCollapsed}
                onToggleAllCollapsed={() => sectionState.setAll(!sectionState.allCollapsed)}
                tourId="hero-settings-panel"
            >
                {/* CARDS */}
                <InspectorSection
                    id="cards"
                    title="Cards"
                    isCollapsed={sectionState.isCollapsed('cards')}
                    onToggle={() => sectionState.toggle('cards')}
                >
                    <div className="space-y-2">
                        {cards.map((card, i) => {
                            const isActive = i === activeIndex;
                            const label = card.content.title.value?.trim() || `Card ${i + 1}`;
                            return (
                                <div
                                    key={card.id}
                                    className={`flex items-center gap-1 rounded-xl border px-2 py-1.5 transition-colors ${
                                        isActive ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    <button
                                        type="button"
                                        onClick={() => setActiveIndex(i)}
                                        aria-pressed={isActive}
                                        className="flex flex-1 items-center gap-2 truncate rounded-lg px-2 py-1 text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                            {i + 1}
                                        </span>
                                        <span className="truncate text-sm font-medium text-slate-700">{label}</span>
                                    </button>
                                    <div className="flex items-center">
                                        <button type="button" onClick={() => moveCard(i, -1)} disabled={i === 0} className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-30" title="Move up">
                                            <ChevronUp className="h-3.5 w-3.5" />
                                        </button>
                                        <button type="button" onClick={() => moveCard(i, 1)} disabled={i === cards.length - 1} className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-30" title="Move down">
                                            <ChevronDown className="h-3.5 w-3.5" />
                                        </button>
                                        <button type="button" onClick={() => duplicateCard(i)} className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700" title="Duplicate">
                                            <Copy className="h-3.5 w-3.5" />
                                        </button>
                                        <button type="button" onClick={() => deleteCard(i)} disabled={cards.length <= 1} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30" title="Delete">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        <button
                            type="button"
                            onClick={addCard}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm font-bold text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <Plus className="h-4 w-4" />
                            Add Card
                        </button>
                    </div>
                </InspectorSection>

                {/* TRANSITION */}
                {cards.length > 1 && (
                    <InspectorSection
                        id="transition"
                        title="Card Transition"
                        isCollapsed={sectionState.isCollapsed('transition')}
                        onToggle={() => sectionState.toggle('transition')}
                    >
                        <div className="space-y-3">
                            <div>
                                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Type</p>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['fade', 'slide', 'none'] as const).map((id) => {
                                        const isActive = transition.type === id;
                                        return (
                                            <button
                                                key={id}
                                                type="button"
                                                onClick={() => setTransition({ ...transition, type: id })}
                                                aria-pressed={isActive}
                                                className={`rounded-xl border px-3 py-2 text-center text-sm font-bold capitalize transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                                    isActive ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                                }`}
                                            >
                                                {id}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                                    Interval: {transition.intervalSec}s
                                </label>
                                <input
                                    type="range"
                                    min={2}
                                    max={15}
                                    value={transition.intervalSec}
                                    onChange={(e) => setTransition({ ...transition, intervalSec: parseInt(e.target.value) || 5 })}
                                    className="w-full accent-blue-600"
                                />
                            </div>
                            <InspectorToggle
                                label="Pause on hover"
                                checked={transition.pauseOnHover}
                                onChange={() => setTransition({ ...transition, pauseOnHover: !transition.pauseOnHover })}
                            />
                        </div>
                    </InspectorSection>
                )}

                {/* CONTENT LAYOUT — per active card */}
                <InspectorSection
                    id="content-layout"
                    title={`Content Layout — Card ${activeIndex + 1}`}
                    isCollapsed={sectionState.isCollapsed('content-layout')}
                    onToggle={() => sectionState.toggle('content-layout')}
                >
                    <div className="space-y-3">
                        <ContentRow
                            label="Title"
                            enabled={activeCard.content.title.enabled}
                            onToggle={() => updateContent('title', { enabled: !activeCard.content.title.enabled })}
                            align={activeCard.content.title.align}
                            onAlign={(a) => updateContent('title', { align: a })}
                        />
                        <ContentRow
                            label="Subtitle"
                            enabled={activeCard.content.subtitle.enabled}
                            onToggle={() => updateContent('subtitle', { enabled: !activeCard.content.subtitle.enabled })}
                            align={activeCard.content.subtitle.align}
                            onAlign={(a) => updateContent('subtitle', { align: a })}
                        />
                        <ContentRow
                            label="CTA Button"
                            enabled={activeCard.content.cta.enabled}
                            onToggle={() => updateContent('cta', { enabled: !activeCard.content.cta.enabled })}
                            align={activeCard.content.cta.align}
                            onAlign={(a) => updateContent('cta', { align: a })}
                        />
                        <div className="rounded-xl border border-slate-200 p-3">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-medium text-slate-700">Foreground Image</p>
                                    <p className="text-xs text-slate-500">Like the old &ldquo;split&rdquo; layout — sits next to the text.</p>
                                </div>
                                <Toggle
                                    checked={activeCard.content.image.enabled}
                                    onChange={() => updateContent('image', { enabled: !activeCard.content.image.enabled })}
                                />
                            </div>
                            {activeCard.content.image.enabled && (
                                <div className="mt-3 space-y-3">
                                    <div>
                                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Image side</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {(['left', 'right'] as ImageSide[]).map((side) => {
                                                const isActive = activeCard.content.image.side === side;
                                                const Icon = side === 'left' ? MoveLeft : MoveRight;
                                                return (
                                                    <button
                                                        key={side}
                                                        type="button"
                                                        onClick={() => updateContent('image', { side })}
                                                        aria-pressed={isActive}
                                                        className={`flex items-center justify-center gap-1 rounded-xl border px-3 py-2 text-sm font-bold capitalize transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                                            isActive ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        <Icon className="h-3.5 w-3.5" />
                                                        {side}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    {activeCard.content.image.url && (
                                        <div className="relative h-32 overflow-hidden rounded-lg border border-slate-200">
                                            <img src={activeCard.content.image.url} alt="" className="h-full w-full object-cover" />
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setImageEditorOpen('foreground')}
                                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
                                    >
                                        {activeCard.content.image.url ? 'Change Image' : 'Choose Image'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </InspectorSection>

                {/* BACKGROUND — per active card */}
                <InspectorSection
                    id="background"
                    title={`Background — Card ${activeIndex + 1}`}
                    isCollapsed={sectionState.isCollapsed('background')}
                    onToggle={() => sectionState.toggle('background')}
                >
                    <div className="space-y-4">
                        <div className="grid grid-cols-4 gap-2">
                            {BG_TYPE_OPTIONS.map(({ id, label, Icon }) => {
                                const isActive = activeCard.background.type === id;
                                return (
                                    <button
                                        key={id}
                                        type="button"
                                        onClick={() => updateBackground({ type: id })}
                                        aria-pressed={isActive}
                                        className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                            isActive ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                        }`}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {label}
                                    </button>
                                );
                            })}
                        </div>

                        {activeCard.background.type === 'image' && (
                            <div className="space-y-3">
                                {activeCard.background.image?.url && (
                                    <div className="relative h-32 overflow-hidden rounded-lg border border-slate-200">
                                        <img src={activeCard.background.image.url} alt="" className="h-full w-full object-cover" />
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setImageEditorOpen('background')}
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
                                >
                                    {activeCard.background.image?.url ? 'Change Background Image' : 'Choose Background Image'}
                                </button>
                                <OverlayControls bg={activeCard.background} onChange={updateBackground} />
                            </div>
                        )}

                        {activeCard.background.type === 'video' && (
                            <div className="space-y-3">
                                <div>
                                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Source</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(['pexels', 'url'] as VideoSource[]).map((src) => {
                                            const isActive = (activeCard.background.video?.source || 'pexels') === src;
                                            return (
                                                <button
                                                    key={src}
                                                    type="button"
                                                    onClick={() => updateBackground({ video: { source: src, url: activeCard.background.video?.url || '' } })}
                                                    aria-pressed={isActive}
                                                    className={`rounded-xl border px-3 py-2 text-sm font-bold capitalize transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                                        isActive ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    {src === 'url' ? 'External URL' : 'Pexels'}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                {(activeCard.background.video?.source || 'pexels') === 'pexels' ? (
                                    <button
                                        type="button"
                                        onClick={() => setPexelsOpen(true)}
                                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
                                    >
                                        {activeCard.background.video?.url ? 'Change Pexels Video' : 'Choose Pexels Video'}
                                    </button>
                                ) : (
                                    <input
                                        type="url"
                                        value={activeCard.background.video?.url || ''}
                                        onChange={(e) => updateBackground({ video: { source: 'url', url: e.target.value } })}
                                        placeholder="https://example.com/hero.mp4"
                                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                )}
                                {activeCard.background.video?.url && (
                                    <video src={activeCard.background.video.url} className="h-32 w-full rounded-lg object-cover" muted autoPlay loop playsInline />
                                )}
                                <OverlayControls bg={activeCard.background} onChange={updateBackground} />
                            </div>
                        )}

                        {activeCard.background.type === 'gradient' && (
                            <GradientControls
                                bg={activeCard.background}
                                onChange={updateBackground}
                                palette={palette}
                            />
                        )}

                        {activeCard.background.type === 'animation' && (
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                    {HERO_BG_ANIMATION_LIST.map((anim) => {
                                        const isActive = (activeCard.background.animation?.id || 'aurora') === anim.id;
                                        return (
                                            <button
                                                key={anim.id}
                                                type="button"
                                                onClick={() => updateBackground({ animation: { id: anim.id as HeroBgAnimationId } })}
                                                aria-pressed={isActive}
                                                className={`rounded-xl border p-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                                    isActive ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                                }`}
                                            >
                                                <span className="block text-sm font-bold text-slate-900">{anim.label}</span>
                                                <span className="mt-0.5 block text-xs leading-snug text-slate-500">{anim.description}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <OverlayControls bg={activeCard.background} onChange={updateBackground} />
                            </div>
                        )}
                    </div>
                </InspectorSection>

                {/* HEIGHT */}
                <InspectorSection
                    id="height"
                    title="Height"
                    isCollapsed={sectionState.isCollapsed('height')}
                    onToggle={() => sectionState.toggle('height')}
                >
                    <HeightSettings
                        value={height}
                        onChange={setHeight}
                        activeBp={activeHeightBp}
                        onActiveBpChange={setActiveHeightBp}
                    />
                </InspectorSection>

                {/* ADVANCED */}
                <InspectorSection
                    id="advanced"
                    title="Advanced"
                    isCollapsed={sectionState.isCollapsed('advanced')}
                    onToggle={() => sectionState.toggle('advanced')}
                >
                    {isProUser ? (
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor={`${blockId}-hero-css`}>
                                Custom CSS
                            </label>
                            <textarea
                                id={`${blockId}-hero-css`}
                                value={localCss}
                                onChange={(e) => setLocalCss(e.target.value)}
                                placeholder={`/* Scoped to this Hero block */\n.hero-title {\n  letter-spacing: -0.02em;\n}`}
                                className="mt-2 min-h-40 w-full resize-y rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-sm text-green-400 outline-none selection:bg-green-900 focus:ring-2 focus:ring-blue-500"
                                spellCheck={false}
                            />
                            <p className="mt-2 text-xs text-slate-500">
                                Helpful classes: <code>.hero-title</code>, <code>.hero-subtitle</code>, <code>.hero-button</code>, <code>.hero-image</code>, <code>.hero-overlay</code>.
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800">
                            <div className="flex items-center gap-2 font-bold">
                                <Crown className="h-4 w-4" />
                                Custom CSS is a Pro feature
                            </div>
                        </div>
                    )}
                </InspectorSection>
            </BlockSettingsPanel>

            <ImageEditorModal
                isOpen={imageEditorOpen !== null}
                onClose={() => setImageEditorOpen(null)}
                currentImageUrl={imagePickerInitialUrl}
                currentSettings={imagePickerInitialSettings as ImageSettings | undefined}
                siteCategory={siteCategory}
                siteId={siteId}
                onSave={handleImagePickerSave}
                onUpload={uploadImage || (async () => '')}
                contentKey={imageEditorOpen === 'foreground' ? 'image' : 'bgImage'}
                allowUnsplash
            />

            <PexelsVideoPickerModal
                isOpen={pexelsOpen}
                onClose={() => setPexelsOpen(false)}
                onSelect={(url) => {
                    updateBackground({ video: { source: 'pexels', url } });
                    setPexelsOpen(false);
                }}
            />
        </>
    );
}

function ContentRow({
    label,
    enabled,
    onToggle,
    align,
    onAlign,
}: {
    label: string;
    enabled: boolean;
    onToggle: () => void;
    align: Align;
    onAlign: (a: Align) => void;
}) {
    return (
        <div className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-700">{label}</span>
                <Toggle checked={enabled} onChange={onToggle} />
            </div>
            {enabled && (
                <div className="mt-3 grid grid-cols-3 gap-1">
                    {ALIGN_OPTIONS.map(({ id, label: alignLabel, Icon }) => {
                        const isActive = align === id;
                        return (
                            <button
                                key={id}
                                type="button"
                                onClick={() => onAlign(id)}
                                aria-pressed={isActive}
                                className={`flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    isActive ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                }`}
                                title={`${label} ${alignLabel}`}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                {alignLabel}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={onChange}
            className={`relative h-5 w-10 shrink-0 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-200'}`}
        >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
    );
}

function OverlayControls({ bg, onChange }: { bg: HeroBackground; onChange: (patch: Partial<HeroBackground>) => void }) {
    const overlay = bg.overlay || { color: '#000000', opacity: 0 };
    return (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Overlay</p>
            <div className="flex items-center gap-2">
                <input
                    type="color"
                    value={overlay.color}
                    onChange={(e) => onChange({ overlay: { ...overlay, color: e.target.value } })}
                    className="h-9 w-9 cursor-pointer rounded border border-slate-200 bg-white"
                />
                <div className="flex-1">
                    <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        Opacity: {Math.round(overlay.opacity * 100)}%
                    </label>
                    <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(overlay.opacity * 100)}
                        onChange={(e) => onChange({ overlay: { ...overlay, opacity: parseInt(e.target.value) / 100 } })}
                        className="w-full accent-blue-600"
                    />
                </div>
            </div>
        </div>
    );
}

function GradientControls({
    bg,
    onChange,
    palette,
}: {
    bg: HeroBackground;
    onChange: (patch: Partial<HeroBackground>) => void;
    palette: Record<string, string>;
}) {
    const grad = bg.gradient || { from: 'palette:primary', to: 'palette:secondary', angle: 135 };
    const fromInput = getColorInputValue(grad.from, palette, '#1f2937');
    const toInput = getColorInputValue(grad.to, palette, '#ef4444');
    const viaInput = grad.via ? getColorInputValue(grad.via, palette, '#ffffff') : '';

    const update = (patch: Partial<typeof grad>) => onChange({ gradient: { ...grad, ...patch } });

    return (
        <div className="space-y-3">
            <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">From</p>
                <div className="flex items-center gap-2">
                    <input
                        type="color"
                        value={fromInput}
                        onChange={(e) => update({ from: e.target.value })}
                        className="h-9 w-9 cursor-pointer rounded border border-slate-200 bg-white"
                    />
                    <PaletteTokenButtons selected={grad.from} palette={palette} onSelect={(t) => update({ from: t })} />
                </div>
            </div>
            <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">To</p>
                <div className="flex items-center gap-2">
                    <input
                        type="color"
                        value={toInput}
                        onChange={(e) => update({ to: e.target.value })}
                        className="h-9 w-9 cursor-pointer rounded border border-slate-200 bg-white"
                    />
                    <PaletteTokenButtons selected={grad.to} palette={palette} onSelect={(t) => update({ to: t })} />
                </div>
            </div>
            <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Mid stop (optional)</p>
                <div className="flex items-center gap-2">
                    <input
                        type="color"
                        value={viaInput || '#ffffff'}
                        onChange={(e) => update({ via: e.target.value })}
                        className="h-9 w-9 cursor-pointer rounded border border-slate-200 bg-white"
                        disabled={!grad.via}
                    />
                    <button
                        type="button"
                        onClick={() => update({ via: grad.via ? undefined : 'palette:accent' })}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
                    >
                        {grad.via ? 'Remove' : 'Add'}
                    </button>
                </div>
            </div>
            <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    Angle: {grad.angle}°
                </label>
                <input
                    type="range"
                    min={0}
                    max={360}
                    value={grad.angle}
                    onChange={(e) => update({ angle: parseInt(e.target.value) || 0 })}
                    className="w-full accent-blue-600"
                />
            </div>
        </div>
    );
}

const BREAKPOINT_TABS: { id: HeroBreakpoint; label: string; Icon: typeof Monitor }[] = [
    { id: 'desktop', label: 'Desktop', Icon: Monitor },
    { id: 'tablet', label: 'Tablet', Icon: Tablet },
    { id: 'mobile', label: 'Mobile', Icon: Smartphone },
];

const REVEAL_NEXT_OPTIONS = [
    { value: 0, label: 'None' },
    { value: 1, label: '1 block' },
    { value: 2, label: '2 blocks' },
    { value: 3, label: '3 blocks' },
];

function HeightSettings({
    value,
    onChange,
    activeBp,
    onActiveBpChange,
}: {
    value: HeroHeight;
    onChange: (next: HeroHeight) => void;
    activeBp: HeroBreakpoint;
    onActiveBpChange: (bp: HeroBreakpoint) => void;
}) {
    const cfg = value[activeBp];
    const updateCfg = (patch: Partial<HeroHeightConfig>) => {
        onChange({ ...value, [activeBp]: { ...cfg, ...patch } });
    };

    return (
        <div className="space-y-3">
            {/* Breakpoint switcher */}
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                {BREAKPOINT_TABS.map(({ id, label, Icon }) => {
                    const isActive = activeBp === id;
                    return (
                        <button
                            key={id}
                            type="button"
                            onClick={() => onActiveBpChange(id)}
                            aria-pressed={isActive}
                            title={label}
                            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                isActive ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <Icon className="h-4 w-4" />
                            {label}
                        </button>
                    );
                })}
            </div>

            {/* Mode chips for the active breakpoint */}
            <div className="grid grid-cols-3 gap-2">
                {HEIGHT_OPTIONS.map(({ id, label }) => {
                    const isActive = cfg.mode === id;
                    return (
                        <button
                            key={id}
                            type="button"
                            onClick={() => updateCfg({ mode: id })}
                            aria-pressed={isActive}
                            className={`rounded-xl border px-3 py-2 text-center text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                isActive ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>

            {cfg.mode === 'manual' && (
                <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                        Height: {cfg.valuePx}px
                    </label>
                    <input
                        type="range"
                        min={200}
                        max={1200}
                        step={20}
                        value={cfg.valuePx}
                        onChange={(e) => updateCfg({ valuePx: parseInt(e.target.value) || 600 })}
                        className="w-full accent-blue-600"
                    />
                </div>
            )}

            {cfg.mode === 'fitScreen' && (
                <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                        Reveal next section
                    </label>
                    <div className="grid grid-cols-4 gap-1">
                        {REVEAL_NEXT_OPTIONS.map(({ value: v, label }) => {
                            const isActive = (cfg.revealNext || 0) === v;
                            return (
                                <button
                                    key={v}
                                    type="button"
                                    onClick={() => updateCfg({ revealNext: v })}
                                    aria-pressed={isActive}
                                    className={`rounded-md border px-2 py-1.5 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                        isActive ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                                    }`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                        Hero shrinks so this many block(s) following it also fit on screen.
                    </p>
                </div>
            )}

            <p className="text-xs leading-relaxed text-slate-500">
                Each device size has its own setting — switch tabs above to tune it. Fit-screen subtracts a sticky header automatically (or pads below a transparent header) for first-block heroes.
            </p>
        </div>
    );
}
