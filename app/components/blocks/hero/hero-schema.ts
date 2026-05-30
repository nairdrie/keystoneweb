import type { HeroBgAnimationId } from './HeroBgAnimations';
import type { HeroBgPatternId } from './HeroBgPatterns';

export type Align = 'left' | 'center' | 'right';
export type ImageSide = 'left' | 'right';
export type HeroImageLayout = 'contained' | 'split';
export type HeightMode = 'fitContent' | 'fitScreen' | 'manual';
export type CardTransition = 'fade' | 'slide' | 'none';
export type BgType = 'image' | 'video' | 'gradient' | 'animation' | 'pattern';
export type VideoSource = 'pexels' | 'url' | 'upload';
export type HeroPretextStyle = 'text' | 'pill' | 'outline' | 'underline';
export type SecondaryCtaPlacement = 'beside' | 'below';
export type HeroElementKey = 'pretext' | 'title' | 'subtitle' | 'social' | 'cta';

export interface HeroPretext {
    enabled: boolean;
    value: string;
    style: HeroPretextStyle;
    color: string;
    align: Align;
}

export interface HeroSocialLink {
    id: string;
    platform: string;
    label?: string;
    url: string;
}

export interface HeroContent {
    pretext: HeroPretext;
    title: { enabled: boolean; value: string; align: Align };
    subtitle: { enabled: boolean; value: string; align: Align };
    cta: {
        enabled: boolean;
        label: string;
        link?: unknown;
        icon?: unknown;
        align: Align;
        secondary?: {
            enabled: boolean;
            label: string;
            link?: unknown;
            icon?: unknown;
        };
        secondaryPlacement?: SecondaryCtaPlacement;
    };
    image: {
        enabled: boolean;
        url: string;
        side: ImageSide;
        layout: HeroImageLayout;
        settings?: unknown;
        attribution?: unknown;
    };
    social: {
        enabled: boolean;
        align: Align;
        links: HeroSocialLink[];
    };
    /** Vertical order of elements in the text column. Missing keys fall back
     *  to DEFAULT_ELEMENT_ORDER's positions; unknown keys are ignored. */
    elementOrder?: HeroElementKey[];
}

