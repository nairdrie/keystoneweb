'use client';

import { useEffect, useMemo, useState } from 'react';
import { Crown, LayoutGrid, Rows, Columns, ListOrdered } from 'lucide-react';
import { useEditorContext } from '@/lib/editor-context';
import BlockSettingsPanel from '../BlockSettingsPanel';
import {
    InspectorSection,
    InspectorToggle,
    PaletteTokenButtons,
    SideBySideBackgroundOverrideNotice,
    getColorInputValue,
    useInspectorSectionState,
} from '../panel-shared';
import { LayoutTab, ResponsiveColumnsControl } from '../layout/LayoutTab';
import type { BlockPanelProps } from '../block-panel-registry';
import {
    areSectionSettingsEqual,
    normalizeSectionSettings,
    type SectionSettings,
} from '@/lib/builder/layout-settings';

const SECTION_IDS = ['content', 'universal-layout', 'block-layout', 'style', 'advanced'];

const VARIANTS = [
    { id: 'grid', label: 'Grid', Icon: LayoutGrid, description: 'Multi-column responsive grid.' },
    { id: 'row', label: 'Scrolling Row', Icon: Rows, description: 'Horizontal carousel of cards.' },
    { id: 'gridWithSidebar', label: 'Grid + Sidebar', Icon: Columns, description: 'Category sidebar + grid.' },
    { id: 'list', label: 'List', Icon: ListOrdered, description: 'Stacked list rows.' },
] as const;

type VariantId = typeof VARIANTS[number]['id'];

