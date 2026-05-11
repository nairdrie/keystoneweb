'use client';

import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import {
    AlignCenter, AlignLeft, AlignRight, Crown, Image as ImageIcon, MoveLeft, MoveRight,
    Plus, Trash2, Copy, ChevronUp, ChevronDown, Video, Palette as PaletteIcon, Sparkles,
    Monitor, Tablet, Smartphone, LayoutGrid, RotateCcw,
} from 'lucide-react';
import { useEditorContext } from '@/lib/editor-context';
import BlockSettingsPanel from '../BlockSettingsPanel';
import {
    InspectorSection,
    InspectorToggle,
    PaletteTokenButtons,
    SideBySideBackgroundOverrideNotice,
    getColorInputValue,
    useInspectorSectionState,
} from '../panel-shared';
import { LayoutTab } from '../layout/LayoutTab';
import type { BlockPanelProps } from '../block-panel-registry';
import KeyframeEditor from '../KeyframeEditor';
import {
    areSectionSettingsEqual,
    normalizeSectionSettings,
    type SectionSettings,
} from '@/lib/builder/layout-settings';
import {
    Align,
    BgType,
    DEFAULT_CTA2_LABEL,
    HeroBackground,
    HeroBreakpoint,
    HeroCard,
    HeroData,
    HeroHeight,
    HeroHeightConfig,
    HeroPretextStyle,
    HeroSocialLink,
    HeroTransition,
    ImageSide,
    SecondaryCtaPlacement,
    makeCardId,
    makeDefaultCard,
    makeSocialLinkId,
    migrateLegacyHeroData,
    resolveElementOrder,
    VideoSource,
} from './hero-schema';
import { SOCIAL_PLATFORM_OPTIONS, getSocialIcon, getSocialPlatformLabel } from '../contact/contact-config';
import {
    HERO_BG_ANIMATION_LIST,
    HERO_BG_ANIMATION_META,
    HeroBgAnimation,
    type HeroBgAnimationId,
} from './HeroBgAnimations';
import {
    HERO_BG_PATTERN_LIST,
    HERO_BG_PATTERN_META,
    HeroBgPattern,
    type HeroBgPatternId,
} from './HeroBgPatterns';
import { resolveSlotColors } from './hero-bg-shared';
import { resolvePaletteColor } from '@/lib/palette-colors';
import ImageEditorModal, { type ImageSettings, type UnsplashAttribution } from '@/app/components/ImageEditorModal';
import PexelsVideoPickerModal from '@/app/components/PexelsVideoPickerModal';

