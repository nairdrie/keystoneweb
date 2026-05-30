'use client';

import { useEffect, useState } from 'react';
import type { ComponentType, FocusEvent, MouseEvent, ReactNode } from 'react';
import { AlignCenter, AlignLeft, AlignRight, ChevronDown } from 'lucide-react';
import {
    type LayoutContainerWidth,
    type LayoutHorizontalAlign,
    type ResponsiveBoxSides,
    type ResponsiveBoxValue,
    type ResponsiveBreakpoint,
    type ResponsiveValue,
    type SectionLayoutSettings,
    type SectionSettings,
    DEFAULT_LAYOUT_COLUMN_MAX,
    LAYOUT_CONTAINER_WIDTH_PERCENT_MAX,
    LAYOUT_CONTAINER_WIDTH_PERCENT_MIN,
    getLayoutContainerWidthPercent,
    getLayoutCapabilities,
    isFullLayoutContainerWidth,
    normalizeSectionSettings,
} from '@/lib/builder/layout-settings';

const BREAKPOINTS: Array<{ id: ResponsiveBreakpoint; label: string }> = [
    { id: 'desktop', label: 'Desktop' },
    { id: 'tablet', label: 'Tablet' },
    { id: 'mobile', label: 'Mobile' },
];

const SPACING_SIDES: Array<{ id: keyof ResponsiveBoxSides; label: string }> = [
    { id: 'top', label: 'Top' },
    { id: 'right', label: 'Right' },
    { id: 'bottom', label: 'Bottom' },
    { id: 'left', label: 'Left' },
];

const COLUMN_SLIDER_MIN = 1;
const COLUMN_SLIDER_MAX = DEFAULT_LAYOUT_COLUMN_MAX;
const COLUMN_SLIDER_DEFAULTS: Record<ResponsiveBreakpoint, number> = {
    desktop: 3,
    tablet: 2,
    mobile: 1,
};
const CONTAINER_WIDTH_SLIDER_MIN = LAYOUT_CONTAINER_WIDTH_PERCENT_MIN;
const CONTAINER_WIDTH_SLIDER_MAX = LAYOUT_CONTAINER_WIDTH_PERCENT_MAX;
const SPACING_SLIDER_MIN = 0;
const SPACING_SLIDER_MAX = 160;
const SPACING_SLIDER_STEP = 4;
const GAP_SLIDER_DEFAULTS: Record<ResponsiveBreakpoint, number> = {
    desktop: 24,
    tablet: 20,
    mobile: 16,
};
const BOX_SPACING_SLIDER_DEFAULTS: Record<'padding' | 'margin', Record<ResponsiveBreakpoint, number>> = {
    padding: {
        desktop: 64,
        tablet: 48,
        mobile: 32,
    },
    margin: {
        desktop: 0,
        tablet: 0,
        mobile: 0,
    },
};
const LEGACY_CONTAINER_WIDTH_PERCENT: Record<'default' | 'narrow' | 'wide' | 'full', number> = {
    default: 88,
    narrow: 64,
    wide: 88,
    full: 100,
};

export const LAYOUT_GUIDE_PREVIEW_EVENT = 'ks:layout-guide-preview';
export const SPACING_GUIDE_PREVIEW_EVENT = 'ks:spacing-guide-preview';
export type SpacingGuideArea = 'gap' | 'padding' | 'margin';

type LayoutTabProps = {
    blockId?: string;
    blockType: string;
    value: SectionSettings;
    onChange: (value: SectionSettings) => void;
};

