'use client';

import { useEffect } from 'react';
import type { ComponentType, MouseEvent, ReactNode } from 'react';
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
    getLayoutCapabilities,
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

export const LAYOUT_GUIDE_PREVIEW_EVENT = 'ks:layout-guide-preview';

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
        () => dispatchLayoutGuidePreview(blockId, 'default', 'center', false)
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
    const showAdvancedSpacing = capabilities.supportsGap || capabilities.supportsPadding || capabilities.supportsMargin;
    const hasAdvancedSpacingValues = hasGapValues || hasPaddingValues || hasMarginValues;

    return (
        <div className="space-y-5">
            {capabilities.supportsContainerWidth && (
                <ContainerWidthControl
                    blockId={blockId}
                    value={layout.containerWidth}
                    horizontalAlign={layout.horizontalAlign}
                    onChange={(containerWidth) => {
                        const horizontalAlign = containerWidth === 'default'
                            ? 'left'
                            : containerWidth !== 'full' && isImplicitDefaultAlignment(layout.containerWidth, layout.horizontalAlign)
                                ? 'center'
                                : layout.horizontalAlign;

                        updateLayout({
                            containerWidth,
                            horizontalAlign,
                        });
                    }}
                />
            )}

            {capabilities.supportsHorizontalAlign && layout.containerWidth !== 'default' && layout.containerWidth !== 'full' && (
                <AlignmentControl
                    value={layout.horizontalAlign}
                    onChange={(horizontalAlign) => updateLayout({ horizontalAlign })}
                />
            )}

            {showAdvancedSpacing && (
                <AdvancedLayoutDisclosure
                    hasActiveValues={hasAdvancedSpacingValues}
                    onClearAll={() => updateLayout({ gap: undefined, padding: undefined, margin: undefined })}
                >
                    {capabilities.supportsGap && (
                        <CollapsibleLayoutSection
                            title="Gap"
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

                    {capabilities.supportsPadding && (
                        <CollapsibleLayoutSection
                            title="Padding"
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

                    {capabilities.supportsMargin && (
                        <CollapsibleLayoutSection
                            title="Margin"
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
    const getPreviewAlign = (containerWidth: LayoutContainerWidth) => (
        containerWidth !== 'default' && containerWidth !== 'full' && isImplicitDefaultAlignment(value, horizontalAlign)
            ? 'center'
            : horizontalAlign
    );

    return (
        <ChoiceButtonGroup
            label="Container width"
            options={[
                { value: 'default', label: 'Default' },
                { value: 'narrow', label: 'Narrow' },
                { value: 'wide', label: 'Wide' },
                { value: 'full', label: 'Full width' },
            ]}
            value={value}
            onChange={onChange}
            onPreview={(containerWidth, active) => dispatchLayoutGuidePreview(blockId, containerWidth, getPreviewAlign(containerWidth), active)}
        />
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
    }, [effectiveMaxColumns, value?.desktop, value?.tablet, value?.mobile, onChange]);

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

    return (
        <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Columns</p>
            <div className="space-y-3">
                {BREAKPOINTS.map(({ id, label }) => {
                    const currentValue = value?.[id];
                    const displayValue = Math.min(currentValue ?? COLUMN_SLIDER_DEFAULTS[id], effectiveMaxColumns);

                    return (
                        <div key={id}>
                            <div className="mb-1.5 flex items-center justify-between gap-3">
                                <span className="text-[11px] font-semibold text-slate-500">{label}</span>
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
                                    onChange={(event) => update(id, Number(event.target.value))}
                                    aria-label={`${label} columns`}
                                    className="h-2 min-w-0 flex-1 cursor-pointer accent-blue-600"
                                />
                                <button
                                    type="button"
                                    onClick={() => reset(id)}
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
                    );
                })}
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
        <ResponsiveTextInputs
            label={showLabel ? 'Gap' : undefined}
            value={value}
            placeholder="Default"
            onChange={onChange}
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
    const update = (breakpoint: ResponsiveBreakpoint, side: keyof ResponsiveBoxSides, sideValue: string) => {
        const next: ResponsiveBoxValue = {
            desktop: value?.desktop ? { ...value.desktop } : undefined,
            tablet: value?.tablet ? { ...value.tablet } : undefined,
            mobile: value?.mobile ? { ...value.mobile } : undefined,
        };
        const breakpointBox = { ...(next[breakpoint] || {}) };
        if (sideValue.trim()) breakpointBox[side] = sideValue;
        else delete breakpointBox[side];
        next[breakpoint] = Object.keys(breakpointBox).length > 0 ? breakpointBox : undefined;
        onChange(hasResponsiveBoxValues(next) ? next : undefined);
    };

    return (
        <div>
            {showLabel && <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>}
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                {BREAKPOINTS.map(({ id, label: breakpointLabel }) => (
                    <div key={id}>
                        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">{breakpointLabel}</p>
                        <div className="grid grid-cols-2 gap-2">
                            {SPACING_SIDES.map(({ id: side, label: sideLabel }) => (
                                <label key={side} className="block">
                                    <span className="mb-1 block text-[11px] font-semibold text-slate-500">{sideLabel}</span>
                                    <input
                                        type="text"
                                        value={value?.[id]?.[side] ?? ''}
                                        onChange={(event) => update(id, side, event.target.value)}
                                        placeholder="Default"
                                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </label>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
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
                    <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">Advanced layout</span>
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
    hasActiveValues,
    onClear,
    children,
}: {
    title: string;
    hasActiveValues: boolean;
    onClear?: () => void;
    children: ReactNode;
}) {
    return (
        <details className="group/section rounded-lg border border-slate-200 bg-white">
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

function ResponsiveTextInputs({
    label,
    value,
    placeholder,
    onChange,
}: {
    label?: string;
    value?: ResponsiveValue<string>;
    placeholder: string;
    onChange: (value?: ResponsiveValue<string>) => void;
}) {
    const update = (breakpoint: ResponsiveBreakpoint, inputValue: string) => {
        const next = { ...(value || {}) };
        if (inputValue.trim()) next[breakpoint] = inputValue;
        else delete next[breakpoint];
        onChange(hasResponsiveValues(next) ? next : undefined);
    };

    return (
        <div>
            {label && <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>}
            <div className="grid grid-cols-3 gap-2">
                {BREAKPOINTS.map(({ id, label: breakpointLabel }) => (
                    <label key={id} className="block">
                        <span className="mb-1 block text-[11px] font-semibold text-slate-500">{breakpointLabel}</span>
                        <input
                            type="text"
                            value={value?.[id] ?? ''}
                            onChange={(event) => update(id, event.target.value)}
                            placeholder={placeholder}
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </label>
                ))}
            </div>
        </div>
    );
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
    return horizontalAlign === 'left' && (containerWidth === 'default' || containerWidth === 'full');
}

function hasResponsiveValues<T>(value: ResponsiveValue<T> | undefined): boolean {
    return Boolean(value && Object.values(value).some((entry) => entry !== undefined && entry !== ''));
}

function hasResponsiveBoxValues(value: ResponsiveBoxValue | undefined): boolean {
    return Boolean(value && Object.values(value).some((box) => box && Object.values(box).some(Boolean)));
}
