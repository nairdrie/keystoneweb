'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Crown, GripVertical, Plus, Trash2 } from 'lucide-react';
import { useEditorContext } from '@/lib/editor-context';
import BlockSettingsPanel from './BlockSettingsPanel';
import KeyframeEditor, { inferFieldNames } from './KeyframeEditor';
import {
    InspectorSection,
    PaletteTokenButtons,
    PRETEXT_BLOCKS,
    PretextControls,
    SideBySideBackgroundOverrideNotice,
    getColorInputValue,
    readPretextFromBlockData,
    useInspectorSectionState,
} from './panel-shared';
import { LayoutTab, ResponsiveColumnsControl } from './layout/LayoutTab';
import type { BlockPanelProps } from './block-panel-registry';
import {
    areSectionSettingsEqual,
    getLayoutCapabilities,
    normalizeSectionSettings,
    type SectionSettings,
} from '@/lib/builder/layout-settings';

const REPEATABLE_ITEMS_DRAFT_UPDATE_EVENT = 'ks:repeatable-items-draft-update';

type ManagedBlockType = 'servicesGrid' | 'stats' | 'testimonials' | 'faq' | 'timeline';
type ItemValue = string | number | string[];
type ManagedItem = Record<string, ItemValue>;
type StatsSeparator = 'none' | 'line' | 'dot';

const STATS_SEPARATOR_OPTIONS: ReadonlyArray<{ id: StatsSeparator; label: string }> = [
    { id: 'none', label: 'None' },
    { id: 'line', label: 'Line' },
    { id: 'dot', label: 'Dot' },
];

function normalizeStatsSeparator(value: unknown): StatsSeparator {
    return value === 'line' || value === 'dot' ? value : 'none';
}

function SeparatorPreview({ kind, active }: { kind: StatsSeparator; active: boolean }) {
    const tone = active ? '#2563eb' : '#94a3b8';
    return (
        <span className="flex h-7 w-full items-center justify-center gap-2 text-xs font-semibold" style={{ color: tone }}>
            <span>9+</span>
            {kind === 'line' && <span style={{ width: 1, height: 18, backgroundColor: tone, opacity: 0.7 }} />}
            {kind === 'dot' && <span style={{ width: 4, height: 4, borderRadius: 9999, backgroundColor: tone, opacity: 0.7 }} />}
            {kind === 'none' && <span aria-hidden style={{ width: 12 }} />}
            <span>9+</span>
        </span>
    );
}
type TestimonialDisplaySettings = {
    showMoreEnabled: boolean;
    visibleCount: number;
    autoScroll: boolean;
    interval: number;
    infiniteScroll: boolean;
    loopScroll: boolean;
};

type FieldConfig = {
    key: string;
    label: string;
    type: 'text' | 'textarea' | 'number' | 'tags';
    placeholder?: string;
    min?: number;
    max?: number;
};

type VariantOption = {
    id: string;
    label: string;
    description: string;
};

type ManagedBlockConfig = {
    blockType: ManagedBlockType;
    title: string;
    subtitle: string;
    itemsTitle: string;
    addLabel: string;
    emptyLabel: string;
    itemLabel: string;
    defaultItems: ManagedItem[];
    createItem: (items: ManagedItem[]) => ManagedItem;
    fields: FieldConfig[];
    rowTitle: (item: ManagedItem, index: number) => string;
    rowMeta: (item: ManagedItem, index: number) => string;
    variants?: VariantOption[];
    defaultVariant?: string;
    backgroundFallback: string;
    backgroundPlaceholder: string;
    cssPlaceholder: string;
};