const SECTION_IDS = ['cards', 'universal-layout', 'style', 'transition', 'content-layout', 'background', 'height', 'advanced'];
const HERO_DRAFT_UPDATE_EVENT = 'ks:hero-draft-update';

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
    { id: 'pattern', label: 'Pattern', Icon: LayoutGrid },
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
    const persistedSectionSettings = useMemo(
        () => normalizeSectionSettings(blockData?.sectionSettings),
        [blockData?.sectionSettings],
    );
    const persistedBackgroundColor = typeof blockData?.backgroundColor === 'string' ? blockData.backgroundColor : '';

    const [cards, setCards] = useState<HeroCard[]>(persistedData.cards);
    const [transition, setTransition] = useState<HeroTransition>(persistedData.transition);
    const [height, setHeight] = useState<HeroHeight>(persistedData.height);
    const [sectionSettings, setSectionSettings] = useState<SectionSettings>(persistedSectionSettings);
    const [backgroundColor, setBackgroundColor] = useState<string>(persistedBackgroundColor);
    const [activeHeightBp, setActiveHeightBp] = useState<HeroBreakpoint>('desktop');
    const [activeIndex, setActiveIndex] = useState<number>(0);
    const [localCss, setLocalCss] = useState<string>(customCss);
    const persistedScript = typeof blockData?.__customScript === 'string' ? blockData.__customScript : '';
    const [localScript, setLocalScript] = useState<string>(persistedScript);
    const cardsRef = useRef<HeroCard[]>(persistedData.cards);

    const [imageEditorOpen, setImageEditorOpen] = useState<null | 'foreground' | 'background'>(null);
    const [pexelsOpen, setPexelsOpen] = useState(false);

    const sectionState = useInspectorSectionState(SECTION_IDS, true);

    const activeCard = cards[Math.max(0, Math.min(activeIndex, cards.length - 1))] ?? cards[0];

    useEffect(() => {
        cardsRef.current = cards;
    }, [cards]);

    const updateCards = (updater: (current: HeroCard[]) => HeroCard[]) => {
        const next = updater(cardsRef.current);
        cardsRef.current = next;
        setCards(next);
        return next;
    };

    // Forward draft to canvas for live preview
    useEffect(() => {
        if (!onDraftBlockDataChange) return;
        const draft: HeroData & Record<string, unknown> = {
            ...(blockData || {}),
            cards,
            transition,
            height,
            sectionSettings,
            backgroundColor,
            __activeCardIndex: activeIndex,
            __pauseRotation: true,
            __customCss: localCss,
            __customScript: localScript,
        };
        onDraftBlockDataChange(draft);
    }, [cards, transition, height, sectionSettings, backgroundColor, activeIndex, localCss, localScript, blockData, onDraftBlockDataChange]);

    // Canvas dots can also switch the active card; sync our state when they do.
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent<{ blockId: string; index: number }>).detail;
            if (!detail || detail.blockId !== blockId) return;
            setActiveIndex(detail.index);
        };
        window.addEventListener('ks:hero-set-active-card', handler);
        return () => window.removeEventListener('ks:hero-set-active-card', handler);
    }, [blockId]);

    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent<{ blockId?: string; key?: string; value?: unknown }>).detail;
            if (!detail || detail.blockId !== blockId || detail.key !== 'cards' || !Array.isArray(detail.value)) return;
            cardsRef.current = detail.value as HeroCard[];
            setCards(detail.value as HeroCard[]);
        };
        window.addEventListener(HERO_DRAFT_UPDATE_EVENT, handler);
        return () => window.removeEventListener(HERO_DRAFT_UPDATE_EVENT, handler);
    }, [blockId]);

    const updateActiveCard = (mutator: (card: HeroCard) => HeroCard) => {
        updateCards((prev) => prev.map((c, i) => (i === activeIndex ? mutator(c) : c)));
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
        updateCards((prev) => {
            const next = [...prev, makeDefaultCard(makeCardId())];
            setActiveIndex(next.length - 1);
            return next;
        });
    };

    const duplicateCard = (idx: number) => {
        updateCards((prev) => {
            const copy: HeroCard = JSON.parse(JSON.stringify(prev[idx]));
            copy.id = makeCardId();
            const next = [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)];
            setActiveIndex(idx + 1);
            return next;
        });
    };

    const deleteCard = (idx: number) => {
        updateCards((prev) => {
            if (prev.length <= 1) return prev;
            const next = prev.filter((_, i) => i !== idx);
            setActiveIndex(Math.min(activeIndex, next.length - 1));
            return next;
        });
    };

    const moveCard = (idx: number, dir: -1 | 1) => {
        updateCards((prev) => {
            const target = idx + dir;
            if (target < 0 || target >= prev.length) return prev;
            const next = [...prev];
            const [item] = next.splice(idx, 1);
            next.splice(target, 0, item);
            if (activeIndex === idx) setActiveIndex(target);
            return next;
        });
    };

    const moveElement = (idx: number, dir: -1 | 1) => {
        updateActiveCard((card) => {
            const order = resolveElementOrder(card.content.elementOrder);
            const target = idx + dir;
            if (target < 0 || target >= order.length) return card;
            const next = [...order];
            const [item] = next.splice(idx, 1);
            next.splice(target, 0, item);
            return { ...card, content: { ...card.content, elementOrder: next } };
        });
    };

    const hasUnsavedChanges = useMemo(() => (
        JSON.stringify({ cards, transition, height }) !== JSON.stringify({
            cards: persistedData.cards,
            transition: persistedData.transition,
            height: persistedData.height,
        }) || !areSectionSettingsEqual(sectionSettings, persistedSectionSettings) || backgroundColor !== persistedBackgroundColor || localCss !== customCss || localScript !== persistedScript
    ), [cards, transition, height, persistedData, sectionSettings, persistedSectionSettings, backgroundColor, persistedBackgroundColor, localCss, customCss, localScript, persistedScript]);

    const handleSave = () => {
        const cardsToSave = cardsRef.current;
        const updates: Record<string, unknown> = {
            cards: cardsToSave,
            transition,
            height,
            backgroundColor,
        };
        if (!areSectionSettingsEqual(sectionSettings, persistedSectionSettings)) {
            updates.sectionSettings = normalizeSectionSettings(sectionSettings);
        }
        if (localCss !== customCss) {
            updates['__customCss'] = localCss;
        }
        if (localScript !== persistedScript) {
            updates['__customScript'] = localScript;
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
        cardsRef.current = persistedData.cards;
        setCards(persistedData.cards);
        setTransition(persistedData.transition);
        setHeight(persistedData.height);
        setSectionSettings(persistedSectionSettings);
        setBackgroundColor(persistedBackgroundColor);
        setActiveIndex(0);
        setLocalCss(customCss);
        sectionState.reset();
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
    const imagePickerPreviewFrameClassName = imageEditorOpen === 'foreground'
        ? 'w-full h-96'
        : 'w-full min-h-[360px]';
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
                title="Hero Section Settings"
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

                <InspectorSection
                    id="universal-layout"
                    title="Layout"
                    isCollapsed={sectionState.isCollapsed('universal-layout')}
                    onToggle={() => sectionState.toggle('universal-layout')}
                >
                    <LayoutTab
                        blockId={blockId}
                        blockType="hero"
                        value={sectionSettings}
                        onChange={setSectionSettings}
                    />
                </InspectorSection>

                <InspectorSection
                    id="style"
                    title="Style"
                    isCollapsed={sectionState.isCollapsed('style')}
                    onToggle={() => sectionState.toggle('style')}
                >
                    <SectionBackgroundColorControl
                        id={`${blockId}-hero-bg`}
                        value={backgroundColor}
                        palette={palette}
                        onChange={setBackgroundColor}
                    />
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
                        <p className="text-xs leading-relaxed text-slate-500">
                            Reorder elements with the up/down arrows. Toggle off any element you don&apos;t need.
                        </p>
                        {resolveElementOrder(activeCard.content.elementOrder).map((key, idx, arr) => {
                            const moveControls = (
                                <MoveControls
                                    onMoveUp={() => moveElement(idx, -1)}
                                    onMoveDown={() => moveElement(idx, 1)}
                                    canMoveUp={idx > 0}
                                    canMoveDown={idx < arr.length - 1}
                                />
                            );
                            if (key === 'pretext') {
                                return (
                                    <PretextRow
                                        key="pretext"
                                        enabled={activeCard.content.pretext.enabled}
                                        onToggle={() => updateContent('pretext', { enabled: !activeCard.content.pretext.enabled })}
                                        align={activeCard.content.pretext.align}
                                        onAlign={(a) => updateContent('pretext', { align: a })}
                                        style={activeCard.content.pretext.style}
                                        onStyle={(s) => updateContent('pretext', { style: s })}
                                        color={activeCard.content.pretext.color}
                                        onColor={(c) => updateContent('pretext', { color: c })}
                                        palette={palette}
                                        moveControls={moveControls}
                                    />
                                );
                            }
                            if (key === 'title') {
                                return (
                                    <ContentRow
                                        key="title"
                                        label="Title"
                                        enabled={activeCard.content.title.enabled}
                                        onToggle={() => updateContent('title', { enabled: !activeCard.content.title.enabled })}
                                        align={activeCard.content.title.align}
                                        onAlign={(a) => updateContent('title', { align: a })}
                                        moveControls={moveControls}
                                    />
                                );
                            }
                            if (key === 'subtitle') {
                                return (
                                    <ContentRow
                                        key="subtitle"
                                        label="Subtitle"
                                        enabled={activeCard.content.subtitle.enabled}
                                        onToggle={() => updateContent('subtitle', { enabled: !activeCard.content.subtitle.enabled })}
                                        align={activeCard.content.subtitle.align}
                                        onAlign={(a) => updateContent('subtitle', { align: a })}
                                        moveControls={moveControls}
                                    />
                                );
                            }
                            if (key === 'social') {
                                return (
                                    <SocialRow
                                        key="social"
                                        enabled={activeCard.content.social.enabled}
                                        onToggle={() => updateContent('social', { enabled: !activeCard.content.social.enabled })}
                                        align={activeCard.content.social.align}
                                        onAlign={(a) => updateContent('social', { align: a })}
                                        links={activeCard.content.social.links}
                                        onLinksChange={(links) => updateContent('social', { links })}
                                        moveControls={moveControls}
                                    />
                                );
                            }
                            if (key === 'cta') {
                                return (
                                    <ContentRow
                                        key="cta"
                                        label="CTA Button"
                                        enabled={activeCard.content.cta.enabled}
                                        onToggle={() => updateContent('cta', { enabled: !activeCard.content.cta.enabled })}
                                        align={activeCard.content.cta.align}
                                        onAlign={(a) => updateContent('cta', { align: a })}
                                        moveControls={moveControls}
                                    >
                                        <SecondaryCtaControls
                                            secondary={activeCard.content.cta.secondary}
                                            placement={activeCard.content.cta.secondaryPlacement === 'below' ? 'below' : 'beside'}
                                            onSecondaryChange={(patch) => updateContent('cta', {
                                                secondary: {
                                                    enabled: false,
                                                    label: DEFAULT_CTA2_LABEL,
                                                    ...(activeCard.content.cta.secondary || {}),
                                                    ...patch,
                                                },
                                            })}
                                            onPlacementChange={(p) => updateContent('cta', { secondaryPlacement: p })}
                                        />
                                    </ContentRow>
                                );
                            }
                            return null;
                        })}
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
                        <div className="grid grid-cols-5 gap-2">
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
                            <AnimationControls
                                bg={activeCard.background}
                                onChange={updateBackground}
                                palette={palette}
                            />
                        )}

                        {activeCard.background.type === 'pattern' && (
                            <PatternControls
                                bg={activeCard.background}
                                onChange={updateBackground}
                                palette={palette}
                            />
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
                        <div className="space-y-5">
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
                            <div className="border-t border-slate-200 pt-4">
                                <KeyframeEditor
                                    blockId={blockId}
                                    blockType="hero"
                                    value={localScript}
                                    onChange={setLocalScript}
                                    isProUser={isProUser}
                                    fieldNames={['title', 'subtitle', 'buttonText', 'buttonTextSecondary', 'image', 'pretext']}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800">
                            <div className="flex items-center gap-2 font-bold">
                                <Crown className="h-4 w-4" />
                                Custom CSS &amp; Keyframe scripting are Pro features
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
                previewFrameClassName={imagePickerPreviewFrameClassName}
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
    moveControls,
    children,
}: {
    label: string;
    enabled: boolean;
    onToggle: () => void;
    align: Align;
    onAlign: (a: Align) => void;
    moveControls?: React.ReactNode;
    children?: React.ReactNode;
}) {
    return (
        <div className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-700">{label}</span>
                <div className="flex items-center gap-1.5">
                    {moveControls}
                    <Toggle checked={enabled} onChange={onToggle} />
                </div>
            </div>
            {enabled && (
                <>
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
                    {children && <div className="mt-3">{children}</div>}
                </>
            )}
        </div>
    );
}