export function LayoutTab({ blockId, blockType, value, onChange }: LayoutTabProps) {
    const capabilities = getLayoutCapabilities(blockType);
    const sectionSettings = normalizeSectionSettings(value);
    const layout = {
        ...sectionSettings.layout,
        ...readDraftResponsiveLayout(value),
    };

    useEffect(() => (
        () => {
            dispatchLayoutGuidePreview(blockId, 'default', 'center', false);
            dispatchSpacingGuidePreview(blockId, undefined, false);
        }
    ), [blockId]);

    const updateLayout = (patch: Partial<SectionLayoutSettings>) => {
        onChange({
            layout: {
                ...layout,
                ...patch,
            },
        });
    };
    const hasGapValues = hasResponsiveValues(layout.gap);
    const hasPaddingValues = hasResponsiveBoxValues(layout.padding);
    const hasMarginValues = hasResponsiveBoxValues(layout.margin);
    const showSpacing = capabilities.supportsGap || capabilities.supportsPadding || capabilities.supportsMargin;
    const hasSpacingValues = hasGapValues || hasPaddingValues || hasMarginValues;

    return (
        <div className="space-y-5">
            {showSpacing && (
                <AdvancedLayoutDisclosure
                    hasActiveValues={hasSpacingValues}
                    onClearAll={() => updateLayout({ gap: undefined, padding: undefined, margin: undefined })}
                >
                    {capabilities.supportsGap && (
                        <CollapsibleLayoutSection
                            title="Gap"
                            blockId={blockId}
                            previewArea="gap"
                            hasActiveValues={hasGapValues}
                            onClear={() => updateLayout({ gap: undefined })}
                        >
                            <ResponsiveGapControl
                                value={layout.gap}
                                onChange={(gap) => updateLayout({ gap })}
                                showLabel={false}
                            />
                        </CollapsibleLayoutSection>
                    )}

                    {capabilities.supportsMargin && (
                        <CollapsibleLayoutSection
                            title="Margin"
                            blockId={blockId}
                            previewArea="margin"
                            hasActiveValues={hasMarginValues}
                            onClear={() => updateLayout({ margin: undefined })}
                        >
                            <ResponsiveSpacingControl
                                label="Margin"
                                value={layout.margin}
                                onChange={(margin) => updateLayout({ margin })}
                                showLabel={false}
                            />
                        </CollapsibleLayoutSection>
                    )}

                    {capabilities.supportsPadding && (
                        <CollapsibleLayoutSection
                            title="Padding"
                            blockId={blockId}
                            previewArea="padding"
                            hasActiveValues={hasPaddingValues}
                            onClear={() => updateLayout({ padding: undefined })}
                        >
                            <ResponsiveSpacingControl
                                label="Padding"
                                value={layout.padding}
                                onChange={(padding) => updateLayout({ padding })}
                                showLabel={false}
                            />
                        </CollapsibleLayoutSection>
                    )}
                </AdvancedLayoutDisclosure>
            )}
        </div>
    );
}

export function ContainerWidthControl({
    blockId,
    value,
    horizontalAlign,
    onChange,
}: {
    blockId?: string;
    value: LayoutContainerWidth;
    horizontalAlign: LayoutHorizontalAlign;
    onChange: (value: LayoutContainerWidth) => void;
}) {
    const sliderValue = getContainerWidthSliderValue(value);
    const displayValue = value === 'default' ? `Auto (${sliderValue}%)` : `${sliderValue}%`;
    const getPreviewAlign = (containerWidth: LayoutContainerWidth) => (
        containerWidth !== 'default' && !isFullLayoutContainerWidth(containerWidth) && isImplicitDefaultAlignment(value, horizontalAlign)
            ? 'center'
            : horizontalAlign
    );
    const preview = (containerWidth: LayoutContainerWidth, active: boolean) => {
        dispatchLayoutGuidePreview(blockId, containerWidth, getPreviewAlign(containerWidth), active);
    };
    const updateFromSlider = (nextValue: number) => {
        const containerWidth = containerWidthFromSliderValue(nextValue);
        onChange(containerWidth);
        preview(containerWidth, true);
    };
    const resetToDefault = () => {
        onChange('default');
        dispatchLayoutGuidePreview(blockId, 'default', 'left', false);
    };

    return (
        <div>
            <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Container width</p>
                <span className="text-[11px] font-bold text-slate-500">{displayValue}</span>
            </div>
            <div className="flex items-center gap-3">
                <input
                    type="range"
                    min={CONTAINER_WIDTH_SLIDER_MIN}
                    max={CONTAINER_WIDTH_SLIDER_MAX}
                    step={1}
                    value={sliderValue}
                    onChange={(event) => updateFromSlider(Number(event.target.value))}
                    onPointerEnter={() => preview(value, true)}
                    onPointerLeave={() => preview(value, false)}
                    onFocus={() => preview(value, true)}
                    onBlur={() => preview(value, false)}
                    aria-label="Container width"
                    className="h-2 min-w-0 flex-1 cursor-pointer accent-blue-600"
                />
                <button
                    type="button"
                    onClick={resetToDefault}
                    aria-pressed={value === 'default'}
                    className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                        value === 'default'
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                >
                    Auto
                </button>
            </div>
        </div>
    );
}

