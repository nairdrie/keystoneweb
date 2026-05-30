'use client';

import { Children, ReactNode, cloneElement, isValidElement, useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
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
    buildSectionStyleCss,
    getLayoutContainerWidthPercent,
    type LayoutContainerWidth,
    type LayoutHorizontalAlign,
} from '@/lib/builder/layout-settings';

const WALKTHROUGH_RESET_EVENT = 'ks:walkthrough-reset-ui';
const BLOCK_SETTINGS_OPEN_EVENT = 'ks:block-settings-open';
const REPEATABLE_ITEMS_DRAFT_UPDATE_EVENT = 'ks:repeatable-items-draft-update';
const HERO_DRAFT_UPDATE_EVENT = 'ks:hero-draft-update';
const CONTACT_DRAFT_UPDATE_EVENT = 'ks:contact-draft-update';
const MAP_DRAFT_UPDATE_EVENT = 'ks:map-draft-update';
const LAYOUT_GUIDE_PREVIEW_EVENT = 'ks:layout-guide-preview';
const SPACING_GUIDE_PREVIEW_EVENT = 'ks:spacing-guide-preview';

interface BlockWrapperEditorProps {
    id: string;
    type: string;
    children: ReactNode;
    data?: Record<string, unknown>;
    onUpdateBlockData?: (key: string, value: unknown) => void;
    customCss?: string;
    onUpdateCustomCss?: (css: string) => void;
    /** Keyframe script — passed through for completeness; runs only in view mode. */
    customScript?: string;
    palette?: Record<string, string>;
    slug: string;
    scopedCss: string;
    siteLayoutCss: string;
    paletteVars?: React.CSSProperties;
}

type LayoutGuidePreviewDetail = {
    blockId?: string;
    containerWidth?: LayoutContainerWidth;
    horizontalAlign?: LayoutHorizontalAlign;
    active?: boolean;
};

type SpacingGuideArea = 'gap' | 'padding' | 'margin';

