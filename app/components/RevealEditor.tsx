'use client';

import { motion } from 'framer-motion';
import { revealVariants } from '@/lib/motion';

interface RevealEditorProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export default function RevealEditor({ children, className = '', delay }: RevealEditorProps) {
  return (
    <motion.div
      variants={revealVariants as any}
      className={className}
      transition={delay ? { delay } : undefined}
      animate="show"
    >
      {children}
    </motion.div>
  );
}
