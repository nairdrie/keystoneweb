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

  return (
    <motion.div
      variants={revealVariants as any}
      className={className}
      transition={delay ? { delay } : undefined}
      animate={isEditMode ? "show" : undefined}
    >
      {children}
    </motion.div>
  );
}
