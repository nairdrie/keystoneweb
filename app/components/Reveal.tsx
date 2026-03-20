'use client';

import { motion } from 'framer-motion';
import { revealVariants } from '@/lib/motion';

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export default function Reveal({ children, className = '', delay }: RevealProps) {
  return (
    <motion.div
      variants={revealVariants}
      className={className}
      transition={delay ? { delay } : undefined}
    >
      {children}
    </motion.div>
  );
}
