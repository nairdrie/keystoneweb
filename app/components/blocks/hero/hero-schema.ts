import type { HeroBgAnimationId } from './HeroBgAnimations';

export type Align = 'left' | 'center' | 'right';
export type ImageSide = 'left' | 'right';
export type HeightMode = 'fitContent' | 'fitScreen' | 'manual';
export type CardTransition = 'fade' | 'slide' | 'none';
export type BgType = 'image' | 'video' | 'gradient' | 'animation';
export type VideoSource = 'pexels' | 'url';

export interface HeroContent {
    title: { enabled: boolean; value: string; align: Align };
    subtitle: { enabled: boolean; value: string; align: Align };
    cta: {
        enabled: boolean;
        label: string;
        link?: unknown;
        icon?: unknown;
        align: Align;
    };
    image: {
        enabled: boolean;
        url: string;
        side: ImageSide;
        settings?: unknown;
        attribution?: unknown;
    };
}

export interface HeroBackground {
    type: BgType;
    image?: { url: string; settings?: unknown; attribution?: unknown };
    video?: { source: VideoSource; url: string };
    gradient?: { from: string; to: string; via?: string; angle: number };
    animation?: { id: HeroBgAnimationId };
    /** Overlay applied above image/video/animation backgrounds. */
    overlay?: { color: string; opacity: number };
}

export interface HeroCard {
    id: string;
    content: HeroContent;
    background: HeroBackground;
}

export interface HeroTransition {
    type: CardTransition;
    intervalSec: number;
    pauseOnHover: boolean;
}

export interface HeroHeightConfig {
    mode: HeightMode;
    valuePx: number;
    /** Fit-screen only: also subtract the height of the next N sibling blocks
     *  so e.g. "header + hero + next block" exactly fills one viewport. */
    revealNext: number;
}

export type HeroBreakpoint = 'desktop' | 'tablet' | 'mobile';

export interface HeroHeight {
    desktop: HeroHeightConfig;
    tablet: HeroHeightConfig;
    mobile: HeroHeightConfig;
}

export interface HeroData {
    cards: HeroCard[];
    transition: HeroTransition;
    height: HeroHeight;
    /** Editor-only: which card is currently being edited (not persisted). */
    __activeCardIndex?: number;
    /** Editor-only: pause card rotation while panel is open (not persisted). */
    __pauseRotation?: boolean;
    /** Pro-only custom CSS. */
    __customCss?: string;
}

export const DEFAULT_TITLE = 'Welcome to our site';
export const DEFAULT_SUBTITLE = 'We offer the best services available.';
export const DEFAULT_CTA_LABEL = 'Get a Free Quote';

export function makeDefaultCard(id: string): HeroCard {
    return {
        id,
        content: {
            title: { enabled: true, value: DEFAULT_TITLE, align: 'left' },
            subtitle: { enabled: true, value: DEFAULT_SUBTITLE, align: 'left' },
            cta: { enabled: true, label: DEFAULT_CTA_LABEL, align: 'left' },
            image: { enabled: false, url: '', side: 'right' },
        },
        background: {
            type: 'gradient',
            gradient: { from: 'palette:accent', to: 'palette:primary', angle: 135 },
            overlay: { color: '#000000', opacity: 0 },
        },
    };
}

export const DEFAULT_TRANSITION: HeroTransition = {
    type: 'fade',
    intervalSec: 5,
    pauseOnHover: true,
};

export const DEFAULT_HEIGHT_CONFIG: HeroHeightConfig = {
    mode: 'fitContent',
    valuePx: 600,
    revealNext: 0,
};

export const DEFAULT_HEIGHT: HeroHeight = {
    desktop: { ...DEFAULT_HEIGHT_CONFIG },
    tablet: { ...DEFAULT_HEIGHT_CONFIG },
    mobile: { ...DEFAULT_HEIGHT_CONFIG },
};

/**
 * Builds a complete HeroData from a possibly-legacy block.data object.
 * - If `cards` already exists, returns the data largely unchanged
 *   (with sensible defaults filled in for missing leaves).
 * - Otherwise, synthesizes one or more cards from the legacy fields
 *   (variant, title, subtitle, buttonText, image, videoUrl, bgType,
 *   bgImage, bgCarouselImages, bgCarouselTransition, bgCarouselTiming,
 *   backgroundColor) so existing pages keep rendering.
 */
