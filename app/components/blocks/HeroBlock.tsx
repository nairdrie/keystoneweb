'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BlockData, useEditorContext } from '@/lib/editor-context';
import EditableText from '@/app/components/EditableText';
import EditableImage from '@/app/components/EditableImage';
import EditableButton, { type ButtonIconData, type ButtonLinkData } from '@/app/components/EditableButton';
import BlockPretext from '@/app/components/BlockPretext';
import type { ImageSettings, UnsplashAttribution } from '@/app/components/ImageEditorModal';
import Reveal from '@/app/components/Reveal';
import { resolvePaletteColor } from '@/lib/palette-colors';
import {
    DEFAULT_CTA2_LABEL,
    DEFAULT_CTA_LABEL,
    DEFAULT_PRETEXT,
    DEFAULT_SUBTITLE,
    DEFAULT_TITLE,
    HeroBackground,
    HeroBreakpoint,
    HeroCard,
    HeroData,
    HeroElementKey,
    HeroHeight,
    HeroHeightConfig,
    HeroSocialLink,
    legacyVariantClass,
    migrateLegacyHeroData,
    resolveElementOrder,
} from './hero/hero-schema';
import { getSocialIcon, getSocialPlatformLabel, normalizeHref } from './contact/contact-config';
import { HeroBgAnimation, HERO_BG_ANIMATION_META } from './hero/HeroBgAnimations';
import { HeroBgPattern, HERO_BG_PATTERN_META } from './hero/HeroBgPatterns';
import { resolveSlotColors } from './hero/hero-bg-shared';

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
    updateContent,
}: {
    block: BlockData;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: Record<string, any>;
    palette: Record<string, string>;
    updateContent?: (key: string, value: unknown) => void;
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
    const cardsRef = useRef<HeroCard[]>(cards);
    const cardCount = cards.length;
    const transition = data.transition;
    const heightCfg = data.height;

    const editorActiveIndex = typeof rawData?.__activeCardIndex === 'number' ? rawData.__activeCardIndex : null;
    const pauseRotation = rawData?.__pauseRotation === true;

    const [autoIndex, setAutoIndex] = useState(0);
    // When the settings panel is closed, the canvas dots still need to drive
    // which card is in focus for inline editing. Track that here.
    const [editIndex, setEditIndex] = useState<number>(0);
    const clamp = (n: number) => Math.max(0, Math.min(n, cardCount - 1));
    const activeIndex = editorActiveIndex !== null
        ? clamp(editorActiveIndex)
        : isEditMode
            ? clamp(editIndex)
            : clamp(autoIndex);

    // Mirror the settings-panel selection so closing the panel doesn't reset
    // the canvas to card 0 — the editor stays parked on whatever card they
    // were last working on.
    useEffect(() => {
        cardsRef.current = cards;
    }, [cards]);

    useEffect(() => {
        if (editorActiveIndex !== null) setEditIndex(editorActiveIndex);
    }, [editorActiveIndex]);

    const manualPauseUntil = useRef(0);

    useEffect(() => {
        if (isEditMode) return;
        if (cardCount <= 1 || pauseRotation || transition.type === 'none') return;
        const id = setInterval(() => {
            if (Date.now() < manualPauseUntil.current) return;
            setAutoIndex((i) => (i + 1) % cardCount);
        }, Math.max(2, transition.intervalSec) * 1000);
        return () => clearInterval(id);
    }, [cardCount, pauseRotation, transition.intervalSec, transition.type, isEditMode]);

    const goToCard = useCallback((i: number) => {
        manualPauseUntil.current = Date.now() + 30_000;
        setAutoIndex(i);
    }, []);

    const setActiveCardForEditing = (i: number) => {
        setEditIndex(i);
        // Notify the settings panel (if open) so its activeIndex stays in sync.
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('ks:hero-set-active-card', {
                detail: { blockId: block.id, index: i },
            }));
        }
    };

    const updateData = (cardIndex: number) => (key: string, value: unknown) => {
        // Inline-edit a content field of a specific card. Persists by writing
        // the whole `cards` array back through editor context.
        const next = cardsRef.current.map((c, i) => {
            if (i !== cardIndex) return c;
            const nc: HeroCard = JSON.parse(JSON.stringify(c));
            // Keys we know how to project back into the new schema
            if (key === 'title') {
                nc.content.title.value = String(value ?? '');
            } else if (key === 'subtitle') {
                nc.content.subtitle.value = String(value ?? '');
            } else if (key === 'pretext') {
                nc.content.pretext.value = String(value ?? '');
            } else if (key === 'buttonText') {
                nc.content.cta.label = String(value ?? '');
            } else if (key === 'buttonTextLink') {
                nc.content.cta.link = value;
            } else if (key === 'buttonTextIcon') {
                nc.content.cta.icon = value;
            } else if (key === 'buttonText2') {
                nc.content.cta.secondary = {
                    ...(nc.content.cta.secondary || { enabled: true, label: DEFAULT_CTA2_LABEL }),
                    label: String(value ?? ''),
                };
            } else if (key === 'buttonText2Link') {
                nc.content.cta.secondary = {
                    ...(nc.content.cta.secondary || { enabled: true, label: DEFAULT_CTA2_LABEL }),
                    link: value,
                };
            } else if (key === 'buttonText2Icon') {
                nc.content.cta.secondary = {
                    ...(nc.content.cta.secondary || { enabled: true, label: DEFAULT_CTA2_LABEL }),
                    icon: value,
                };
            } else if (key === 'image') {
                const nextUrl = String(value ?? '');
                nc.content.image.url = nextUrl;
                if (nextUrl) {
                    nc.content.image.enabled = true;
                }
            } else if (key === 'image__settings') {
                nc.content.image.settings = value;
            } else if (key === 'image__attribution') {
                nc.content.image.attribution = value;
            }
            return nc;
        });
        cardsRef.current = next;
        if (updateContent) updateContent('cards', next);
        else context?.updateBlockData?.(block.id, 'cards', next);

        if (key.endsWith('__styles')) {
            const scopedKey = `${key}__${cardIndex}`;
            if (updateContent) updateContent(scopedKey, value);
            else context?.updateBlockData?.(block.id, scopedKey, value);
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

    // Per-breakpoint height CSS — emitted as a scoped <style> tag so the
    // correct min-height is applied at SSR (no hydration flash on mobile).
    const heroScopeClass = `ks-hero-${block.id}`;
    const heightCss = useMemo(() => buildHeroHeightCss(heroScopeClass, heightCfg), [heroScopeClass, heightCfg]);

    // Measure next-N sibling heights and publish as --hero-peek-height so
    // fit-screen + revealNext can subtract them from 100dvh. The count and
    // mode for the *current* breakpoint are picked at runtime; the CSS still
    // honors per-breakpoint mode via media queries above.
    const sectionRef = useRef<HTMLElement>(null);
    useEffect(() => {
        const section = sectionRef.current;
        if (!section) return;
        const wrapper = section.closest('[data-tour="builder-section-frame"]') as HTMLElement | null;
        // When rendered inside the editor's preview iframe, parent-window
        // markers like `.ks-preview-mode` aren't reachable from inside the
        // iframe document. The iframe itself is sized to the device, so the
        // iframe's own `innerWidth` already reflects the breakpoint — we just
        // detect that case and skip the parent-class lookup.
        const ownerWin = section.ownerDocument?.defaultView ?? window;
        const isInIframe = ownerWin !== window;
        const previewHost = isInIframe
            ? null
            : (section.closest('.ks-preview-mode') as HTMLElement | null);
        let observers: ResizeObserver[] = [];

        const detectBreakpoint = (): HeroBreakpoint => {
            // Editor's device preview dropdown overrides the natural viewport.
            if (previewHost?.classList.contains('ks-preview-mobile')) return 'mobile';
            if (previewHost?.classList.contains('ks-preview-tablet')) return 'tablet';
            if (previewHost?.classList.contains('ks-preview-desktop')) return 'desktop';
            const w = ownerWin.innerWidth;
            return w >= 1536 ? 'desktop' : w >= 640 ? 'tablet' : 'mobile';
        };

        const update = () => {
            const bp = detectBreakpoint();
            const cfg = heightCfg[bp];
            if (cfg.mode !== 'fitScreen' || !cfg.revealNext || cfg.revealNext <= 0 || !wrapper) {
                section.style.removeProperty('--hero-peek-height');
                return;
            }
            // Disconnect prior observers; re-attach to the new sibling set.
            observers.forEach((o) => o.disconnect());
            observers = [];
            const peeked: HTMLElement[] = [];
            let cur = wrapper.nextElementSibling as HTMLElement | null;
            while (cur && peeked.length < cfg.revealNext) {
                peeked.push(cur);
                cur = cur.nextElementSibling as HTMLElement | null;
            }
            const total = peeked.reduce((sum, el) => sum + el.getBoundingClientRect().height, 0);
            section.style.setProperty('--hero-peek-height', `${total}px`);

            const obs = new ResizeObserver(() => {
                const t = peeked.reduce((sum, el) => sum + el.getBoundingClientRect().height, 0);
                section.style.setProperty('--hero-peek-height', `${t}px`);
            });
            peeked.forEach((el) => obs.observe(el));
            observers.push(obs);
        };

        update();
        ownerWin.addEventListener('resize', update);
        // React to preview-device class flips so revealNext's count updates
        // when the user picks a different device from the editor dropdown.
        const classObs = previewHost
            ? new MutationObserver(update)
            : null;
        classObs?.observe(previewHost!, { attributes: true, attributeFilter: ['class'] });
        return () => {
            ownerWin.removeEventListener('resize', update);
            classObs?.disconnect();
            observers.forEach((o) => o.disconnect());
            section.style.removeProperty('--hero-peek-height');
        };
    }, [heightCfg]);

    const activeCard = cards[activeIndex] ?? cards[0];

    return (
        <section
            ref={sectionRef}
            className={`hero relative overflow-hidden ${heroScopeClass}`}
            data-hero-cards={cardCount}
        >
            {/* Per-block, per-breakpoint height + header-aware fit-screen CSS. */}
            <style dangerouslySetInnerHTML={{ __html: heightCss + HERO_GLOBAL_CSS }} />

            {lcpImageUrl && <link rel="preload" as="image" href={lcpImageUrl} fetchPriority="high" />}

            {/* All cards layered absolutely so backgrounds always fill the section
                (which is sized below by the in-flow content sizer or by min-height). */}
            {cards.map((card, i) => {
                const isActive = i === activeIndex;
                const transitionStyles = computeCardTransition(transition.type, isActive, i, activeIndex, cardCount, isEditMode);
                return (
                    <div
                        key={card.id}
                        className={`absolute inset-0 ${legacyVariantClass(card)} ${isActive ? 'ks-hero-card-active' : ''}`}
                        style={transitionStyles}
                        aria-hidden={!isActive}
                    >
                        <HeroCardRenderer
                            card={card}
                            cardIndex={i}
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
                        cardIndex={activeIndex}
                        palette={palette}
                        isEditMode={false}
                        onSave={() => {}}
                        blockData={rawData}
                    />
                </div>
            )}

            {/* Card dots — published view animates the active dot;
                edit mode shows them so the editor can pick which card to edit. */}
            {!isEditMode && cardCount > 1 && transition.type !== 'none' && (
                <div className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2 flex gap-2">
                    {cards.map((_, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => goToCard(i)}
                            aria-label={`Go to card ${i + 1}`}
                            className={`h-2 w-2 rounded-full transition-all ${i === activeIndex ? 'bg-white w-6' : 'bg-white/50 hover:bg-white/70'}`}
                        />
                    ))}
                </div>
            )}
            {isEditMode && cardCount > 1 && (
                <div
                    className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-slate-900/80 px-2.5 py-1.5 text-white shadow-lg backdrop-blur"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                >
                    {cards.map((_, i) => {
                        const isActive = i === activeIndex;
                        return (
                            <button
                                key={i}
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setActiveCardForEditing(i);
                                }}
                                aria-pressed={isActive}
                                aria-label={`Edit card ${i + 1}`}
                                className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold transition-colors ${
                                    isActive ? 'bg-white text-slate-900' : 'bg-white/15 text-white hover:bg-white/30'
                                }`}
                            >
                                {i + 1}
                            </button>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

/* Mobile font-size cap (shared, not per-block). Caps inline font-size set
   by EditableText so a desktop-tuned size doesn't blow out on phones. */
const HERO_GLOBAL_CSS = `
@media (max-width: 640px) {
    .ks-block-hero .hero-title { font-size: clamp(1.875rem, 8vw, 3rem) !important; }
    .ks-block-hero .hero-subtitle { font-size: clamp(0.9375rem, 4vw, 1.25rem) !important; }
}
`;

/** Emits per-block, per-breakpoint min-height CSS. Scoped via a unique class
 *  applied to the hero <section> so multiple heroes on a page don't collide.
 *  Also emits parent-class overrides (.ks-preview-{device}) so the editor's
 *  device preview dropdown forces a specific breakpoint regardless of the
 *  actual viewport width. */
function buildHeroHeightCss(scopeClass: string, h: HeroHeight): string {
    const sel = `.${scopeClass}`;
    const minH = (cfg: HeroHeightConfig): string => {
        if (cfg.mode === 'manual') return `${cfg.valuePx}px`;
        if (cfg.mode === 'fitScreen') return `calc(100dvh - var(--ks-header-height, 0px) - var(--hero-peek-height, 0px))`;
        return 'auto';
    };
    const overlayMinH = (cfg: HeroHeightConfig): string => {
        // For overlay/transparent headers, don't subtract — pad-top instead.
        if (cfg.mode === 'manual') return `${cfg.valuePx}px`;
        if (cfg.mode === 'fitScreen') return `calc(100dvh - var(--hero-peek-height, 0px))`;
        return 'auto';
    };
    const overlayPad = (cfg: HeroHeightConfig): string =>
        cfg.mode === 'fitScreen' ? 'var(--ks-header-height, 0px)' : '0';

    // For fitScreen, lock the height (not just min-height) so the in-flow
    // sizer of a tall card can't push the section past viewport-minus-header.
    // The section already has overflow-hidden; bg images use bg-cover/center
    // and videos use object-cover, so they fill and crop cleanly.
    const lockHeight = (cfg: HeroHeightConfig): string =>
        cfg.mode === 'fitScreen' ? `height: ${minH(cfg)};` : '';
    const overlayLockHeight = (cfg: HeroHeightConfig): string =>
        cfg.mode === 'fitScreen' ? `height: ${overlayMinH(cfg)};` : '';

    const block = (cfg: HeroHeightConfig, scope = sel): string => `
${scope} { min-height: ${minH(cfg)}; ${lockHeight(cfg)} }
:root[data-ks-header-overlay="true"] .first-block-offset > .ks-block ${scope} {
    min-height: ${overlayMinH(cfg)};
    ${overlayLockHeight(cfg)}
    padding-top: ${overlayPad(cfg)};
}`;

    // Mobile-first cascade: define mobile, override at >=640px (tablet), then
    // >=1536px (desktop). The desktop threshold is intentionally above
    // Tailwind's default 1024 because Retina laptops at default scaling
    // report ~1470–1512 CSS px — without this they'd hit desktop rules
    // despite being physically small. Then class-scoped overrides for the
    // editor preview (specificity .ks-preview-* + ${sel} beats unmediated
    // rules and rules inside @media queries since classes add specificity
    // but media queries do not).
    return `
${block(h.mobile)}
@media (min-width: 640px) { ${block(h.tablet)} }
@media (min-width: 1536px) { ${block(h.desktop)} }
${block(h.mobile, `.ks-preview-mobile ${sel}`)}
${block(h.tablet, `.ks-preview-tablet ${sel}`)}
${block(h.desktop, `.ks-preview-desktop ${sel}`)}
`;
}

function computeCardTransition(
    type: 'fade' | 'slide' | 'none',
    isActive: boolean,
    cardIndex: number,
    activeIndex: number,
    cardCount: number,
    isEditMode: boolean,
): React.CSSProperties {
    if (cardCount <= 1) return { opacity: 1 };
    // In edit mode, swap cards instantly — no fade/slide. The dots at the
    // bottom drive which card is in focus for inline editing.
    if (isEditMode) {
        return { opacity: isActive ? 1 : 0, pointerEvents: isActive ? 'auto' : 'none' };
    }
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
    cardIndex: number;
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
    cardIndex,
    palette,
    isEditMode,
    onSave,
    uploadImage,
    blockData,
}: {
    card: HeroCard;
    cardIndex: number;
    palette: Record<string, string>;
    isEditMode: boolean;
    onSave: (key: string, value: unknown) => void;
    uploadImage?: (file: File, contentKey: string) => Promise<string>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    blockData: Record<string, any> | undefined;
}) {
    const pPrimary = palette.primary || '#1f2937';
    const pSecondary = palette.secondary || '#ef4444';

    const social = card.content.social;
    const visibleSocialLinks = social && social.enabled
        ? (isEditMode ? social.links : social.links.filter((l) => l.url.trim()))
        : [];
    const hasSocial = visibleSocialLinks.length > 0;

    const showText = card.content.pretext.enabled || card.content.title.enabled || card.content.subtitle.enabled || card.content.cta.enabled || hasSocial;
    const showForeground = card.content.image.enabled && (card.content.image.url || isEditMode);
    const imageOnRight = card.content.image.side !== 'left';
    const imageLayout = card.content.image.layout === 'split' ? 'split' : 'contained';
    const splitScreen = showForeground && imageLayout === 'split';

    // Default text color: white when on a media background, primary otherwise.
    const isMediaBg = card.background.type === 'image' || card.background.type === 'video' || card.background.type === 'animation';
    const textColor = isMediaBg ? '#ffffff' : pPrimary;

    // Project the per-card pretext block onto the shape BlockPretext expects.
    const pretextData = {
        pretextEnabled: card.content.pretext.enabled,
        pretext: card.content.pretext.value,
        pretextStyle: card.content.pretext.style,
        pretextColor: card.content.pretext.color,
        pretextAlignment: card.content.pretext.align,
    };

    const order = resolveElementOrder(card.content.elementOrder);
    const secondary = card.content.cta.secondary;
    const secondaryEnabled = !!secondary?.enabled;
    const secondaryPlacement = card.content.cta.secondaryPlacement === 'below' ? 'below' : 'beside';
    const ctaWrapperFlex = secondaryEnabled && secondaryPlacement === 'below' ? 'flex-col gap-3' : 'flex-row gap-4 flex-wrap';

    const renderElement = (key: HeroElementKey): React.ReactNode => {
        if (key === 'pretext') {
            if (!card.content.pretext.enabled) return null;
            return (
                <Reveal key="pretext">
                    <BlockPretext
                        data={pretextData}
                        isEditMode={isEditMode}
                        palette={palette}
                        updateContent={onSave}
                        defaultText={DEFAULT_PRETEXT}
                    />
                </Reveal>
            );
        }
        if (key === 'title') {
            if (!card.content.title.enabled) return null;
            return (
                <Reveal key="title">
                    <EditableText
                        as="h1"
                        contentKey="title"
                        styleData={(blockData?.[`title__styles__${cardIndex}`] ?? blockData?.['title__styles']) as string | Record<string, unknown> | undefined}
                        content={card.content.title.value}
                        defaultValue={DEFAULT_TITLE}
                        isEditMode={isEditMode}
                        onSave={onSave}
                        className={`hero-title ${splitScreen ? 'text-3xl sm:text-4xl lg:text-5xl' : 'text-3xl sm:text-4xl md:text-5xl lg:text-6xl'} font-extrabold leading-tight ${TEXT_ALIGN_CLASS[card.content.title.align]}`}
                        style={{ color: textColor }}
                    />
                </Reveal>
            );
        }
        if (key === 'subtitle') {
            if (!card.content.subtitle.enabled) return null;
            return (
                <Reveal key="subtitle">
                    <EditableText
                        as="p"
                        contentKey="subtitle"
                        styleData={(blockData?.[`subtitle__styles__${cardIndex}`] ?? blockData?.['subtitle__styles']) as string | Record<string, unknown> | undefined}
                        content={card.content.subtitle.value}
                        defaultValue={DEFAULT_SUBTITLE}
                        isEditMode={isEditMode}
                        onSave={onSave}
                        className={`hero-subtitle ${splitScreen ? 'mt-5 text-sm sm:text-base' : 'mt-6 text-base sm:text-lg md:text-xl'} ${TEXT_ALIGN_CLASS[card.content.subtitle.align]}`}
                        style={{ color: isMediaBg ? 'rgba(255,255,255,0.85)' : 'rgba(15,23,42,0.7)' }}
                    />
                </Reveal>
            );
        }
        if (key === 'social') {
            if (!hasSocial) return null;
            return (
                <Reveal key="social">
                    <div className={`hero-social mt-6 flex ${FLEX_ALIGN_CLASS[social.align]}`}>
                        <ul className="flex items-center gap-3 flex-wrap">
                            {visibleSocialLinks.map((link) => (
                                <SocialIconLink
                                    key={link.id}
                                    link={link}
                                    color={textColor}
                                    onMediaBg={isMediaBg}
                                />
                            ))}
                        </ul>
                    </div>
                </Reveal>
            );
        }
        if (key === 'cta') {
            if (!card.content.cta.enabled) return null;
            return (
                <Reveal key="cta">
                    <div className={`mt-8 flex ${FLEX_ALIGN_CLASS[card.content.cta.align]}`}>
                        <div className={`inline-flex items-center ${ctaWrapperFlex}`}>
                            <EditableButton
                                contentKey="buttonText"
                                label={card.content.cta.label}
                                linkData={card.content.cta.link as Partial<ButtonLinkData> | undefined}
                                iconData={card.content.cta.icon as ButtonIconData | undefined}
                                defaultLabel={DEFAULT_CTA_LABEL}
                                isEditMode={isEditMode}
                                onSave={onSave}
                                className={splitScreen
                                    ? 'hero-button px-6 py-3 text-sm text-white font-bold rounded-md hover:opacity-90 transition-opacity inline-block'
                                    : 'hero-button px-8 py-4 text-white font-bold rounded-lg shadow-lg hover:opacity-90 transition-opacity inline-block'}
                                style={{ backgroundColor: pSecondary, color: '#ffffff' }}
                                palette={palette}
                            />
                            {secondaryEnabled && (
                                <EditableButton
                                    contentKey="buttonText2"
                                    label={secondary?.label}
                                    linkData={secondary?.link as Partial<ButtonLinkData> | undefined}
                                    iconData={secondary?.icon as ButtonIconData | undefined}
                                    defaultLabel={DEFAULT_CTA2_LABEL}
                                    isEditMode={isEditMode}
                                    onSave={onSave}
                                    defaultFill="ghost"
                                    className={splitScreen
                                        ? 'hero-button-secondary px-6 py-3 text-sm font-bold rounded-md hover:opacity-70 transition-opacity inline-block'
                                        : 'hero-button-secondary px-8 py-4 font-bold rounded-lg hover:opacity-70 transition-opacity inline-block'}
                                    style={{ color: textColor, backgroundColor: 'transparent' }}
                                    palette={palette}
                                />
                            )}
                        </div>
                    </div>
                </Reveal>
            );
        }
        return null;
    };

    const containerClass = splitScreen
        ? 'hero-container hero-container-split ks-layout-content relative z-10 mx-auto flex h-full w-full max-w-none items-stretch px-0 py-0'
        : 'hero-container ks-layout-content relative z-10 mx-auto flex h-full w-full max-w-7xl items-center px-4 py-20 md:py-24';
    const gridClass = splitScreen
        ? `hero-split-grid grid h-full min-h-[560px] w-full grid-cols-1 items-stretch gap-0 md:min-h-[640px] ${showForeground && showText ? 'md:grid-cols-2' : ''}`
        : `grid w-full gap-10 items-center ${showForeground && showText ? 'md:grid-cols-2' : 'grid-cols-1'}`;
    const textColumnClass = splitScreen
        ? `hero-content flex min-h-[360px] items-center px-6 py-16 sm:px-10 md:min-h-0 md:px-12 md:py-20 lg:px-20 ${imageOnRight || !showForeground ? 'order-1' : 'order-2'}`
        : `hero-content ${imageOnRight || !showForeground ? 'order-1' : 'order-2'}`;
    const imageColumnClass = splitScreen
        ? `${imageOnRight ? 'order-2' : 'order-1'} h-full min-h-[360px] md:min-h-0`
        : (imageOnRight ? 'order-2' : 'order-1');
    const imageClass = splitScreen
        ? 'hero-image h-full min-h-[360px] w-full object-cover'
        : 'hero-image w-full h-96 object-cover shadow-xl';
    const imagePreviewFrameClass = splitScreen
        ? 'w-full h-full min-h-[360px]'
        : 'w-full h-96';
    const imageContent = (
        <EditableImage
            contentKey="image"
            initialSettings={card.content.image.settings as ImageSettings | undefined}
            initialAttribution={card.content.image.attribution as UnsplashAttribution | undefined}
            imageUrl={card.content.image.url}
            isEditMode={isEditMode}
            onSave={onSave}
            onUpload={uploadImage}
            className={imageClass}
            enableInlineCropControls
            editorPreviewFrameClassName={imagePreviewFrameClass}
            placeholder="Click to upload hero image"
            priority
        />
    );

    return (
        <div className={containerClass}>
            <div className={gridClass}>
                {showText && (
                    <div className={textColumnClass}>
                        {splitScreen ? (
                            <div className="hero-content-inner mx-auto w-full max-w-xl">
                                {order.map(renderElement)}
                            </div>
                        ) : (
                            order.map(renderElement)
                        )}
                    </div>
                )}
                {showForeground && (
                    <Reveal className={imageColumnClass}>
                        {imageContent}
                    </Reveal>
                )}
            </div>
        </div>
    );
}

function SocialIconLink({ link, color, onMediaBg }: { link: HeroSocialLink; color: string; onMediaBg: boolean }) {
    const Icon = getSocialIcon(link.platform);
    const label = link.label || getSocialPlatformLabel(link.platform);
    const href = normalizeHref(link.url);
    const bgClass = onMediaBg
        ? 'bg-white/15 hover:bg-white/25'
        : 'bg-slate-100 hover:bg-slate-200';
    const inner = (
        <span
            className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors ${bgClass}`}
            style={{ color }}
        >
            <Icon className="h-5 w-5" />
        </span>
    );
    return (
        <li>
            {href ? (
                <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="inline-flex"
                >
                    {inner}
                </a>
            ) : (
                <span aria-label={label} className="inline-flex">{inner}</span>
            )}
        </li>
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
        const objectFit = bg.video.objectFit === 'contain' ? 'contain' : 'cover';
        const objectPosition = bg.video.objectPosition || '50% 50%';
        const scale = typeof bg.video.scale === 'number' && bg.video.scale > 0 ? bg.video.scale : 1;
        mediaLayer = (
            <video
                autoPlay
                muted
                loop
                playsInline
                className="hero-video-bg absolute inset-0 z-0 h-full w-full"
                style={{
                    objectFit,
                    objectPosition,
                    transform: scale !== 1 ? `scale(${scale})` : undefined,
                    transformOrigin: objectPosition,
                }}
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
        const meta = HERO_BG_ANIMATION_META[bg.animation.id];
        if (meta) {
            const colors = resolveSlotColors(meta.colorSlots, bg.animation.colors, palette, resolvePaletteColor);
            mediaLayer = <HeroBgAnimation id={bg.animation.id} colors={colors} speed={bg.animation.speed} />;
        }
    } else if (bg.type === 'pattern' && bg.pattern) {
        const meta = HERO_BG_PATTERN_META[bg.pattern.id];
        if (meta) {
            const colors = resolveSlotColors(meta.colorSlots, bg.pattern.colors, palette, resolvePaletteColor);
            mediaLayer = (
                <HeroBgPattern
                    id={bg.pattern.id}
                    colors={colors}
                    scale={bg.pattern.scale ?? 1}
                    rotation={bg.pattern.rotation ?? 0}
                    opacity={bg.pattern.opacity ?? 1}
                />
            );
        }
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
