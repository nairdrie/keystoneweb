'use client';

import { useEffect, useMemo, useState } from 'react';
import { Crown } from 'lucide-react';
import { useEditorContext } from '@/lib/editor-context';
import BlockSettingsPanel from '../BlockSettingsPanel';
import {
    InspectorSection,
    InspectorToggle,
    PaletteTokenButtons,
    getColorInputValue,
    useInspectorSectionState,
} from '../panel-shared';
import { LayoutTab } from '../layout/LayoutTab';
import {
    areSectionSettingsEqual,
    normalizeSectionSettings,
    type SectionSettings,
} from '@/lib/builder/layout-settings';
import type { BlockPanelProps } from '../block-panel-registry';

type ColumnRatio = '50-50' | '60-40' | '40-60' | '33-67' | '67-33';
type VerticalAlign = 'start' | 'center' | 'end' | 'stretch';

interface DraftSettings {
    columnRatio: ColumnRatio;
    verticalAlign: VerticalAlign;
    gap: number;
    stackOnMobile: boolean;
    reverseOnMobile: boolean;
    backgroundColor: string;
    __customCss: string;
}

const DEFAULTS: DraftSettings = {
    columnRatio: '50-50',
    verticalAlign: 'start',
    gap: 32,
    stackOnMobile: true,
    reverseOnMobile: false,
    backgroundColor: '',
    __customCss: '',
};

const RATIO_OPTIONS: Array<{ value: ColumnRatio; label: string }> = [
    { value: '50-50', label: '50 / 50' },
    { value: '60-40', label: '60 / 40' },
    { value: '40-60', label: '40 / 60' },
    { value: '67-33', label: '67 / 33' },
    { value: '33-67', label: '33 / 67' },
];

const ALIGN_OPTIONS: Array<{ value: VerticalAlign; label: string; description?: string }> = [
    { value: 'start', label: 'Top' },
    { value: 'center', label: 'Center' },
    { value: 'end', label: 'Bottom' },
    { value: 'stretch', label: 'Stretch', description: 'Equal-height columns.' },
];

function readDraft(blockData: Record<string, unknown> | undefined, customCss: string): DraftSettings {
    const data = blockData || {};
    return {
        columnRatio: (data.columnRatio as ColumnRatio) || DEFAULTS.columnRatio,
        verticalAlign: (data.verticalAlign as VerticalAlign) || DEFAULTS.verticalAlign,
        gap: typeof data.gap === 'number' ? (data.gap as number) : DEFAULTS.gap,
        stackOnMobile: data.stackOnMobile === undefined ? DEFAULTS.stackOnMobile : Boolean(data.stackOnMobile),
        reverseOnMobile: Boolean(data.reverseOnMobile),
        backgroundColor: typeof data.backgroundColor === 'string' ? (data.backgroundColor as string) : '',
        __customCss: customCss,
    };
}

function shallowEqual(a: DraftSettings, b: DraftSettings): boolean {
    return (
        a.columnRatio === b.columnRatio &&
        a.verticalAlign === b.verticalAlign &&
        a.gap === b.gap &&
        a.stackOnMobile === b.stackOnMobile &&
        a.reverseOnMobile === b.reverseOnMobile &&
        a.backgroundColor === b.backgroundColor &&
        a.__customCss === b.__customCss
    );
}