export interface HeroBackground {
    type: BgType;
    image?: { url: string; settings?: unknown; attribution?: unknown };
    video?: {
        source: VideoSource;
        url: string;
        /** How the video frame is scaled inside the hero. Defaults to 'cover'. */
        objectFit?: 'cover' | 'contain';
        /** CSS object-position string, e.g. "50% 30%". Defaults to "50% 50%". */
        objectPosition?: string;
        /** Additional zoom multiplier applied via transform: scale(). 1 = none. */
        scale?: number;
    };
    gradient?: { from: string; to: string; via?: string; angle: number };
    animation?: {
        id: HeroBgAnimationId;
        /**
         * Optional per-slot color overrides. Each entry is either a hex
         * color (e.g. "#ec4899") or a palette token (e.g. "palette:primary").
         * Indexed against the animation's `colorSlots` metadata. Missing
         * indices fall back to the slot's `defaultToken`.
         */
        colors?: string[];
        /** 0.25 – 2; speed multiplier for the animation. Defaults to 1. */
        speed?: number;
    };
    pattern?: {
        id: HeroBgPatternId;
        /** Same shape as animation.colors — see above. */
        colors?: string[];
        /** 0.5 - 2.0; uniform scale of the tile. */
        scale?: number;
        /** Degrees, applied to the tile layer. */
        rotation?: number;
        /** 0 - 1, multiplied with overlay opacity. */
        opacity?: number;
    };
    /** Overlay applied above image/video/animation/pattern backgrounds. */
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
export const DEFAULT_CTA2_LABEL = 'Learn More';
export const DEFAULT_PRETEXT = 'Welcome';

export const DEFAULT_HERO_PRETEXT: HeroPretext = {
    enabled: false,
    value: '',
    style: 'text',
    color: 'palette:secondary',
    align: 'left',
};

export const DEFAULT_ELEMENT_ORDER: HeroElementKey[] = ['pretext', 'title', 'subtitle', 'social', 'cta'];

/** Returns a sanitized order: known keys in user order followed by any
 *  default-order keys the user hasn't placed yet. Guarantees every renderer
 *  key gets emitted exactly once. */
export function resolveElementOrder(order: HeroElementKey[] | undefined): HeroElementKey[] {
    const known = new Set<HeroElementKey>(DEFAULT_ELEMENT_ORDER);
    const seen = new Set<HeroElementKey>();
    const result: HeroElementKey[] = [];
    for (const key of order || []) {
        if (known.has(key) && !seen.has(key)) {
            result.push(key);
            seen.add(key);
        }
    }
    for (const key of DEFAULT_ELEMENT_ORDER) {
        if (!seen.has(key)) result.push(key);
    }
    return result;
}

export function makeDefaultCard(id: string): HeroCard {
    return {
        id,
        content: {
            pretext: { ...DEFAULT_HERO_PRETEXT },
            title: { enabled: true, value: DEFAULT_TITLE, align: 'left' },
            subtitle: { enabled: true, value: DEFAULT_SUBTITLE, align: 'left' },
            cta: {
                enabled: true,
                label: DEFAULT_CTA_LABEL,
                align: 'left',
                secondary: { enabled: false, label: DEFAULT_CTA2_LABEL },
                secondaryPlacement: 'beside',
            },
            image: { enabled: false, url: '', side: 'right', layout: 'contained' },
            social: { enabled: false, align: 'left', links: [] },
            elementOrder: [...DEFAULT_ELEMENT_ORDER],
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
        pretext: { ...DEFAULT_HERO_PRETEXT, align: baseAlign },
        title: { enabled: true, value: title, align: baseAlign },
        subtitle: { enabled: true, value: subtitle, align: baseAlign },
        cta: {
            enabled: showButton,
            label: ctaLabel,
            link: data.buttonTextLink,
            icon: data.buttonTextIcon,
            align: baseAlign,
            secondary: { enabled: false, label: DEFAULT_CTA2_LABEL },
            secondaryPlacement: 'beside',
        },
        image: {
            enabled: variant === 'split',
            url: variant === 'split' ? imageUrl : '',
            side: 'right',
            layout: 'contained',
            settings: variant === 'split' ? data.image__settings : undefined,
            attribution: variant === 'split' ? data.image__attribution : undefined,
        },
        social: { enabled: false, align: baseAlign, links: [] },
        elementOrder: [...DEFAULT_ELEMENT_ORDER],
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
        pretext: { ...c.pretext },
        title: { ...c.title },
        subtitle: { ...c.subtitle },
        cta: {
            ...c.cta,
            secondary: c.cta.secondary ? { ...c.cta.secondary } : undefined,
        },
        image: { ...c.image },
        social: { ...c.social, links: c.social.links.map((l) => ({ ...l })) },
        elementOrder: c.elementOrder ? [...c.elementOrder] : undefined,
    };
}

function withDefaults<T extends object>(defaults: T, override: Partial<T> | undefined | null | unknown): T {
    return Object.assign({}, defaults, (override || {}) as Partial<T>) as T;
}

function normalizeCta(cta: HeroContent['cta'] | undefined): HeroContent['cta'] {
    const base = withDefaults(
        { enabled: true, label: DEFAULT_CTA_LABEL, align: 'left' as Align },
        cta,
    ) as HeroContent['cta'];
    const sec = cta?.secondary;
    return {
        ...base,
        secondary: sec
            ? {
                enabled: !!sec.enabled,
                label: typeof sec.label === 'string' && sec.label ? sec.label : DEFAULT_CTA2_LABEL,
                link: sec.link,
                icon: sec.icon,
            }
            : { enabled: false, label: DEFAULT_CTA2_LABEL },
        secondaryPlacement: cta?.secondaryPlacement === 'below' ? 'below' : 'beside',
    };
}

function normalizeSocial(
    social: HeroContent['social'] | undefined,
    fallbackAlign: Align | undefined,
): HeroContent['social'] {
    const align: Align = (social?.align === 'left' || social?.align === 'center' || social?.align === 'right')
        ? social.align
        : (fallbackAlign || 'left');
    const rawLinks = Array.isArray(social?.links) ? social!.links : [];
    const links: HeroSocialLink[] = rawLinks
        .map((l, i) => normalizeSocialLink(l, i))
        .filter(Boolean) as HeroSocialLink[];
    return {
        enabled: !!social?.enabled,
        align,
        links,
    };
}

function normalizeSocialLink(item: unknown, index: number): HeroSocialLink | null {
    if (!item || typeof item !== 'object') return null;
    const r = item as Partial<HeroSocialLink>;
    const platform = typeof r.platform === 'string' && r.platform ? r.platform : 'website';
    return {
        id: typeof r.id === 'string' && r.id ? r.id : `hero-social-${index + 1}`,
        platform,
        label: typeof r.label === 'string' ? r.label : undefined,
        url: typeof r.url === 'string' ? r.url : '',
    };
}

export function makeSocialLinkId(): string {
    return `hero-social-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Fills in any missing leaves on an already-new-format HeroData. */
function normalizeHeroData(data: Record<string, unknown> & { cards?: HeroCard[]; transition?: HeroTransition; height?: HeroHeight; __activeCardIndex?: number; __pauseRotation?: boolean; __customCss?: string }): HeroData {
    const cards: HeroCard[] = (data.cards as HeroCard[]).map((c: HeroCard, i: number) => ({
        id: c.id || `card-${i}`,
        content: {
            pretext: withDefaults(DEFAULT_HERO_PRETEXT, c?.content?.pretext),
            title: withDefaults({ enabled: true, value: DEFAULT_TITLE, align: 'left' as Align }, c?.content?.title),
            subtitle: withDefaults({ enabled: true, value: DEFAULT_SUBTITLE, align: 'left' as Align }, c?.content?.subtitle),
            cta: normalizeCta(c?.content?.cta),
            image: withDefaults({ enabled: false, url: '', side: 'right' as ImageSide, layout: 'contained' as HeroImageLayout }, c?.content?.image),
            social: normalizeSocial(c?.content?.social, c?.content?.title?.align),
            elementOrder: resolveElementOrder(c?.content?.elementOrder),
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
    if (c.image.enabled) return c.image.layout === 'split' ? 'hero-split hero-split-half' : 'hero-split';
    if (!c.cta.enabled && !c.image.enabled && bg.type === 'gradient') return 'hero-minimal';
    return 'hero-centered';
}
