'use client';

import { motion } from 'framer-motion';
import { revealVariants } from '@/lib/motion';
import { useEditorContext } from '@/lib/editor-context';

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export default function Reveal({ children, className = '', delay }: RevealProps) {
  const context = useEditorContext();
  const isEditMode = context?.isEditMode || false;

  const animationProps = isEditMode
    ? { animate: 'show' as const }
    : {
        initial: 'hidden' as const,
        whileInView: 'show' as const,
        viewport: { once: true, margin: '-50px' },
      };

  return (
    <motion.div
      variants={revealVariants}
      className={className}
      transition={delay ? { delay } : undefined}
      {...animationProps}
    >
      {children}
    </motion.div>
  );
}