export function AlignmentControl({
    value,
    onChange,
}: {
    value: LayoutHorizontalAlign;
    onChange: (value: LayoutHorizontalAlign) => void;
}) {
    return (
        <ChoiceButtonGroup
            label="Container position"
            options={[
                { value: 'center', label: 'Center', Icon: AlignCenter },
                { value: 'left', label: 'Left', Icon: AlignLeft },
                { value: 'right', label: 'Right', Icon: AlignRight },
            ]}
            value={value}
            onChange={onChange}
        />
    );
}

export function ResponsiveColumnsControl({
    value,
    onChange,
    maxColumns = COLUMN_SLIDER_MAX,
}: {
    value?: ResponsiveValue<number>;
    onChange: (value?: ResponsiveValue<number>) => void;
    maxColumns?: number;
}) {
    const [activeBreakpoint, setActiveBreakpoint] = useState<ResponsiveBreakpoint>('desktop');
    const effectiveMaxColumns = Math.max(
        COLUMN_SLIDER_MIN,
        Math.min(COLUMN_SLIDER_MAX, Math.floor(maxColumns || COLUMN_SLIDER_MAX)),
    );

    useEffect(() => {
        if (!value) return;
        const next = { ...value };
        let changed = false;

        for (const breakpoint of BREAKPOINTS) {
            const currentValue = next[breakpoint.id];
            if (typeof currentValue !== 'number' || currentValue <= effectiveMaxColumns) continue;
            next[breakpoint.id] = effectiveMaxColumns;
            changed = true;
        }

        if (changed) onChange(hasResponsiveValues(next) ? next : undefined);
    }, [effectiveMaxColumns, value, onChange]);

    const update = (breakpoint: ResponsiveBreakpoint, nextValue: number) => {
        const next = { ...(value || {}) };
        next[breakpoint] = Math.min(effectiveMaxColumns, Math.max(COLUMN_SLIDER_MIN, Math.round(nextValue)));
        onChange(hasResponsiveValues(next) ? next : undefined);
    };

    const reset = (breakpoint: ResponsiveBreakpoint) => {
        const next = { ...(value || {}) };
        delete next[breakpoint];
        onChange(hasResponsiveValues(next) ? next : undefined);
    };
    const activeBreakpointLabel = getBreakpointLabel(activeBreakpoint);
    const currentValue = value?.[activeBreakpoint];
    const displayValue = Math.min(currentValue ?? COLUMN_SLIDER_DEFAULTS[activeBreakpoint], effectiveMaxColumns);

    return (
        <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Columns</p>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <BreakpointTabs
                    value={activeBreakpoint}
                    onChange={setActiveBreakpoint}
                    isCustomized={(breakpoint) => typeof value?.[breakpoint] === 'number'}
                />
                <div className="mt-3">
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                        <span className="text-[11px] font-semibold text-slate-500">{activeBreakpointLabel}</span>
                        <span className="text-[11px] font-bold text-slate-500">
                            {currentValue ? `${currentValue} column${currentValue === 1 ? '' : 's'}` : 'Auto'}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <input
                            type="range"
                            min={COLUMN_SLIDER_MIN}
                            max={effectiveMaxColumns}
                            step={1}
                            value={displayValue}
                            onChange={(event) => update(activeBreakpoint, Number(event.target.value))}
                            aria-label={`${activeBreakpointLabel} columns`}
                            className="h-2 min-w-0 flex-1 cursor-pointer accent-blue-600"
                        />
                        <button
                            type="button"
                            onClick={() => reset(activeBreakpoint)}
                            aria-pressed={!currentValue}
                            className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                                currentValue
                                    ? 'border-slate-200 text-slate-500 hover:bg-slate-50'
                                    : 'border-blue-600 bg-blue-50 text-blue-700'
                            }`}
                        >
                            Auto
                        </button>
                    </div>
                </div>
            </div>
            {effectiveMaxColumns < COLUMN_SLIDER_MAX && (
                <p className="mt-2 text-[11px] font-medium text-slate-500">
                    Limited to {effectiveMaxColumns} {effectiveMaxColumns === 1 ? 'card' : 'cards'} in this block.
                </p>
            )}
        </div>
    );
}

export function ResponsiveGapControl({
    value,
    onChange,
    showLabel = true,
}: {
    value?: ResponsiveValue<string>;
    onChange: (value?: ResponsiveValue<string>) => void;
    showLabel?: boolean;
}) {
    return (
        <ResponsivePixelSliderGroup
            label={showLabel ? 'Gap' : undefined}
            value={value}
            onChange={onChange}
            defaults={GAP_SLIDER_DEFAULTS}
        />
    );
}

export function ResponsiveSpacingControl({
    label,
    value,
    onChange,
    showLabel = true,
}: {
    label: string;
    value?: ResponsiveBoxValue;
    onChange: (value?: ResponsiveBoxValue) => void;
    showLabel?: boolean;
}) {
    const kind = label.toLowerCase() === 'margin' ? 'margin' : 'padding';
    const defaults = BOX_SPACING_SLIDER_DEFAULTS[kind];
    const [activeBreakpoint, setActiveBreakpoint] = useState<ResponsiveBreakpoint>('desktop');
    const update = (breakpoint: ResponsiveBreakpoint, side: keyof ResponsiveBoxSides, sideValue: number) => {
        const next: ResponsiveBoxValue = {
            desktop: value?.desktop ? { ...value.desktop } : undefined,
            tablet: value?.tablet ? { ...value.tablet } : undefined,
            mobile: value?.mobile ? { ...value.mobile } : undefined,
        };
        const breakpointBox = { ...(next[breakpoint] || {}) };
        breakpointBox[side] = `${clampSpacingSliderValue(sideValue)}px`;
        next[breakpoint] = Object.keys(breakpointBox).length > 0 ? breakpointBox : undefined;
        onChange(hasResponsiveBoxValues(next) ? next : undefined);
    };
    const reset = (breakpoint: ResponsiveBreakpoint, side: keyof ResponsiveBoxSides) => {
        const next: ResponsiveBoxValue = {
            desktop: value?.desktop ? { ...value.desktop } : undefined,
            tablet: value?.tablet ? { ...value.tablet } : undefined,
            mobile: value?.mobile ? { ...value.mobile } : undefined,
        };
        const breakpointBox = { ...(next[breakpoint] || {}) };
        delete breakpointBox[side];
        next[breakpoint] = Object.keys(breakpointBox).length > 0 ? breakpointBox : undefined;
        onChange(hasResponsiveBoxValues(next) ? next : undefined);
    };

    return (
        <div>
            {showLabel && <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <BreakpointTabs
                    value={activeBreakpoint}
                    onChange={setActiveBreakpoint}
                    isCustomized={(breakpoint) => Boolean(value?.[breakpoint] && Object.values(value?.[breakpoint] || {}).some(Boolean))}
                />
                <div className="mt-3 space-y-3">
                    {SPACING_SIDES.map(({ id: side, label: sideLabel }) => (
                        <div key={side}>
                            <div className="mb-1.5 flex items-center justify-between gap-3">
                                <span className="text-[11px] font-semibold text-slate-500">{sideLabel}</span>
                                <span className="text-[11px] font-bold text-slate-500">
                                    {formatSpacingValue(value?.[activeBreakpoint]?.[side])}
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <input
                                    type="range"
                                    min={SPACING_SLIDER_MIN}
                                    max={SPACING_SLIDER_MAX}
                                    step={SPACING_SLIDER_STEP}
                                    value={spacingValueToSliderValue(value?.[activeBreakpoint]?.[side], defaults[activeBreakpoint])}
                                    onChange={(event) => update(activeBreakpoint, side, Number(event.target.value))}
                                    aria-label={`${getBreakpointLabel(activeBreakpoint)} ${label.toLowerCase()} ${sideLabel.toLowerCase()}`}
                                    className="h-2 min-w-0 flex-1 cursor-pointer accent-blue-600"
                                />
                                <button
                                    type="button"
                                    onClick={() => reset(activeBreakpoint, side)}
                                    aria-pressed={!value?.[activeBreakpoint]?.[side]}
                                    className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                                        value?.[activeBreakpoint]?.[side]
                                            ? 'border-slate-200 text-slate-500 hover:bg-slate-50'
                                            : 'border-blue-600 bg-blue-50 text-blue-700'
                                    }`}
                                >
                                    Auto
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function ResponsivePixelSliderGroup({
    label,
    value,
    defaults,
    onChange,
}: {
    label?: string;
    value?: ResponsiveValue<string>;
    defaults: Record<ResponsiveBreakpoint, number>;
    onChange: (value?: ResponsiveValue<string>) => void;
}) {
    const [activeBreakpoint, setActiveBreakpoint] = useState<ResponsiveBreakpoint>('desktop');
    const update = (breakpoint: ResponsiveBreakpoint, nextValue: number) => {
        const next = { ...(value || {}) };
        next[breakpoint] = `${clampSpacingSliderValue(nextValue)}px`;
        onChange(hasResponsiveValues(next) ? next : undefined);
    };

    const reset = (breakpoint: ResponsiveBreakpoint) => {
        const next = { ...(value || {}) };
        delete next[breakpoint];
        onChange(hasResponsiveValues(next) ? next : undefined);
    };
    const activeBreakpointLabel = getBreakpointLabel(activeBreakpoint);

    return (
        <div>
            {label && <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <BreakpointTabs
                    value={activeBreakpoint}
                    onChange={setActiveBreakpoint}
                    isCustomized={(breakpoint) => Boolean(value?.[breakpoint])}
                />
                <div className="mt-3">
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                        <span className="text-[11px] font-semibold text-slate-500">{activeBreakpointLabel}</span>
                        <span className="text-[11px] font-bold text-slate-500">
                            {formatSpacingValue(value?.[activeBreakpoint])}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <input
                            type="range"
                            min={SPACING_SLIDER_MIN}
                            max={SPACING_SLIDER_MAX}
                            step={SPACING_SLIDER_STEP}
                            value={spacingValueToSliderValue(value?.[activeBreakpoint], defaults[activeBreakpoint])}
                            onChange={(event) => update(activeBreakpoint, Number(event.target.value))}
                            aria-label={`${activeBreakpointLabel} ${label?.toLowerCase() || 'spacing'}`}
                            className="h-2 min-w-0 flex-1 cursor-pointer accent-blue-600"
                        />
                        <button
                            type="button"
                            onClick={() => reset(activeBreakpoint)}
                            aria-pressed={!value?.[activeBreakpoint]}
                            className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                                value?.[activeBreakpoint]
                                    ? 'border-slate-200 text-slate-500 hover:bg-slate-50'
                                    : 'border-blue-600 bg-blue-50 text-blue-700'
                            }`}
                        >
                            Auto
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function BreakpointTabs({
    value,
    onChange,
    isCustomized,
}: {
    value: ResponsiveBreakpoint;
    onChange: (value: ResponsiveBreakpoint) => void;
    isCustomized?: (value: ResponsiveBreakpoint) => boolean;
}) {
    return (
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
            {BREAKPOINTS.map(({ id, label }) => {
                const active = value === id;
                const customized = Boolean(isCustomized?.(id));

                return (
                    <button
                        key={id}
                        type="button"
                        onClick={() => onChange(id)}
                        aria-pressed={active}
                        className={`flex min-w-0 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            active
                                ? 'bg-white text-blue-700 shadow-sm ring-1 ring-blue-200'
                                : 'text-slate-500 hover:bg-white/70 hover:text-slate-700'
                        }`}
                    >
                        <span className="truncate">{label}</span>
                        {customized && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? 'bg-blue-600' : 'bg-slate-400'}`} />}
                    </button>
                );
            })}
        </div>
    );
}

