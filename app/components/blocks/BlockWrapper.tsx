'use client';

import { ReactNode, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { motion, useReducedMotion } from 'framer-motion';
import { useEditorContext } from '@/lib/editor-context';
import { getBlockSlug } from '@/lib/block-utils';
import { buildStaggerContainer } from '@/lib/motion';
import { buildLayoutCss } from '@/lib/builder/layout-settings';
import {
    blockToken,
    resolveAnimation,
    type AnimationConfig,
} from '@/lib/animations';
import { markComplete, useAnimationGate } from '@/lib/animation-bus';

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
    const layoutCss = buildLayoutCss(id, type, props.data?.sectionSettings, props.data);
    const combinedCss = [scopedCss, layoutCss].filter(Boolean).join('\n');

    const paletteVars = palette
        ? ({
            '--primary': palette.primary,
            '--secondary': palette.secondary,
            '--accent': palette.accent,
        } as React.CSSProperties)
        : undefined;

    const config: AnimationConfig = resolveAnimation(context?.siteContent, props.data);
    const prefersReducedMotion = useReducedMotion();
    const forceInstant = prefersReducedMotion === true || config.reduceMotion || config.effect === 'none';

    const gateToken = config.trigger?.kind === 'after' ? config.trigger.after : undefined;
    const gateOpen = useAnimationGate(gateToken);

    const onAnimationComplete = useCallback(() => {
        markComplete(blockToken(id));
    }, [id]);

    if (!isEditMode) {
        const variants = buildStaggerContainer({ config, forceInstant });

        return (
            <motion.div
                key={`${id}-view`}
                id={slug}
                data-block-id={id}
                variants={variants as any}
                initial="hidden"
                animate={gateOpen ? 'show' : 'hidden'}
                whileInView={gateToken ? undefined : 'show'}
                viewport={gateToken ? undefined : { once: true, margin: '-50px' }}
                onAnimationComplete={onAnimationComplete}
                style={paletteVars}
                className={`w-full ks-block ks-block-${type}`}
            >
                {combinedCss && <style dangerouslySetInnerHTML={{ __html: combinedCss }} />}
                {children}
            </motion.div>
        );
    }

    return <BlockWrapperEditor {...props} slug={slug} scopedCss={scopedCss} paletteVars={paletteVars} />;
}

function scopeCustomCss(id: string, customCss?: string): string {
    if (!customCss) return '';
    const blockScope = `[data-block-id="${id}"]`;

    return customCss
        .split('}')
        .filter(rule => rule.trim())
        .map(rule => {
            const trimmed = rule.trim();
            if (!trimmed) return '';

            if (trimmed.startsWith('@')) {
                return `${trimmed}}`;
            }

            const declarationStart = trimmed.indexOf('{');
            if (declarationStart === -1) {
                return `${blockScope} ${trimmed}}`;
            }

            const selectorText = trimmed.slice(0, declarationStart).trim();
            const declarations = trimmed.slice(declarationStart + 1).trim();
            const scopedSelectors = selectorText
                .split(',')
                .map(selector => selector.trim())
                .filter(Boolean)
                .map(selector => selector.startsWith(blockScope) ? selector : `${blockScope} ${selector}`)
                .join(', ');

            return `${scopedSelectors} { ${declarations} }`;
        })
        .join('\n');
}