export function migrateLegacyHeroData(raw: unknown): HeroData {
    const data = (raw || {}) as Record<string, unknown> & {
        cards?: HeroCard[];
        variant?: string;
        title?: string; subtitle?: string; buttonText?: string; showButton?: boolean;
        buttonTextLink?: unknown; buttonTextIcon?: unknown;
        image?: string; image__settings?: unknown; image__attribution?: unknown;
        videoUrl?: string;
        bgType?: string; bgImage?: string;
        bgCarouselImages?: string[]; bgCarouselTiming?: number; bgCarouselTransition?: string;
        backgroundColor?: string;
        transition?: HeroTransition; height?: HeroHeight;
        __activeCardIndex?: number; __pauseRotation?: boolean; __customCss?: string;
    };

    if (Array.isArray(data.cards) && data.cards.length > 0) {
        return normalizeHeroData(data);
    }

    const variant: string = data.variant || 'split';
    const title = data.title !== undefined ? String(data.title) : DEFAULT_TITLE;
    const subtitle = data.subtitle !== undefined ? String(data.subtitle) : DEFAULT_SUBTITLE;
    const ctaLabel = data.buttonText !== undefined ? String(data.buttonText) : DEFAULT_CTA_LABEL;
    const showButton = data.showButton !== false;
    const imageUrl = typeof data.image === 'string' ? data.image : '';
    const videoUrl = typeof data.videoUrl === 'string' ? data.videoUrl : '';

    const baseAlign: Align = variant === 'centered' || variant === 'video' || variant === 'fullImage' ? 'center' : 'left';

    const baseContent: HeroContent = {
        title: { enabled: true, value: title, align: baseAlign },
        subtitle: { enabled: true, value: subtitle, align: baseAlign },
        cta: {
            enabled: showButton,
            label: ctaLabel,
            link: data.buttonTextLink,
            icon: data.buttonTextIcon,
            align: baseAlign,
        },
        image: {
            enabled: variant === 'split',
            url: variant === 'split' ? imageUrl : '',
            side: 'right',
            settings: variant === 'split' ? data.image__settings : undefined,
            attribution: variant === 'split' ? data.image__attribution : undefined,
        },
    };

    const overlayDefault = { color: '#000000', opacity: variant === 'fullImage' || variant === 'video' || variant === 'centered' ? 0.5 : 0 };

    let baseBackground: HeroBackground;
    if (variant === 'video' && videoUrl) {
        baseBackground = {
            type: 'video',
            video: { source: 'url', url: videoUrl },
            overlay: overlayDefault,
        };
    } else if (variant === 'fullImage' && imageUrl) {
        baseBackground = {
            type: 'image',
            image: { url: imageUrl, settings: data.image__settings, attribution: data.image__attribution },
            overlay: overlayDefault,
        };
    } else if (variant === 'centered' && data.bgType === 'image' && data.bgImage) {
        baseBackground = {
            type: 'image',
            image: { url: String(data.bgImage) },
            overlay: overlayDefault,
        };
    } else if (data.backgroundColor) {
        baseBackground = {
            type: 'gradient',
            gradient: { from: String(data.backgroundColor), to: String(data.backgroundColor), angle: 0 },
            overlay: { color: '#000000', opacity: 0 },
        };
    } else {
        baseBackground = {
            type: 'gradient',
            gradient: { from: 'palette:accent', to: 'palette:primary', angle: 135 },
            overlay: { color: '#000000', opacity: 0 },
        };
    }

    let cards: HeroCard[];
    const carouselImages: string[] = Array.isArray(data.bgCarouselImages) ? data.bgCarouselImages : [];

    if (data.bgType === 'carousel' && carouselImages.length > 0) {
        cards = carouselImages.map((imgUrl, i) => ({
            id: `legacy-${i}`,
            content: i === 0 ? baseContent : duplicateContent(baseContent),
            background: {
                type: 'image',
                image: { url: String(imgUrl) },
                overlay: { color: '#000000', opacity: 0.5 },
            },
        }));
    } else {
        cards = [{ id: 'legacy-0', content: baseContent, background: baseBackground }];
    }

    const legacyTransition: CardTransition = (() => {
        const t = data.bgCarouselTransition;
        if (t === 'fade' || t === 'swipe' || t === 'scroll') return t === 'swipe' ? 'slide' : 'fade';
        return 'fade';
    })();

    const transition: HeroTransition = {
        type: cards.length > 1 ? legacyTransition : 'fade',
        intervalSec: typeof data.bgCarouselTiming === 'number' ? data.bgCarouselTiming : 5,
        pauseOnHover: true,
    };

    let heightMode: HeightMode = 'fitContent';
    if (variant === 'video' || variant === 'fullImage') heightMode = 'fitScreen';
    const legacyHeightCfg: HeroHeightConfig = { mode: heightMode, valuePx: 600, revealNext: 0 };

    return {
        cards,
        transition,
        height: {
            desktop: { ...legacyHeightCfg },
            tablet: { ...legacyHeightCfg },
            mobile: { ...legacyHeightCfg },
        },
    };
}

