'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { buildRevealVariants } from '@/lib/motion';
import { useEditorContext } from '@/lib/editor-context';
import { resolveAnimation } from '@/lib/animations';

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
  const variants = buildRevealVariants({
    config,
    forceInstant: prefersReducedMotion === true,
  });

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
      transition={delay ? { delay } : undefined}
      {...animationProps}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {children}
    </motion.div>
  );
}
