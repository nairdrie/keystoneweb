'use client';

import { useEffect, useMemo, useState } from 'react';
import { Crown } from 'lucide-react';
import { useEditorContext } from '@/lib/editor-context';
import BlockSettingsPanel from '../BlockSettingsPanel';
import { AVAILABLE_BLOCKS } from '../block-registry';
import {
    InspectorSection,
    InspectorToggle,
    PaletteTokenButtons,
    getColorInputValue,
    useInspectorSectionState,
} from '../panel-shared';
import { LayoutTab, ResponsiveColumnsControl } from '../layout/LayoutTab';
import type { BlockPanelProps } from '../block-panel-registry';
import {
    areSectionSettingsEqual,
    getLayoutCapabilities,
    getLayoutColumnLimit,
    normalizeSectionSettings,
    type SectionSettings,
} from '@/lib/builder/layout-settings';

type SettingValue = string | number | boolean;
type DraftSettings = Record<string, SettingValue>;

type ChoiceOption = {
    value: SettingValue;
    label: string;
    description?: string;
};

type ChoiceField = {
    key: string;
    label: string;
    defaultValue: SettingValue;
    options: ChoiceOption[];
};

type ControlDependency = { key: string; value: SettingValue };

type ToggleControl = {
    kind: 'toggle';
    key: string;
    label: string;
    description?: string;
    defaultValue: boolean;
    dependsOn?: ControlDependency | ControlDependency[];
};

type SelectControl = {
    kind: 'select';
    key: string;
    label: string;
    defaultValue: SettingValue;
    options: ChoiceOption[];
    dependsOn?: ControlDependency | ControlDependency[];
};

type RangeControl = {
    kind: 'range';
    key: string;
    label: string;
    defaultValue: number;
    min: number;
    max: number;
    step?: number;
    suffix?: string;
    dependsOn?: ControlDependency | ControlDependency[];
};

type TextControl = {
    kind: 'text' | 'url';
    key: string;
    label: string;
    defaultValue: string;
    placeholder?: string;
    dependsOn?: ControlDependency | ControlDependency[];
};

type DisplayControl = ToggleControl | SelectControl | RangeControl | TextControl;

type ColorField = {
    key: string;
    label: string;
    defaultValue: string;
    fallback: string;
    placeholder?: string;
};

const BLOCK_SUBTITLES: Record<string, string> = {
    gallery: 'Tune gallery behavior, section styling, and custom CSS.',
    team: 'Choose a team layout and control member details.',
    carousel: 'Set the carousel layout, motion, and section styling.',
    blog: 'Control the blog feed layout and visible metadata.',
    events: 'Choose which events appear and how they are sorted.',
    pdf: 'Configure viewer actions and custom CSS.',
    socialFeed: 'Lay out social embeds and adjust the block styling.',
    tabBar: 'Adjust tabs, alignment, colors, and custom CSS.',
};

