'use client';

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, useReducedMotion } from 'framer-motion';
import { useEditorContext } from '@/lib/editor-context';
import { getBlockSlug } from '@/lib/block-utils';
import { buildStaggerContainer } from '@/lib/motion';
import { buildLayoutCss, buildSectionStyleCss } from '@/lib/builder/layout-settings';
import { resolveAnimation } from '@/lib/animations';
import { compileScript, runKeyframe } from '@/lib/keyframe';

interface BlockWrapperProps {
    id: string;
    type: string;
    children: ReactNode;
    data?: Record<string, unknown>;
    onUpdateBlockData?: (key: string, value: unknown) => void;
    customCss?: string;
    onUpdateCustomCss?: (css: string) => void;
    customScript?: string;
    palette?: Record<string, string>;
}

const BlockWrapperEditor = dynamic(() => import('./BlockWrapperEditor'), { ssr: false });

export default function BlockWrapper(props: BlockWrapperProps) {
    const { id, type, children, customCss, customScript, palette } = props;
    const context = useEditorContext();
    const isEditMode = context?.isEditMode || false;
    const blocks = context?.blocks || [];
    const index = blocks.findIndex(b => b.id === id);
    const slug = index !== -1 ? getBlockSlug(blocks[index], index, blocks) : id;

    const scopedCss = scopeCustomCss(id, customCss);
    const layoutCss = buildLayoutCss(id, type, props.data?.sectionSettings, props.data);
    const sectionStyleCss = buildSectionStyleCss(id, props.data, palette || {});
    const combinedCss = [scopedCss, layoutCss, sectionStyleCss].filter(Boolean).join('\n');

    const paletteVars = palette
        ? ({
            '--primary': palette.primary,
            '--secondary': palette.secondary,
            '--accent': palette.accent,
        } as React.CSSProperties)
        : undefined;

    if (isEditMode) {
        return <BlockWrapperEditor {...props} slug={slug} scopedCss={scopedCss} paletteVars={paletteVars} />;
    }

    return (
        <BlockWrapperView
            id={id}
            type={type}
            slug={slug}
            siteContent={context?.siteContent}
            combinedCss={combinedCss}
            paletteVars={paletteVars}
            customScript={customScript}
        >
            {children}
        </BlockWrapperView>
    );
}

interface BlockWrapperViewProps {
    id: string;
    type: string;
    slug: string;
    siteContent?: Record<string, unknown>;
    combinedCss: string;
    paletteVars?: React.CSSProperties;
    customScript?: string;
    children: ReactNode;
}

/**
 * View-mode rendering lives in its own component so the framer-motion hooks
 * only run on the published site, never during editor sessions.
 */
function BlockWrapperView({ id, type, slug, siteContent, combinedCss, paletteVars, customScript, children }: BlockWrapperViewProps) {
    const config = resolveAnimation(siteContent);
    const prefersReducedMotion = useReducedMotion();
    const forceInstant = prefersReducedMotion === true || config.reduceMotion || config.effect === 'none';
    const variants = buildStaggerContainer({ config, forceInstant });

    // Compile the Keyframe script once per script value. If it requests `hold animations`,
    // the block stays in its hidden variant until the runtime calls release.
    const compiled = useMemo(() => compileScript(customScript || ''), [customScript]);
    const usesHold = !!compiled.program?.usesHold;
    const [scriptReleased, setScriptReleased] = useState(!usesHold);
    const motionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const root = motionRef.current;
        if (!root || !compiled.program) return;
        const result = runKeyframe(root, compiled.program, {
            onHoldAnimations: () => setScriptReleased(false),
            onReleaseAnimations: () => setScriptReleased(true),
        });
        return () => result.teardown();
    }, [compiled]);

    const onAnimationComplete = () => {
        // Notify Keyframe `on animations-complete` triggers.
        motionRef.current?.dispatchEvent(new CustomEvent('ks:kf:animations-complete'));
    };

    const animationsHeld = usesHold && !scriptReleased;

    return (
        <motion.div
            key={`${id}-view`}
            ref={motionRef}
            id={slug}
            data-block-id={id}
            data-ks-block-type={type}
            variants={variants as any}
            initial="hidden"
            animate={animationsHeld ? 'hidden' : undefined}
            whileInView={animationsHeld ? undefined : 'show'}
            viewport={animationsHeld ? undefined : { once: true, margin: '-50px' }}
            onAnimationComplete={onAnimationComplete}
            style={paletteVars}
            className={`w-full ks-block ks-block-${type}`}
        >
            {combinedCss && <style dangerouslySetInnerHTML={{ __html: combinedCss }} />}
            {children}
        </motion.div>
    );
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
