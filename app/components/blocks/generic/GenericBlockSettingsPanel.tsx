'use client';

import { useEffect, useMemo, useState } from 'react';
import { Crown, GripVertical, Plus, Trash2 } from 'lucide-react';
import { useEditorContext } from '@/lib/editor-context';
import BlockSettingsPanel from '../BlockSettingsPanel';
import { AVAILABLE_BLOCKS } from '../block-registry';
import {
    InspectorSection,
    InspectorToggle,
    PaletteTokenButtons,
    PretextControls,
    PRETEXT_BLOCKS,
    PRETEXT_DEFAULTS,
    SideBySideBackgroundOverrideNotice,
    getColorInputValue,
    useInspectorSectionState,
} from '../panel-shared';
import { LayoutTab, ResponsiveColumnsControl } from '../layout/LayoutTab';
import BlockAnimationSection from '../BlockAnimationSection';
import type { BlockPanelProps } from '../block-panel-registry';
import {
    areSectionSettingsEqual,
    getLayoutCapabilities,
    getLayoutColumnLimit,
    normalizeSectionSettings,
    type SectionSettings,
} from '@/lib/builder/layout-settings';
import {
    readBlockAnimationOverride,
    type PartialAnimationConfig,
} from '@/lib/animations';

type SettingValue = string | number | boolean | string[];
type DraftSettings = Record<string, SettingValue>;

const REPEATABLE_ITEMS_DRAFT_UPDATE_EVENT = 'ks:repeatable-items-draft-update';
const DEFAULT_ABOUT_ITEMS = [
    'Licensed & Insured Experts',
    '100% Satisfaction Guarantee',
    'Upfront Honest Pricing',
    'Decades of Experience',
];

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
        {
            key: 'splitRatio',
            label: 'Split ratio',
            defaultValue: '50-50',
            options: [
                { value: '40-60', label: 'Image 40 / Text 60' },
                { value: '50-50', label: 'Balanced 50 / 50' },
                { value: '60-40', label: 'Image 60 / Text 40' },
            ],
        },
        {
            key: 'mobileStackOrder',
            label: 'Mobile order',
            defaultValue: 'image-first',
            options: [
                { value: 'image-first', label: 'Image first' },
                { value: 'text-first', label: 'Text first' },
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
    aboutImageText: [
        {
            kind: 'toggle',
            key: 'showSecondaryButton',
            label: 'Show secondary CTA',
            description: 'Adds an outline-style button below the about copy.',
            defaultValue: false,
        },
        {
            kind: 'text',
            key: 'imageCaption',
            label: 'Image caption',
            defaultValue: '',
            placeholder: 'Optional caption under the image',
        },
    ],
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

const FOREGROUND_COLOR_BLOCKS = new Set([
    'aboutImageText',
    'carousel',
    'featuredQuote',
    'events',
    'faq',
    'deliveryLinks',
    'contact',
    'contact_form',
    'contactForm',
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
    const hasAboutItemsControl = blockType === 'aboutImageText';
    const supportsPretext = PRETEXT_BLOCKS.has(blockType);
    const layoutCapabilities = useMemo(() => getLayoutCapabilities(blockType), [blockType]);
    const supportsColumnLayoutControl = layoutCapabilities.supportsColumns;
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
    const persistedAnimation = useMemo<PartialAnimationConfig | undefined>(
        () => readBlockAnimationOverride(blockData),
        [blockData],
    );
    const [draft, setDraft] = useState<DraftSettings>(initialDraft);
    const [sectionSettings, setSectionSettings] = useState<SectionSettings>(persistedSectionSettings);
    const [animationDraft, setAnimationDraft] = useState<PartialAnimationConfig | undefined>(persistedAnimation);
    const hasColumnLayoutControl = supportsColumnLayoutControl && shouldShowColumnLayoutControl(blockType, draft);

    const sectionIds = useMemo(() => {
        const ids: string[] = hasAboutItemsControl ? ['items', 'universal-layout'] : ['universal-layout'];
        if (layoutFields.length > 0 || hasColumnLayoutControl) ids.push('block-layout');
        if (supportsPretext) ids.push('pretext');
        if (visibleDisplayControls.length > 0) ids.push('display');
        if (colorFields.length > 0) ids.push('style');
        ids.push('animation');
        ids.push('advanced');
        return ids;
    }, [hasAboutItemsControl, layoutFields.length, hasColumnLayoutControl, supportsPretext, visibleDisplayControls.length, colorFields.length]);

    const sectionState = useInspectorSectionState(sectionIds, true);

    useEffect(() => {
        if (!onDraftBlockDataChange) return;
        onDraftBlockDataChange({
            ...(blockData || {}),
            ...draft,
            sectionSettings,
            animation: animationDraft,
        });
    }, [blockData, draft, sectionSettings, animationDraft, onDraftBlockDataChange]);

    useEffect(() => {
        if (!hasAboutItemsControl) return;

        const handleCanvasDraftUpdate = (event: Event) => {
            const detail = (event as CustomEvent<{
                blockId?: string;
                key?: string;
                value?: unknown;
            }>).detail;
            if (detail?.blockId !== blockId || detail.key !== 'items') return;

            setDraft((current) => ({
                ...current,
                items: normalizeAboutItems(detail.value),
            }));
        };

        window.addEventListener(REPEATABLE_ITEMS_DRAFT_UPDATE_EVENT, handleCanvasDraftUpdate);
        return () => window.removeEventListener(REPEATABLE_ITEMS_DRAFT_UPDATE_EVENT, handleCanvasDraftUpdate);
    }, [blockId, hasAboutItemsControl]);

    const hasUnsavedChanges = useMemo(
        () => !areRecordsEqual(draft, initialDraft)
            || !areSectionSettingsEqual(sectionSettings, persistedSectionSettings)
            || !areAnimationOverridesEqual(animationDraft, persistedAnimation),
        [draft, initialDraft, sectionSettings, persistedSectionSettings, animationDraft, persistedAnimation],
    );

    const updateDraft = (key: string, value: SettingValue) => {
        setDraft((current) => ({ ...current, [key]: value }));
    };

    const aboutItems = useMemo(() => normalizeAboutItems(draft.items), [draft.items]);

    const updateAboutItems = (nextItems: string[]) => {
        updateDraft('items', nextItems);
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
        if (!areAnimationOverridesEqual(animationDraft, persistedAnimation)) {
            updates.animation = animationDraft ?? null;
        }
        if (Object.keys(updates).length > 0 && context?.updateBlockDataBatch) {
            context.updateBlockDataBatch(blockId, updates);
        }
        onClose();
    };

    const handleReset = () => {
        setDraft(initialDraft);
        setSectionSettings(persistedSectionSettings);
        setAnimationDraft(persistedAnimation);
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
            {hasAboutItemsControl && (
                <InspectorSection
                    id="items"
                    title="Items"
                    isCollapsed={sectionState.isCollapsed('items')}
                    onToggle={() => sectionState.toggle('items')}
                >
                    <AboutItemsControl
                        items={aboutItems}
                        onChange={updateAboutItems}
                    />
                </InspectorSection>
            )}

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
                    title={blockType === 'aboutImageText' ? 'Eyebrow' : 'Label'}
                    isCollapsed={sectionState.isCollapsed('pretext')}
                    onToggle={() => sectionState.toggle('pretext')}
                >
                    <PretextControls
                        values={draft}
                        palette={palette}
                        onChange={updateDraft}
                        labelName={blockType === 'aboutImageText' ? 'eyebrow' : 'label'}
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
                                fallback={getColorFieldFallback(blockType, field, draft)}
                                value={String(draft[field.key] ?? '')}
                                palette={palette}
                                onChange={(value) => updateDraft(field.key, value)}
                            />
                        ))}
                    </div>
                </InspectorSection>
            )}

            <InspectorSection
                id="animation"
                title="Animation"
                isCollapsed={sectionState.isCollapsed('animation')}
                onToggle={() => sectionState.toggle('animation')}
            >
                <BlockAnimationSection
                    blockId={blockId}
                    draft={animationDraft}
                    onChange={setAnimationDraft}
                />
            </InspectorSection>

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