export default function ProductSettingsPanel({
    blockId,
    blockData,
    palette,
    isProUser,
    customCss,
    onClose,
    onDraftBlockDataChange,
}: BlockPanelProps) {
    const context = useEditorContext();
    const persistedSectionSettings = useMemo(
        () => normalizeSectionSettings(blockData?.sectionSettings),
        [blockData?.sectionSettings],
    );

    const [variant, setVariant] = useState<VariantId>((blockData?.variant as VariantId) || 'grid');
    const [categoryFilter, setCategoryFilter] = useState<string>(blockData?.categoryFilter || '');
    const [subcategoryFilter, setSubcategoryFilter] = useState<string>(blockData?.subcategoryFilter || '');
    const [featuredOnly, setFeaturedOnly] = useState<boolean>(!!blockData?.featuredOnly);
    // Backward-compat: existing featured blocks didn't have this field but
    // always rendered a title — default to featuredOnly when unset.
    const [showTitle, setShowTitle] = useState<boolean>(
        typeof blockData?.showTitle === 'boolean' ? blockData.showTitle : !!blockData?.featuredOnly,
    );
    const [showSeeMore, setShowSeeMore] = useState<boolean>(!!blockData?.showSeeMore);
    const [bgColor, setBgColor] = useState<string>(blockData?.backgroundColor || '');
    const [autoScroll, setAutoScroll] = useState<boolean>(blockData?.autoScroll !== false);
    const [autoScrollIntervalSec, setAutoScrollIntervalSec] = useState<number>(
        typeof blockData?.autoScrollIntervalSec === 'number' ? blockData.autoScrollIntervalSec : 5,
    );
    const [autoScrollPauseOnHover, setAutoScrollPauseOnHover] = useState<boolean>(blockData?.autoScrollPauseOnHover !== false);
    const [sectionSettings, setSectionSettings] = useState<SectionSettings>(persistedSectionSettings);
    const [localCss, setLocalCss] = useState<string>(customCss);

    const [categoryTree, setCategoryTree] = useState<Record<string, string[]>>({});

    const sectionState = useInspectorSectionState(SECTION_IDS, true);

    const siteId = context?.siteId || '';

    useEffect(() => {
        if (!siteId) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`/api/products?siteId=${siteId}&limit=1`);
                if (!res.ok) return;
                const d = await res.json();
                if (!cancelled) setCategoryTree(d.categoryTree || {});
            } catch {
                /* ignore */
            }
        })();
        return () => { cancelled = true; };
    }, [siteId]);

    // Forward draft to canvas for live preview
    useEffect(() => {
        if (!onDraftBlockDataChange) return;
        onDraftBlockDataChange({
            ...(blockData || {}),
            variant,
            categoryFilter,
            subcategoryFilter,
            featuredOnly,
            showTitle,
            showSeeMore,
            backgroundColor: bgColor,
            autoScroll,
            autoScrollIntervalSec,
            autoScrollPauseOnHover,
            sectionSettings,
            __customCss: localCss,
        });
    }, [
        blockData,
        variant,
        categoryFilter,
        subcategoryFilter,
        featuredOnly,
        showTitle,
        showSeeMore,
        bgColor,
        autoScroll,
        autoScrollIntervalSec,
        autoScrollPauseOnHover,
        sectionSettings,
        localCss,
        onDraftBlockDataChange,
    ]);

    const categories = useMemo(() => Object.keys(categoryTree).sort(), [categoryTree]);
    const subcategories = categoryFilter ? (categoryTree[categoryFilter] || []) : [];

    const bgInputValue = getColorInputValue(bgColor, palette, '#ffffff');

    const persistedShowTitle = typeof blockData?.showTitle === 'boolean' ? blockData.showTitle : !!blockData?.featuredOnly;
    const hasUnsavedChanges = useMemo(() => (
        variant !== ((blockData?.variant as VariantId) || 'grid') ||
        categoryFilter !== (blockData?.categoryFilter || '') ||
        subcategoryFilter !== (blockData?.subcategoryFilter || '') ||
        featuredOnly !== !!blockData?.featuredOnly ||
        showTitle !== persistedShowTitle ||
        showSeeMore !== !!blockData?.showSeeMore ||
        bgColor !== (blockData?.backgroundColor || '') ||
        autoScroll !== (blockData?.autoScroll !== false) ||
        autoScrollIntervalSec !== (typeof blockData?.autoScrollIntervalSec === 'number' ? blockData.autoScrollIntervalSec : 5) ||
        autoScrollPauseOnHover !== (blockData?.autoScrollPauseOnHover !== false) ||
        !areSectionSettingsEqual(sectionSettings, persistedSectionSettings) ||
        localCss !== customCss
    ), [
        blockData,
        variant,
        categoryFilter,
        subcategoryFilter,
        featuredOnly,
        showTitle,
        persistedShowTitle,
        showSeeMore,
        bgColor,
        autoScroll,
        autoScrollIntervalSec,
        autoScrollPauseOnHover,
        sectionSettings,
        persistedSectionSettings,
        localCss,
        customCss,
    ]);

    const updateSectionLayout = (patch: Partial<SectionSettings['layout']>) => {
        setSectionSettings((current) => ({
            layout: {
                ...normalizeSectionSettings(current).layout,
                ...patch,
            },
        }));
    };

    const handleSave = () => {
        const updates: Record<string, unknown> = {
            variant,
            categoryFilter,
            subcategoryFilter,
            featuredOnly,
            showTitle,
            showSeeMore,
            backgroundColor: bgColor,
            autoScroll,
            autoScrollIntervalSec,
            autoScrollPauseOnHover,
        };
        if (!areSectionSettingsEqual(sectionSettings, persistedSectionSettings)) updates.sectionSettings = normalizeSectionSettings(sectionSettings);
        if (localCss !== customCss) updates['__customCss'] = localCss;
        if (context?.updateBlockDataBatch) {
            context.updateBlockDataBatch(blockId, updates);
        }
        onClose();
    };

    const handleReset = () => {
        setVariant((blockData?.variant as VariantId) || 'grid');
        setCategoryFilter(blockData?.categoryFilter || '');
        setSubcategoryFilter(blockData?.subcategoryFilter || '');
        setFeaturedOnly(!!blockData?.featuredOnly);
        setShowTitle(persistedShowTitle);
        setShowSeeMore(!!blockData?.showSeeMore);
        setBgColor(blockData?.backgroundColor || '');
        setAutoScroll(blockData?.autoScroll !== false);
        setAutoScrollIntervalSec(typeof blockData?.autoScrollIntervalSec === 'number' ? blockData.autoScrollIntervalSec : 5);
        setAutoScrollPauseOnHover(blockData?.autoScrollPauseOnHover !== false);
        setSectionSettings(persistedSectionSettings);
        setLocalCss(customCss);
        sectionState.reset();
    };

    return (
        <BlockSettingsPanel
            isOpen
            title="Product Catalog Settings"
            subtitle="Filter, lay out, and style the product block."
            blockId={blockId}
            blockType="productGrid"
            hasUnsavedChanges={hasUnsavedChanges}
            onClose={onClose}
            onSave={handleSave}
            onReset={handleReset}
            allCollapsed={sectionState.allCollapsed}
            onToggleAllCollapsed={() => sectionState.setAll(!sectionState.allCollapsed)}
            tourId="product-settings-panel"
        >
            {/* CONTENT */}
            <InspectorSection
                id="content"
                title="Content"
                isCollapsed={sectionState.isCollapsed('content')}
                onToggle={() => sectionState.toggle('content')}
            >
                <div className="space-y-4">
                    <div>
                        <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                            Show category
                        </label>
                        <select
                            value={categoryFilter}
                            onChange={(e) => {
                                setCategoryFilter(e.target.value);
                                if (subcategoryFilter) setSubcategoryFilter('');
                            }}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">All categories</option>
                            {categories.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    {categoryFilter && subcategories.length > 0 && (
                        <div>
                            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                                Show subcategory
                            </label>
                            <select
                                value={subcategoryFilter}
                                onChange={(e) => setSubcategoryFilter(e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">All {categoryFilter}</option>
                                {subcategories.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <InspectorToggle
                        label="Featured products only"
                        description="Only show products flagged as featured."
                        checked={featuredOnly}
                        onChange={() => setFeaturedOnly(!featuredOnly)}
                    />

                    <InspectorToggle
                        label="Show title"
                        description="Edit the title text and style directly on the canvas."
                        checked={showTitle}
                        onChange={() => setShowTitle(!showTitle)}
                    />

                    <InspectorToggle
                        label='Show "view more" button'
                        description="Edit the button label, link, and style directly on the canvas."
                        checked={showSeeMore}
                        onChange={() => setShowSeeMore(!showSeeMore)}
                    />
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
                    blockType="productGrid"
                    value={sectionSettings}
                    onChange={setSectionSettings}
                />
            </InspectorSection>

            {/* LAYOUT */}
            <InspectorSection
                id="block-layout"
                title="Block Layout"
                isCollapsed={sectionState.isCollapsed('block-layout')}
                onToggle={() => sectionState.toggle('block-layout')}
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                        {VARIANTS.map(({ id, label, Icon, description }) => {
                            const isActive = variant === id;
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => setVariant(id)}
                                    aria-pressed={isActive}
                                    className={`flex flex-col items-start gap-1 rounded-xl border px-3 py-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                        isActive
                                            ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                                            : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                    }`}
                                    title={description}
                                >
                                    <Icon className="h-4 w-4" />
                                    <span className="text-sm font-bold">{label}</span>
                                    <span className="text-[11px] leading-snug text-slate-500">{description}</span>
                                </button>
                            );
                        })}
                    </div>

                    <ResponsiveColumnsControl
                        value={sectionSettings.layout.columns}
                        onChange={(columns) => updateSectionLayout({ columns })}
                    />

                    {variant === 'row' && (
                        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Carousel</p>
                            <InspectorToggle
                                label="Auto-scroll"
                                description="Smoothly advance product-by-product."
                                checked={autoScroll}
                                onChange={() => setAutoScroll(!autoScroll)}
                            />
                            {autoScroll && (
                                <>
                                    <div>
                                        <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                                            Interval: {autoScrollIntervalSec}s
                                        </label>
                                        <input
                                            type="range"
                                            min={2}
                                            max={15}
                                            value={autoScrollIntervalSec}
                                            onChange={(e) => setAutoScrollIntervalSec(parseInt(e.target.value) || 5)}
                                            className="w-full accent-blue-600"
                                        />
                                    </div>
                                    <InspectorToggle
                                        label="Pause on hover"
                                        checked={autoScrollPauseOnHover}
                                        onChange={() => setAutoScrollPauseOnHover(!autoScrollPauseOnHover)}
                                    />
                                </>
                            )}
                        </div>
                    )}
                </div>
            </InspectorSection>

            {/* STYLE */}
            <InspectorSection
                id="style"
                title="Style"
                isCollapsed={sectionState.isCollapsed('style')}
                onToggle={() => sectionState.toggle('style')}
            >
                <label
                    className="block text-xs font-bold uppercase tracking-wide text-slate-500"
                    htmlFor={`${blockId}-product-bg`}
                >
                    Section background color
                </label>
                <SideBySideBackgroundOverrideNotice />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                        id={`${blockId}-product-bg`}
                        type="color"
                        value={bgInputValue}
                        onChange={(e) => setBgColor(e.target.value)}
                        className="h-10 w-10 cursor-pointer rounded border border-slate-200 bg-white"
                    />
                    <PaletteTokenButtons
                        selected={bgColor}
                        palette={palette}
                        onSelect={(token) => setBgColor(token)}
                    />
                </div>
                <div className="mt-3 flex gap-2">
                    <input
                        type="text"
                        value={bgColor}
                        onChange={(e) => setBgColor(e.target.value)}
                        placeholder="Default (white)"
                        className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        type="button"
                        onClick={() => setBgColor('')}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        Reset
                    </button>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                    Choose a palette token (P/S/A) or pick a custom color. Defaults to white.
                </p>
            </InspectorSection>

            {/* ADVANCED */}
            <InspectorSection
                id="advanced"
                title="Advanced"
                isCollapsed={sectionState.isCollapsed('advanced')}
                onToggle={() => sectionState.toggle('advanced')}
            >
                {isProUser ? (
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor={`${blockId}-product-css`}>
                            Custom CSS
                        </label>
                        <textarea
                            id={`${blockId}-product-css`}
                            value={localCss}
                            onChange={(e) => setLocalCss(e.target.value)}
                            placeholder={`/* Scoped to this Products block */\n.product-card {\n  border-radius: 1rem;\n}`}
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
