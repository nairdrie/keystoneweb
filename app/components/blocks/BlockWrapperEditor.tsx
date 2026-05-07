'use client';

import { ReactNode, cloneElement, isValidElement, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useEditorContext } from '@/lib/editor-context';
import { ArrowUp, ArrowDown, Trash2, Settings } from 'lucide-react';
import BlockSettingsModal from './BlockSettingsModal';
import { getPanelEntry, hasInspectorPanel } from './block-panel-registry';
import { AVAILABLE_BLOCKS } from './block-registry';
import { motion } from 'framer-motion';
import { staggerContainer } from '@/lib/motion';

const WALKTHROUGH_RESET_EVENT = 'ks:walkthrough-reset-ui';
const BLOCK_SETTINGS_OPEN_EVENT = 'ks:block-settings-open';

interface BlockWrapperEditorProps {
    id: string;
    type: string;
    children: ReactNode;
    data?: any;
    onUpdateBlockData?: (key: string, value: any) => void;
    customCss?: string;
    onUpdateCustomCss?: (css: string) => void;
    palette?: Record<string, string>;
    slug: string;
    scopedCss: string;
    paletteVars?: React.CSSProperties;
}

export default function BlockWrapperEditor({
    id,
    type,
    children,
    data,
    onUpdateBlockData,
    customCss,
    onUpdateCustomCss,
    palette,
    slug,
    scopedCss,
    paletteVars,
}: BlockWrapperEditorProps) {
    const context = useEditorContext();
    const router = useRouter();
    const isProUser = context?.isProUser || false;
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [isSelected, setIsSelected] = useState(false);
    const [draftData, setDraftData] = useState<Record<string, unknown> | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const settingsButtonRef = useRef<HTMLButtonElement>(null);

    const usesPanel = hasInspectorPanel(type);
    const panelEntry = getPanelEntry(type);

    const closeSettings = useCallback((options?: { restoreFocus?: boolean }) => {
        setSettingsOpen(false);
        setDraftData(null);
        if (options?.restoreFocus !== false) {
            window.setTimeout(() => settingsButtonRef.current?.focus(), 0);
        }
    }, []);

    useEffect(() => {
        const handleWalkthroughReset = () => closeSettings();

        window.addEventListener(WALKTHROUGH_RESET_EVENT, handleWalkthroughReset);
        return () => window.removeEventListener(WALKTHROUGH_RESET_EVENT, handleWalkthroughReset);
    }, [closeSettings]);

    useEffect(() => {
        const handleBlockSettingsOpen = (event: Event) => {
            const detail = (event as CustomEvent<{ blockId?: string }>).detail;
            if (detail?.blockId === id) return;
            setSettingsOpen(false);
            setDraftData(null);
            setIsSelected(false);
        };

        window.addEventListener(BLOCK_SETTINGS_OPEN_EVENT, handleBlockSettingsOpen);
        return () => window.removeEventListener(BLOCK_SETTINGS_OPEN_EVENT, handleBlockSettingsOpen);
    }, [id]);

    useEffect(() => {
        const handleDocumentPointerDown = (event: PointerEvent) => {
            if (!wrapperRef.current?.contains(event.target as Node)) {
                setIsSelected(false);
            }
        };

        document.addEventListener('pointerdown', handleDocumentPointerDown);
        return () => document.removeEventListener('pointerdown', handleDocumentPointerDown);
    }, []);

    const openSettings = () => {
        window.dispatchEvent(new CustomEvent(BLOCK_SETTINGS_OPEN_EVENT, { detail: { blockId: id } }));
        setIsSelected(true);
        if (usesPanel) {
            setDraftData((data || {}) as Record<string, unknown>);
        }
        setSettingsOpen(true);
    };

    const previewData = usesPanel && draftData ? draftData : data;
    const draftCustomCss = typeof draftData?.__customCss === 'string' ? draftData.__customCss : '';
    const previewScopedCss = usesPanel && draftData
        ? scopeCustomCss(id, draftCustomCss)
        : scopedCss;
    const previewChildren = usesPanel && previewData
        ? cloneChildrenWithData(children, previewData)
        : children;
    const controlsVisibleClass = isSelected
        ? 'opacity-100'
        : 'opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100';
    const wrapperBorderClass = settingsOpen
        ? 'border-blue-300/80 ring-1 ring-blue-100'
        : isSelected
            ? 'border-slate-300'
            : 'border-transparent hover:border-slate-300 [@media(hover:none)]:border-slate-300/60';

    const primaryButton = panelEntry?.primaryButton;
    const PrimaryIcon = primaryButton?.icon ?? Settings;
    const secondaryActions = panelEntry?.secondaryActions ?? [];
    const showSettingsButton = panelEntry?.hideSettingsButton !== true;
    const blockLabel = getReadableBlockLabel(type);

    return (
        <motion.div
            ref={wrapperRef}
            key={`${id}-edit`}
            id={slug}
            data-tour="builder-section"
            variants={staggerContainer as any}
            initial="show"
            animate="show"
            style={paletteVars}
            onClick={() => setIsSelected(true)}
            className={`relative group w-full border-2 transition-[border-color,box-shadow] ks-block ks-block-${type} ${wrapperBorderClass}`}
        >
            <div className="absolute left-2 top-2 z-[100] pointer-events-none rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                {blockLabel}
            </div>
            {/* Editor controls are intentionally outside data-block-id so block __customCss cannot affect them */}
            <div className={`absolute top-2 right-2 ${controlsVisibleClass} transition-opacity bg-white shadow-md border border-slate-200 rounded-md flex overflow-hidden z-[100]`}>
                {showSettingsButton && (
                    primaryButton ? (
                        <button
                            ref={settingsButtonRef}
                            onClick={openSettings}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-r border-slate-100 transition-colors"
                            title={primaryButton.label}
                        >
                            <PrimaryIcon className="w-4 h-4" />
                            {primaryButton.label}
                        </button>
                    ) : (
                        <button
                            ref={settingsButtonRef}
                            onClick={openSettings}
                            className="p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-900 border-r border-slate-100 transition-colors"
                            title="Settings"
                        >
                            <Settings className="w-4 h-4" />
                        </button>
                    )
                )}
                {secondaryActions.map((action) => {
                    const Icon = action.icon;
                    const SuffixIcon = action.suffixIcon;
                    const handleClick = () => {
                        const href = action.getHref?.(context ?? null, id);
                        if (!href) return;
                        const navigate = () => router.push(href);
                        if (context?.requestNavigation) context.requestNavigation(navigate);
                        else navigate();
                    };
                    return (
                        <button
                            key={action.id}
                            onClick={handleClick}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-r border-slate-100 transition-colors"
                            title={action.label}
                        >
                            <Icon className="w-4 h-4" />
                            {action.label}
                            {SuffixIcon && <SuffixIcon className="w-3 h-3 opacity-60" />}
                        </button>
                    );
                })}
                <button
                    onClick={() => context?.moveBlock?.(id, 'up')}
                    className="p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-900 border-r border-slate-100 transition-colors"
                    title="Move Up"
                >
                    <ArrowUp className="w-4 h-4" />
                </button>
                <button
                    onClick={() => context?.moveBlock?.(id, 'down')}
                    className="p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-900 border-r border-slate-100 transition-colors"
                    title="Move Down"
                >
                    <ArrowDown className="w-4 h-4" />
                </button>
                <button
                    onClick={() => context?.removeBlock?.(id)}
                    className="p-1.5 text-red-500 hover:bg-red-50 transition-colors"
                    title="Delete Block"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
            <div data-block-id={id}>
                {previewScopedCss && <style dangerouslySetInnerHTML={{ __html: previewScopedCss }} />}
                {previewChildren}
            </div>

            <BlockSettingsModal
                isOpen={settingsOpen}
                onClose={closeSettings}
                blockId={id}
                blockType={type}
                blockData={data}
                onUpdateBlockData={onUpdateBlockData}
                customCss={customCss || ''}
                onSaveCustomCss={(css) => onUpdateCustomCss?.(css)}
                isProUser={isProUser}
                palette={palette}
                onDraftBlockDataChange={usesPanel ? setDraftData : undefined}
            />
        </motion.div>
    );
}

function getReadableBlockLabel(type: string): string {
    const label = AVAILABLE_BLOCKS.find(block => block.type === type)?.label || type;
    const cleanLabel = label
        .replace(/[^\x20-\x7E]/g, '')
        .replace(/^[^A-Za-z0-9]+/, '')
        .trim();

    return cleanLabel || type;
}

function cloneChildrenWithData(children: ReactNode, data: Record<string, unknown>): ReactNode {
    if (!isValidElement<{ data?: Record<string, unknown>; block?: { data?: Record<string, unknown> } }>(children)) {
        return children;
    }

    const block = children.props.block
        ? { ...children.props.block, data }
        : undefined;

    return cloneElement(children, block ? { data, block } : { data });
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
