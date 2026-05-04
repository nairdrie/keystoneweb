'use client';

import { useEffect, useMemo, useState } from 'react';
import { BlockData, useEditorContext } from '@/lib/editor-context';
import EditableText from '@/app/components/EditableText';
import EditableImage from '@/app/components/EditableImage';
import EditableButton, { type ButtonIconData, type ButtonLinkData } from '@/app/components/EditableButton';
import type { ImageSettings, UnsplashAttribution } from '@/app/components/ImageEditorModal';
import Reveal from '@/app/components/Reveal';
import { resolvePaletteColor } from '@/lib/palette-colors';
import {
    DEFAULT_CTA_LABEL,
    DEFAULT_SUBTITLE,
    DEFAULT_TITLE,
    HeroBackground,
    HeroCard,
    HeroData,
    legacyVariantClass,
    migrateLegacyHeroData,
} from './hero/hero-schema';
import { HeroBgAnimation } from './hero/HeroBgAnimations';

const TEXT_ALIGN_CLASS: Record<'left' | 'center' | 'right', string> = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
};

const FLEX_ALIGN_CLASS: Record<'left' | 'center' | 'right', string> = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
};

export default function HeroBlock({
    block,
    data: dataProp,
    palette,
}: {
    block: BlockData;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: Record<string, any>;
    palette: Record<string, string>;
}) {
    const context = useEditorContext();
    const isEditMode = context?.isEditMode || false;

    // BlockWrapperEditor overrides the `data` prop with draft data during
    // the live-preview flow (cloneElement). Prefer that when present so
    // settings-panel changes show on the canvas instantly. Fall back to the
    // persisted block.data for non-edit / non-draft renders.
    const rawData = dataProp ?? block.data;

    const data: HeroData = useMemo(() => migrateLegacyHeroData(rawData), [rawData]);

    const cards = data.cards;
    const cardCount = cards.length;
    const transition = data.transition;
    const heightCfg = data.height;

    const editorActiveIndex = typeof rawData?.__activeCardIndex === 'number' ? rawData.__activeCardIndex : null;
    const pauseRotation = rawData?.__pauseRotation === true;

    const [autoIndex, setAutoIndex] = useState(0);
    const activeIndex = editorActiveIndex !== null
        ? Math.max(0, Math.min(editorActiveIndex, cardCount - 1))
        : Math.max(0, Math.min(autoIndex, cardCount - 1));

    useEffect(() => {
        if (cardCount <= 1 || pauseRotation || transition.type === 'none') return;
        const id = setInterval(() => {
            setAutoIndex((i) => (i + 1) % cardCount);
        }, Math.max(2, transition.intervalSec) * 1000);
        return () => clearInterval(id);
    }, [cardCount, pauseRotation, transition.intervalSec, transition.type]);

    const updateData = (cardIndex: number) => (key: string, value: unknown) => {
        // Inline-edit a content field of a specific card. Persists by writing
        // the whole `cards` array back through editor context.
        const next = cards.map((c, i) => {
            if (i !== cardIndex) return c;
            const nc: HeroCard = JSON.parse(JSON.stringify(c));
            // Keys we know how to project back into the new schema
            if (key === 'title') {
                nc.content.title.value = String(value ?? '');
            } else if (key === 'subtitle') {
                nc.content.subtitle.value = String(value ?? '');
            } else if (key === 'buttonText') {
                nc.content.cta.label = String(value ?? '');
            } else if (key === 'buttonTextLink') {
                nc.content.cta.link = value;
            } else if (key === 'buttonTextIcon') {
                nc.content.cta.icon = value;
            } else if (key === 'image') {
                nc.content.image.url = String(value ?? '');
            } else if (key === 'image__settings') {
                nc.content.image.settings = value;
            } else if (key === 'image__attribution') {
                nc.content.image.attribution = value;
            }
            return nc;
        });
        context?.updateBlockData?.(block.id, 'cards', next);

        // Style metadata (font/color) is still keyed off the old `__styles`
        // properties — pass through unchanged so existing element-level
        // settings keep working.
        if (key.endsWith('__styles')) {
            context?.updateBlockData?.(block.id, key, value);
        }
    };

    // Pick the LCP image URL for hint preloading
    const lcpImageUrl: string | null = useMemo(() => {
        if (isEditMode) return null;
        const c = cards[0];
        if (!c) return null;
        if (c.background.type === 'image' && c.background.image?.url) return c.background.image.url;
        if (c.content.image.enabled && c.content.image.url) return c.content.image.url;
        return null;
    }, [cards, isEditMode]);

    // Compute height styles
    const heightStyles = useMemo<React.CSSProperties>(() => {
        const out: React.CSSProperties = {};
        if (heightCfg.mode === 'manual') {
            out.minHeight = `${heightCfg.valuePx}px`;
        } else if (heightCfg.mode === 'fitScreen') {
            // Will be refined via inline CSS class targeting first-block context.
            out.minHeight = '100dvh';
        }
        return out;
    }, [heightCfg]);

    const activeCard = cards[activeIndex] ?? cards[0];

    return (
        <section
            className={`hero relative overflow-hidden ks-hero-${heightCfg.mode}`}
            style={heightStyles}
            data-hero-cards={cardCount}
        >
            {/* fit-screen header awareness, scoped to .first-block-offset wrapping */}
            <style dangerouslySetInnerHTML={{ __html: HERO_HEIGHT_CSS }} />

            {lcpImageUrl && <link rel="preload" as="image" href={lcpImageUrl} fetchPriority="high" />}

            {/* All cards layered absolutely so backgrounds always fill the section
                (which is sized below by the in-flow content sizer or by min-height). */}
            {cards.map((card, i) => {
                const isActive = i === activeIndex;
                const transitionStyles = computeCardTransition(transition.type, isActive, i, activeIndex, cardCount);
                return (
                    <div
                        key={card.id}
                        className={`absolute inset-0 ${legacyVariantClass(card)} ${isActive ? 'ks-hero-card-active' : ''}`}
                        style={transitionStyles}
                        aria-hidden={!isActive}
                    >
                        <HeroCardRenderer
                            card={card}
                            palette={palette}
                            isEditMode={isEditMode && isActive}
                            onSave={updateData(i)}
                            uploadImage={context?.uploadImage}
                            blockData={rawData}
                        />
                    </div>
                );
            })}

            {/* In-flow sizer: an invisible duplicate of the active card's content layer.
                This is what gives the section its intrinsic height in fit-content mode
                so the absolutely-positioned backgrounds have something to fill. For
                fit-screen / manual modes the section's min-height is what dominates. */}
            {activeCard && (
                <div className="invisible relative z-0 pointer-events-none" aria-hidden>
                    <HeroCardContent
                        card={activeCard}
                        palette={palette}
                        isEditMode={false}
                        onSave={() => {}}
                        blockData={rawData}
                    />
                </div>
            )}

            {/* Card dots in non-edit mode */}
            {!isEditMode && cardCount > 1 && transition.type !== 'none' && (
                <div className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2 flex gap-2">
                    {cards.map((_, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => setAutoIndex(i)}
                            aria-label={`Go to card ${i + 1}`}
                            className={`h-2 w-2 rounded-full transition-all ${i === activeIndex ? 'bg-white w-6' : 'bg-white/50 hover:bg-white/70'}`}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}

const HERO_HEIGHT_CSS = `
.first-block-offset > .ks-block .hero.ks-hero-fitScreen { min-height: calc(100dvh - var(--ks-header-height, 0px)); }
:root[data-ks-header-overlay="true"] .first-block-offset > .ks-block .hero.ks-hero-fitScreen {
    min-height: 100dvh;
    padding-top: var(--ks-header-height, 0px);
}
`;

function computeCardTransition(
    type: 'fade' | 'slide' | 'none',
    isActive: boolean,
    cardIndex: number,
    activeIndex: number,
    cardCount: number,
): React.CSSProperties {
    if (cardCount <= 1) return { opacity: 1 };
    if (type === 'none') return { opacity: isActive ? 1 : 0, pointerEvents: isActive ? 'auto' : 'none' };
    if (type === 'fade') {
        return {
            opacity: isActive ? 1 : 0,
            transition: 'opacity 700ms ease-in-out',
            pointerEvents: isActive ? 'auto' : 'none',
        };
    }
    // slide: shift translateX
    const offset = (cardIndex - activeIndex) * 100;
    return {
        transform: `translateX(${offset}%)`,
        transition: 'transform 700ms ease-in-out',
        pointerEvents: isActive ? 'auto' : 'none',
    };
}

function HeroCardRenderer(props: {
    card: HeroCard;
    palette: Record<string, string>;
    isEditMode: boolean;
    onSave: (key: string, value: unknown) => void;
    uploadImage?: (file: File, contentKey: string) => Promise<string>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    blockData: Record<string, any> | undefined;
}) {
    return (
        <>
            <BackgroundLayer bg={props.card.background} palette={props.palette} />
            <HeroCardContent {...props} />
        </>
    );
}

function HeroCardContent({
    card,
    palette,
    isEditMode,
    onSave,
    uploadImage,
    blockData,
}: {
    card: HeroCard;
    palette: Record<string, string>;
    isEditMode: boolean;
    onSave: (key: string, value: unknown) => void;
    uploadImage?: (file: File, contentKey: string) => Promise<string>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    blockData: Record<string, any> | undefined;
}) {
    const pPrimary = palette.primary || '#1f2937';
    const pSecondary = palette.secondary || '#ef4444';

    const showText = card.content.title.enabled || card.content.subtitle.enabled || card.content.cta.enabled;
    const showForeground = card.content.image.enabled && (card.content.image.url || isEditMode);
    const imageOnRight = card.content.image.side !== 'left';

    // Default text color: white when on a media background, primary otherwise.
    const isMediaBg = card.background.type === 'image' || card.background.type === 'video' || card.background.type === 'animation';
    const textColor = isMediaBg ? '#ffffff' : pPrimary;

    return (
        <div className="hero-container relative z-10 mx-auto flex h-full w-full max-w-7xl items-center px-4 py-20 md:py-24">
            <div className={`grid w-full gap-10 items-center ${showForeground && showText ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
                {showText && (
                    <div className={`hero-content ${imageOnRight || !showForeground ? 'order-1' : 'order-2 md:order-1'}`}>
                        {card.content.title.enabled && (
                            <Reveal>
                                <EditableText
                                    as="h1"
                                    contentKey="title"
                                    styleData={blockData?.['title__styles'] as string | Record<string, unknown> | undefined}
                                    content={card.content.title.value}
                                    defaultValue={DEFAULT_TITLE}
                                    isEditMode={isEditMode}
                                    onSave={onSave}
                                    className={`hero-title text-4xl md:text-6xl font-extrabold leading-tight ${TEXT_ALIGN_CLASS[card.content.title.align]}`}
                                    style={{ color: textColor }}
                                />
                            </Reveal>
                        )}
                        {card.content.subtitle.enabled && (
                            <Reveal>
                                <EditableText
                                    as="p"
                                    contentKey="subtitle"
                                    styleData={blockData?.['subtitle__styles'] as string | Record<string, unknown> | undefined}
                                    content={card.content.subtitle.value}
                                    defaultValue={DEFAULT_SUBTITLE}
                                    isEditMode={isEditMode}
                                    onSave={onSave}
                                    className={`hero-subtitle mt-6 text-lg md:text-xl ${TEXT_ALIGN_CLASS[card.content.subtitle.align]}`}
                                    style={{ color: isMediaBg ? 'rgba(255,255,255,0.85)' : 'rgba(15,23,42,0.7)' }}
                                />
                            </Reveal>
                        )}
                        {card.content.cta.enabled && (
                            <Reveal>
                                <div className={`mt-8 flex ${FLEX_ALIGN_CLASS[card.content.cta.align]}`}>
                                    <EditableButton
                                        contentKey="buttonText"
                                        label={card.content.cta.label}
                                        linkData={card.content.cta.link as Partial<ButtonLinkData> | undefined}
                                        iconData={card.content.cta.icon as ButtonIconData | undefined}
                                        defaultLabel={DEFAULT_CTA_LABEL}
                                        isEditMode={isEditMode}
                                        onSave={onSave}
                                        className="hero-button px-8 py-4 text-white font-bold rounded-lg shadow-lg hover:opacity-90 transition-opacity inline-block"
                                        style={{ backgroundColor: pSecondary, color: '#ffffff' }}
                                    />
                                </div>
                            </Reveal>
                        )}
                    </div>
                )}
                {showForeground && (
                    <Reveal className={imageOnRight ? 'order-2' : 'order-1 md:order-1'}>
                        <EditableImage
                            contentKey="image"
                            initialSettings={card.content.image.settings as ImageSettings | undefined}
                            initialAttribution={card.content.image.attribution as UnsplashAttribution | undefined}
                            imageUrl={card.content.image.url}
                            isEditMode={isEditMode}
                            onSave={onSave}
                            onUpload={uploadImage}
                            className="hero-image w-full h-96 object-cover rounded-2xl shadow-xl"
                            placeholder="Click to upload hero image"
                            priority
                        />
                    </Reveal>
                )}
            </div>
        </div>
    );
}

function BackgroundLayer({ bg, palette }: { bg: HeroBackground; palette: Record<string, string> }) {
    const overlay = bg.overlay || { color: '#000000', opacity: 0 };

    let mediaLayer: React.ReactNode = null;
    const baseStyle: React.CSSProperties = {};

    if (bg.type === 'image' && bg.image?.url) {
        mediaLayer = (
            <div
                className="hero-bg-image absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: `url(${bg.image.url})` }}
            />
        );
    } else if (bg.type === 'video' && bg.video?.url) {
        mediaLayer = (
            <video
                autoPlay
                muted
                loop
                playsInline
                className="hero-video-bg absolute inset-0 z-0 h-full w-full object-cover"
            >
                <source src={bg.video.url} type="video/mp4" />
            </video>
        );
    } else if (bg.type === 'gradient' && bg.gradient) {
        const from = resolvePaletteColor(bg.gradient.from, palette, palette.primary || '#1f2937');
        const to = resolvePaletteColor(bg.gradient.to, palette, palette.secondary || '#ef4444');
        const via = bg.gradient.via ? resolvePaletteColor(bg.gradient.via, palette, '#ffffff') : null;
        const stops = via ? `${from}, ${via}, ${to}` : `${from}, ${to}`;
        baseStyle.background = `linear-gradient(${bg.gradient.angle}deg, ${stops})`;
    } else if (bg.type === 'animation' && bg.animation) {
        mediaLayer = <HeroBgAnimation id={bg.animation.id} />;
    } else {
        baseStyle.backgroundColor = palette.accent || '#f3f4f6';
    }

    return (
        <div className="hero-bg-fallback absolute inset-0 z-0" style={baseStyle}>
            {mediaLayer}
            {overlay.opacity > 0 && (
                <div
                    className="hero-overlay absolute inset-0 z-0"
                    style={{ backgroundColor: overlay.color, opacity: overlay.opacity }}
                />
            )}
        </div>
    );
}