type SpacingGuidePreviewDetail = {
    blockId?: string;
    area?: SpacingGuideArea;
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
    siteLayoutCss,
    paletteVars,
}: BlockWrapperEditorProps) {
    const context = useEditorContext();
    const router = useRouter();
    const isProUser = context?.isProUser || false;
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [isSelected, setIsSelected] = useState(false);
    const [draftData, setDraftData] = useState<Record<string, unknown> | null>(null);
    const [containerWidthGuideStyle, setContainerWidthGuideStyle] = useState<CSSProperties | null>(null);
    const [spacingGuideArea, setSpacingGuideArea] = useState<SpacingGuideArea | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const settingsButtonRef = useRef<HTMLButtonElement>(null);

    const usesPanel = hasInspectorPanel(type);
    const panelEntry = getPanelEntry(type);

    const closeSettings = useCallback((options?: { restoreFocus?: boolean }) => {
        setSettingsOpen(false);
        setDraftData(null);
        setContainerWidthGuideStyle(null);
        setSpacingGuideArea(null);
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
            setSpacingGuideArea(null);
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

    useEffect(() => {
        const handleSpacingGuidePreview = (event: Event) => {
            const detail = (event as CustomEvent<SpacingGuidePreviewDetail>).detail;
            if (detail?.blockId !== id) return;
            setSpacingGuideArea(detail.active && detail.area ? detail.area : null);
        };

        window.addEventListener(SPACING_GUIDE_PREVIEW_EVENT, handleSpacingGuidePreview);
        return () => window.removeEventListener(SPACING_GUIDE_PREVIEW_EVENT, handleSpacingGuidePreview);
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
    const previewSectionStyleCss = buildSectionStyleCss(id, previewData, palette || {});
    const previewScopedCss = [previewCustomCss, siteLayoutCss, previewLayoutCss, previewSectionStyleCss].filter(Boolean).join('\n');
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

        if (settingsOpen && usesPanel && type === 'map' && isMapDraftKey(key)) {
            setDraftData((current) => ({
                ...((current || data || {}) as Record<string, unknown>),
                [key]: value,
            }));
            window.dispatchEvent(new CustomEvent(MAP_DRAFT_UPDATE_EVENT, {
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

        // The canvas renders from draftData while the panel is open, so any
        // fall-through update (e.g. *__styles from the typography modal) must
        // also be mirrored into draftData or it'll save but not appear.
        if (settingsOpen && usesPanel) {
            setDraftData((current) => ({
                ...((current || data || {}) as Record<string, unknown>),
                [key]: value,
            }));
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
            {spacingGuideArea && <SpacingGuideOverlay area={spacingGuideArea} wrapperRef={wrapperRef} />}

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

type SpacingGuideRect = {
    left: number;
    top: number;
    width: number;
    height: number;
};

type BoxSpacing = {
    top: number;
    right: number;
    bottom: number;
    left: number;
};

type VisibleRect = SpacingGuideRect & {
    right: number;
    bottom: number;
};

const MIN_SPACING_GUIDE_SIZE = 1;

function SpacingGuideOverlay({
    area,
    wrapperRef,
}: {
    area: SpacingGuideArea;
    wrapperRef: RefObject<HTMLDivElement | null>;
}) {
    const [rects, setRects] = useState<SpacingGuideRect[]>([]);
    const colorClass = area === 'gap'
        ? 'border-violet-500/50 bg-violet-400/20'
        : area === 'padding'
            ? 'border-sky-500/50 bg-sky-400/20'
            : 'border-amber-500/55 bg-amber-400/20';

    useEffect(() => {
        let frameId = 0;
        let previousSignature = '';

        const measure = () => {
            const nextRects = measureSpacingGuideRects(wrapperRef.current, area);
            const nextSignature = getGuideRectsSignature(nextRects);

            if (nextSignature !== previousSignature) {
                previousSignature = nextSignature;
                setRects(nextRects);
            }

            frameId = window.requestAnimationFrame(measure);
        };

        measure();
        return () => window.cancelAnimationFrame(frameId);
    }, [area, wrapperRef]);

    return (
        <div className="pointer-events-none absolute inset-0 z-[91] overflow-visible" aria-hidden="true">
            {rects.map((rect, index) => (
                <div
                    key={`${area}-${index}`}
                    className={`absolute rounded-[4px] border ${colorClass}`}
                    style={{
                        left: `${rect.left}px`,
                        top: `${rect.top}px`,
                        width: `${rect.width}px`,
                        height: `${rect.height}px`,
                    }}
                />
            ))}
        </div>
    );
}

function measureSpacingGuideRects(wrapper: HTMLDivElement | null, area: SpacingGuideArea): SpacingGuideRect[] {
    if (!wrapper) return [];

    const blockRoot = getBlockRootElement(wrapper);
    const sectionTarget = blockRoot ? getSpacingSectionTarget(blockRoot) : null;
    if (!blockRoot || !sectionTarget) return [];

    const wrapperRect = wrapper.getBoundingClientRect();
    if (area === 'gap') {
        return measureGapRects(blockRoot, wrapperRect);
    }

    const targetRect = sectionTarget.getBoundingClientRect();
    const spacing = readComputedBoxSpacing(sectionTarget, area);
    return area === 'padding'
        ? getPaddingGuideRects(targetRect, wrapperRect, spacing)
        : getMarginGuideRects(targetRect, wrapperRect, spacing);
}

function getBlockRootElement(wrapper: HTMLDivElement): HTMLElement | null {
    return Array.from(wrapper.children).find((child): child is HTMLElement => (
        child instanceof HTMLElement && child.hasAttribute('data-block-id')
    )) || null;
}

function getSpacingSectionTarget(blockRoot: HTMLElement): HTMLElement | null {
    const directChildren = Array.from(blockRoot.children).filter((child): child is HTMLElement => (
        child instanceof HTMLElement && child.tagName.toLowerCase() !== 'style'
    ));

    return directChildren.find((child) => child.tagName.toLowerCase() === 'section')
        || directChildren.find((child) => child.tagName.toLowerCase() === 'div')
        || directChildren[0]
        || null;
}

function measureGapRects(blockRoot: HTMLElement, wrapperRect: DOMRect): SpacingGuideRect[] {
    const gapTarget = getGapGuideTarget(blockRoot);
    if (!gapTarget) return [];

    const childRects = getVisibleChildRects(gapTarget);
    if (childRects.length < 2) return [];

    return dedupeGuideRects([
        ...getHorizontalGapRects(childRects),
        ...getVerticalGapRects(childRects),
    ].map((rect) => toOverlayRect(rect, wrapperRect)));
}

function getGapGuideTarget(blockRoot: HTMLElement): HTMLElement | null {
    const candidates = Array.from(blockRoot.querySelectorAll<HTMLElement>('*'));
    let bestTarget: HTMLElement | null = null;
    let bestScore = 0;

    for (const candidate of candidates) {
        const score = getGapTargetScore(candidate);
        if (score > bestScore) {
            bestTarget = candidate;
            bestScore = score;
        }
    }

    return bestTarget;
}

function getGapTargetScore(element: HTMLElement): number {
    const rect = element.getBoundingClientRect();
    if (rect.width < 80 || rect.height < 20) return 0;

    const children = getVisibleElementChildren(element);
    if (children.length < 2) return 0;

    const style = window.getComputedStyle(element);
    const className = typeof element.className === 'string' ? element.className : '';
    let score = 0;

    if (className.includes('ks-layout-grid') || className.includes('ks-layout-stack')) score += 1000;
    if (className.includes('space-y-')) score += 760;
    if (style.display === 'grid' || style.display === 'inline-grid') score += 650;
    if (style.display === 'flex' || style.display === 'inline-flex') score += 360;
    if (className.includes('gap-')) score += 260;
    if (element.tagName.toLowerCase() === 'ul' || element.tagName.toLowerCase() === 'ol') score += 180;

    score += Math.min(children.length * 24, 180);
    score += Math.min((rect.width * rect.height) / 12000, 120);

    return score;
}

function getVisibleElementChildren(element: HTMLElement): HTMLElement[] {
    return Array.from(element.children).filter((child): child is HTMLElement => {
        if (!(child instanceof HTMLElement) || child.hidden) return false;
        const style = window.getComputedStyle(child);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const rect = child.getBoundingClientRect();
        return rect.width > MIN_SPACING_GUIDE_SIZE && rect.height > MIN_SPACING_GUIDE_SIZE;
    });
}

function getVisibleChildRects(element: HTMLElement): VisibleRect[] {
    return getVisibleElementChildren(element).map((child) => {
        const rect = child.getBoundingClientRect();
        return {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
        };
    });
}

function getHorizontalGapRects(rects: VisibleRect[]): SpacingGuideRect[] {
    return rects.flatMap((rect) => {
        const neighbor = rects
            .filter((candidate) => candidate.left >= rect.right + MIN_SPACING_GUIDE_SIZE)
            .filter((candidate) => getVerticalOverlap(rect, candidate) > MIN_SPACING_GUIDE_SIZE)
            .sort((a, b) => a.left - b.left)[0];

        if (!neighbor) return [];

        const top = Math.max(rect.top, neighbor.top);
        const bottom = Math.min(rect.bottom, neighbor.bottom);
        return [{
            left: rect.right,
            top,
            width: neighbor.left - rect.right,
            height: bottom - top,
        }];
    }).filter(isMeaningfulGuideRect);
}

function getVerticalGapRects(rects: VisibleRect[]): SpacingGuideRect[] {
    return rects.flatMap((rect) => {
        const neighbor = rects
            .filter((candidate) => candidate.top >= rect.bottom + MIN_SPACING_GUIDE_SIZE)
            .filter((candidate) => getHorizontalOverlap(rect, candidate) > MIN_SPACING_GUIDE_SIZE)
            .sort((a, b) => a.top - b.top)[0];

        if (!neighbor) return [];

        const left = Math.max(rect.left, neighbor.left);
        const right = Math.min(rect.right, neighbor.right);
        return [{
            left,
            top: rect.bottom,
            width: right - left,
            height: neighbor.top - rect.bottom,
        }];
    }).filter(isMeaningfulGuideRect);
}

function getPaddingGuideRects(targetRect: DOMRect, wrapperRect: DOMRect, spacing: BoxSpacing): SpacingGuideRect[] {
    const innerHeight = Math.max(0, targetRect.height - spacing.top - spacing.bottom);

    return [
        {
            left: targetRect.left,
            top: targetRect.top,
            width: targetRect.width,
            height: spacing.top,
        },
        {
            left: targetRect.right - spacing.right,
            top: targetRect.top + spacing.top,
            width: spacing.right,
            height: innerHeight,
        },
        {
            left: targetRect.left,
            top: targetRect.bottom - spacing.bottom,
            width: targetRect.width,
            height: spacing.bottom,
        },
        {
            left: targetRect.left,
            top: targetRect.top + spacing.top,
            width: spacing.left,
            height: innerHeight,
        },
    ].filter(isMeaningfulGuideRect).map((rect) => toOverlayRect(rect, wrapperRect));
}

function getMarginGuideRects(targetRect: DOMRect, wrapperRect: DOMRect, spacing: BoxSpacing): SpacingGuideRect[] {
    const marginLeft = targetRect.left - spacing.left;
    const marginTop = targetRect.top - spacing.top;
    const marginWidth = targetRect.width + spacing.left + spacing.right;
    const marginHeight = targetRect.height + spacing.top + spacing.bottom;

    return [
        {
            left: marginLeft,
            top: marginTop,
            width: marginWidth,
            height: spacing.top,
        },
        {
            left: targetRect.right,
            top: marginTop,
            width: spacing.right,
            height: marginHeight,
        },
        {
            left: marginLeft,
            top: targetRect.bottom,
            width: marginWidth,
            height: spacing.bottom,
        },
        {
            left: marginLeft,
            top: marginTop,
            width: spacing.left,
            height: marginHeight,
        },
    ].filter(isMeaningfulGuideRect).map((rect) => toOverlayRect(rect, wrapperRect));
}

function readComputedBoxSpacing(element: HTMLElement, area: 'padding' | 'margin'): BoxSpacing {
    const style = window.getComputedStyle(element);
    const prefix = area === 'padding' ? 'padding' : 'margin';

    return {
        top: readCssPixelValue(style.getPropertyValue(`${prefix}-top`)),
        right: readCssPixelValue(style.getPropertyValue(`${prefix}-right`)),
        bottom: readCssPixelValue(style.getPropertyValue(`${prefix}-bottom`)),
        left: readCssPixelValue(style.getPropertyValue(`${prefix}-left`)),
    };
}

function readCssPixelValue(value: string): number {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function getHorizontalOverlap(a: VisibleRect, b: VisibleRect): number {
    return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
}

function getVerticalOverlap(a: VisibleRect, b: VisibleRect): number {
    return Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
}

function toOverlayRect(rect: SpacingGuideRect, wrapperRect: DOMRect): SpacingGuideRect {
    return {
        left: rect.left - wrapperRect.left,
        top: rect.top - wrapperRect.top,
        width: rect.width,
        height: rect.height,
    };
}

function isMeaningfulGuideRect(rect: SpacingGuideRect): boolean {
    return rect.width > MIN_SPACING_GUIDE_SIZE && rect.height > MIN_SPACING_GUIDE_SIZE;
}

function dedupeGuideRects(rects: SpacingGuideRect[]): SpacingGuideRect[] {
    const seen = new Set<string>();
    return rects.filter((rect) => {
        if (!isMeaningfulGuideRect(rect)) return false;
        const key = [
            Math.round(rect.left),
            Math.round(rect.top),
            Math.round(rect.width),
            Math.round(rect.height),
        ].join(':');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function getGuideRectsSignature(rects: SpacingGuideRect[]): string {
    return rects
        .map((rect) => [
            Math.round(rect.left),
            Math.round(rect.top),
            Math.round(rect.width),
            Math.round(rect.height),
        ].join(':'))
        .join('|');
}

function getGuidePositionStyle(width: LayoutContainerWidth, align: LayoutHorizontalAlign): CSSProperties {
    const percent = getLayoutContainerWidthPercent(width);
    const guideWidth = width === 'narrow'
        ? 'min(100%, 56rem)'
        : width === 'wide'
            ? 'min(100%, 90rem)'
            : percent
                ? `${percent}%`
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
    value?: Record<string, unknown>;
    children?: ReactNode;
};

function cloneChildrenWithData(
    children: ReactNode,
    data: Record<string, unknown>,
    updateContent: (key: string, value: unknown) => void,
): ReactNode {
    if (!isValidElement<EditableBlockChildProps>(children)) {
        return children;
    }

    const nestedChildren = children.props.children
        ? Children.map(children.props.children, (child) => cloneChildrenWithData(child, data, updateContent))
        : children.props.children;

    if ('value' in children.props) {
        return cloneElement(children, {
            value: data,
            children: nestedChildren,
        });
    }

    const block = children.props.block
        ? { ...children.props.block, data }
        : undefined;

    return cloneElement(children, block
        ? { data, block, updateContent, children: nestedChildren }
        : { data, updateContent, children: nestedChildren });
}

function isRepeatableItemsPanelType(type: string): boolean {
    return type === 'servicesGrid' || type === 'stats' || type === 'testimonials' || type === 'faq' || type === 'timeline' || type === 'aboutImageText';
}

function isContactDraftKey(key: string): boolean {
    return key === 'contactItems' || key === 'socialLinks';
}

function isMapDraftKey(key: string): boolean {
    return [
        'title',
        'address',
        'locations',
        'mapProvider',
        'mapHeight',
        'mapZoom',
        'mapStyle',
        'markerLabel',
        'showDirections',
        'showMapDirections',
        'showCardDirections',
        'showLocationCards',
        'showAllPinsToggle',
        'startWithAllPins',
        'requireMapConsent',
        'backgroundColor',
    ].includes(key);
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