function duplicateContent(c: HeroContent): HeroContent {
    return {
        title: { ...c.title },
        subtitle: { ...c.subtitle },
        cta: { ...c.cta },
        image: { ...c.image },
    };
}

function withDefaults<T extends object>(defaults: T, override: Partial<T> | undefined | null | unknown): T {
    return Object.assign({}, defaults, (override || {}) as Partial<T>) as T;
}

/** Fills in any missing leaves on an already-new-format HeroData. */
function normalizeHeroData(data: Record<string, unknown> & { cards?: HeroCard[]; transition?: HeroTransition; height?: HeroHeight; __activeCardIndex?: number; __pauseRotation?: boolean; __customCss?: string }): HeroData {
    const cards: HeroCard[] = (data.cards as HeroCard[]).map((c: HeroCard, i: number) => ({
        id: c.id || `card-${i}`,
        content: {
            title: withDefaults({ enabled: true, value: DEFAULT_TITLE, align: 'left' as Align }, c?.content?.title),
            subtitle: withDefaults({ enabled: true, value: DEFAULT_SUBTITLE, align: 'left' as Align }, c?.content?.subtitle),
            cta: withDefaults({ enabled: true, label: DEFAULT_CTA_LABEL, align: 'left' as Align }, c?.content?.cta),
            image: withDefaults({ enabled: false, url: '', side: 'right' as ImageSide }, c?.content?.image),
        },
        background: Object.assign({ type: 'gradient' as BgType }, c?.background || {}) as HeroBackground,
    }));

    return {
        cards: cards.length > 0 ? cards : [makeDefaultCard('card-0')],
        transition: { ...DEFAULT_TRANSITION, ...(data.transition || {}) },
        height: normalizeHeroHeight(data.height),
        __activeCardIndex: data.__activeCardIndex,
        __pauseRotation: data.__pauseRotation,
        __customCss: data.__customCss,
    };
}

/** Coerces any prior shape of `height` (legacy single-config or new
 *  per-breakpoint) into the per-breakpoint structure the renderer expects. */
function normalizeHeroHeight(raw: unknown): HeroHeight {
    const r = (raw || {}) as Partial<HeroHeight> & Partial<HeroHeightConfig>;
    // Legacy: { mode, valuePx } with no per-breakpoint keys → fan out to all three.
    if (typeof r.mode === 'string' && !r.desktop && !r.tablet && !r.mobile) {
        const cfg: HeroHeightConfig = {
            mode: r.mode as HeightMode,
            valuePx: typeof r.valuePx === 'number' ? r.valuePx : 600,
            revealNext: 0,
        };
        return { desktop: { ...cfg }, tablet: { ...cfg }, mobile: { ...cfg } };
    }
    const desktop: HeroHeightConfig = { ...DEFAULT_HEIGHT_CONFIG, ...(r.desktop || {}) };
    return {
        desktop,
        tablet: { ...desktop, ...(r.tablet || {}) },
        mobile: { ...desktop, ...(r.mobile || {}) },
    };
}

/** Cheap unique id for client-side card creation (no uuid dep). */
export function makeCardId(): string {
    return `card-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Computes the legacy `.hero-{variant}` class for backwards CSS compat. */
export function legacyVariantClass(card: HeroCard): string {
    const c = card.content;
    const bg = card.background;
    if (bg.type === 'video') return 'hero-video';
    if (bg.type === 'image' && (!c.image.enabled)) return 'hero-fullimage';
    if (c.image.enabled) return 'hero-split';
    if (!c.cta.enabled && !c.image.enabled && bg.type === 'gradient') return 'hero-minimal';
    return 'hero-centered';
}
