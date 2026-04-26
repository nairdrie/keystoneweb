'use client';

import dynamic from 'next/dynamic';
import { useEditorContext } from '@/lib/editor-context';

const RevealEditor = dynamic(() => import('./RevealEditor'), { ssr: false });

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

/**
 * In edit mode this used to fade-in via framer-motion. In published mode the
 * `animate` prop was undefined so no animation ran anyway — but framer-motion
 * still shipped to every visitor's bundle. Now Reveal is a passthrough on the
 * published path, and only edit mode pulls in framer-motion via dynamic import.
 */
export default function Reveal({ children, className = '', delay }: RevealProps) {
  const context = useEditorContext();
  const isEditMode = context?.isEditMode || false;

  if (!isEditMode) {
    return <div className={className}>{children}</div>;
  }

  return <RevealEditor className={className} delay={delay}>{children}</RevealEditor>;
}