const LAYOUT_FIELDS: Record<string, ChoiceField[]> = {
    aboutImageText: [
        {
            key: 'variant',
            label: 'Image aspect',
            defaultValue: 'landscape',
            options: [
                { value: 'landscape', label: 'Landscape', description: 'Wide 4:3 image.' },
                { value: 'square', label: 'Square', description: 'Balanced 1:1 crop.' },
                { value: 'tall', label: 'Tall', description: 'Portrait 3:4 image.' },
            ],
        },
        {
            key: 'imagePosition',
            label: 'Image position',
            defaultValue: 'left',
            options: [
                { value: 'left', label: 'Left' },
                { value: 'right', label: 'Right' },
            ],
        },
    ],
    testimonials: [
        {
            key: 'variant',
            label: 'Layout',
            defaultValue: 'cards',
            options: [
                { value: 'cards', label: 'Multiple Cards' },
                { value: 'scroll', label: 'Horizontal Scroll' },
                { value: 'single', label: 'Single Focus' },
            ],
        },
    ],
    team: [
        {
            key: 'variant',
            label: 'Layout',
            defaultValue: 'grid',
            options: [
                { value: 'grid', label: 'Simple Grid' },
                { value: 'cards', label: 'Detailed Cards' },
                { value: 'minimal', label: 'Minimal' },
            ],
        },
    ],
    stats: [
        {
            key: 'variant',
            label: 'Layout',
            defaultValue: 'banner',
            options: [
                { value: 'banner', label: 'Banner' },
                { value: 'cards', label: 'Cards' },
            ],
        },
    ],
    pricing: [
        {
            key: 'variant',
            label: 'Layout',
            defaultValue: 'cards',
            options: [
                { value: 'cards', label: 'Pricing Cards' },
                { value: 'comparison', label: 'Comparison' },
                { value: 'simple', label: 'Simple List' },
            ],
        },
    ],
    logoCloud: [
        {
            key: 'variant',
            label: 'Layout',
            defaultValue: 'inline',
            options: [
                { value: 'inline', label: 'Inline Row' },
                { value: 'grid', label: 'Logo Grid' },
                { value: 'marquee', label: 'Marquee' },
            ],
        },
    ],
    featuredQuote: [
        {
            key: 'variant',
            label: 'Layout',
            defaultValue: 'centered',
            options: [
                { value: 'centered', label: 'Centered' },
                { value: 'split', label: 'Split' },
                { value: 'minimal', label: 'Minimal' },
                { value: 'essay', label: 'Essay' },
                { value: 'multiGrid', label: 'Multi-Person' },
            ],
        },
        {
            key: 'imagePosition',
            label: 'Image position',
            defaultValue: 'right',
            options: [
                { value: 'left', label: 'Left' },
                { value: 'right', label: 'Right' },
            ],
        },
    ],
    carousel: [
        {
            key: 'variant',
            label: 'Layout',
            defaultValue: 'cards',
            options: [
                { value: 'cards', label: 'Cards' },
                { value: 'slides', label: 'Split Slides' },
                { value: 'minimal', label: 'Minimal' },
            ],
        },
    ],
    video: [
        {
            key: 'variant',
            label: 'Layout',
            defaultValue: 'contained',
            options: [
                { value: 'contained', label: 'Contained' },
                { value: 'fullWidth', label: 'Full Width' },
            ],
        },
    ],
    blog: [
        {
            key: 'layout',
            label: 'Layout',
            defaultValue: 'grid',
            options: [
                { value: 'grid', label: 'Grid' },
                { value: 'list', label: 'List' },
                { value: 'magazine', label: 'Magazine' },
            ],
        },
    ],
    resources: [
        {
            key: 'variant',
            label: 'Layout',
            defaultValue: 'grid',
            options: [
                { value: 'grid', label: 'Card Grid' },
                { value: 'list', label: 'Document List' },
            ],
        },
    ],
    socialFeed: [
        {
            key: 'variant',
            label: 'Layout',
            defaultValue: 'grid',
            options: [
                { value: 'grid', label: 'Grid' },
                { value: 'single', label: 'Single Column' },
            ],
        },
    ],
    tabBar: [
        {
            key: 'tabStyle',
            label: 'Tab style',
            defaultValue: 'underline',
            options: [
                { value: 'underline', label: 'Underline' },
                { value: 'pills', label: 'Pills' },
                { value: 'tabs', label: 'Tabs' },
                { value: 'buttons', label: 'Buttons' },
            ],
        },
        {
            key: 'tabAlign',
            label: 'Alignment',
            defaultValue: 'left',
            options: [
                { value: 'left', label: 'Left' },
                { value: 'center', label: 'Center' },
                { value: 'right', label: 'Right' },
                { value: 'stretch', label: 'Stretch' },
            ],
        },
    ],
};

