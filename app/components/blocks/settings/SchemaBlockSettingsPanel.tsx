'use client';

import { Crown } from 'lucide-react';
import BlockSettingsPanel from '../BlockSettingsPanel';
import type { BlockPanelProps } from '../block-panel-registry';
import { CardSettingsControls } from '../CardSettingsControls';
import LayoutOptionTiles, { hasLayoutOptionThumbnail } from '../LayoutOptionTiles';
import KeyframeEditor, { inferFieldNames } from '../KeyframeEditor';
import {
    DeferredColorInput,
    InspectorSection,
    InspectorToggle,
    PaletteTokenButtons,
    PretextControls,
    getColorInputValue,
    useInspectorSectionState,
} from '../panel-shared';
import { LayoutTab, ResponsiveColumnsControl } from '../layout/LayoutTab';
import { getLayoutColumnLimit, normalizeSectionSettings } from '@/lib/builder/layout-settings';
import {
    CARD_MEDIA_LAYOUT_OPTIONS,
    buildCardSettingsForPreset,
    normalizeCardSettingsOverride,
    readCardSettings,
    type CardMediaLayout,
    type CardSettings,
} from '@/lib/block-style-options';
import {
    getBlockSettingsSchema,
} from './registry';
import {
    getSectionIds,
    getSettingsSectionTitle,
    isVisible,
    readDraftPath,
    type BlockSettingsSchema,
    type CardMediaLayoutSettingsControl,
    type CardStyleSettingsControl,
    type ColorSettingsControl,
    type GradientSettingsControl,
    type CustomSettingsRenderers,
    type MediaStyleSettingsControl,
    type NumberSettingsControl,
    type RangeSettingsControl,
    type SelectSettingsControl,
    type SegmentedSettingsControl,
    type SettingsControl,
    type SettingsOption,
    type SettingsValue,
    type TextSettingsControl,
    type ToggleSettingsControl,
} from './schema';
import { useBlockSettingsDraft } from './useBlockSettingsDraft';

const DEFAULT_CUSTOM_RENDERERS: CustomSettingsRenderers = {};

export default function SchemaBlockSettingsPanel(props: BlockPanelProps) {
    const blockType = props.blockType || '';
    const schema = getBlockSettingsSchema(blockType);

    if (!schema) {
        return null;
    }

    return (
        <SchemaBlockSettingsPanelInner
            {...props}
            blockType={blockType}
            schema={schema}
            customRenderers={DEFAULT_CUSTOM_RENDERERS}
        />
    );
}

function SchemaBlockSettingsPanelInner({
    schema,
    customRenderers,
    ...props
}: BlockPanelProps & {
    blockType: string;
    schema: BlockSettingsSchema;
    customRenderers: CustomSettingsRenderers;
}) {
    const {
        draft,
        updateDraft,
        sectionSettings,
        setSectionSettings,
    } = useBlockSettingsDraft({
        blockId: props.blockId,
        schema,
        blockData: props.blockData,
        customCss: props.customCss,
        onDraftBlockDataChange: props.onDraftBlockDataChange,
    });
    const visibleSections = schema.sections.filter((section) => (
        isVisible(section.visibleWhen, draft)
        && section.controls.some((control) => isVisible(control.visibleWhen, draft))
    ));
    const sectionState = useInspectorSectionState(getSectionIds({ ...schema, sections: visibleSections }), true);

    return (
        <BlockSettingsPanel
            isOpen
            title={schema.title}
            subtitle={schema.subtitle}
            blockId={props.blockId}
            blockType={props.blockType}
            onClose={props.onClose}
            allCollapsed={sectionState.allCollapsed}
            onToggleAllCollapsed={() => sectionState.setAll(!sectionState.allCollapsed)}
            tourId="schema-block-settings-panel"
        >
            {visibleSections.map((section) => {
                const visibleControls = section.controls.filter((control) => isVisible(control.visibleWhen, draft));
                return (
                    <InspectorSection
                        key={section.id}
                        id={section.id}
                        title={section.title || getSettingsSectionTitle(section.id)}
                        isCollapsed={sectionState.isCollapsed(section.id)}
                        onToggle={() => sectionState.toggle(section.id)}
                    >
                        <div className="space-y-5">
                            {section.description && (
                                <p className="text-sm leading-relaxed text-slate-500">{section.description}</p>
                            )}
                            {visibleControls.map((control) => (
                                <SettingsControlRenderer
                                    key={control.id}
                                    control={control}
                                    props={props}
                                    schema={schema}
                                    customRenderers={customRenderers}
                                    draft={draft}
                                    updateDraft={updateDraft}
                                    sectionSettings={sectionSettings}
                                    setSectionSettings={setSectionSettings}
                                />
                            ))}
                        </div>
                    </InspectorSection>
                );
            })}
        </BlockSettingsPanel>
    );
}

