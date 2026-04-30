'use client';

import { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { useEditorContext } from '@/lib/editor-context';
import { getBlockSlug } from '@/lib/block-utils';
import { staggerContainer } from '@/lib/motion';

interface BlockWrapperProps {
    id: string;
    type: string;
    children: ReactNode;
    data?: any;
    onUpdateBlockData?: (key: string, value: any) => void;
    customCss?: string;
    onUpdateCustomCss?: (css: string) => void;
    palette?: Record<string, string>;
}

const BlockWrapperEditor = dynamic(() => import('./BlockWrapperEditor'), { ssr: false });

export default function BlockWrapper(props: BlockWrapperProps) {
    const { id, type, children, customCss, palette } = props;
    const context = useEditorContext();
    const isEditMode = context?.isEditMode || false;
    const blocks = context?.blocks || [];
    const index = blocks.findIndex(b => b.id === id);
    const slug = index !== -1 ? getBlockSlug(blocks[index], index, blocks) : id;

    const scopedCss = scopeCustomCss(id, customCss);

    const paletteVars = palette
        ? ({
            '--primary': palette.primary,
            '--secondary': palette.secondary,
            '--accent': palette.accent,
        } as React.CSSProperties)
        : undefined;

    if (!isEditMode) {
        return (
            <motion.div
                key={`${id}-view`}
                id={slug}
                data-block-id={id}
                variants={staggerContainer as any}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-50px" }}
                style={paletteVars}
                className={`w-full ks-block ks-block-${type}`}
            >
                {scopedCss && <style dangerouslySetInnerHTML={{ __html: scopedCss }} />}
                {children}
            </motion.div>
        );
    }

    return <BlockWrapperEditor {...props} slug={slug} scopedCss={scopedCss} paletteVars={paletteVars} />;
}

function scopeCustomCss(id: string, customCss?: string): string {
    if (!customCss) return '';
    return customCss
        .split('}')
        .filter(rule => rule.trim())
        .map(rule => {
            const trimmed = rule.trim();
            if (!trimmed) return '';
            return `[data-block-id="${id}"] ${trimmed}}`;
        })
        .join('\n');
}