function MoveControls({
    onMoveUp,
    onMoveDown,
    canMoveUp,
    canMoveDown,
}: {
    onMoveUp: () => void;
    onMoveDown: () => void;
    canMoveUp: boolean;
    canMoveDown: boolean;
}) {
    return (
        <div className="flex items-center">
            <button
                type="button"
                onClick={onMoveUp}
                disabled={!canMoveUp}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                title="Move up"
                aria-label="Move element up"
            >
                <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
                type="button"
                onClick={onMoveDown}
                disabled={!canMoveDown}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                title="Move down"
                aria-label="Move element down"
            >
                <ChevronDown className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}

function SecondaryCtaControls({
    secondary,
    placement,
    onSecondaryChange,
    onPlacementChange,
}: {
    secondary: { enabled: boolean; label: string; link?: unknown; icon?: unknown } | undefined;
    placement: SecondaryCtaPlacement;
    onSecondaryChange: (patch: Partial<{ enabled: boolean; label: string; link?: unknown; icon?: unknown }>) => void;
    onPlacementChange: (p: SecondaryCtaPlacement) => void;
}) {
    const enabled = !!secondary?.enabled;
    return (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-sm font-medium text-slate-700">Secondary button</p>
                    <p className="text-xs text-slate-500">Add a second link next to the primary CTA.</p>
                </div>
                <Toggle checked={enabled} onChange={() => onSecondaryChange({ enabled: !enabled })} />
            </div>
            {enabled && (
                <div className="space-y-3">
                    <div>
                        <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Label</label>
                        <input
                            type="text"
                            value={secondary?.label || ''}
                            onChange={(e) => onSecondaryChange({ label: e.target.value })}
                            placeholder={DEFAULT_CTA2_LABEL}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Placement</p>
                        <div className="grid grid-cols-2 gap-2">
                            {(['beside', 'below'] as SecondaryCtaPlacement[]).map((p) => {
                                const isActive = placement === p;
                                return (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => onPlacementChange(p)}
                                        aria-pressed={isActive}
                                        className={`rounded-lg border px-3 py-2 text-sm font-bold capitalize transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                            isActive ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                        }`}
                                    >
                                        {p}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-500">
                        Click the button on the canvas to edit its link, icon, and styling.
                    </p>
                </div>
            )}
        </div>
    );
}

function SocialRow({
    enabled,
    onToggle,
    align,
    onAlign,
    links,
    onLinksChange,
    moveControls,
}: {
    enabled: boolean;
    onToggle: () => void;
    align: Align;
    onAlign: (a: Align) => void;
    links: HeroSocialLink[];
    onLinksChange: (links: HeroSocialLink[]) => void;
    moveControls?: React.ReactNode;
}) {
    const updateLink = (id: string, patch: Partial<HeroSocialLink>) => {
        onLinksChange(links.map((l) => l.id === id ? { ...l, ...patch } : l));
    };
    const removeLink = (id: string) => {
        onLinksChange(links.filter((l) => l.id !== id));
    };
    const addLink = () => {
        const platform = SOCIAL_PLATFORM_OPTIONS[0];
        onLinksChange([
            ...links,
            { id: makeSocialLinkId(), platform: platform.key, label: platform.label, url: '' },
        ]);
    };
    const moveLink = (idx: number, dir: -1 | 1) => {
        const target = idx + dir;
        if (target < 0 || target >= links.length) return;
        const next = [...links];
        const [item] = next.splice(idx, 1);
        next.splice(target, 0, item);
        onLinksChange(next);
    };

    return (
        <div className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-sm font-medium text-slate-700">Social links</p>
                    <p className="text-xs text-slate-500">Round social icons rendered inline with the content.</p>
                </div>
                <div className="flex items-center gap-1.5">
                    {moveControls}
                    <Toggle checked={enabled} onChange={onToggle} />
                </div>
            </div>
            {enabled && (
                <div className="mt-3 space-y-3">
                    <div>
                        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">Alignment</p>
                        <div className="grid grid-cols-3 gap-1">
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
                                    >
                                        <Icon className="h-3.5 w-3.5" />
                                        {alignLabel}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="space-y-2">
                        {links.length === 0 && (
                            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                                No social links yet. Add one below.
                            </p>
                        )}
                        {links.map((link, idx) => (
                            <SocialLinkRow
                                key={link.id}
                                link={link}
                                canMoveUp={idx > 0}
                                canMoveDown={idx < links.length - 1}
                                onMoveUp={() => moveLink(idx, -1)}
                                onMoveDown={() => moveLink(idx, 1)}
                                onChange={(patch) => updateLink(link.id, patch)}
                                onRemove={() => removeLink(link.id)}
                            />
                        ))}
                        <button
                            type="button"
                            onClick={addLink}
                            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-blue-300 px-3 py-1.5 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-50"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Add social link
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function SocialLinkRow({
    link,
    canMoveUp,
    canMoveDown,
    onMoveUp,
    onMoveDown,
    onChange,
    onRemove,
}: {
    link: HeroSocialLink;
    canMoveUp: boolean;
    canMoveDown: boolean;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onChange: (patch: Partial<HeroSocialLink>) => void;
    onRemove: () => void;
}) {
    const iconComponent = getSocialIcon(link.platform);
    return (
        <div className="rounded-lg border border-slate-200 bg-white p-2.5">
            <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600">
                    {createElement(iconComponent, { className: 'h-4 w-4' })}
                </span>
                <select
                    value={link.platform}
                    onChange={(e) => {
                        const platform = e.target.value;
                        onChange({ platform, label: getSocialPlatformLabel(platform) });
                    }}
                    className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                >
                    {SOCIAL_PLATFORM_OPTIONS.map((opt) => (
                        <option key={opt.key} value={opt.key}>{opt.label}</option>
                    ))}
                </select>
                <MoveControls
                    onMoveUp={onMoveUp}
                    onMoveDown={onMoveDown}
                    canMoveUp={canMoveUp}
                    canMoveDown={canMoveDown}
                />
                <button
                    type="button"
                    onClick={onRemove}
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                    title="Remove"
                    aria-label="Remove social link"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            </div>
            <input
                type="url"
                value={link.url}
                onChange={(e) => onChange({ url: e.target.value })}
                placeholder="https://..."
                className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
            />
        </div>
    );
}

const PRETEXT_STYLE_OPTIONS: Array<{ id: HeroPretextStyle; label: string }> = [
    { id: 'text', label: 'Text' },
    { id: 'pill', label: 'Pill' },
    { id: 'outline', label: 'Outline' },
    { id: 'underline', label: 'Underline' },
];

const PRETEXT_COLOR_TOKENS: Array<{ value: string; label: string; paletteKey: string; title: string }> = [
    { value: 'palette:primary', label: 'P', paletteKey: 'primary', title: 'Use palette primary' },
    { value: 'palette:secondary', label: 'S', paletteKey: 'secondary', title: 'Use palette secondary' },
    { value: 'palette:accent', label: 'A', paletteKey: 'accent', title: 'Use palette accent' },
];

function PretextRow({
    enabled,
    onToggle,
    align,
    onAlign,
    style,
    onStyle,
    color,
    onColor,
    palette,
    moveControls,
}: {
    enabled: boolean;
    onToggle: () => void;
    align: Align;
    onAlign: (a: Align) => void;
    style: HeroPretextStyle;
    onStyle: (s: HeroPretextStyle) => void;
    color: string;
    onColor: (c: string) => void;
    palette: Record<string, string>;
    moveControls?: React.ReactNode;
}) {
    return (
        <div className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <span className="text-sm font-medium text-slate-700">Label</span>
                    <p className="text-xs text-slate-500">Small text shown above the title.</p>
                </div>
                <div className="flex items-center gap-1.5">
                    {moveControls}
                    <Toggle checked={enabled} onChange={onToggle} />
                </div>
            </div>
            {enabled && (
                <div className="mt-3 space-y-3">
                    <div>
                        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">Alignment</p>
                        <div className="grid grid-cols-3 gap-1">
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
                                        title={`Label ${alignLabel}`}
                                    >
                                        <Icon className="h-3.5 w-3.5" />
                                        {alignLabel}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div>
                        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">Style</p>
                        <div className="grid grid-cols-2 gap-2">
                            {PRETEXT_STYLE_OPTIONS.map((option) => {
                                const active = style === option.id;
                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => onStyle(option.id)}
                                        aria-pressed={active}
                                        className={`rounded-lg border px-3 py-2 text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                            active ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div>
                        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">Color</p>
                        <div className="flex items-center gap-1">
                            {PRETEXT_COLOR_TOKENS.map(({ value, label, paletteKey, title }) => {
                                const active = color === value;
                                return (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => onColor(value)}
                                        title={title}
                                        className={`w-8 h-8 rounded-full border text-[10px] font-bold shadow-sm transition-transform ${active ? 'border-slate-900 scale-105' : 'border-white'}`}
                                        style={{
                                            backgroundColor: palette[paletteKey] || '#ffffff',
                                            color: paletteKey === 'accent' ? (palette.primary || '#0f172a') : '#ffffff',
                                        }}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
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

/** Compact preview tile for an animation or pattern card. Renders the
 *  actual component at thumbnail size with its current resolved colors. */
function VariantPreview({ children }: { children: React.ReactNode }) {
    return (
        <div className="pointer-events-none relative h-20 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
            {children}
        </div>
    );
}

function SectionBackgroundColorControl({
    id,
    value,
    palette,
    onChange,
}: {
    id: string;
    value: string;
    palette: Record<string, string>;
    onChange: (next: string) => void;
}) {
    return (
        <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor={id}>
                Section background color
            </label>
            <SideBySideBackgroundOverrideNotice />
            <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                    id={id}
                    type="color"
                    value={getColorInputValue(value, palette, '#ffffff')}
                    onChange={(event) => onChange(event.target.value)}
                    className="h-10 w-10 cursor-pointer rounded border border-slate-200 bg-white"
                />
                <PaletteTokenButtons selected={value} palette={palette} onSelect={onChange} />
            </div>
            <div className="mt-3 flex gap-2">
                <input
                    type="text"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder="Default"
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                    type="button"
                    onClick={() => onChange('')}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                >
                    Reset
                </button>
            </div>
        </div>
    );
}

/** Editor for one named color slot. Hex picker + palette tokens + reset. */
function ColorSlotEditor({
    label,
    value,
    palette,
    defaultToken,
    onChange,
}: {
    label: string;
    value: string;
    palette: Record<string, string>;
    defaultToken: string;
    onChange: (next: string) => void;
}) {
    const isDefault = value === defaultToken;
    const hex = getColorInputValue(value, palette, '#1f2937');
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
                {!isDefault && (
                    <button
                        type="button"
                        onClick={() => onChange(defaultToken)}
                        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                        title="Reset to default"
                    >
                        <RotateCcw className="h-3 w-3" />
                        Reset
                    </button>
                )}
            </div>
            <div className="flex items-center gap-2">
                <input
                    type="color"
                    value={hex}
                    onChange={(e) => onChange(e.target.value)}
                    className="h-9 w-9 shrink-0 cursor-pointer rounded border border-slate-200 bg-white"
                />
                <PaletteTokenButtons selected={value} palette={palette} onSelect={onChange} />
            </div>
        </div>
    );
}

/** Update one entry in the colors[] override array, preserving others. */
function setSlotColor(current: string[] | undefined, slotCount: number, defaults: string[], index: number, next: string): string[] {
    const arr: string[] = Array.from({ length: slotCount }, (_, i) => current?.[i] ?? defaults[i]);
    arr[index] = next;
    return arr;
}

function AnimationControls({
    bg,
    onChange,
    palette,
}: {
    bg: HeroBackground;
    onChange: (patch: Partial<HeroBackground>) => void;
    palette: Record<string, string>;
}) {
    const activeId: HeroBgAnimationId = (bg.animation?.id || 'aurora') as HeroBgAnimationId;
    const activeMeta = HERO_BG_ANIMATION_META[activeId] || HERO_BG_ANIMATION_META.aurora;
    const slots = activeMeta.colorSlots;
    const defaults = slots.map((s) => s.defaultToken);
    const overrides = bg.animation?.colors;
    const resolvedActiveColors = resolveSlotColors(slots, overrides, palette, resolvePaletteColor);

    const setSlot = (index: number, next: string) => {
        const arr = setSlotColor(overrides, slots.length, defaults, index, next);
        onChange({ animation: { id: activeId, colors: arr } });
    };

    const resetAllColors = () => {
        onChange({ animation: { id: activeId, colors: undefined } });
    };

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
                {HERO_BG_ANIMATION_LIST.map((anim) => {
                    const isActive = activeId === anim.id;
                    // Each thumbnail renders with the variant's defaults so the
                    // editor can compare options at a glance.
                    const previewColors = resolveSlotColors(anim.colorSlots, undefined, palette, resolvePaletteColor);
                    return (
                        <button
                            key={anim.id}
                            type="button"
                            onClick={() => onChange({ animation: { id: anim.id, colors: undefined } })}
                            aria-pressed={isActive}
                            className={`overflow-hidden rounded-xl border text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                isActive ? 'border-blue-600 ring-1 ring-blue-600' : 'border-slate-200 hover:border-slate-300'
                            }`}
                        >
                            <VariantPreview>
                                <HeroBgAnimation id={anim.id} colors={previewColors} />
                            </VariantPreview>
                            <div className={`px-2.5 py-2 ${isActive ? 'bg-blue-50' : 'bg-white'}`}>
                                <span className="block text-xs font-bold text-slate-900">{anim.label}</span>
                                <span className="mt-0.5 block text-[10px] leading-snug text-slate-500 line-clamp-2">{anim.description}</span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Live large preview of the selected animation */}
            <div className="relative h-32 overflow-hidden rounded-xl border border-slate-200">
                <HeroBgAnimation id={activeId} colors={resolvedActiveColors} />
                <div className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white">
                    {activeMeta.label}
                </div>
            </div>

            {/* Color slot editors */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Colors</p>
                    {overrides && overrides.length > 0 && (
                        <button
                            type="button"
                            onClick={resetAllColors}
                            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        >
                            <RotateCcw className="h-3 w-3" />
                            Reset all
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {slots.map((slot, i) => {
                        const value = overrides?.[i] ?? slot.defaultToken;
                        return (
                            <ColorSlotEditor
                                key={`${activeId}-${i}`}
                                label={slot.label}
                                value={value}
                                palette={palette}
                                defaultToken={slot.defaultToken}
                                onChange={(next) => setSlot(i, next)}
                            />
                        );
                    })}
                </div>
            </div>

            <OverlayControls bg={bg} onChange={onChange} />
        </div>
    );
}

function PatternControls({
    bg,
    onChange,
    palette,
}: {
    bg: HeroBackground;
    onChange: (patch: Partial<HeroBackground>) => void;
    palette: Record<string, string>;
}) {
    const activeId: HeroBgPatternId = (bg.pattern?.id || 'dotsGrid') as HeroBgPatternId;
    const activeMeta = HERO_BG_PATTERN_META[activeId] || HERO_BG_PATTERN_META.dotsGrid;
    const slots = activeMeta.colorSlots;
    const defaults = slots.map((s) => s.defaultToken);
    const overrides = bg.pattern?.colors;
    const scale = bg.pattern?.scale ?? 1;
    const rotation = bg.pattern?.rotation ?? 0;
    const opacity = bg.pattern?.opacity ?? 1;
    const resolvedActiveColors = resolveSlotColors(slots, overrides, palette, resolvePaletteColor);

    const updatePattern = (patch: Partial<NonNullable<HeroBackground['pattern']>>) => {
        onChange({
            pattern: {
                id: activeId,
                colors: overrides,
                scale,
                rotation,
                opacity,
                ...patch,
            },
        });
    };

    const setSlot = (index: number, next: string) => {
        const arr = setSlotColor(overrides, slots.length, defaults, index, next);
        updatePattern({ colors: arr });
    };

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
                {HERO_BG_PATTERN_LIST.map((p) => {
                    const isActive = activeId === p.id;
                    const previewColors = resolveSlotColors(p.colorSlots, undefined, palette, resolvePaletteColor);
                    return (
                        <button
                            key={p.id}
                            type="button"
                            onClick={() => onChange({
                                pattern: {
                                    id: p.id,
                                    colors: undefined,
                                    scale: 1,
                                    rotation: 0,
                                    opacity: 1,
                                },
                            })}
                            aria-pressed={isActive}
                            className={`overflow-hidden rounded-xl border text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                isActive ? 'border-blue-600 ring-1 ring-blue-600' : 'border-slate-200 hover:border-slate-300'
                            }`}
                        >
                            <VariantPreview>
                                <HeroBgPattern id={p.id} colors={previewColors} scale={1} rotation={0} opacity={1} />
                            </VariantPreview>
                            <div className={`px-2.5 py-2 ${isActive ? 'bg-blue-50' : 'bg-white'}`}>
                                <span className="block text-xs font-bold text-slate-900">{p.label}</span>
                                <span className="mt-0.5 block text-[10px] leading-snug text-slate-500 line-clamp-2">{p.description}</span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Large preview */}
            <div className="relative h-32 overflow-hidden rounded-xl border border-slate-200">
                <HeroBgPattern
                    id={activeId}
                    colors={resolvedActiveColors}
                    scale={scale}
                    rotation={rotation}
                    opacity={opacity}
                />
                <div className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white">
                    {activeMeta.label}
                </div>
            </div>

            {/* Geometry controls */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Tile</p>
                <div className="space-y-2">
                    <div>
                        <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            Scale: {scale.toFixed(2)}×
                        </label>
                        <input
                            type="range"
                            min={50}
                            max={200}
                            value={Math.round(scale * 100)}
                            onChange={(e) => updatePattern({ scale: parseInt(e.target.value) / 100 })}
                            className="w-full accent-blue-600"
                        />
                    </div>
                    <div>
                        <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            Rotation: {rotation}°
                        </label>
                        <input
                            type="range"
                            min={0}
                            max={360}
                            value={rotation}
                            onChange={(e) => updatePattern({ rotation: parseInt(e.target.value) || 0 })}
                            className="w-full accent-blue-600"
                        />
                    </div>
                    <div>
                        <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            Opacity: {Math.round(opacity * 100)}%
                        </label>
                        <input
                            type="range"
                            min={0}
                            max={100}
                            value={Math.round(opacity * 100)}
                            onChange={(e) => updatePattern({ opacity: parseInt(e.target.value) / 100 })}
                            className="w-full accent-blue-600"
                        />
                    </div>
                </div>
            </div>

            {/* Color slot editors */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Colors</p>
                    {overrides && overrides.length > 0 && (
                        <button
                            type="button"
                            onClick={() => updatePattern({ colors: undefined })}
                            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        >
                            <RotateCcw className="h-3 w-3" />
                            Reset all
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {slots.map((slot, i) => {
                        const value = overrides?.[i] ?? slot.defaultToken;
                        return (
                            <ColorSlotEditor
                                key={`${activeId}-${i}`}
                                label={slot.label}
                                value={value}
                                palette={palette}
                                defaultToken={slot.defaultToken}
                                onChange={(next) => setSlot(i, next)}
                            />
                        );
                    })}
                </div>
            </div>

            <OverlayControls bg={bg} onChange={onChange} />
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
