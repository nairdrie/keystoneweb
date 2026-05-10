/**
 * Animation customization model.
 *
 * Three layers of configuration with inheritance:
 *   1. Site default      — designData.__animation_*
 *   2. Per-block override — block.data.animation (partial; missing fields fall back to site default)
 *   3. Per-text reveal    — block.data[`${contentKey}__textReveal`] (independent of block-level config)
 *
 * Resolved config drives both Framer Motion variants and the typewriter component.
 */

export type AnimationEffect = 'fade-up' | 'fade' | 'slide' | 'scale' | 'none';

export type AnimationSpeed = 'subtle' | 'normal' | 'pronounced' | 'custom';

export type AnimationTriggerKind = 'scroll' | 'after';

export interface AnimationTrigger {
  kind: AnimationTriggerKind;
  /** Token of the predecessor element when kind === 'after'. e.g. "block:<id>" or "text:<contentKey>". */
  after?: string;
}

export interface AnimationConfig {
  effect: AnimationEffect;
  speed: AnimationSpeed;
  /** Used when speed === 'custom'. Milliseconds. */
  customDurationMs?: number;
  /** Stagger delay between sibling children of a block, in ms. */
  staggerMs: number;
  /** Master reduce-motion toggle. When true, all entrances are instant. */
  reduceMotion: boolean;
  /** Trigger condition for this element (block-level only). */
  trigger?: AnimationTrigger;
}

export type PartialAnimationConfig = Partial<Omit<AnimationConfig, 'trigger'>> & {
  trigger?: AnimationTrigger;
};

export type TextRevealEffect = 'none' | 'typewriter' | 'word' | 'letter-fade';

export interface TextRevealConfig {
  effect: TextRevealEffect;
  /** Characters per second for typewriter, words per second for word, letters per second for letter-fade. */
  speed: number;
  /** Optional explicit start delay (ms) after the reveal is triggered. */
  delayMs?: number;
  /** Optional sequencing trigger; same shape as block-level trigger. */
  trigger?: AnimationTrigger;
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

export const TEXT_REVEAL_LABELS: Record<TextRevealEffect, string> = {
  none: 'None',
  typewriter: 'Typewriter',
  word: 'Word-by-word',
  'letter-fade': 'Letter fade',
};

export const DEFAULT_TEXT_REVEAL: TextRevealConfig = {
  effect: 'none',
  speed: 25,
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

export function readBlockAnimationOverride(
  blockData: Record<string, unknown> | undefined,
): PartialAnimationConfig | undefined {
  const raw = blockData?.animation;
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  const out: PartialAnimationConfig = {};
  if (isAnimationEffect(obj.effect)) out.effect = obj.effect as AnimationEffect;
  if (isAnimationSpeed(obj.speed)) out.speed = obj.speed as AnimationSpeed;
  const cd = toFiniteNumber(obj.customDurationMs);
  if (cd !== undefined) out.customDurationMs = cd;
  const stagger = toFiniteNumber(obj.staggerMs);
  if (stagger !== undefined) out.staggerMs = stagger;
  if (typeof obj.reduceMotion === 'boolean') out.reduceMotion = obj.reduceMotion;
  if (obj.trigger && typeof obj.trigger === 'object') {
    const trig = obj.trigger as Record<string, unknown>;
    if (trig.kind === 'after' && typeof trig.after === 'string' && trig.after.length > 0) {
      out.trigger = { kind: 'after', after: trig.after };
    } else if (trig.kind === 'scroll') {
      out.trigger = { kind: 'scroll' };
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function resolveAnimation(
  siteContent: Record<string, unknown> | undefined,
  blockData?: Record<string, unknown>,
): AnimationConfig {
  const site = readSiteAnimation(siteContent);
  const override = readBlockAnimationOverride(blockData);
  if (!override) return site;
  return {
    effect: override.effect ?? site.effect,
    speed: override.speed ?? site.speed,
    customDurationMs: override.customDurationMs ?? site.customDurationMs,
    staggerMs: override.staggerMs ?? site.staggerMs,
    reduceMotion: override.reduceMotion ?? site.reduceMotion,
    trigger: override.trigger,
  };
}

export function readTextReveal(
  blockData: Record<string, unknown> | undefined,
  contentKey: string,
): TextRevealConfig | undefined {
  const raw = blockData?.[`${contentKey}__textReveal`];
  if (!raw) return undefined;
  let obj: Record<string, unknown> | undefined;
  if (typeof raw === 'string') {
    if (raw.trim() === '') return undefined;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        obj = parsed as Record<string, unknown>;
      }
    } catch { return undefined; }
  } else if (typeof raw === 'object' && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>;
  }
  if (!obj) return undefined;
  const effect = isTextRevealEffect(obj.effect) ? (obj.effect as TextRevealEffect) : undefined;
  if (!effect || effect === 'none') return undefined;
  const speed = toFiniteNumber(obj.speed) ?? DEFAULT_TEXT_REVEAL.speed;
  const delayMs = toFiniteNumber(obj.delayMs);
  let trigger: AnimationTrigger | undefined;
  if (obj.trigger && typeof obj.trigger === 'object') {
    const trig = obj.trigger as Record<string, unknown>;
    if (trig.kind === 'after' && typeof trig.after === 'string' && trig.after.length > 0) {
      trigger = { kind: 'after', after: trig.after };
    }
  }
  return { effect, speed, delayMs, trigger };
}

export function blockToken(blockId: string): string {
  return `block:${blockId}`;
}

export function textToken(contentKey: string): string {
  return `text:${contentKey}`;
}

function isAnimationEffect(value: unknown): boolean {
  return value === 'fade-up' || value === 'fade' || value === 'slide' || value === 'scale' || value === 'none';
}

function isAnimationSpeed(value: unknown): boolean {
  return value === 'subtle' || value === 'normal' || value === 'pronounced' || value === 'custom';
}

function isTextRevealEffect(value: unknown): boolean {
  return value === 'none' || value === 'typewriter' || value === 'word' || value === 'letter-fade';
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}