function AdvancedLayoutDisclosure({
    hasActiveValues,
    onClearAll,
    children,
}: {
    hasActiveValues: boolean;
    onClearAll?: () => void;
    children: ReactNode;
}) {
    return (
        <details className="group rounded-xl border border-slate-200 bg-slate-50/70">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <span>
                    <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">Spacing</span>
                    {hasActiveValues && (
                        <span className="mt-0.5 block text-[11px] font-semibold text-blue-600">Custom spacing active</span>
                    )}
                </span>
                <span className="flex items-center gap-2">
                    {hasActiveValues && onClearAll && (
                        <button
                            type="button"
                            onClick={(event) => handleSummaryButtonClick(event, onClearAll)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50"
                        >
                            Reset all
                        </button>
                    )}
                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
                </span>
            </summary>
            <div className="space-y-3 border-t border-slate-200 px-3 py-4">
                {children}
            </div>
        </details>
    );
}

function CollapsibleLayoutSection({
    title,
    blockId,
    previewArea,
    hasActiveValues,
    onClear,
    children,
}: {
    title: string;
    blockId?: string;
    previewArea: SpacingGuideArea;
    hasActiveValues: boolean;
    onClear?: () => void;
    children: ReactNode;
}) {
    const showPreview = () => dispatchSpacingGuidePreview(blockId, previewArea, true);
    const hidePreview = () => dispatchSpacingGuidePreview(blockId, previewArea, false);
    const handleBlur = (event: FocusEvent<HTMLElement>) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        hidePreview();
    };

    return (
        <details
            className="group/section rounded-lg border border-slate-200 bg-white"
            onMouseEnter={showPreview}
            onMouseLeave={hidePreview}
            onFocusCapture={showPreview}
            onBlurCapture={handleBlur}
        >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <span className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</span>
                    {hasActiveValues && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">Custom</span>}
                </span>
                <span className="flex items-center gap-2">
                    {hasActiveValues && onClear && (
                        <button
                            type="button"
                            aria-label={`Reset ${title.toLowerCase()} to default`}
                            onClick={(event) => handleSummaryButtonClick(event, onClear)}
                            className="rounded-md px-2 py-1 text-[11px] font-bold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
                        >
                            Reset
                        </button>
                    )}
                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open/section:rotate-180" />
                </span>
            </summary>
            <div className="border-t border-slate-100 p-3">
                {children}
            </div>
        </details>
    );
}

function handleSummaryButtonClick(event: MouseEvent<HTMLButtonElement>, callback: () => void) {
    event.preventDefault();
    event.stopPropagation();
    callback();
}

function ChoiceButtonGroup<T extends string>({
    label,
    options,
    value,
    onChange,
    onPreview,
}: {
    label: string;
    options: Array<{ value: T; label: string; Icon?: ComponentType<{ className?: string }> }>;
    value: T;
    onChange: (value: T) => void;
    onPreview?: (value: T, active: boolean) => void;
}) {
    return (
        <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
            <div className="grid grid-cols-2 gap-2">
                {options.map(({ value: optionValue, label: optionLabel, Icon }) => {
                    const active = value === optionValue;
                    return (
                        <button
                            key={optionValue}
                            type="button"
                            onClick={() => onChange(optionValue)}
                            onMouseEnter={() => onPreview?.(optionValue, true)}
                            onMouseLeave={() => onPreview?.(optionValue, false)}
                            onFocus={() => onPreview?.(optionValue, true)}
                            onBlur={() => onPreview?.(optionValue, false)}
                            aria-pressed={active}
                            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                active
                                    ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                        >
                            {Icon && <Icon className="h-4 w-4 shrink-0" />}
                            <span>{optionLabel}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function dispatchLayoutGuidePreview(
    blockId: string | undefined,
    containerWidth: LayoutContainerWidth,
    horizontalAlign: LayoutHorizontalAlign,
    active: boolean,
) {
    if (!blockId || typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(LAYOUT_GUIDE_PREVIEW_EVENT, {
        detail: {
            blockId,
            containerWidth,
            horizontalAlign,
            active,
        },
    }));
}

function dispatchSpacingGuidePreview(
    blockId: string | undefined,
    area: SpacingGuideArea | undefined,
    active: boolean,
) {
    if (!blockId || typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(SPACING_GUIDE_PREVIEW_EVENT, {
        detail: {
            blockId,
            area,
            active,
        },
    }));
}

function getContainerWidthSliderValue(containerWidth: LayoutContainerWidth): number {
    if (containerWidth in LEGACY_CONTAINER_WIDTH_PERCENT) {
        return LEGACY_CONTAINER_WIDTH_PERCENT[containerWidth as keyof typeof LEGACY_CONTAINER_WIDTH_PERCENT];
    }

    return getLayoutContainerWidthPercent(containerWidth) ?? CONTAINER_WIDTH_SLIDER_MAX;
}

function containerWidthFromSliderValue(value: number): LayoutContainerWidth {
    const percent = Math.min(
        CONTAINER_WIDTH_SLIDER_MAX,
        Math.max(CONTAINER_WIDTH_SLIDER_MIN, Math.round(value)),
    );
    return percent >= CONTAINER_WIDTH_SLIDER_MAX ? 'full' : `${percent}%`;
}

function spacingValueToSliderValue(value: string | undefined, fallback: number): number {
    return clampSpacingSliderValue(readSpacingPx(value) ?? fallback);
}

function clampSpacingSliderValue(value: number): number {
    const rounded = Math.round(value / SPACING_SLIDER_STEP) * SPACING_SLIDER_STEP;
    return Math.min(SPACING_SLIDER_MAX, Math.max(SPACING_SLIDER_MIN, rounded));
}

function formatSpacingValue(value: string | undefined): string {
    if (!value) return 'Default';
    const px = readSpacingPx(value);
    if (px !== undefined) return `${px}px`;
    return 'Custom';
}

function readSpacingPx(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (/^-?\d*\.?\d+$/.test(trimmed)) return Number(trimmed);

    const match = trimmed.match(/^(-?\d*\.?\d+)(px|rem)$/i);
    if (!match) return undefined;
    const numeric = Number(match[1]);
    if (!Number.isFinite(numeric)) return undefined;
    const unit = match[2].toLowerCase();
    return Math.round(unit === 'rem' ? numeric * 16 : numeric);
}

function getBreakpointLabel(value: ResponsiveBreakpoint): string {
    return BREAKPOINTS.find((breakpoint) => breakpoint.id === value)?.label || value;
}

function readDraftResponsiveLayout(value: SectionSettings): Partial<SectionLayoutSettings> {
    const rawLayout: Record<string, unknown> = isRecord(value) && isRecord(value.layout) ? value.layout : {};
    return {
        gap: readResponsiveStringDraft(rawLayout.gap),
        padding: readResponsiveBoxDraft(rawLayout.padding),
        margin: readResponsiveBoxDraft(rawLayout.margin),
    };
}

function readResponsiveStringDraft(value: unknown): ResponsiveValue<string> | undefined {
    if (!isRecord(value)) return undefined;
    const draft: ResponsiveValue<string> = {};
    for (const breakpoint of BREAKPOINTS) {
        const raw = value[breakpoint.id];
        if (typeof raw === 'string') draft[breakpoint.id] = raw;
    }
    return hasResponsiveValues(draft) ? draft : undefined;
}

function readResponsiveBoxDraft(value: unknown): ResponsiveBoxValue | undefined {
    if (!isRecord(value)) return undefined;
    const draft: ResponsiveBoxValue = {};
    for (const breakpoint of BREAKPOINTS) {
        const rawBox = value[breakpoint.id];
        if (!isRecord(rawBox)) continue;
        const box: ResponsiveBoxSides = {};
        for (const side of SPACING_SIDES) {
            const raw = rawBox[side.id];
            if (typeof raw === 'string') box[side.id] = raw;
        }
        if (Object.keys(box).length > 0) draft[breakpoint.id] = box;
    }
    return hasResponsiveBoxValues(draft) ? draft : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isImplicitDefaultAlignment(containerWidth: LayoutContainerWidth, horizontalAlign: LayoutHorizontalAlign): boolean {
    return horizontalAlign === 'left' && (containerWidth === 'default' || isFullLayoutContainerWidth(containerWidth));
}

function hasResponsiveValues<T>(value: ResponsiveValue<T> | undefined): boolean {
    return Boolean(value && Object.values(value).some((entry) => entry !== undefined && entry !== ''));
}

function hasResponsiveBoxValues(value: ResponsiveBoxValue | undefined): boolean {
    return Boolean(value && Object.values(value).some((box) => box && Object.values(box).some(Boolean)));
}