const DISPLAY_CONTROLS: Record<string, DisplayControl[]> = {
    gallery: [
        {
            kind: 'select',
            key: 'columns',
            label: 'Columns',
            defaultValue: 3,
            options: [
                { value: 2, label: '2' },
                { value: 3, label: '3' },
                { value: 4, label: '4' },
            ],
        },
        { kind: 'toggle', key: 'showLightboxNav', label: 'Show lightbox navigation', defaultValue: true },
        { kind: 'toggle', key: 'showLightboxThumbs', label: 'Show thumbnail strip', defaultValue: true },
        { kind: 'toggle', key: 'showSeeMore', label: 'Show "See More" button', defaultValue: false },
        { kind: 'toggle', key: 'autoScroll', label: 'Auto-scroll images', defaultValue: false },
        {
            kind: 'select',
            key: 'autoScrollRows',
            label: 'Auto-scroll rows',
            defaultValue: 2,
            dependsOn: { key: 'autoScroll', value: true },
            options: [
                { value: 1, label: '1' },
                { value: 2, label: '2' },
                { value: 3, label: '3' },
                { value: 4, label: '4' },
            ],
        },
    ],
    testimonials: [
        {
            kind: 'toggle',
            key: 'showMoreEnabled',
            label: 'Show More button',
            description: 'Limit visible cards and let visitors show or hide the rest.',
            defaultValue: false,
            dependsOn: { key: 'variant', value: 'cards' },
        },
        {
            kind: 'range',
            key: 'visibleCount',
            label: 'Cards shown before button',
            defaultValue: 3,
            min: 1,
            max: 12,
            step: 1,
            dependsOn: [
                { key: 'variant', value: 'cards' },
                { key: 'showMoreEnabled', value: true },
            ],
        },
        {
            kind: 'toggle',
            key: 'autoScroll',
            label: 'Auto-scroll cards',
            description: 'Automatically move through testimonial cards.',
            defaultValue: false,
            dependsOn: { key: 'variant', value: 'scroll' },
        },
        {
            kind: 'range',
            key: 'interval',
            label: 'Interval',
            defaultValue: 5,
            min: 2,
            max: 15,
            suffix: 's',
            dependsOn: [
                { key: 'variant', value: 'scroll' },
                { key: 'autoScroll', value: true },
            ],
        },
        {
            kind: 'toggle',
            key: 'infiniteScroll',
            label: 'Infinite scrolling',
            description: 'Use a seamless continuous scroll instead of stepped carousel movement.',
            defaultValue: false,
            dependsOn: [
                { key: 'variant', value: 'scroll' },
                { key: 'autoScroll', value: true },
            ],
        },
        {
            kind: 'toggle',
            key: 'loopScroll',
            label: 'Loop auto-scroll',
            description: 'Keep stepped auto-scroll moving forward through the first cards again.',
            defaultValue: false,
            dependsOn: [
                { key: 'variant', value: 'scroll' },
                { key: 'autoScroll', value: true },
                { key: 'infiniteScroll', value: false },
            ],
        },
    ],
    team: [
        { kind: 'toggle', key: 'showBio', label: 'Show descriptions', description: 'Show each member bio.', defaultValue: true },
        {
            kind: 'select',
            key: 'columns',
            label: 'Columns',
            defaultValue: 0,
            options: [
                { value: 0, label: 'Auto' },
                { value: 2, label: '2' },
                { value: 3, label: '3' },
                { value: 4, label: '4' },
            ],
        },
    ],
    carousel: [
        { kind: 'toggle', key: 'autoPlay', label: 'Auto-scroll slides', defaultValue: true },
        { kind: 'range', key: 'interval', label: 'Interval', defaultValue: 5, min: 2, max: 15, suffix: 's', dependsOn: { key: 'autoPlay', value: true } },
    ],
    blog: [
        { kind: 'toggle', key: 'showAuthor', label: 'Show author', defaultValue: true },
        { kind: 'toggle', key: 'showDate', label: 'Show date', defaultValue: true },
        { kind: 'toggle', key: 'showTags', label: 'Show tags', defaultValue: true },
        { kind: 'toggle', key: 'showExcerpt', label: 'Show excerpt', defaultValue: true },
    ],
    events: [
        {
            kind: 'select',
            key: 'sortOrder',
            label: 'Sort order',
            defaultValue: 'desc',
            options: [
                { value: 'asc', label: 'Closest first' },
                { value: 'desc', label: 'Newest first' },
            ],
        },
        { kind: 'toggle', key: 'showPast', label: 'Show past events', defaultValue: false },
    ],
    pdf: [
        { kind: 'toggle', key: 'showDownload', label: 'Show download button', defaultValue: true },
        { kind: 'text', key: 'downloadLabel', label: 'Download label', defaultValue: 'Download PDF', placeholder: 'Download PDF' },
        { kind: 'url', key: 'pdfUrl', label: 'PDF URL', defaultValue: '', placeholder: 'https://example.com/file.pdf' },
    ],
    video: [
        { kind: 'url', key: 'videoUrl', label: 'Video URL', defaultValue: '', placeholder: 'YouTube, Vimeo, or direct video URL' },
    ],
    map: [
        { kind: 'text', key: 'address', label: 'Address', defaultValue: '', placeholder: 'Enter an address or landmark' },
    ],
    cta: [
        { kind: 'toggle', key: 'showPattern', label: 'Show background pattern', defaultValue: false },
    ],
    socialFeed: [
        {
            kind: 'select',
            key: 'columns',
            label: 'Columns',
            defaultValue: 3,
            dependsOn: { key: 'variant', value: 'grid' },
            options: [
                { value: 1, label: '1' },
                { value: 2, label: '2' },
                { value: 3, label: '3' },
                { value: 4, label: '4' },
            ],
        },
    ],
    servicesGrid: [
        {
            kind: 'toggle',
            key: 'ctaEnabled',
            label: 'Show CTA link',
            description: 'Show or hide the call-to-action link below the services.',
            defaultValue: true,
        },
    ],
    contact_form: [
        { kind: 'text', key: 'submitText', label: 'Submit button text', defaultValue: 'Send Message', placeholder: 'Send Message' },
        { kind: 'text', key: 'successMessage', label: 'Success message', defaultValue: 'Thank you for your message! We will get back to you shortly.' },
    ],
};