function SettingsControlRenderer({
    control,
    props,
    schema,
    customRenderers,
    draft,
    updateDraft,
    sectionSettings,
    setSectionSettings,
}: {
    control: SettingsControl;
    props: BlockPanelProps & { blockType: string };
    schema: BlockSettingsSchema;
    customRenderers: CustomSettingsRenderers;
    draft: Record<string, SettingsValue>;
    updateDraft: (field: string, value: SettingsValue) => void;
    sectionSettings: ReturnType<typeof normalizeSectionSettings>;
    setSectionSettings: (value: ReturnType<typeof normalizeSectionSettings>) => void;
}) {
    switch (control.kind) {
        case 'toggle':
            return <ToggleControl control={control} draft={draft} updateDraft={updateDraft} />;
        case 'select':
            return (
                <SelectControl
                    control={control}
                    draft={draft}
                    updateDraft={updateDraft}
                    blockType={props.blockType}
                />
            );
        case 'segmented':
            return <SegmentedControl control={control} draft={draft} updateDraft={updateDraft} />;
        case 'range':
            return <RangeControl control={control} draft={draft} updateDraft={updateDraft} />;
        case 'number':
            return <NumberControl control={control} draft={draft} updateDraft={updateDraft} />;
        case 'text':
        case 'url':
        case 'textarea':
            return <TextControl control={control} draft={draft} updateDraft={updateDraft} />;
        case 'color':
            return <ColorControl control={control} draft={draft} updateDraft={updateDraft} palette={props.palette} />;
        case 'gradient':
            return <GradientControl control={control} draft={draft} updateDraft={updateDraft} palette={props.palette} />;
        case 'layout':
            return (
                <LayoutTab
                    blockId={props.blockId}
                    blockType={props.blockType}
                    value={sectionSettings}
                    onChange={setSectionSettings}
                />
            );
        case 'responsiveColumns':
            return (
                <ResponsiveColumnsControl
                    value={sectionSettings.layout.columns}
                    onChange={(columns) => setSectionSettings({
                        layout: {
                            ...sectionSettings.layout,
                            columns,
                        },
                    })}
                    maxColumns={control.maxColumns || getLayoutColumnLimit(props.blockType, props.blockData)}
                />
            );
        case 'pretext':
            return (
                <PretextControls
                    values={draft}
                    palette={props.palette}
                    onChange={updateDraft}
                    labelName={control.labelName}
                />
            );
        case 'cardMediaLayout':
            return <CardMediaLayoutControl control={control} draft={draft} updateDraft={updateDraft} />;
        case 'cardStyle':
            return <CardStyleControl control={control} draft={draft} updateDraft={updateDraft} palette={props.palette} />;
        case 'mediaStyle':
            return <MediaStyleControl control={control} draft={draft} updateDraft={updateDraft} palette={props.palette} />;
        case 'advancedCss':
            return <AdvancedCssControl props={props} draft={draft} updateDraft={updateDraft} />;
        case 'custom': {
            const Renderer = customRenderers[control.renderKey];
            if (!Renderer) {
                return (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                        This settings group is registered for a custom renderer.
                    </div>
                );
            }
            return (
                <Renderer
                    {...props}
                    schema={schema}
                    draft={draft}
                    updateDraft={updateDraft}
                />
            );
        }
        default:
            return null;
    }
}

function ToggleControl({
    control,
    draft,
    updateDraft,
}: {
    control: ToggleSettingsControl;
    draft: Record<string, SettingsValue>;
    updateDraft: (field: string, value: SettingsValue) => void;
}) {
    return (
        <InspectorToggle
            label={control.label || control.field}
            description={control.description}
            checked={Boolean(draft[control.field])}
            onChange={() => updateDraft(control.field, !Boolean(draft[control.field]))}
        />
    );
}

