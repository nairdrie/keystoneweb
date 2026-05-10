import { Variants } from 'framer-motion';
import {
  type AnimationConfig,
  type AnimationEffect,
  speedToMs,
} from './animations';

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Default scroll-in variants. Kept for back-compat with callers that don't
 * resolve a config. Equivalent to `buildRevealVariants({ effect: 'fade-up', ... })`.
 */
export const revealVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE },
  },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
};

interface VariantOpts {
  config: AnimationConfig;
  /** When true, render hidden = visible (used for prefers-reduced-motion or 'none'). */
  forceInstant?: boolean;
}

export function buildRevealVariants({ config, forceInstant }: VariantOpts): Variants {
  if (forceInstant || config.effect === 'none' || config.reduceMotion) {
    return {
      hidden: { opacity: 1 },
      show: { opacity: 1, transition: { duration: 0 } },
    };
  }

  const durationSec = Math.max(0, speedToMs(config) / 1000);
  const transition = { duration: durationSec, ease: EASE } as const;

  switch (config.effect) {
    case 'fade':
      return {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition },
      };
    case 'slide':
      return {
        hidden: { opacity: 0, x: -32 },
        show: { opacity: 1, x: 0, transition },
      };
    case 'scale':
      return {
        hidden: { opacity: 0, scale: 0.94 },
        show: { opacity: 1, scale: 1, transition },
      };
    case 'fade-up':
    default:
      return {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition },
      };
  }
}

export function buildStaggerContainer({ config, forceInstant }: VariantOpts): Variants {
  if (forceInstant || config.effect === 'none' || config.reduceMotion) {
    return {
      hidden: { opacity: 1 },
      show: { opacity: 1, transition: { duration: 0 } },
    };
  }
  const staggerChildren = Math.max(0, (config.staggerMs ?? 150) / 1000);
  return {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren,
        delayChildren: 0.1,
      },
    },
  };
}

/** Total animation length (ms) for a config — used to schedule "done" events. */
export function totalDurationMs(config: AnimationConfig): number {
  if (config.effect === 'none' || config.reduceMotion) return 0;
  return speedToMs(config);
}

export type { AnimationEffect };