const EMPTY_LAYOUT_FIELDS: ChoiceField[] = [];
const EMPTY_DISPLAY_CONTROLS: DisplayControl[] = [];

const BACKGROUND_BLOCKS = new Set([
    'aboutImageText',
    'carousel',
    'featuredQuote',
    'events',
    'faq',
    'deliveryLinks',
    'contact',
    'cta',
    'gallery',
    'featuresList',
    'logoCloud',
    'pricing',
    'resources',
    'servicesGrid',
    'stats',
    'team',
    'testimonials',
]);

// Blocks whose components render <BlockPretext /> above their primary title.
// Adding a block here enables the Label inspector section; the block component
// itself is responsible for placing the pretext element above its heading.
const PRETEXT_BLOCKS = new Set([
    'aboutImageText',
]);

const PRETEXT_STYLE_OPTIONS: Array<{ value: string; label: string; description?: string }> = [
    { value: 'text', label: 'Text', description: 'Tracked uppercase eyebrow.' },
    { value: 'pill', label: 'Pill', description: 'Filled rounded badge.' },
    { value: 'outline', label: 'Outline', description: 'Bordered pill.' },
    { value: 'underline', label: 'Underline', description: 'Underlined text.' },
];

const PRETEXT_ALIGN_OPTIONS: Array<{ value: string; label: string }> = [
    { value: 'left', label: 'Left' },
    { value: 'center', label: 'Center' },
];