function AboutItemsControl({
    items,
    onChange,
}: {
    items: string[];
    onChange: (items: string[]) => void;
}) {
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    const updateItem = (index: number, value: string) => {
        onChange(items.map((item, itemIndex) => itemIndex === index ? value : item));
    };

    const addItem = () => {
        onChange([...items, `New Benefit ${getNextAboutBenefitNumber(items)}`]);
    };

    const deleteItem = (index: number) => {
        if (items.length <= 1) return;
        onChange(items.filter((_, itemIndex) => itemIndex !== index));
    };

    const reorderItem = (fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
        if (fromIndex >= items.length || toIndex >= items.length) return;
        const next = [...items];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        onChange(next);
    };

    return (
        <div className="space-y-2">
            {items.map((item, index) => {
                const isDragOver = dragOverIndex === index && dragIndex !== index;
                return (
                    <div
                        key={`about-item-settings-${index}`}
                        className={`rounded-xl border bg-white transition-colors ${
                            isDragOver ? 'border-blue-400 bg-blue-50/50' : 'border-slate-200'
                        }`}
                        onDragOver={(event) => {
                            event.preventDefault();
                            setDragOverIndex(index);
                        }}
                        onDrop={(event) => {
                            event.preventDefault();
                            if (dragIndex !== null) reorderItem(dragIndex, index);
                            setDragIndex(null);
                            setDragOverIndex(null);
                        }}
                    >
                        <div className="flex items-center gap-2 px-3 py-2">
                            <button
                                type="button"
                                draggable
                                onDragStart={(event) => {
                                    event.dataTransfer.effectAllowed = 'move';
                                    event.dataTransfer.setData('text/plain', `about-item-${index}`);
                                    setDragIndex(index);
                                }}
                                onDragEnd={() => {
                                    setDragIndex(null);
                                    setDragOverIndex(null);
                                }}
                                className="cursor-grab rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700 active:cursor-grabbing"
                                title="Drag to reorder about item"
                                aria-label="Drag to reorder about item"
                            >
                                <GripVertical className="h-4 w-4" />
                            </button>
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500">
                                {index + 1}
                            </span>
                            <input
                                type="text"
                                value={item}
                                onChange={(event) => updateItem(index, event.target.value)}
                                aria-label={`About item ${index + 1}`}
                                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                                type="button"
                                onClick={() => deleteItem(index)}
                                disabled={items.length <= 1}
                                className="rounded-md border border-slate-200 p-2 text-red-500 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                                title="Delete about item"
                                aria-label="Delete about item"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                );
            })}
            <button
                type="button"
                onClick={addItem}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm font-bold text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <Plus className="h-4 w-4" />
                Add Item
            </button>
        </div>
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
    fallback,
    value,
    palette,
    onChange,
}: {
    field: ColorField;
    fallback: string;
    value: string;
    palette: Record<string, string>;
    onChange: (value: string) => void;
}) {
    const inputValue = getColorInputValue(value, palette, fallback);

    return (
        <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor={`generic-${field.key}`}>
                {field.label}
            </label>
            {field.key === 'backgroundColor' && <SideBySideBackgroundOverrideNotice />}
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

function getColorFields(blockType: string): ColorField[] {
    const fields: ColorField[] = [
        {
            key: 'backgroundColor',
            label: 'Section background color',
            defaultValue: '',
            fallback: '#ffffff',
            placeholder: 'Default',
        },
    ];

    if (FOREGROUND_COLOR_BLOCKS.has(blockType)) {
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

function getColorFieldFallback(blockType: string, field: ColorField, draft: DraftSettings): string {
    if (field.key !== 'backgroundColor') return field.fallback;

    switch (blockType) {
        case 'aboutImageText':
        case 'deliveryLinks':
        case 'featuredQuote':
            return 'palette:accent';
        case 'cta':
            return 'palette:secondary';
        case 'resources':
            return '#f8fafc';
        case 'carousel':
            return readDraftString(draft, 'variant', 'cards') === 'slides' ? 'palette:accent' : '#ffffff';
        case 'logoCloud':
            return readDraftString(draft, 'variant', 'inline') === 'marquee' ? 'palette:accent' : '#ffffff';
        case 'pricing':
            return readDraftString(draft, 'variant', 'cards') === 'simple' ? '#ffffff' : 'palette:accent';
        case 'team':
            return readDraftString(draft, 'variant', 'grid') === 'cards' ? 'palette:accent' : '#ffffff';
        default:
            return field.fallback;
    }
}

function readDraftString(draft: DraftSettings, key: string, fallback: string): string {
    const value = draft[key];
    return typeof value === 'string' && value.trim() ? value : fallback;
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
        draft.pretextEnabled = readSetting(blockData, 'pretextEnabled', PRETEXT_DEFAULTS.pretextEnabled);
        draft.pretextStyle = readSetting(blockData, 'pretextStyle', PRETEXT_DEFAULTS.pretextStyle);
        draft.pretextColor = readSetting(blockData, 'pretextColor', PRETEXT_DEFAULTS.pretextColor);
        draft.pretextAlignment = readSetting(blockData, 'pretextAlignment', PRETEXT_DEFAULTS.pretextAlignment);
    }

    if (blockType === 'aboutImageText') {
        draft.items = normalizeAboutItems(blockData.items);
    }

    if (blockType === 'socialFeed' && draft.variant === 'single') {
        draft.columns = readSetting(blockData, 'columns', 1);
    }

    return draft;
}

function normalizeAboutItems(value: unknown): string[] {
    if (!Array.isArray(value) || value.length === 0) return DEFAULT_ABOUT_ITEMS;
    const items = value.map((item) => String(item)).filter(Boolean);
    return items.length > 0 ? items : DEFAULT_ABOUT_ITEMS;
}

function getNextAboutBenefitNumber(items: string[]): number {
    const existingNumbers = items
        .map((item) => item.match(/^New Benefit (\d+)$/)?.[1])
        .filter((value): value is string => Boolean(value))
        .map((value) => Number(value))
        .filter(Number.isFinite);

    return existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : items.length + 1;
}

function readSetting(blockData: Record<string, unknown>, key: string, defaultValue: SettingValue): SettingValue {
    const value = blockData[key];
    if (value === undefined || value === null) return defaultValue;
    if (Array.isArray(defaultValue)) {
        return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : defaultValue;
    }
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

function shouldShowColumnLayoutControl(blockType: string, draft: DraftSettings): boolean {
    if (blockType === 'logoCloud') {
        return String(draft.variant || 'inline') === 'grid';
    }
    return true;
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

function areAnimationOverridesEqual(
    a: PartialAnimationConfig | undefined,
    b: PartialAnimationConfig | undefined,
): boolean {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}