const CONFIGS: Record<ManagedBlockType, ManagedBlockConfig> = {
    servicesGrid: {
        blockType: 'servicesGrid',
        title: 'Services Grid Settings',
        subtitle: 'Manage service cards, section styling, and advanced CSS.',
        itemsTitle: 'Service Cards',
        addLabel: 'Add Service',
        emptyLabel: 'No services yet.',
        itemLabel: 'Service',
        defaultItems: [
            { title: 'Service 1', description: 'First service description.' },
            { title: 'Service 2', description: 'Second service description.' },
            { title: 'Service 3', description: 'Third service description.' },
        ],
        createItem: (items) => {
            const next = nextNumber(items, 'title', /^Service\s+(\d+)$/i);
            return { title: `Service ${next}`, description: 'Description of this service.' };
        },
        fields: [
            { key: 'title', label: 'Title', type: 'text', placeholder: 'Service name' },
            { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Short service description' },
        ],
        rowTitle: (item, index) => String(item.title || `Service ${index + 1}`),
        rowMeta: (_item, index) => `Card ${index + 1}`,
        backgroundFallback: '#ffffff',
        backgroundPlaceholder: 'Default (white)',
        cssPlaceholder: `/* Scoped to this Services Grid block */\n.service-card {\n  border-radius: 0.75rem;\n}`,
    },
    stats: {
        blockType: 'stats',
        title: 'Stats / Numbers Settings',
        subtitle: 'Manage number cards, layout, section styling, and advanced CSS.',
        itemsTitle: 'Stat Items',
        addLabel: 'Add Stat',
        emptyLabel: 'No stats yet.',
        itemLabel: 'Stat',
        defaultItems: [
            { value: '500+', label: 'Happy Clients' },
            { value: '15+', label: 'Years Experience' },
            { value: '24/7', label: 'Emergency Support' },
            { value: '100%', label: 'Satisfaction Rate' },
        ],
        createItem: (items) => {
            const next = nextNumber(items, 'label', /^New Stat\s+(\d+)$/i);
            return { value: '100+', label: `New Stat ${next}` };
        },
        fields: [
            { key: 'value', label: 'Value', type: 'text', placeholder: '100+' },
            { key: 'label', label: 'Label', type: 'text', placeholder: 'Metric label' },
        ],
        rowTitle: (item, index) => String(item.label || `Stat ${index + 1}`),
        rowMeta: (item, index) => `${item.value || 'Value'} - Item ${index + 1}`,
        variants: [
            { id: 'banner', label: 'Horizontal Banner', description: 'Full-width colored band.' },
            { id: 'cards', label: 'Statistic Cards', description: 'Individual cards on a light section.' },
            { id: 'progress', label: 'Progress Bars', description: 'Skill bars with percentage values on a card.' },
        ],
        defaultVariant: 'banner',
        backgroundFallback: '#ffffff',
        backgroundPlaceholder: 'Default',
        cssPlaceholder: `/* Scoped to this Stats block */\n.stat-card {\n  box-shadow: 0 12px 30px rgb(15 23 42 / 0.08);\n}`,
    },
    testimonials: {
        blockType: 'testimonials',
        title: 'Testimonials Settings',
        subtitle: 'Manage testimonial cards, layout, section styling, and advanced CSS.',
        itemsTitle: 'Testimonial Cards',
        addLabel: 'Add Testimonial',
        emptyLabel: 'No testimonials yet.',
        itemLabel: 'Testimonial',
        defaultItems: [
            {
                name: 'Sarah M.',
                role: 'Homeowner',
                quote: 'Absolutely outstanding service! They arrived on time, explained everything clearly, and the quality of work exceeded our expectations.',
                rating: 5,
            },
            {
                name: 'James R.',
                role: 'Business Owner',
                quote: 'Professional, reliable, and reasonably priced. I have been a loyal customer for years and always recommend them to everyone.',
                rating: 5,
            },
            {
                name: 'Lisa K.',
                role: 'Property Manager',
                quote: 'They handle all our properties and never disappoint. Quick response time and excellent craftsmanship on every job.',
                rating: 5,
            },
        ],
        createItem: (items) => {
            const next = nextNumber(items, 'name', /^Client\s+(\d+)$/i);
            return {
                name: `Client ${next}`,
                role: 'Customer',
                quote: 'Great service and outstanding results!',
                rating: 5,
            };
        },
        fields: [
            { key: 'name', label: 'Name', type: 'text', placeholder: 'Customer name' },
            { key: 'role', label: 'Role', type: 'text', placeholder: 'Customer role' },
            { key: 'quote', label: 'Quote', type: 'textarea', placeholder: 'Customer quote' },
            { key: 'rating', label: 'Rating', type: 'number', min: 1, max: 5, placeholder: '5' },
        ],
        rowTitle: (item, index) => String(item.name || `Testimonial ${index + 1}`),
        rowMeta: (item, index) => `${item.role || 'Customer'} - Card ${index + 1}`,
        variants: [
            { id: 'cards', label: 'Multiple Cards', description: 'Several testimonial cards in a grid.' },
            { id: 'scroll', label: 'Horizontal Scroll', description: 'Scrollable row with optional autoplay.' },
            { id: 'single', label: 'Single Focus', description: 'Feature the first testimonial.' },
        ],
        defaultVariant: 'cards',
        backgroundFallback: '#ffffff',
        backgroundPlaceholder: 'Default',
        cssPlaceholder: `/* Scoped to this Testimonials block */\n.testimonial-card {\n  border-radius: 1rem;\n}`,
    },
    faq: {
        blockType: 'faq',
        title: 'FAQ Accordion Settings',
        subtitle: 'Manage FAQ cards, section styling, and advanced CSS.',
        itemsTitle: 'FAQ Cards',
        addLabel: 'Add FAQ',
        emptyLabel: 'No FAQ cards yet.',
        itemLabel: 'FAQ',
        defaultItems: [
            {
                question: 'How quickly can you respond to an emergency?',
                answer: 'We offer 24/7 emergency services and can typically be at your location within 60 minutes of your call.',
            },
            {
                question: 'Do you provide free estimates?',
                answer: 'Yes! We provide free, no-obligation estimates for all our services. Contact us to schedule yours.',
            },
            {
                question: 'Are you licensed and insured?',
                answer: 'Absolutely. We are fully licensed, bonded, and insured for your complete peace of mind.',
            },
            {
                question: 'What areas do you serve?',
                answer: 'We serve the greater metro area and surrounding communities within a 30-mile radius.',
            },
        ],
        createItem: (items) => {
            const next = nextNumber(items, 'question', /^(?:New\s+)?Question\s+(\d+)$/i, items.length + 1);
            return { question: `New Question ${next}`, answer: 'Answer goes here.' };
        },
        fields: [
            { key: 'question', label: 'Question', type: 'text', placeholder: 'Question' },
            { key: 'answer', label: 'Answer', type: 'textarea', placeholder: 'Answer goes here.' },
        ],
        rowTitle: (item, index) => String(item.question || `FAQ ${index + 1}`),
        rowMeta: (_item, index) => `Card ${index + 1}`,
        backgroundFallback: '#ffffff',
        backgroundPlaceholder: 'Default (white)',
        cssPlaceholder: `/* Scoped to this FAQ block */\n.faq-item {\n  border-radius: 0.75rem;\n}`,
    },
    timeline: {
        blockType: 'timeline',
        title: 'Timeline Settings',
        subtitle: 'Manage timeline entries, layout, section styling, and advanced CSS.',
        itemsTitle: 'Timeline Entries',
        addLabel: 'Add Entry',
        emptyLabel: 'No entries yet.',
        itemLabel: 'Entry',
        defaultItems: [
            {
                title: 'Milestone Title',
                organization: 'Organization',
                dateRange: 'Year - Present',
                description: 'Describe what happened during this period and the impact it had.',
                tags: ['Tag 1', 'Tag 2', 'Tag 3'],
            },
            {
                title: 'Milestone Title',
                organization: 'Organization',
                dateRange: 'Year - Year',
                description: 'Describe what happened during this period and the impact it had.',
                tags: ['Tag 1', 'Tag 2'],
            },
            {
                title: 'Milestone Title',
                organization: 'Organization',
                dateRange: 'Year',
                description: 'Describe what happened during this period and the impact it had.',
                tags: ['Tag 1'],
            },
        ],
        createItem: (items) => {
            const next = nextNumber(items, 'title', /^New Entry\s+(\d+)$/i, items.length + 1);
            return {
                title: `New Entry ${next}`,
                organization: 'Company Name',
                dateRange: 'Year - Year',
                description: 'Describe what you accomplished here.',
                tags: [],
            };
        },
        fields: [
            { key: 'title', label: 'Title', type: 'text', placeholder: 'Role / Position' },
            { key: 'organization', label: 'Organization', type: 'text', placeholder: 'Company or institution' },
            { key: 'dateRange', label: 'Date Range', type: 'text', placeholder: '2020 - Present' },
            { key: 'description', label: 'Description', type: 'textarea', placeholder: 'What you accomplished.' },
            { key: 'tags', label: 'Tags', type: 'tags', placeholder: 'Add tag and press Enter' },
        ],
        rowTitle: (item, index) => String(item.title || `Entry ${index + 1}`),
        rowMeta: (item, index) => {
            const org = String(item.organization || '');
            const date = String(item.dateRange || '');
            const meta = [org, date].filter(Boolean).join(' • ');
            return meta || `Entry ${index + 1}`;
        },
        variants: [
            { id: 'cards', label: 'Side Timeline', description: 'Vertical line on the left with cards.' },
            { id: 'centered', label: 'Centered', description: 'Alternating cards on either side.' },
            { id: 'compact', label: 'Compact List', description: 'Date column with minimal cards.' },
        ],
        defaultVariant: 'cards',
        backgroundFallback: '#ffffff',
        backgroundPlaceholder: 'Default (white)',
        cssPlaceholder: `/* Scoped to this Timeline block */\n.timeline-item {\n  border-radius: 1rem;\n}`,
    },
};

export default function RepeatableItemsSettingsPanel({
    blockId,
    blockType = 'servicesGrid',
    blockData,
    palette,
    isProUser,
    customCss,
    onClose,
    onDraftBlockDataChange,
}: BlockPanelProps) {
    const context = useEditorContext();
    const managedType: ManagedBlockType = isManagedBlockType(blockType) ? blockType : 'servicesGrid';
    const config = CONFIGS[managedType];
    const hasTestimonialDisplayControls = managedType === 'testimonials';
    const layoutCapabilities = useMemo(
        () => getLayoutCapabilities(config.blockType),
        [config.blockType],
    );
    const hasColumnLayoutControl = layoutCapabilities.supportsColumns;

    const persistedItems = useMemo(
        () => normalizeItems(blockData?.items, config.defaultItems),
        [blockData?.items, config.defaultItems],
    );
    const persistedVariant = config.variants
        ? String(blockData?.variant || config.defaultVariant || config.variants[0].id)
        : '';
    const supportsSeparator = managedType === 'stats';
    const persistedSeparator = supportsSeparator
        ? normalizeStatsSeparator(blockData?.separator)
        : 'none';
    const persistedBackgroundColor = typeof blockData?.backgroundColor === 'string' ? blockData.backgroundColor : '';
    const persistedForegroundColor = typeof blockData?.foregroundColor === 'string' ? blockData.foregroundColor : '';
    const persistedSectionSettings = useMemo(
        () => normalizeSectionSettings(blockData?.sectionSettings),
        [blockData?.sectionSettings],
    );
    const persistedDisplaySettings = useMemo<TestimonialDisplaySettings>(() => ({
        showMoreEnabled: blockData?.showMoreEnabled === true,
        visibleCount: clampNumber(blockData?.visibleCount, 3, 1, 12),
        autoScroll: blockData?.autoScroll === true,
        interval: clampNumber(blockData?.interval, 5, 2, 15),
        infiniteScroll: blockData?.infiniteScroll === true,
        loopScroll: blockData?.loopScroll === true,
    }), [
        blockData?.showMoreEnabled,
        blockData?.visibleCount,
        blockData?.autoScroll,
        blockData?.interval,
        blockData?.infiniteScroll,
        blockData?.loopScroll,
    ]);

    const supportsPretext = PRETEXT_BLOCKS.has(config.blockType);
    const persistedPretext = useMemo(
        () => readPretextFromBlockData(blockData as Record<string, unknown> | undefined),
        [blockData],
    );

    const sectionIds = useMemo(
        () => {
            const baseLayout = config.variants || hasColumnLayoutControl
                ? ['items', 'universal-layout', 'block-layout']
                : ['items', 'universal-layout'];
            const tail = [
                ...(hasTestimonialDisplayControls ? ['display'] : []),
                ...(supportsPretext ? ['pretext'] : []),
                'style',
                'advanced',
            ];
            return [...baseLayout, ...tail];
        },
        [config.variants, hasColumnLayoutControl, hasTestimonialDisplayControls, supportsPretext],
    );
    const sectionState = useInspectorSectionState(sectionIds, true);

    const [items, setItems] = useState<ManagedItem[]>(persistedItems);
    const [variant, setVariant] = useState<string>(persistedVariant);
    const [separator, setSeparator] = useState<StatsSeparator>(persistedSeparator);
    const [displaySettings, setDisplaySettings] = useState<TestimonialDisplaySettings>(persistedDisplaySettings);
    const [backgroundColor, setBackgroundColor] = useState<string>(persistedBackgroundColor);
    const [foregroundColor, setForegroundColor] = useState<string>(persistedForegroundColor);
    const [sectionSettings, setSectionSettings] = useState<SectionSettings>(persistedSectionSettings);
    const [localCss, setLocalCss] = useState<string>(customCss);
    const persistedScript = typeof blockData?.__customScript === 'string' ? blockData.__customScript : '';
    const [localScript, setLocalScript] = useState<string>(persistedScript);
    const [pretext, setPretext] = useState(persistedPretext);
    const [expandedRows, setExpandedRows] = useState<Set<number>>(() => new Set());
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const structuralItemSnapshotsRef = useRef<ManagedItem[][]>([]);

    const recordStructuralItemsChange = (nextItems: ManagedItem[]) => {
        structuralItemSnapshotsRef.current.push(cloneItems(nextItems));
    };

    useEffect(() => {
        const handleCanvasDraftUpdate = (event: Event) => {
            const detail = (event as CustomEvent<{
                blockId?: string;
                key?: string;
                value?: unknown;
                source?: 'preview' | 'persisted';
            }>).detail;
            if (detail?.blockId !== blockId || detail.key !== 'items') return;

            const nextItems = normalizeItems(detail.value, config.defaultItems);
            setItems((currentItems) => {
                if (detail.source === 'preview' && isStructuralItemsChange(currentItems, nextItems)) {
                    recordStructuralItemsChange(nextItems);
                }
                return nextItems;
            });
            if (detail.source === 'persisted') {
                structuralItemSnapshotsRef.current = [];
            }
            setExpandedRows((current) => {
                const next = new Set<number>();
                current.forEach((index) => {
                    if (index < nextItems.length) next.add(index);
                });
                return next;
            });
        };

        window.addEventListener(REPEATABLE_ITEMS_DRAFT_UPDATE_EVENT, handleCanvasDraftUpdate);
        return () => window.removeEventListener(REPEATABLE_ITEMS_DRAFT_UPDATE_EVENT, handleCanvasDraftUpdate);
    }, [blockId, config.defaultItems]);

    useEffect(() => {
        if (!onDraftBlockDataChange) return;
        onDraftBlockDataChange({
            ...(blockData || {}),
            items,
            ...(config.variants ? { variant } : {}),
            ...(supportsSeparator ? { separator } : {}),
            ...(hasTestimonialDisplayControls ? displaySettings : {}),
            ...(supportsPretext ? pretext : {}),
            backgroundColor,
            foregroundColor,
            sectionSettings,
            __customCss: localCss,
            __customScript: localScript,
        });
    }, [blockData, items, variant, separator, supportsSeparator, displaySettings, pretext, supportsPretext, backgroundColor, foregroundColor, sectionSettings, localCss, localScript, config.variants, hasTestimonialDisplayControls, onDraftBlockDataChange]);

    const backgroundFallback = getRepeatableBackgroundFallback(managedType, variant, config.backgroundFallback);
    const bgInputValue = getColorInputValue(backgroundColor, palette, backgroundFallback);
    const fgInputValue = getColorInputValue(foregroundColor, palette, '#0f172a');

    const updateSectionLayout = (patch: Partial<SectionSettings['layout']>) => {
        setSectionSettings((current) => ({
            layout: {
                ...normalizeSectionSettings(current).layout,
                ...patch,
            },
        }));
    };

    useEffect(() => {
        if (!context?.updateBlockDataBatch) return;
        const updates: Record<string, unknown> = {};
        const hasItemChanges = JSON.stringify(items) !== JSON.stringify(persistedItems);
        let lastCommittedItems = persistedItems;

        if (hasItemChanges && structuralItemSnapshotsRef.current.length > 0 && context?.updateBlockData) {
            for (const snapshot of structuralItemSnapshotsRef.current) {
                if (JSON.stringify(snapshot) === JSON.stringify(lastCommittedItems)) continue;
                context.updateBlockData(blockId, 'items', snapshot);
                lastCommittedItems = snapshot;
            }
            if (JSON.stringify(items) !== JSON.stringify(lastCommittedItems)) {
                updates.items = items;
            }
        } else if (hasItemChanges) {
            updates.items = items;
        }

        if (backgroundColor !== persistedBackgroundColor) updates.backgroundColor = backgroundColor;
        if (foregroundColor !== persistedForegroundColor) updates.foregroundColor = foregroundColor;
        if (!areSectionSettingsEqual(sectionSettings, persistedSectionSettings)) updates.sectionSettings = normalizeSectionSettings(sectionSettings);
        if (config.variants && variant !== persistedVariant) updates.variant = variant;
        if (supportsSeparator && separator !== persistedSeparator) updates.separator = separator;
        if (hasTestimonialDisplayControls) {
            for (const key of Object.keys(displaySettings) as Array<keyof TestimonialDisplaySettings>) {
                if (displaySettings[key] !== persistedDisplaySettings[key]) updates[key] = displaySettings[key];
            }
        }
        if (localCss !== customCss) updates.__customCss = localCss;
        if (localScript !== persistedScript) updates.__customScript = localScript;
        if (supportsPretext) {
            for (const key of ['pretextEnabled', 'pretextStyle', 'pretextColor', 'pretextAlignment'] as const) {
                if (pretext[key] !== persistedPretext[key]) updates[key] = pretext[key];
            }
        }
        if (Object.keys(updates).length > 0) {
            context.updateBlockDataBatch(blockId, updates);
        }
        structuralItemSnapshotsRef.current = [];
    }, [
        items,
        persistedItems,
        variant,
        persistedVariant,
        separator,
        persistedSeparator,
        displaySettings,
        persistedDisplaySettings,
        backgroundColor,
        persistedBackgroundColor,
        foregroundColor,
        persistedForegroundColor,
        sectionSettings,
        persistedSectionSettings,
        localCss,
        customCss,
        localScript,
        persistedScript,
        pretext,
        persistedPretext,
        supportsPretext,
        supportsSeparator,
        hasTestimonialDisplayControls,
        config.variants,
        blockId,
        context,
    ]);

    const toggleRow = (index: number) => {
        setExpandedRows((current) => {
            const next = new Set(current);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };

    const updateItem = (index: number, key: string, value: ItemValue) => {
        setItems((current) => current.map((item, i) => i === index ? { ...item, [key]: value } : item));
    };

    const addItem = () => {
        const nextItems = [...items, config.createItem(items)];
        setItems(nextItems);
        setExpandedRows(new Set([nextItems.length - 1]));
        recordStructuralItemsChange(nextItems);
    };

    const deleteItem = (index: number) => {
        if (items.length <= 1) return;
        const nextItems = items.filter((_, i) => i !== index);
        setItems(nextItems);
        setExpandedRows((expanded) => remapExpandedRowsAfterDelete(expanded, index));
        recordStructuralItemsChange(nextItems);
    };

    const reorderItem = (fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
        if (fromIndex >= items.length || toIndex >= items.length) return;
        const nextItems = [...items];
        const [moved] = nextItems.splice(fromIndex, 1);
        nextItems.splice(toIndex, 0, moved);
        setItems(nextItems);
        setExpandedRows((expanded) => remapExpandedRowsAfterMove(expanded, fromIndex, toIndex));
        recordStructuralItemsChange(nextItems);
    };

    return (
        <BlockSettingsPanel
            isOpen
            title={config.title}
            subtitle={config.subtitle}
            blockId={blockId}
            blockType={config.blockType}
            onClose={onClose}
            allCollapsed={sectionState.allCollapsed}
            onToggleAllCollapsed={() => sectionState.setAll(!sectionState.allCollapsed)}
            tourId={`${config.blockType}-settings-panel`}
        >
            <InspectorSection
                id="items"
                title={config.itemsTitle}
                isCollapsed={sectionState.isCollapsed('items')}
                onToggle={() => sectionState.toggle('items')}
            >
                <div className="space-y-2">
                    {items.length === 0 && (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
                            {config.emptyLabel}
                        </div>
                    )}
                    {items.map((item, index) => {
                        const expanded = expandedRows.has(index);
                        return (
                            <ItemSettingsRow
                                key={`${config.blockType}-${index}`}
                                item={item}
                                index={index}
                                config={config}
                                expanded={expanded}
                                canDelete={items.length > 1}
                                isDragOver={dragOverIndex === index && dragIndex !== index}
                                onToggle={() => toggleRow(index)}
                                onDelete={() => deleteItem(index)}
                                onUpdate={updateItem}
                                onDragStart={() => setDragIndex(index)}
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
                                onDragEnd={() => {
                                    setDragIndex(null);
                                    setDragOverIndex(null);
                                }}
                            />
                        );
                    })}
                    <button
                        type="button"
                        onClick={addItem}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm font-bold text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <Plus className="h-4 w-4" />
                        {config.addLabel}
                    </button>
                </div>
            </InspectorSection>

            <InspectorSection
                id="universal-layout"
                title="Layout"
                isCollapsed={sectionState.isCollapsed('universal-layout')}
                onToggle={() => sectionState.toggle('universal-layout')}
            >
                <LayoutTab
                    blockId={blockId}
                    blockType={config.blockType}
                    value={sectionSettings}
                    onChange={setSectionSettings}
                />
            </InspectorSection>

            {(config.variants || hasColumnLayoutControl) && (
                <InspectorSection
                    id="block-layout"
                    title="Block Layout"
                    isCollapsed={sectionState.isCollapsed('block-layout')}
                    onToggle={() => sectionState.toggle('block-layout')}
                >
                    <div className="space-y-5">
                        {config.variants && (
                            <div className="grid grid-cols-2 gap-2">
                                {config.variants.map((option) => {
                                    const active = variant === option.id;
                                    return (
                                        <button
                                            key={option.id}
                                            type="button"
                                            onClick={() => setVariant(option.id)}
                                            aria-pressed={active}
                                            className={`rounded-xl border px-3 py-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                                active
                                                    ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                                                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                            }`}
                                        >
                                            <span className="block text-sm font-bold">{option.label}</span>
                                            <span className="mt-1 block text-[11px] leading-snug text-slate-500">{option.description}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {hasColumnLayoutControl && (
                            <ResponsiveColumnsControl
                                value={sectionSettings.layout.columns}
                                onChange={(columns) => updateSectionLayout({ columns })}
                                maxColumns={items.length}
                            />
                        )}

                        {supportsSeparator && variant === 'banner' && (
                            <div>
                                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                                    Separator
                                </span>
                                <div className="grid grid-cols-3 gap-2">
                                    {STATS_SEPARATOR_OPTIONS.map((option) => {
                                        const active = separator === option.id;
                                        return (
                                            <button
                                                key={option.id}
                                                type="button"
                                                onClick={() => setSeparator(option.id)}
                                                aria-pressed={active}
                                                className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-3 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                                    active
                                                        ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                                                        : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                                }`}
                                            >
                                                <SeparatorPreview kind={option.id} active={active} />
                                                <span className="text-xs font-bold">{option.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </InspectorSection>
            )}

            {hasTestimonialDisplayControls && isTestimonialDisplaySectionVisible(variant) && (
                <InspectorSection
                    id="display"
                    title="Display"
                    isCollapsed={sectionState.isCollapsed('display')}
                    onToggle={() => sectionState.toggle('display')}
                >
                    <TestimonialDisplayControls
                        value={displaySettings}
                        variant={variant}
                        onChange={(updates) => setDisplaySettings((current) => ({ ...current, ...updates }))}
                    />
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
                        values={pretext}
                        palette={palette}
                        onChange={(key, value) => setPretext((current) => ({ ...current, [key]: value }))}
                    />
                </InspectorSection>
            )}

            <InspectorSection
                id="style"
                title="Style"
                isCollapsed={sectionState.isCollapsed('style')}
                onToggle={() => sectionState.toggle('style')}
            >
                <label
                    className="block text-xs font-bold uppercase tracking-wide text-slate-500"
                    htmlFor={`${blockId}-${config.blockType}-bg`}
                >
                    Section background color
                </label>
                <SideBySideBackgroundOverrideNotice />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                        id={`${blockId}-${config.blockType}-bg`}
                        type="color"
                        value={bgInputValue}
                        onChange={(event) => setBackgroundColor(event.target.value)}
                        className="h-10 w-10 cursor-pointer rounded border border-slate-200 bg-white"
                    />
                    <PaletteTokenButtons
                        selected={backgroundColor}
                        palette={palette}
                        onSelect={(token) => setBackgroundColor(token)}
                    />
                </div>
                <div className="mt-3 flex gap-2">
                    <input
                        type="text"
                        value={backgroundColor}
                        onChange={(event) => setBackgroundColor(event.target.value)}
                        placeholder={config.backgroundPlaceholder}
                        className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        type="button"
                        onClick={() => setBackgroundColor('')}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        Reset
                    </button>
                </div>

                <label
                    className="mt-5 block text-xs font-bold uppercase tracking-wide text-slate-500"
                    htmlFor={`${blockId}-${config.blockType}-fg`}
                >
                    Section text color
                </label>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                        id={`${blockId}-${config.blockType}-fg`}
                        type="color"
                        value={fgInputValue}
                        onChange={(event) => setForegroundColor(event.target.value)}
                        className="h-10 w-10 cursor-pointer rounded border border-slate-200 bg-white"
                    />
                    <PaletteTokenButtons
                        selected={foregroundColor}
                        palette={palette}
                        onSelect={(token) => setForegroundColor(token)}
                    />
                </div>
                <div className="mt-3 flex gap-2">
                    <input
                        type="text"
                        value={foregroundColor}
                        onChange={(event) => setForegroundColor(event.target.value)}
                        placeholder="Default"
                        className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        type="button"
                        onClick={() => setForegroundColor('')}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        Reset
                    </button>
                </div>
            </InspectorSection>

            <InspectorSection
                id="advanced"
                title="Advanced"
                isCollapsed={sectionState.isCollapsed('advanced')}
                onToggle={() => sectionState.toggle('advanced')}
            >
                {isProUser ? (
                    <div className="space-y-5">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor={`${blockId}-${config.blockType}-css`}>
                                Custom CSS
                            </label>
                            <textarea
                                id={`${blockId}-${config.blockType}-css`}
                                value={localCss}
                                onChange={(event) => setLocalCss(event.target.value)}
                                placeholder={config.cssPlaceholder}
                                className="mt-2 min-h-40 w-full resize-y rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-sm text-green-400 outline-none selection:bg-green-900 focus:ring-2 focus:ring-blue-500"
                                spellCheck={false}
                            />
                        </div>
                        <div className="border-t border-slate-200 pt-4">
                            <KeyframeEditor
                                blockId={blockId}
                                blockType={config.blockType}
                                value={localScript}
                                onChange={setLocalScript}
                                isProUser={isProUser}
                                fieldNames={inferFieldNames(blockData)}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800">
                        <div className="flex items-center gap-2 font-bold">
                            <Crown className="h-4 w-4" />
                            Custom CSS &amp; Keyframe scripting are Pro features
                        </div>
                    </div>
                )}
            </InspectorSection>
        </BlockSettingsPanel>
    );
}

function ItemSettingsRow({
    item,
    index,
    config,
    expanded,
    canDelete,
    isDragOver,
    onToggle,
    onDelete,
    onUpdate,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
}: {
    item: ManagedItem;
    index: number;
    config: ManagedBlockConfig;
    expanded: boolean;
    canDelete: boolean;
    isDragOver: boolean;
    onToggle: () => void;
    onDelete: () => void;
    onUpdate: (index: number, key: string, value: ItemValue) => void;
    onDragStart: () => void;
    onDragOver: React.DragEventHandler<HTMLDivElement>;
    onDrop: React.DragEventHandler<HTMLDivElement>;
    onDragEnd: () => void;
}) {
    return (
        <div
            className={`rounded-xl border bg-white transition-colors ${
                isDragOver ? 'border-blue-400 bg-blue-50/50' : 'border-slate-200'
            }`}
            onDragOver={onDragOver}
            onDrop={onDrop}
        >
            <div className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                    <span
                        draggable
                        onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = 'move';
                            onDragStart();
                        }}
                        onDragEnd={onDragEnd}
                        className="cursor-grab rounded p-1 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700 active:cursor-grabbing"
                        title={`Drag to reorder ${config.itemLabel.toLowerCase()}`}
                        aria-label={`Drag to reorder ${config.itemLabel.toLowerCase()}`}
                    >
                        <GripVertical className="h-4 w-4" />
                    </span>
                    <button
                        type="button"
                        onClick={onToggle}
                        className="flex min-w-0 items-center gap-3 rounded-lg px-1 py-1 text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
                        aria-expanded={expanded}
                    >
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500">
                            {index + 1}
                        </span>
                        <span className="min-w-0">
                            <span className="block truncate text-sm font-bold text-slate-800">{config.rowTitle(item, index)}</span>
                            <span className="block truncate text-xs text-slate-500">{config.rowMeta(item, index)}</span>
                        </span>
                    </button>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <button
                        type="button"
                        onClick={onToggle}
                        className="rounded-md border border-slate-200 p-1.5 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        title={expanded ? `Collapse ${config.itemLabel.toLowerCase()}` : `Expand ${config.itemLabel.toLowerCase()}`}
                        aria-expanded={expanded}
                    >
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                    <div className="flex overflow-hidden rounded-md border border-slate-200">
                        <button
                            type="button"
                            onClick={onDelete}
                            disabled={!canDelete}
                            className="p-1.5 text-red-500 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                            title={`Delete ${config.itemLabel.toLowerCase()}`}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            </div>

            {expanded && (
                <div className="space-y-3 border-t border-slate-100 px-3 py-3">
                    {config.fields.map((field) => (
                        <FieldEditor
                            key={field.key}
                            field={field}
                            value={item[field.key] ?? ''}
                            onChange={(value) => onUpdate(index, field.key, value)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function FieldEditor({
    field,
    value,
    onChange,
}: {
    field: FieldConfig;
    value: ItemValue | '';
    onChange: (value: ItemValue) => void;
}) {
    if (field.type === 'tags') {
        const tags = Array.isArray(value) ? value.map((tag) => String(tag)) : [];
        return (
            <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{field.label}</span>
                <TagsFieldEditor tags={tags} placeholder={field.placeholder} onChange={onChange} />
            </label>
        );
    }
    return (
        <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{field.label}</span>
            {field.type === 'textarea' ? (
                <textarea
                    value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={field.placeholder}
                    rows={4}
                    className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
            ) : (
                <input
                    type={field.type}
                    value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
                    min={field.min}
                    max={field.max}
                    onChange={(event) => {
                        if (field.type === 'number') {
                            const parsed = parseInt(event.target.value, 10);
                            onChange(Number.isFinite(parsed) ? parsed : '');
                            return;
                        }
                        onChange(event.target.value);
                    }}
                    placeholder={field.placeholder}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
            )}
        </label>
    );
}

function TagsFieldEditor({
    tags,
    placeholder,
    onChange,
}: {
    tags: string[];
    placeholder?: string;
    onChange: (next: string[]) => void;
}) {
    const [draft, setDraft] = useState('');

    const commitDraft = () => {
        const trimmed = draft.trim();
        if (!trimmed) return;
        onChange([...tags, trimmed]);
        setDraft('');
    };

    const removeAt = (index: number) => {
        onChange(tags.filter((_, i) => i !== index));
    };

    const updateAt = (index: number, value: string) => {
        onChange(tags.map((tag, i) => (i === index ? value : tag)));
    };

    return (
        <div className="rounded-lg border border-slate-200 bg-white p-2">
            <div className="flex flex-wrap gap-1.5">
                {tags.map((tag, index) => (
                    <span
                        key={index}
                        className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700"
                    >
                        <input
                            type="text"
                            value={tag}
                            onChange={(event) => updateAt(index, event.target.value)}
                            className="bg-transparent border-none outline-none text-xs font-semibold"
                            style={{ width: `${Math.max(2, tag.length)}ch` }}
                            aria-label={`Edit tag ${index + 1}`}
                        />
                        <button
                            type="button"
                            onClick={() => removeAt(index)}
                            className="rounded-full p-0.5 text-blue-700/70 hover:bg-blue-100 hover:text-blue-800"
                            aria-label={`Remove tag ${tag}`}
                            title="Remove tag"
                        >
                            <Trash2 className="h-3 w-3" />
                        </button>
                    </span>
                ))}
                <input
                    type="text"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ',') {
                            event.preventDefault();
                            commitDraft();
                        } else if (event.key === 'Backspace' && draft === '' && tags.length > 0) {
                            event.preventDefault();
                            removeAt(tags.length - 1);
                        }
                    }}
                    onBlur={commitDraft}
                    placeholder={tags.length === 0 ? placeholder || 'Add tag…' : 'Add tag…'}
                    className="min-w-[8ch] flex-1 border-none px-1 py-1 text-xs outline-none focus:ring-0"
                />
            </div>
        </div>
    );
}

function TestimonialDisplayControls({
    value,
    variant,
    onChange,
}: {
    value: TestimonialDisplaySettings;
    variant: string;
    onChange: (updates: Partial<TestimonialDisplaySettings>) => void;
}) {
    const isCardLayout = variant === 'cards';
    const isScrollLayout = variant === 'scroll';

    return (
        <div className="space-y-4">
            {isCardLayout && (
                <>
                    <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2">
                        <span>
                            <span className="block text-sm font-bold text-slate-800">Limit visible cards</span>
                            <span className="block text-xs text-slate-500">Adds a show-more flow on card layouts.</span>
                        </span>
                        <input
                            type="checkbox"
                            checked={value.showMoreEnabled}
                            onChange={(event) => onChange({ showMoreEnabled: event.target.checked })}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                    </label>

                    {value.showMoreEnabled && (
                        <label className="block">
                            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Visible card count</span>
                            <input
                                type="number"
                                min={1}
                                max={12}
                                value={value.visibleCount}
                                onChange={(event) => onChange({ visibleCount: clampNumber(event.target.value, 3, 1, 12) })}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </label>
                    )}
                </>
            )}

            {isScrollLayout && (
                <>
                    <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2">
                        <span>
                            <span className="block text-sm font-bold text-slate-800">Autoplay scroll layout</span>
                            <span className="block text-xs text-slate-500">Moves horizontal testimonial rows automatically.</span>
                        </span>
                        <input
                            type="checkbox"
                            checked={value.autoScroll}
                            onChange={(event) => onChange({ autoScroll: event.target.checked })}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                    </label>

                    {value.autoScroll && (
                        <>
                            <label className="block">
                                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Autoplay interval seconds</span>
                                <input
                                    type="number"
                                    min={2}
                                    max={15}
                                    value={value.interval}
                                    onChange={(event) => onChange({ interval: clampNumber(event.target.value, 5, 2, 15) })}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </label>

                            <div className="grid grid-cols-1 gap-2">
                                <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2">
                                    <span className="text-sm font-bold text-slate-800">Infinite marquee</span>
                                    <input
                                        type="checkbox"
                                        checked={value.infiniteScroll}
                                        onChange={(event) => onChange({ infiniteScroll: event.target.checked })}
                                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                </label>

                                {!value.infiniteScroll && (
                                    <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2">
                                        <span className="text-sm font-bold text-slate-800">Loop carousel controls</span>
                                        <input
                                            type="checkbox"
                                            checked={value.loopScroll}
                                            onChange={(event) => onChange({ loopScroll: event.target.checked })}
                                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        />
                                    </label>
                                )}
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
}

function isTestimonialDisplaySectionVisible(variant: string): boolean {
    return variant === 'cards' || variant === 'scroll';
}

function normalizeItems(value: unknown, defaults: ManagedItem[]): ManagedItem[] {
    if (Array.isArray(value) && value.length > 0) {
        return cloneItems(value as ManagedItem[]);
    }
    return cloneItems(defaults);
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
    const parsed = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

function cloneItems(items: ManagedItem[]): ManagedItem[] {
    return items.map((item) => {
        const clone: ManagedItem = {};
        for (const [key, value] of Object.entries(item)) {
            clone[key] = Array.isArray(value) ? [...value] : value;
        }
        return clone;
    });
}

function isStructuralItemsChange(currentItems: ManagedItem[], nextItems: ManagedItem[]): boolean {
    return currentItems.length !== nextItems.length;
}

function nextNumber(items: ManagedItem[], field: string, pattern: RegExp, fallback = 1): number {
    let max = 0;
    for (const item of items) {
        const match = String(item[field] || '').match(pattern);
        if (!match) continue;
        const value = parseInt(match[1], 10);
        if (Number.isFinite(value)) max = Math.max(max, value);
    }
    return max > 0 ? max + 1 : fallback;
}

function remapExpandedRowsAfterDelete(expanded: Set<number>, deletedIndex: number): Set<number> {
    const next = new Set<number>();
    expanded.forEach((index) => {
        if (index === deletedIndex) return;
        next.add(index > deletedIndex ? index - 1 : index);
    });
    return next;
}

function remapExpandedRowsAfterMove(expanded: Set<number>, fromIndex: number, toIndex: number): Set<number> {
    const next = new Set<number>();
    expanded.forEach((index) => {
        if (index === fromIndex) {
            next.add(toIndex);
        } else if (fromIndex < toIndex && index > fromIndex && index <= toIndex) {
            next.add(index - 1);
        } else if (fromIndex > toIndex && index >= toIndex && index < fromIndex) {
            next.add(index + 1);
        } else {
            next.add(index);
        }
    });
    return next;
}

function isManagedBlockType(value: string): value is ManagedBlockType {
    return value === 'servicesGrid' || value === 'stats' || value === 'testimonials' || value === 'faq' || value === 'timeline';
}

function getRepeatableBackgroundFallback(
    managedType: ManagedBlockType,
    variant: string,
    configuredFallback: string,
): string {
    if (managedType === 'stats' && (variant || 'banner') === 'banner') return 'palette:primary';
    if (managedType === 'testimonials' && (variant || 'cards') === 'single') return 'palette:accent';
    return configuredFallback;
}