const PRETEXT_COLOR_TOKENS: Array<{ value: string; label: string; paletteKey: string; title: string }> = [
    { value: 'palette:primary', label: 'P', paletteKey: 'primary', title: 'Use palette primary' },
    { value: 'palette:secondary', label: 'S', paletteKey: 'secondary', title: 'Use palette secondary' },
    { value: 'palette:accent', label: 'A', paletteKey: 'accent', title: 'Use palette accent' },
];

export default function GenericBlockSettingsPanel({
    blockId,
    blockType = '',
    blockData,
    palette,
    isProUser,
    customCss,
    onClose,
    onDraftBlockDataChange,
}: BlockPanelProps) {
    const context = useEditorContext();
    const layoutFields = useMemo(() => LAYOUT_FIELDS[blockType] || EMPTY_LAYOUT_FIELDS, [blockType]);
    const displayControls = useMemo(() => DISPLAY_CONTROLS[blockType] || EMPTY_DISPLAY_CONTROLS, [blockType]);
    const visibleDisplayControls = useMemo(
        () => displayControls.filter((control) => control.key !== 'columns'),
        [displayControls],
    );
    const colorFields = useMemo(() => getColorFields(blockType), [blockType]);
    const supportsPretext = PRETEXT_BLOCKS.has(blockType);
    const layoutCapabilities = useMemo(() => getLayoutCapabilities(blockType), [blockType]);
    const hasColumnLayoutControl = layoutCapabilities.supportsColumns;
    const maxColumnCount = useMemo(
        () => getLayoutColumnLimit(blockType, blockData),
        [blockType, blockData],
    );
    const initialDraft = useMemo(
        () => buildInitialDraft(blockType, blockData || {}, customCss, layoutFields, displayControls, colorFields, supportsPretext),
        [blockType, blockData, customCss, layoutFields, displayControls, colorFields, supportsPretext],
    );
    const persistedSectionSettings = useMemo(
        () => normalizeSectionSettings(blockData?.sectionSettings),
        [blockData?.sectionSettings],
    );
    const [draft, setDraft] = useState<DraftSettings>(initialDraft);
    const [sectionSettings, setSectionSettings] = useState<SectionSettings>(persistedSectionSettings);

    const sectionIds = useMemo(() => {
        const ids: string[] = ['universal-layout'];
        if (layoutFields.length > 0 || hasColumnLayoutControl) ids.push('block-layout');
        if (supportsPretext) ids.push('pretext');
        if (visibleDisplayControls.length > 0) ids.push('display');
        if (colorFields.length > 0) ids.push('style');
        ids.push('advanced');
        return ids;
    }, [layoutFields.length, hasColumnLayoutControl, supportsPretext, visibleDisplayControls.length, colorFields.length]);

    const sectionState = useInspectorSectionState(sectionIds, true);

    useEffect(() => {
        if (!onDraftBlockDataChange) return;
        onDraftBlockDataChange({
            ...(blockData || {}),
            ...draft,
            sectionSettings,
        });
    }, [blockData, draft, sectionSettings, onDraftBlockDataChange]);

    const hasUnsavedChanges = useMemo(
        () => !areRecordsEqual(draft, initialDraft) || !areSectionSettingsEqual(sectionSettings, persistedSectionSettings),
        [draft, initialDraft, sectionSettings, persistedSectionSettings],
    );

    const updateDraft = (key: string, value: SettingValue) => {
        setDraft((current) => ({ ...current, [key]: value }));
    };

    const updateSectionLayout = (patch: Partial<SectionSettings['layout']>) => {
        setSectionSettings((current) => ({
            layout: {
                ...normalizeSectionSettings(current).layout,
                ...patch,
            },
        }));
    };

    const handleSave = () => {
        const updates: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(draft)) {
            if (!areValuesEqual(value, initialDraft[key])) updates[key] = value;
        }
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

    const title = getBlockSettingsTitle(blockType);
    const subtitle = BLOCK_SUBTITLES[blockType] || 'Adjust this block and preview changes before saving.';

    return (
        <BlockSettingsPanel
            isOpen
            title={title}
            subtitle={subtitle}
            blockId={blockId}
            blockType={blockType}
            hasUnsavedChanges={hasUnsavedChanges}
            onClose={onClose}
            onSave={handleSave}
            onReset={handleReset}
            allCollapsed={sectionState.allCollapsed}
            onToggleAllCollapsed={() => sectionState.setAll(!sectionState.allCollapsed)}
            tourId="generic-block-settings-panel"
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

            {(layoutFields.length > 0 || hasColumnLayoutControl) && (
                <InspectorSection
                    id="block-layout"
                    title="Block Layout"
                    isCollapsed={sectionState.isCollapsed('block-layout')}
                    onToggle={() => sectionState.toggle('block-layout')}
                >
                    <div className="space-y-5">
                        {layoutFields.map((field) => (
                            <ChoiceFieldControl
                                key={field.key}
                                field={field}
                                value={draft[field.key]}
                                onChange={(value) => updateDraft(field.key, value)}
                            />
                        ))}

                        {hasColumnLayoutControl && (
                            <ResponsiveColumnsControl
                                value={sectionSettings.layout.columns}
                                onChange={(columns) => updateSectionLayout({ columns })}
                                maxColumns={maxColumnCount}
                            />
                        )}
                    </div>
                </InspectorSection>
            )}

            {supportsPretext && (
                <InspectorSection
                    id="pretext"
                    title="Label"
                    isCollapsed={sectionState.isCollapsed('pretext')}
                    onToggle={() => sectionState.toggle('pretext')}
                >
                    <PretextControls
                        draft={draft}
                        palette={palette}
                        onChange={updateDraft}
                    />
                </InspectorSection>
            )}

            {visibleDisplayControls.length > 0 && (
                <InspectorSection
                    id="display"
                    title="Display"
                    isCollapsed={sectionState.isCollapsed('display')}
                    onToggle={() => sectionState.toggle('display')}
                >
                    <div className="space-y-4">
                        {visibleDisplayControls
                            .filter((control) => shouldShowControl(control, draft))
                            .map((control) => (
                                <DisplayControlRow
                                    key={control.key}
                                    control={control}
                                    value={draft[control.key]}
                                    onChange={(value) => updateDraft(control.key, value)}
                                />
                            ))}
                    </div>
                </InspectorSection>
            )}

            {colorFields.length > 0 && (
                <InspectorSection
                    id="style"
                    title="Style"
                    isCollapsed={sectionState.isCollapsed('style')}
                    onToggle={() => sectionState.toggle('style')}
                >
                    <div className="space-y-5">
                        {colorFields.map((field) => (
                            <ColorFieldControl
                                key={field.key}
                                field={field}
                                value={String(draft[field.key] ?? '')}
                                palette={palette}
                                onChange={(value) => updateDraft(field.key, value)}
                            />
                        ))}
                    </div>
                </InspectorSection>
            )}

            <InspectorSection
                id="advanced"
                title="Advanced"
                isCollapsed={sectionState.isCollapsed('advanced')}
                onToggle={() => sectionState.toggle('advanced')}
            >
                {isProUser ? (
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor={`${blockId}-generic-css`}>
                            Custom CSS
                        </label>
                        <textarea
                            id={`${blockId}-generic-css`}
                            value={String(draft.__customCss ?? '')}
                            onChange={(e) => updateDraft('__customCss', e.target.value)}
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

function getBlockSettingsTitle(blockType: string): string {
    const label = AVAILABLE_BLOCKS.find(block => block.type === blockType)?.label || blockType;
    const cleanLabel = label
        .replace(/[^\x20-\x7E]/g, '')
        .replace(/^[^A-Za-z0-9]+/, '')
        .trim();

    return `${cleanLabel || blockType} Settings`;
}

function ChoiceFieldControl({
    field,
    value,
    onChange,
}: {
    field: ChoiceField;
    value: SettingValue | undefined;
    onChange: (value: SettingValue) => void;
}) {
    return (
        <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{field.label}</p>
            <div className="grid grid-cols-2 gap-2">
                {field.options.map((option) => {
                    const isActive = areValuesEqual(value ?? field.defaultValue, option.value);
                    return (
                        <button
                            key={String(option.value)}
                            type="button"
                            onClick={() => onChange(option.value)}
                            aria-pressed={isActive}
                            className={`rounded-xl border px-3 py-2.5 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                isActive
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
    );
}

function DisplayControlRow({
    control,
    value,
    onChange,
}: {
    control: DisplayControl;
    value: SettingValue | undefined;
    onChange: (value: SettingValue) => void;
}) {
    if (control.kind === 'toggle') {
        return (
            <InspectorToggle
                label={control.label}
                description={control.description}
                checked={Boolean(value)}
                onChange={() => onChange(!value)}
            />
        );
    }

    if (control.kind === 'select') {
        return (
            <ChoiceFieldControl
                field={control}
                value={value}
                onChange={onChange}
            />
        );
    }

    if (control.kind === 'range') {
        const numeric = typeof value === 'number' ? value : control.defaultValue;
        return (
            <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    {control.label}: {numeric}{control.suffix || ''}
                </label>
                <input
                    type="range"
                    min={control.min}
                    max={control.max}
                    step={control.step || 1}
                    value={numeric}
                    onChange={(e) => onChange(parseInt(e.target.value) || control.defaultValue)}
                    className="w-full accent-blue-600"
                />
            </div>
        );
    }

    return (
        <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor={`generic-${control.key}`}>
                {control.label}
            </label>
            <input
                id={`generic-${control.key}`}
                type={control.kind === 'url' ? 'url' : 'text'}
                value={String(value ?? '')}
                onChange={(e) => onChange(e.target.value)}
                placeholder={control.placeholder}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
        </div>
    );
}

function ColorFieldControl({
    field,
    value,
    palette,
    onChange,
}: {
    field: ColorField;
    value: string;
    palette: Record<string, string>;
    onChange: (value: string) => void;
}) {
    const inputValue = getColorInputValue(value, palette, field.fallback);

    return (
        <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor={`generic-${field.key}`}>
                {field.label}
            </label>
            <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                    id={`generic-${field.key}`}
                    type="color"
                    value={inputValue}
                    onChange={(e) => onChange(e.target.value)}
                    className="h-10 w-10 cursor-pointer rounded border border-slate-200 bg-white"
                />
                <PaletteTokenButtons
                    selected={value}
                    palette={palette}
                    onSelect={onChange}
                />
            </div>
            <div className="mt-3 flex gap-2">
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={field.placeholder || 'Default'}
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                    type="button"
                    onClick={() => onChange('')}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    Reset
                </button>
            </div>
        </div>
    );
}

function PretextControls({
    draft,
    palette,
    onChange,
}: {
    draft: DraftSettings;
    palette: Record<string, string>;
    onChange: (key: string, value: SettingValue) => void;
}) {
    const enabled = Boolean(draft.pretextEnabled);
    const style = String(draft.pretextStyle ?? 'text');
    const color = String(draft.pretextColor ?? 'palette:secondary');
    const align = String(draft.pretextAlignment ?? 'left');

    return (
        <div className="space-y-4">
            <InspectorToggle
                label="Show label"
                description="Small text shown above the heading."
                checked={enabled}
                onChange={() => onChange('pretextEnabled', !enabled)}
            />

            {enabled && (
                <>
                    <div>
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Style</p>
                        <div className="grid grid-cols-2 gap-2">
                            {PRETEXT_STYLE_OPTIONS.map((option) => {
                                const active = style === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => onChange('pretextStyle', option.value)}
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

                    <div>
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Color</p>
                        <div className="flex items-center gap-1">
                            {PRETEXT_COLOR_TOKENS.map(({ value, label, paletteKey, title }) => {
                                const active = color === value;
                                return (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => onChange('pretextColor', value)}
                                        title={title}
                                        className={`w-8 h-8 rounded-full border text-[10px] font-bold shadow-sm transition-transform ${active ? 'border-slate-900 scale-105' : 'border-white'}`}
                                        style={{
                                            backgroundColor: palette[paletteKey] || '#ffffff',
                                            color: paletteKey === 'accent' ? (palette.primary || '#0f172a') : '#ffffff',
                                        }}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Alignment</p>
                        <div className="grid grid-cols-2 gap-2">
                            {PRETEXT_ALIGN_OPTIONS.map((option) => {
                                const active = align === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => onChange('pretextAlignment', option.value)}
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
                </>
            )}
        </div>
    );
}

function getColorFields(blockType: string): ColorField[] {
    const fields: ColorField[] = [];
    if (BACKGROUND_BLOCKS.has(blockType)) {
        fields.push({
            key: 'backgroundColor',
            label: 'Section background color',
            defaultValue: '',
            fallback: '#ffffff',
            placeholder: 'Default',
        });
        fields.push({
            key: 'foregroundColor',
            label: 'Section text color',
            defaultValue: '',
            fallback: '#0f172a',
            placeholder: 'Default',
        });
    }

    if (blockType === 'tabBar') {
        fields.push(
            {
                key: 'activeColor',
                label: 'Active tab color',
                defaultValue: 'palette:primary',
                fallback: '#374151',
                placeholder: 'palette:primary',
            },
            {
                key: 'bgColor',
                label: 'Bar background color',
                defaultValue: '',
                fallback: '#ffffff',
                placeholder: 'Transparent',
            },
        );
    }

    return fields;
}

function buildInitialDraft(
    blockType: string,
    blockData: Record<string, unknown>,
    customCss: string,
    layoutFields: ChoiceField[],
    displayControls: DisplayControl[],
    colorFields: ColorField[],
    supportsPretext: boolean,
): DraftSettings {
    const draft: DraftSettings = {
        __customCss: customCss,
    };

    for (const field of layoutFields) {
        draft[field.key] = readSetting(blockData, field.key, field.defaultValue);
    }

    for (const control of displayControls) {
        draft[control.key] = readSetting(blockData, control.key, control.defaultValue);
    }

    for (const field of colorFields) {
        draft[field.key] = readSetting(blockData, field.key, field.defaultValue);
    }

    if (supportsPretext) {
        draft.pretextEnabled = readSetting(blockData, 'pretextEnabled', false);
        draft.pretextStyle = readSetting(blockData, 'pretextStyle', 'text');
        draft.pretextColor = readSetting(blockData, 'pretextColor', 'palette:secondary');
        draft.pretextAlignment = readSetting(blockData, 'pretextAlignment', 'left');
    }

    if (blockType === 'socialFeed' && draft.variant === 'single') {
        draft.columns = readSetting(blockData, 'columns', 1);
    }

    return draft;
}

function readSetting(blockData: Record<string, unknown>, key: string, defaultValue: SettingValue): SettingValue {
    const value = blockData[key];
    if (value === undefined || value === null) return defaultValue;
    if (typeof defaultValue === 'number') {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : defaultValue;
    }
    if (typeof defaultValue === 'boolean') return Boolean(value);
    return String(value);
}

function shouldShowControl(control: DisplayControl, draft: DraftSettings): boolean {
    if (!control.dependsOn) return true;
    const dependencies = Array.isArray(control.dependsOn) ? control.dependsOn : [control.dependsOn];
    return dependencies.every((dependency) => areValuesEqual(draft[dependency.key], dependency.value));
}

function areRecordsEqual(a: DraftSettings, b: DraftSettings): boolean {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
        if (!areValuesEqual(a[key], b[key])) return false;
    }
    return true;
}

function areValuesEqual(a: unknown, b: unknown): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}