export default function SideBySideSettingsPanel({
    blockId,
    blockType = 'sideBySide',
    blockData,
    palette,
    isProUser,
    customCss,
    onClose,
    onDraftBlockDataChange,
}: BlockPanelProps) {
    const context = useEditorContext();
    const initialDraft = useMemo(() => readDraft(blockData, customCss), [blockData, customCss]);
    const [draft, setDraft] = useState<DraftSettings>(initialDraft);

    const persistedSectionSettings = useMemo(
        () => normalizeSectionSettings(blockData?.sectionSettings),
        [blockData?.sectionSettings],
    );
    const [sectionSettings, setSectionSettings] = useState<SectionSettings>(persistedSectionSettings);

    const sectionIds = ['universal-layout', 'layout', 'spacing', 'responsive', 'style', 'advanced'];
    const sectionState = useInspectorSectionState(sectionIds, true);

    useEffect(() => {
        if (!onDraftBlockDataChange) return;
        onDraftBlockDataChange({
            ...(blockData || {}),
            ...draft,
            sectionSettings,
        });
    }, [blockData, draft, sectionSettings, onDraftBlockDataChange]);

    const hasUnsavedChanges =
        !shallowEqual(draft, initialDraft) ||
        !areSectionSettingsEqual(sectionSettings, persistedSectionSettings);

    const update = <K extends keyof DraftSettings>(key: K, value: DraftSettings[K]) => {
        setDraft((current) => ({ ...current, [key]: value }));
    };

    const handleSave = () => {
        const updates: Record<string, unknown> = {};
        if (draft.columnRatio !== initialDraft.columnRatio) updates.columnRatio = draft.columnRatio;
        if (draft.verticalAlign !== initialDraft.verticalAlign) updates.verticalAlign = draft.verticalAlign;
        if (draft.gap !== initialDraft.gap) updates.gap = draft.gap;
        if (draft.stackOnMobile !== initialDraft.stackOnMobile) updates.stackOnMobile = draft.stackOnMobile;
        if (draft.reverseOnMobile !== initialDraft.reverseOnMobile) updates.reverseOnMobile = draft.reverseOnMobile;
        if (draft.backgroundColor !== initialDraft.backgroundColor) updates.backgroundColor = draft.backgroundColor;
        if (draft.__customCss !== initialDraft.__customCss) updates.__customCss = draft.__customCss;
        if (!areSectionSettingsEqual(sectionSettings, persistedSectionSettings)) {
            updates.sectionSettings = normalizeSectionSettings(sectionSettings);
        }
        if (Object.keys(updates).length > 0 && context?.updateBlockDataBatch) {
            context.updateBlockDataBatch(blockId, updates);
        }
        onClose();
    };

    const handleReset = () => {
        setDraft(initialDraft);
        setSectionSettings(persistedSectionSettings);
        sectionState.reset();
    };

    const colorInputValue = getColorInputValue(draft.backgroundColor, palette, '#ffffff');

    return (
        <BlockSettingsPanel
            isOpen
            title="Side by Side Settings"
            subtitle="Place two columns of blocks next to each other and tune their layout."
            blockId={blockId}
            blockType={blockType}
            hasUnsavedChanges={hasUnsavedChanges}
            onClose={onClose}
            onSave={handleSave}
            onReset={handleReset}
            allCollapsed={sectionState.allCollapsed}
            onToggleAllCollapsed={() => sectionState.setAll(!sectionState.allCollapsed)}
            tourId="side-by-side-settings-panel"
        >
            <InspectorSection
                id="universal-layout"
                title="Layout"
                isCollapsed={sectionState.isCollapsed('universal-layout')}
                onToggle={() => sectionState.toggle('universal-layout')}
            >
                <LayoutTab
                    blockId={blockId}
                    blockType={blockType}
                    value={sectionSettings}
                    onChange={setSectionSettings}
                />
            </InspectorSection>

            <InspectorSection
                id="layout"
                title="Columns"
                isCollapsed={sectionState.isCollapsed('layout')}
                onToggle={() => sectionState.toggle('layout')}
            >
                <div className="space-y-5">
                    <div>
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Column ratio</p>
                        <div className="grid grid-cols-2 gap-2">
                            {RATIO_OPTIONS.map((option) => {
                                const active = draft.columnRatio === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => update('columnRatio', option.value)}
                                        aria-pressed={active}
                                        className={`rounded-xl border px-3 py-2.5 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                            active
                                                ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                                                : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                        }`}
                                    >
                                        <span className="block text-sm font-bold">{option.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Vertical alignment</p>
                        <div className="grid grid-cols-2 gap-2">
                            {ALIGN_OPTIONS.map((option) => {
                                const active = draft.verticalAlign === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => update('verticalAlign', option.value)}
                                        aria-pressed={active}
                                        className={`rounded-xl border px-3 py-2.5 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                            active
                                                ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                                                : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                        }`}
                                    >
                                        <span className="block text-sm font-bold">{option.label}</span>
                                        {option.description && (
                                            <span className="mt-0.5 block text-xs leading-snug text-slate-500">{option.description}</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </InspectorSection>

            <InspectorSection
                id="spacing"
                title="Spacing"
                isCollapsed={sectionState.isCollapsed('spacing')}
                onToggle={() => sectionState.toggle('spacing')}
            >
                <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                        Gap between columns: {draft.gap}px
                    </label>
                    <input
                        type="range"
                        min={0}
                        max={96}
                        step={4}
                        value={draft.gap}
                        onChange={(e) => update('gap', parseInt(e.target.value, 10) || 0)}
                        className="w-full accent-blue-600"
                    />
                </div>
            </InspectorSection>

            <InspectorSection
                id="responsive"
                title="Responsive"
                isCollapsed={sectionState.isCollapsed('responsive')}
                onToggle={() => sectionState.toggle('responsive')}
            >
                <div className="space-y-2">
                    <InspectorToggle
                        label="Stack on mobile"
                        description="Show columns one above the other on small screens."
                        checked={draft.stackOnMobile}
                        onChange={() => update('stackOnMobile', !draft.stackOnMobile)}
                    />
                    {draft.stackOnMobile && (
                        <InspectorToggle
                            label="Reverse order on mobile"
                            description="Show the right column first when stacked."
                            checked={draft.reverseOnMobile}
                            onChange={() => update('reverseOnMobile', !draft.reverseOnMobile)}
                        />
                    )}
                </div>
            </InspectorSection>

            <InspectorSection
                id="style"
                title="Style"
                isCollapsed={sectionState.isCollapsed('style')}
                onToggle={() => sectionState.toggle('style')}
            >
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor={`${blockId}-bg-color`}>
                        Section background color
                    </label>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input
                            id={`${blockId}-bg-color`}
                            type="color"
                            value={colorInputValue}
                            onChange={(e) => update('backgroundColor', e.target.value)}
                            className="h-10 w-10 cursor-pointer rounded border border-slate-200 bg-white"
                        />
                        <PaletteTokenButtons
                            selected={draft.backgroundColor}
                            palette={palette}
                            onSelect={(token) => update('backgroundColor', token)}
                        />
                    </div>
                    <div className="mt-3 flex gap-2">
                        <input
                            type="text"
                            value={draft.backgroundColor}
                            onChange={(e) => update('backgroundColor', e.target.value)}
                            placeholder="Default"
                            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                            type="button"
                            onClick={() => update('backgroundColor', '')}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            Reset
                        </button>
                    </div>
                </div>
            </InspectorSection>

            <InspectorSection
                id="advanced"
                title="Advanced"
                isCollapsed={sectionState.isCollapsed('advanced')}
                onToggle={() => sectionState.toggle('advanced')}
            >
                {isProUser ? (
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor={`${blockId}-side-by-side-css`}>
                            Custom CSS
                        </label>
                        <textarea
                            id={`${blockId}-side-by-side-css`}
                            value={draft.__customCss}
                            onChange={(e) => update('__customCss', e.target.value)}
                            placeholder={`/* Scoped to this block */\nsection {\n  padding-top: 5rem;\n}`}
                            className="mt-2 min-h-40 w-full resize-y rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-sm text-green-400 outline-none selection:bg-green-900 focus:ring-2 focus:ring-blue-500"
                            spellCheck={false}
                        />
                    </div>
                ) : (
                    <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800">
                        <div className="flex items-center gap-2 font-bold">
                            <Crown className="h-4 w-4" />
                            Custom CSS is a Pro feature
                        </div>
                    </div>
                )}
            </InspectorSection>
        </BlockSettingsPanel>
    );
}
