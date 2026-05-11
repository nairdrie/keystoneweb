/**
 * Site-wide scroll-in animation settings.
 *
 * Stored as `__animation_*` keys on `designData` (site-level). Every block
 * inherits these via `resolveAnimation` — there is no per-block override layer.
 */

export type AnimationEffect = 'fade-up' | 'fade' | 'slide' | 'scale' | 'none';

export type AnimationSpeed = 'subtle' | 'normal' | 'pronounced' | 'custom';

export interface AnimationConfig {
  effect: AnimationEffect;
  speed: AnimationSpeed;
  /** Used when speed === 'custom'. Milliseconds. */
  customDurationMs?: number;
  /** Stagger delay between sibling children of a block, in ms. */
  staggerMs: number;
  /** Master reduce-motion toggle. When true, all entrances are instant. */
  reduceMotion: boolean;
}

export const SITE_ANIMATION_KEYS = {
  effect: '__animation_effect',
  speed: '__animation_speed',
  customDurationMs: '__animation_customDurationMs',
  staggerMs: '__animation_staggerMs',
  reduceMotion: '__animation_reduceMotion',
} as const;

export const DEFAULT_SITE_ANIMATION: AnimationConfig = {
  effect: 'fade-up',
  speed: 'normal',
  customDurationMs: 600,
  staggerMs: 150,
  reduceMotion: false,
};

const SPEED_TO_MS: Record<Exclude<AnimationSpeed, 'custom'>, number> = {
  subtle: 350,
  normal: 600,
  pronounced: 1000,
};

export function speedToMs(config: Pick<AnimationConfig, 'speed' | 'customDurationMs'>): number {
  if (config.speed === 'custom') {
    const raw = config.customDurationMs;
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return raw;
    return DEFAULT_SITE_ANIMATION.customDurationMs ?? 600;
  }
  return SPEED_TO_MS[config.speed];
}

export const EFFECT_LABELS: Record<AnimationEffect, string> = {
  'fade-up': 'Fade up',
  fade: 'Fade in',
  slide: 'Slide in',
  scale: 'Scale',
  none: 'None',
};

export const SPEED_LABELS: Record<AnimationSpeed, string> = {
  subtle: 'Subtle',
  normal: 'Normal',
  pronounced: 'Pronounced',
  custom: 'Custom…',
};

export function readSiteAnimation(siteContent: Record<string, unknown> | undefined): AnimationConfig {
  const sc = siteContent || {};
  const effect = isAnimationEffect(sc[SITE_ANIMATION_KEYS.effect])
    ? (sc[SITE_ANIMATION_KEYS.effect] as AnimationEffect)
    : DEFAULT_SITE_ANIMATION.effect;
  const speed = isAnimationSpeed(sc[SITE_ANIMATION_KEYS.speed])
    ? (sc[SITE_ANIMATION_KEYS.speed] as AnimationSpeed)
    : DEFAULT_SITE_ANIMATION.speed;
  const customDurationMs = toFiniteNumber(sc[SITE_ANIMATION_KEYS.customDurationMs])
    ?? DEFAULT_SITE_ANIMATION.customDurationMs;
  const staggerMs = toFiniteNumber(sc[SITE_ANIMATION_KEYS.staggerMs])
    ?? DEFAULT_SITE_ANIMATION.staggerMs;
  const reduceMotion = sc[SITE_ANIMATION_KEYS.reduceMotion] === true;
  return { effect, speed, customDurationMs, staggerMs, reduceMotion };
}

/** Resolves the active config. Currently just the site-level value. */
export function resolveAnimation(siteContent: Record<string, unknown> | undefined): AnimationConfig {
  return readSiteAnimation(siteContent);
}

function isAnimationEffect(value: unknown): boolean {
  return value === 'fade-up' || value === 'fade' || value === 'slide' || value === 'scale' || value === 'none';
}

function isAnimationSpeed(value: unknown): boolean {
  return value === 'subtle' || value === 'normal' || value === 'pronounced' || value === 'custom';
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}
