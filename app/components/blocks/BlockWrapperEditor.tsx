'use client';

import { ReactNode, cloneElement, isValidElement, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { useEditorContext } from '@/lib/editor-context';
import { ArrowUp, ArrowDown, Trash2, Settings } from 'lucide-react';
import BlockSettingsModal from './BlockSettingsModal';
import { getPanelEntry, hasInspectorPanel } from './block-panel-registry';
import { AVAILABLE_BLOCKS } from './block-registry';
import { motion } from 'framer-motion';
import { staggerContainer } from '@/lib/motion';
import {
    buildLayoutCss,
    type LayoutContainerWidth,
    type LayoutHorizontalAlign,
} from '@/lib/builder/layout-settings';

const WALKTHROUGH_RESET_EVENT = 'ks:walkthrough-reset-ui';
const BLOCK_SETTINGS_OPEN_EVENT = 'ks:block-settings-open';
const REPEATABLE_ITEMS_DRAFT_UPDATE_EVENT = 'ks:repeatable-items-draft-update';
const HERO_DRAFT_UPDATE_EVENT = 'ks:hero-draft-update';
const CONTACT_DRAFT_UPDATE_EVENT = 'ks:contact-draft-update';
const LAYOUT_GUIDE_PREVIEW_EVENT = 'ks:layout-guide-preview';

interface BlockWrapperEditorProps {
    id: string;
    type: string;
    children: ReactNode;
    data?: Record<string, unknown>;
    onUpdateBlockData?: (key: string, value: unknown) => void;
    customCss?: string;
    onUpdateCustomCss?: (css: string) => void;
    palette?: Record<string, string>;
    slug: string;
    scopedCss: string;
    paletteVars?: React.CSSProperties;
}

type LayoutGuidePreviewDetail = {
    blockId?: string;
    containerWidth?: LayoutContainerWidth;
    horizontalAlign?: LayoutHorizontalAlign;
    active?: boolean;
};

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
    const [containerWidthGuideStyle, setContainerWidthGuideStyle] = useState<CSSProperties | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const settingsButtonRef = useRef<HTMLButtonElement>(null);

    const usesPanel = hasInspectorPanel(type);
    const panelEntry = getPanelEntry(type);

    const closeSettings = useCallback((options?: { restoreFocus?: boolean }) => {
        setSettingsOpen(false);
        setDraftData(null);
        setContainerWidthGuideStyle(null);
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
            setContainerWidthGuideStyle(null);
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

    useEffect(() => {
        const handleLayoutGuidePreview = (event: Event) => {
            const detail = (event as CustomEvent<LayoutGuidePreviewDetail>).detail;
            if (detail?.blockId !== id) return;

            if (!detail.active || !detail.containerWidth || detail.containerWidth === 'default') {
                setContainerWidthGuideStyle(null);
                return;
            }

            setContainerWidthGuideStyle(getGuidePositionStyle(
                detail.containerWidth,
                detail.horizontalAlign || 'center',
            ));
        };

        window.addEventListener(LAYOUT_GUIDE_PREVIEW_EVENT, handleLayoutGuidePreview);
        return () => window.removeEventListener(LAYOUT_GUIDE_PREVIEW_EVENT, handleLayoutGuidePreview);
    }, [id]);

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
    const previewCustomCss = usesPanel && draftData
        ? scopeCustomCss(id, draftCustomCss)
        : scopedCss;
    const previewLayoutCss = buildLayoutCss(id, type, previewData?.sectionSettings, previewData);
    const previewScopedCss = [previewCustomCss, previewLayoutCss].filter(Boolean).join('\n');
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
    const handlePreviewContentUpdate = useCallback((key: string, value: unknown) => {
        if (settingsOpen && usesPanel && type === 'contact' && isContactDraftKey(key)) {
            setDraftData((current) => ({
                ...((current || data || {}) as Record<string, unknown>),
                [key]: value,
            }));
            window.dispatchEvent(new CustomEvent(CONTACT_DRAFT_UPDATE_EVENT, {
                detail: { blockId: id, key, value, source: 'preview' },
            }));
            return;
        }

        if (settingsOpen && usesPanel && type === 'hero' && key === 'cards') {
            setDraftData((current) => ({
                ...((current || data || {}) as Record<string, unknown>),
                [key]: value,
            }));
            window.dispatchEvent(new CustomEvent(HERO_DRAFT_UPDATE_EVENT, {
                detail: { blockId: id, key, value, source: 'preview' },
            }));
            return;
        }

        if (settingsOpen && usesPanel && key === 'items' && isRepeatableItemsPanelType(type)) {
            setDraftData((current) => ({
                ...((current || data || {}) as Record<string, unknown>),
                [key]: value,
            }));
            window.dispatchEvent(new CustomEvent(REPEATABLE_ITEMS_DRAFT_UPDATE_EVENT, {
                detail: { blockId: id, key, value, source: 'preview' },
            }));
            return;
        }

        onUpdateBlockData?.(key, value);
    }, [data, id, onUpdateBlockData, settingsOpen, type, usesPanel]);

    const previewChildren = usesPanel && previewData
        ? cloneChildrenWithData(children, previewData, handlePreviewContentUpdate)
        : children;

    useEffect(() => {
        if (!settingsOpen || !usesPanel || !isRepeatableItemsPanelType(type)) return;
        window.dispatchEvent(new CustomEvent(REPEATABLE_ITEMS_DRAFT_UPDATE_EVENT, {
            detail: { blockId: id, key: 'items', value: data?.items, source: 'persisted' },
        }));
    }, [data?.items, id, settingsOpen, type, usesPanel]);

    return (
        <motion.div
            ref={wrapperRef}
            key={`${id}-edit`}
            id={slug}
            data-tour="builder-section"
            variants={staggerContainer}
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
            {containerWidthGuideStyle && (
                <div className="pointer-events-none absolute inset-0 z-[90]" aria-hidden="true">
                    <div
                        className="ks-container-width-guide absolute inset-y-0 border-x-2 border-dashed border-slate-800/45 bg-slate-950/[0.015] shadow-[inset_1px_0_0_rgba(255,255,255,0.7),inset_-1px_0_0_rgba(255,255,255,0.7)]"
                        style={containerWidthGuideStyle}
                    />
                </div>
            )}

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

function getGuidePositionStyle(width: LayoutContainerWidth, align: LayoutHorizontalAlign): CSSProperties {
    const guideWidth = width === 'narrow'
        ? 'min(100%, 56rem)'
        : width === 'wide'
            ? 'min(100%, 90rem)'
            : '100%';
    const base: CSSProperties = { width: guideWidth };

    if (align === 'right') return { ...base, right: 0 };
    if (align === 'center') return { ...base, left: '50%', transform: 'translateX(-50%)' };
    return { ...base, left: 0 };
}

function getReadableBlockLabel(type: string): string {
    if (type === 'membershipGate') return 'Membership Gate';

    const label = AVAILABLE_BLOCKS.find(block => block.type === type)?.label || type;
    const cleanLabel = label
        .replace(/[^\x20-\x7E]/g, '')
        .replace(/^[^A-Za-z0-9]+/, '')
        .trim();

    return cleanLabel || type;
}

type EditableBlockChildProps = {
    data?: Record<string, unknown>;
    block?: { data?: Record<string, unknown> };
    updateContent?: (key: string, value: unknown) => void;
};

function cloneChildrenWithData(
    children: ReactNode,
    data: Record<string, unknown>,
    updateContent: (key: string, value: unknown) => void,
): ReactNode {
    if (!isValidElement<EditableBlockChildProps>(children)) {
        return children;
    }

    const block = children.props.block
        ? { ...children.props.block, data }
        : undefined;

    return cloneElement(children, block ? { data, block, updateContent } : { data, updateContent });
}

function isRepeatableItemsPanelType(type: string): boolean {
    return type === 'servicesGrid' || type === 'stats' || type === 'testimonials' || type === 'faq';
}

function isContactDraftKey(key: string): boolean {
    return key === 'contactItems' || key === 'socialLinks';
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