function SelectControl({
    control,
    draft,
    updateDraft,
    blockType,
}: {
    control: SelectSettingsControl;
    draft: Record<string, SettingsValue>;
    updateDraft: (field: string, value: SettingsValue) => void;
    blockType: string;
}) {
    if (shouldRenderLayoutTiles(blockType, control)) {
        const value = String(draft[control.field] ?? control.defaultValue);
        const options = control.options.map((option) => ({
            id: String(option.value),
            label: option.label,
            description: option.description,
        }));
        return (
            <LayoutOptionTiles
                blockType={blockType}
                value={value}
                options={options}
                onChange={(next) => updateDraft(control.field, readOptionValue(next, control.options))}
                label={control.label || control.field}
                description={control.description}
            />
        );
    }

    return (
        <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                {control.label || control.field}
            </span>
            {control.description && <span className="mb-2 block text-xs text-slate-500">{control.description}</span>}
            <select
                value={String(draft[control.field] ?? control.defaultValue)}
                onChange={(event) => updateDraft(control.field, readOptionValue(event.target.value, control.options))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
            >
                {control.options.map((option) => (
                    <option key={String(option.value)} value={String(option.value)}>
                        {option.label}
                    </option>
                ))}
            </select>
        </label>
    );
}

function shouldRenderLayoutTiles(blockType: string, control: SelectSettingsControl): boolean {
    const layoutControlIds = new Set([
        'carousel-layout',
        'variant',
        'layout',
        'tabAlign',
        'imagePosition',
    ]);
    if (!layoutControlIds.has(control.id) && !layoutControlIds.has(control.field)) return false;
    return control.options.length > 1 && control.options.every((option) => hasLayoutOptionThumbnail(blockType, String(option.value)));
}

function SegmentedControl({
    control,
    draft,
    updateDraft,
}: {
    control: SegmentedSettingsControl;
    draft: Record<string, SettingsValue>;
    updateDraft: (field: string, value: SettingsValue) => void;
}) {
    const value = draft[control.field] ?? control.defaultValue;

    return (
        <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                {control.label || control.field}
            </p>
            <div className="grid grid-cols-2 gap-2">
                {control.options.map((option) => {
                    const active = String(value) === String(option.value);
                    return (
                        <button
                            key={String(option.value)}
                            type="button"
                            onClick={() => updateDraft(control.field, option.value)}
                            aria-pressed={active}
                            className={`rounded-lg border px-3 py-2 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                active
                                    ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                        >
                            <span className="block text-sm font-bold">{option.label}</span>
                            {option.description && <span className="mt-0.5 block text-xs leading-snug text-slate-500">{option.description}</span>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function RangeControl({
    control,
    draft,
    updateDraft,
}: {
    control: RangeSettingsControl;
    draft: Record<string, SettingsValue>;
    updateDraft: (field: string, value: SettingsValue) => void;
}) {
    const value = readNumber(draft[control.field], control.defaultValue);
    const display = formatRangeValue(value, control);
    const commit = (next: number) => updateDraft(control.field, clampNumber(next, control.min, control.max));

    return (
        <div>
            <div className="mb-1 flex items-center justify-between gap-3">
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                    {control.label || control.field}: {display}
                </label>
                <div className="flex items-center gap-1">
                    <input
                        type="number"
                        min={control.min}
                        max={control.max}
                        step={control.step || 1}
                        value={value}
                        onChange={(event) => commit(Number(event.target.value))}
                        className="h-8 w-16 rounded-md border border-slate-200 px-2 text-right text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {control.suffix && <span className="text-xs font-semibold text-slate-500">{control.suffix}</span>}
                </div>
            </div>
            <input
                type="range"
                min={control.min}
                max={control.max}
                step={control.step || 1}
                value={value}
                onChange={(event) => commit(Number(event.target.value))}
                className="w-full accent-blue-600"
            />
        </div>
    );
}

function NumberControl({
    control,
    draft,
    updateDraft,
}: {
    control: NumberSettingsControl;
    draft: Record<string, SettingsValue>;
    updateDraft: (field: string, value: SettingsValue) => void;
}) {
    const value = readNumber(draft[control.field], control.defaultValue);
    const commit = (next: number) => {
        const min = control.min ?? Number.NEGATIVE_INFINITY;
        const max = control.max ?? Number.POSITIVE_INFINITY;
        updateDraft(control.field, clampNumber(next, min, max));
    };

    return (
        <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                {control.label || control.field}
            </span>
            <div className="flex items-center gap-2">
                <input
                    type="number"
                    min={control.min}
                    max={control.max}
                    step={control.step || 1}
                    value={value}
                    onChange={(event) => commit(Number(event.target.value))}
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
                {control.suffix && <span className="text-xs font-semibold text-slate-500">{control.suffix}</span>}
            </div>
        </label>
    );
}

function TextControl({
    control,
    draft,
    updateDraft,
}: {
    control: TextSettingsControl;
    draft: Record<string, SettingsValue>;
    updateDraft: (field: string, value: SettingsValue) => void;
}) {
    const value = String(draft[control.field] ?? control.defaultValue);

    if (control.kind === 'textarea') {
        return (
            <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    {control.label || control.field}
                </span>
                <textarea
                    value={value}
                    placeholder={control.placeholder}
                    onChange={(event) => updateDraft(control.field, event.target.value)}
                    className="min-h-28 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
            </label>
        );
    }

    return (
        <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                {control.label || control.field}
            </span>
            <input
                type={control.kind === 'url' ? 'url' : 'text'}
                value={value}
                placeholder={control.placeholder}
                onChange={(event) => updateDraft(control.field, event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
        </label>
    );
}

function ColorControl({
    control,
    draft,
    updateDraft,
    palette,
}: {
    control: ColorSettingsControl;
    draft: Record<string, SettingsValue>;
    updateDraft: (field: string, value: SettingsValue) => void;
    palette: Record<string, string>;
}) {
    const value = String(draft[control.field] ?? control.defaultValue);
    const inputValue = getColorInputValue(value, palette, control.fallback);
    const update = (next: string) => updateDraft(control.field, next);

    return (
        <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                {control.label || control.field}
            </label>
            {control.description && <p className="mt-1 text-xs text-slate-500">{control.description}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2">
                <DeferredColorInput
                    value={inputValue}
                    onChange={update}
                    className="h-10 w-10 cursor-pointer rounded border border-slate-200 bg-white"
                />
                <PaletteTokenButtons
                    selected={getPaletteButtonSelection(value)}
                    palette={palette}
                    onSelect={update}
                />
            </div>
            <div className="mt-3 flex gap-2">
                <input
                    type="text"
                    value={value}
                    onChange={(event) => update(event.target.value)}
                    placeholder={control.placeholder || 'Default'}
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                    type="button"
                    onClick={() => update(control.defaultValue)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    Reset
                </button>
            </div>
        </div>
    );
}

type GradientDraftValue = { from: string; to: string; via?: string; angle: number };

function readGradientValue(value: SettingsValue): GradientDraftValue | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const record = value as Record<string, SettingsValue>;
    return {
        from: typeof record.from === 'string' ? record.from : 'palette:accent',
        to: typeof record.to === 'string' ? record.to : 'palette:primary',
        via: typeof record.via === 'string' ? record.via : undefined,
        angle: typeof record.angle === 'number' ? record.angle : 135,
    };
}

function GradientControl({
    control,
    draft,
    updateDraft,
    palette,
}: {
    control: GradientSettingsControl;
    draft: Record<string, SettingsValue>;
    updateDraft: (field: string, value: SettingsValue) => void;
    palette: Record<string, string>;
}) {
    const grad = readGradientValue(draft[control.field]);
    const enabled = Boolean(grad);
    const current: GradientDraftValue = grad || { from: 'palette:accent', to: 'palette:primary', angle: 135 };
    const fromInput = getColorInputValue(current.from, palette, control.fromFallback || '#1f2937');
    const toInput = getColorInputValue(current.to, palette, control.toFallback || '#ef4444');
    const viaInput = current.via ? getColorInputValue(current.via, palette, '#ffffff') : '';
    const update = (patch: Partial<GradientDraftValue>) =>
        updateDraft(control.field, { ...current, ...patch } as Record<string, SettingsValue>);

    return (
        <div>
            <InspectorToggle
                label={control.label || 'Background gradient'}
                description={control.description}
                checked={enabled}
                onChange={() => updateDraft(control.field, enabled ? null : (current as Record<string, SettingsValue>))}
            />
            {enabled && (
                <div className="mt-3 space-y-3">
                    <div>
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">From</p>
                        <div className="flex flex-wrap items-center gap-2">
                            <DeferredColorInput
                                value={fromInput}
                                onChange={(next) => update({ from: next })}
                                className="h-9 w-9 cursor-pointer rounded border border-slate-200 bg-white"
                            />
                            <PaletteTokenButtons
                                selected={getPaletteButtonSelection(current.from)}
                                palette={palette}
                                onSelect={(token) => update({ from: token })}
                            />
                        </div>
                    </div>
                    <div>
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">To</p>
                        <div className="flex flex-wrap items-center gap-2">
                            <DeferredColorInput
                                value={toInput}
                                onChange={(next) => update({ to: next })}
                                className="h-9 w-9 cursor-pointer rounded border border-slate-200 bg-white"
                            />
                            <PaletteTokenButtons
                                selected={getPaletteButtonSelection(current.to)}
                                palette={palette}
                                onSelect={(token) => update({ to: token })}
                            />
                        </div>
                    </div>
                    <div>
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Mid stop (optional)</p>
                        <div className="flex flex-wrap items-center gap-2">
                            <DeferredColorInput
                                value={viaInput || '#ffffff'}
                                onChange={(next) => update({ via: next })}
                                className="h-9 w-9 cursor-pointer rounded border border-slate-200 bg-white disabled:opacity-40"
                                disabled={!current.via}
                            />
                            <button
                                type="button"
                                onClick={() => update({ via: current.via ? undefined : 'palette:secondary' })}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
                            >
                                {current.via ? 'Remove' : 'Add'}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                            Angle: {current.angle}°
                        </label>
                        <input
                            type="range"
                            min={0}
                            max={360}
                            value={current.angle}
                            onChange={(event) => update({ angle: parseInt(event.target.value, 10) || 0 })}
                            className="w-full accent-blue-600"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

function CardMediaLayoutControl({
    control,
    draft,
    updateDraft,
}: {
    control: CardMediaLayoutSettingsControl;
    draft: Record<string, SettingsValue>;
    updateDraft: (field: string, value: SettingsValue) => void;
}) {
    const settingsField = control.settingsField || 'cardSettings';
    const settings = getDraftCardSettings(draft, settingsField, control.fallbackPreset);
    const options = control.options || toOptions(CARD_MEDIA_LAYOUT_OPTIONS);

    return (
        <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                {control.label || 'Media placement'}
            </span>
            {control.description && <span className="mb-2 block text-xs text-slate-500">{control.description}</span>}
            <select
                value={settings.mediaLayout || 'stacked'}
                onChange={(event) => {
                    updateDraft(settingsField, {
                        ...settings,
                        presetId: 'custom',
                        mediaLayout: event.target.value as CardMediaLayout,
                    } as CardSettings as Record<string, SettingsValue>);
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
            >
                {options.map((option) => (
                    <option key={String(option.value)} value={String(option.value)}>
                        {option.label}
                    </option>
                ))}
            </select>
        </label>
    );
}

function CardStyleControl({
    control,
    draft,
    updateDraft,
    palette,
}: {
    control: CardStyleSettingsControl;
    draft: Record<string, SettingsValue>;
    updateDraft: (field: string, value: SettingsValue) => void;
    palette: Record<string, string>;
}) {
    const presetField = control.presetField || 'cardStyle';
    const settingsField = control.settingsField || 'cardSettings';
    const currentPreset = String(draft[presetField] || control.fallbackPreset || 'soft');
    const settings = readCardSettings(draft[settingsField]);
    const mediaControls = getEffectiveMediaControls(control, settings || buildCardSettingsForPreset(currentPreset));

    return (
        <CardSettingsControls
            value={settings}
            currentPresetId={currentPreset}
            palette={palette}
            supportsMedia={control.supportsMedia}
            supportsIcon={control.supportsIcon}
            supportsMarker={control.supportsMarker}
            supportsTextAlign={control.supportsTextAlign}
            mediaControlVisibility={mediaControls}
            onChange={(next) => {
                const nextPreset = next.presetId && next.presetId !== 'custom' ? next.presetId : currentPreset;
                updateDraft(settingsField, normalizeCardSettingsOverride(next, nextPreset) as Record<string, SettingsValue> | undefined);
                if (next.presetId && next.presetId !== 'custom') updateDraft(presetField, next.presetId);
            }}
            onPresetChange={(nextPreset) => {
                updateDraft(presetField, nextPreset);
                updateDraft(settingsField, undefined);
            }}
            onReset={() => updateDraft(settingsField, undefined)}
        />
    );
}

function getEffectiveMediaControls(
    control: CardStyleSettingsControl,
    settings: CardSettings,
): CardStyleSettingsControl['mediaControls'] {
    if (!control.supportsMedia) return control.mediaControls;

    const mediaLayout = settings.mediaLayout || 'stacked';
    const next = {
        layout: control.mediaControls?.layout !== false,
        aspect: control.mediaControls?.aspect !== false,
        size: control.mediaControls?.size !== false,
        radius: control.mediaControls?.radius !== false,
    };

    if (mediaLayout === 'fullBleed') {
        next.size = false;
        next.radius = false;
    }

    if (mediaLayout === 'none') {
        next.aspect = false;
        next.size = false;
        next.radius = false;
    }

    return next;
}

function MediaStyleControl({
    control,
    draft,
    updateDraft,
    palette,
}: {
    control: MediaStyleSettingsControl;
    draft: Record<string, SettingsValue>;
    updateDraft: (field: string, value: SettingsValue) => void;
    palette: Record<string, string>;
}) {
    return (
        <CardStyleControl
            control={{
                id: control.id,
                kind: 'cardStyle',
                settingsField: control.settingsField,
                fallbackPreset: control.fallbackPreset,
                supportsMedia: true,
                supportsTextAlign: false,
                supportsIcon: false,
                mediaControls: {
                    layout: false,
                    aspect: true,
                    size: control.showSize !== false,
                    radius: control.showRadius !== false,
                },
            }}
            draft={draft}
            updateDraft={updateDraft}
            palette={palette}
        />
    );
}

function AdvancedCssControl({
    props,
    draft,
    updateDraft,
}: {
    props: BlockPanelProps & { blockType: string };
    draft: Record<string, SettingsValue>;
    updateDraft: (field: string, value: SettingsValue) => void;
}) {
    if (!props.isProUser) {
        return (
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800">
                <div className="flex items-center gap-2 font-bold">
                    <Crown className="h-4 w-4" />
                    Custom CSS &amp; Keyframe scripting are Pro features
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor={`${props.blockId}-schema-css`}>
                    Custom CSS
                </label>
                <textarea
                    id={`${props.blockId}-schema-css`}
                    value={String(draft.__customCss ?? '')}
                    onChange={(event) => updateDraft('__customCss', event.target.value)}
                    placeholder={`/* Scoped to this block */\nsection {\n  padding-top: 5rem;\n}`}
                    className="mt-2 min-h-40 w-full resize-y rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-sm text-green-400 outline-none selection:bg-green-900 focus:ring-2 focus:ring-blue-500"
                    spellCheck={false}
                />
            </div>
            <div className="border-t border-slate-200 pt-4">
                <KeyframeEditor
                    blockId={props.blockId}
                    blockType={props.blockType}
                    value={String(draft.__customScript ?? '')}
                    onChange={(value) => updateDraft('__customScript', value)}
                    isProUser={props.isProUser}
                    fieldNames={inferFieldNames(draft as Record<string, unknown>)}
                />
            </div>
        </div>
    );
}

function readOptionValue(value: string, options: SettingsOption[]): SettingsValue {
    const option = options.find((entry) => String(entry.value) === value);
    return option ? option.value : value;
}

function readNumber(value: SettingsValue, fallback: number): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function clampNumber(value: number, min: number, max: number): number {
    const numeric = Number.isFinite(value) ? value : min;
    return Math.min(max, Math.max(min, numeric));
}

function formatRangeValue(value: number, control: RangeSettingsControl): string {
    if (control.format === 'percent') return `${Math.round(value * 100)}%`;
    if (control.format === 'seconds') return `${value}s`;
    if (control.format === 'pixels') return `${value}px`;
    if (control.id === 'media-radius' && value >= 100) return 'Circle';
    return `${value}${control.suffix || ''}`;
}

function getPaletteButtonSelection(value: string): string {
    const normalized = value.trim();
    if (normalized === 'primary' || normalized === 'secondary' || normalized === 'accent') {
        return `palette:${normalized}`;
    }
    return normalized;
}

function getDraftCardSettings(
    draft: Record<string, SettingsValue>,
    settingsField: string,
    fallbackPreset = 'soft',
): CardSettings {
    const currentPreset = String(draft.cardStyle || fallbackPreset);
    return readCardSettings(readDraftPath(draft, settingsField)) || buildCardSettingsForPreset(currentPreset);
}

function toOptions<T extends string>(values: readonly T[]): SettingsOption[] {
    return values.map((value) => ({
        value,
        label: titleCase(value),
    }));
}

function titleCase(value: string): string {
    return value
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .split(/[\s_-]+/g)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}
