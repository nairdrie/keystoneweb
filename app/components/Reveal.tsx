'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { buildRevealVariants } from '@/lib/motion';
import { useEditorContext } from '@/lib/editor-context';
import { resolveAnimation } from '@/lib/animations';

/**
 * Resolves the site-wide stagger delay (in seconds) for use with `<Reveal delay={index * useStaggerSec()}>`.
 */
export function useStaggerSec(): number {
  const context = useEditorContext();
  const config = resolveAnimation(context?.siteContent);
  return Math.max(0, (config.staggerMs ?? 150) / 1000);
}

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  onDragOver?: React.DragEventHandler<HTMLDivElement>;
  onDrop?: React.DragEventHandler<HTMLDivElement>;
}

export default function Reveal({ children, className = '', delay, onDragOver, onDrop }: RevealProps) {
  const context = useEditorContext();
  const isEditMode = context?.isEditMode || false;
  const prefersReducedMotion = useReducedMotion();
  const config = resolveAnimation(context?.siteContent);
  const baseVariants = buildRevealVariants({
    config,
    forceInstant: prefersReducedMotion === true,
  });
  const variants =
    delay && delay > 0 && baseVariants.show && typeof baseVariants.show === 'object'
      ? {
          ...baseVariants,
          show: {
            ...(baseVariants.show as Record<string, unknown>),
            transition: {
              ...((baseVariants.show as { transition?: Record<string, unknown> }).transition ?? {}),
              delay,
            },
          },
        }
      : baseVariants;

  const animationProps = isEditMode
    ? { animate: 'show' as const }
    : {
        initial: 'hidden' as const,
        whileInView: 'show' as const,
        viewport: { once: true, margin: '-50px' },
      };

  return (
    <motion.div
      variants={variants}
      className={className}
      {...animationProps}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {children}
    </motion.div>
  );
}
