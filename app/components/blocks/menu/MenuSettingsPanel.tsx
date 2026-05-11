'use client';

import { useEffect, useMemo, useState } from 'react';
import { Crown } from 'lucide-react';
import { useEditorContext } from '@/lib/editor-context';
import BlockSettingsPanel from '../BlockSettingsPanel';
import KeyframeEditor, { inferFieldNames } from '../KeyframeEditor';
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

const MENU_VARIANTS = [
    { id: 'list', label: 'Classic List' },
    { id: 'grid', label: 'Item Grid' },
    { id: 'cards', label: 'Detail Cards' },
    { id: 'compact', label: 'Compact / Dense' },
];

const SECTION_IDS = [
    'content-source',
    'universal-layout',
    'block-layout',
    'preview',
    'display',
    'menu-icons',
    'item-detail-popup',
    'category-style',
    'style',
    'advanced',
];

interface MenuSectionSourceItem {
    menu_section?: string | null;
    menu_section_order?: number | null;
    is_available?: boolean;
}

interface MenuIconOptionSource {
    id: string;
    label: string;
    icon?: string | null;
    sort_order?: number | null;
}

const DEFAULT_MENU_ICON_OPTIONS: MenuIconOptionSource[] = [
    { id: 'gluten_free', label: 'Gluten-free', sort_order: 0 },
    { id: 'vegetarian', label: 'Vegetarian', sort_order: 1 },
    { id: 'vegan', label: 'Vegan', sort_order: 2 },
    { id: 'spicy', label: 'Spicy', sort_order: 3 },
];

function normalizeMenuIconLegendIds(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(
        value
            .filter((id): id is string => typeof id === 'string')
            .map(id => id.trim())
            .filter(Boolean),
    ));
}

function getCombinedMenuIconOptions(customOptions: MenuIconOptionSource[]): MenuIconOptionSource[] {
    const seen = new Set<string>();
    return [...DEFAULT_MENU_ICON_OPTIONS, ...customOptions]
        .filter(option => {
            if (!option.id || seen.has(option.id)) return false;
            seen.add(option.id);
            return true;
        })
        .sort((a, b) => {
            const orderDiff = (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER);
            if (orderDiff !== 0) return orderDiff;
            return a.label.localeCompare(b.label);
        });
}

function areStringArraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const aSet = new Set(a);
    return b.every(value => aSet.has(value));
}

function extractMenuSectionNames(items: MenuSectionSourceItem[]): string[] {
    const sections = new Map<string, number>();

    items.forEach((item, index) => {
        const section = typeof item?.menu_section === 'string' && item.menu_section.trim()
            ? item.menu_section.trim()
            : 'Main Menu';
        const explicitOrder = typeof item?.menu_section_order === 'number' && Number.isFinite(item.menu_section_order)
            ? item.menu_section_order
            : getDefaultMenuSectionOrder(section, index);
        const currentOrder = sections.get(section);

        if (currentOrder === undefined || explicitOrder < currentOrder) {
            sections.set(section, explicitOrder);
        }
    });

    return Array.from(sections.entries())
        .sort(([a, aOrder], [b, bOrder]) => {
            const orderDiff = aOrder - bOrder;
            if (orderDiff !== 0) return orderDiff;
            return a.localeCompare(b);
        })
        .map(([section]) => section);
}

function getDefaultMenuSectionOrder(section: string, index: number) {
    const orders: Record<string, number> = {
        breakfast: 0,
        brunch: 1,
        lunch: 2,
        dinner: 3,
        drinks: 4,
        desserts: 5,
    };

    return orders[section.trim().toLowerCase()] ?? 1000 + index;
}

function MenuLayoutThumbnail({ variant, active }: { variant: string; active: boolean }) {
    const color = active ? 'bg-blue-600' : 'bg-slate-400';
    const pale = active ? 'bg-blue-200' : 'bg-slate-200';

    if (variant === 'grid') {
        return (
            <span className="grid h-12 grid-cols-2 gap-1 rounded-lg bg-white p-1.5">
                {[0, 1, 2, 3].map((i) => <span key={i} className={`rounded ${pale}`} />)}
            </span>
        );
    }

    if (variant === 'cards') {
        return (
            <span className="flex h-12 flex-col gap-1 rounded-lg bg-white p-1.5">
                {[0, 1].map((i) => (
                    <span key={i} className="flex flex-1 gap-1">
                        <span className={`w-8 rounded ${pale}`} />
                        <span className="flex flex-1 flex-col justify-center gap-1">
                            <span className={`h-1.5 rounded ${color}`} />
                            <span className={`h-1 rounded ${pale}`} />
                        </span>
                    </span>
                ))}
            </span>
        );
    }

    if (variant === 'compact') {
        return (
            <span className="flex h-12 flex-col justify-center gap-1 rounded-lg bg-white p-1.5">
                {[0, 1, 2, 3].map((i) => <span key={i} className={`h-1.5 rounded ${i === 0 ? color : pale}`} />)}
            </span>
        );
    }

    return (
        <span className="flex h-12 flex-col justify-center gap-2 rounded-lg bg-white p-1.5">
            {[0, 1, 2].map((i) => (
                <span key={i} className="flex items-center gap-2">
                    <span className={`h-2 flex-1 rounded ${i === 0 ? color : pale}`} />
                    <span className={`h-2 w-8 rounded ${pale}`} />
                </span>
            ))}
        </span>
    );
}

export default function MenuSettingsPanel({
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
    const fallbackMenuItems = useMemo<MenuSectionSourceItem[]>(
        () => Array.isArray(blockData?.fallbackItems) ? blockData.fallbackItems as MenuSectionSourceItem[] : [],
        [blockData],
    );
    const fallbackMenuSections = useMemo(
        () => extractMenuSectionNames(fallbackMenuItems),
        [fallbackMenuItems],
    );

    // Local CSS draft (mirrors prior behavior — committed via batch)
    const [localCss, setLocalCss] = useState(customCss);
    const persistedScript = typeof blockData?.__customScript === 'string' ? blockData.__customScript : '';
    const [localScript, setLocalScript] = useState<string>(persistedScript);

    const [menuModeDraft, setMenuModeDraft] = useState<string>(blockData?.mode || 'items');
    const [menuVariantDraft, setMenuVariantDraft] = useState<string>(blockData?.variant || 'list');
    const [menuShowPrices, setMenuShowPrices] = useState<boolean>(blockData?.showPrices !== false);
    const [menuShowDescriptions, setMenuShowDescriptions] = useState<boolean>(blockData?.showDescriptions !== false);
    const [menuShowImages, setMenuShowImages] = useState<boolean>(blockData?.showImages === true);
    const [menuShowFeaturedImages, setMenuShowFeaturedImages] = useState<boolean>(blockData?.showFeaturedImages !== false);
    const [menuShowTabs, setMenuShowTabs] = useState<boolean>(blockData?.showMenuTabs !== false);
    const [menuShowIcons, setMenuShowIcons] = useState<boolean>(blockData?.showMenuIcons !== false);
    const [menuShowIconLegend, setMenuShowIconLegend] = useState<boolean>(blockData?.showMenuIconLegend === true);
    const [menuIconLegendPosition, setMenuIconLegendPosition] = useState<string>(blockData?.menuIconLegendPosition || 'bottom');
    const [menuIconLegendMode, setMenuIconLegendMode] = useState<string>(blockData?.menuIconLegendMode || 'all');
    const [menuIconLegendIds, setMenuIconLegendIds] = useState<string[]>(normalizeMenuIconLegendIds(blockData?.menuIconLegendIds));
    const [menuCategoryStyle, setMenuCategoryStyle] = useState<string>(blockData?.categoryStyle || 'heading');
    const [menuBgColor, setMenuBgColor] = useState<string>(blockData?.backgroundColor || '');
    const [menuItemDetailEnabled, setMenuItemDetailEnabled] = useState<boolean>(blockData?.itemDetailEnabled === true);
    const [menuItemDetailShowPhoto, setMenuItemDetailShowPhoto] = useState<boolean>(blockData?.itemDetailShowPhoto !== false);
    const [menuItemDetailPhotoVisibility, setMenuItemDetailPhotoVisibility] = useState<string>(blockData?.itemDetailPhotoVisibility || 'always');
    const [menuItemDetailShowName, setMenuItemDetailShowName] = useState<boolean>(blockData?.itemDetailShowName !== false);
    const [menuItemDetailShowDescription, setMenuItemDetailShowDescription] = useState<boolean>(blockData?.itemDetailShowDescription !== false);
    const [menuItemDetailShowPrice, setMenuItemDetailShowPrice] = useState<boolean>(blockData?.itemDetailShowPrice !== false);
    const [menuItemDetailShowCategory, setMenuItemDetailShowCategory] = useState<boolean>(blockData?.itemDetailShowCategory === true);
    const [menuItemDetailShowIcons, setMenuItemDetailShowIcons] = useState<boolean>(blockData?.itemDetailShowIcons === true);
    const [menuItemDetailImageFit, setMenuItemDetailImageFit] = useState<string>(blockData?.itemDetailImageFit || 'contain');
    const [menuItemDetailCaptionBg, setMenuItemDetailCaptionBg] = useState<string>(blockData?.itemDetailCaptionBg || '#0f172a');
    const [menuItemDetailTextColor, setMenuItemDetailTextColor] = useState<string>(blockData?.itemDetailTextColor || '#ffffff');
    const [sectionSettings, setSectionSettings] = useState<SectionSettings>(persistedSectionSettings);
    const [menuPreviewSection, setMenuPreviewSection] = useState<string>('');
    const [menuSections, setMenuSections] = useState<string[]>(fallbackMenuSections);
    const [menuIconOptions, setMenuIconOptions] = useState<MenuIconOptionSource[]>(DEFAULT_MENU_ICON_OPTIONS);

    const sectionState = useInspectorSectionState(SECTION_IDS, true);
    const visibleMenuSections = context?.siteId ? menuSections : fallbackMenuSections;
    const visibleMenuIconOptions = context?.siteId ? menuIconOptions : DEFAULT_MENU_ICON_OPTIONS;

    const menuBackgroundFallback = menuModeDraft === 'pdf' ? 'palette:accent' : '#ffffff';
    const menuBgColorInputValue = getColorInputValue(menuBgColor, palette, menuBackgroundFallback);
    const menuItemDetailCaptionBgInputValue = getColorInputValue(menuItemDetailCaptionBg, palette, '#0f172a');
    const menuItemDetailTextColorInputValue = getColorInputValue(menuItemDetailTextColor, palette, '#ffffff');

    // Load menu sections + icon options
    useEffect(() => {
        let isMounted = true;

        if (!context?.siteId) {
            return () => {
                isMounted = false;
            };
        }

        fetch(`/api/menu?siteId=${context.siteId}`)
            .then((res) => res.ok ? res.json() : { items: [] })
            .then((data: { items?: MenuSectionSourceItem[]; iconOptions?: MenuIconOptionSource[] }) => {
                if (!isMounted) return;
                const availableItems = Array.isArray(data.items)
                    ? data.items.filter((item) => item?.is_available !== false)
                    : [];
                setMenuSections(extractMenuSectionNames(availableItems.length > 0 ? availableItems : fallbackMenuItems));
                setMenuIconOptions(getCombinedMenuIconOptions(Array.isArray(data.iconOptions) ? data.iconOptions : []));
            })
            .catch(() => {
                if (isMounted) {
                    setMenuSections(extractMenuSectionNames(fallbackMenuItems));
                    setMenuIconOptions(DEFAULT_MENU_ICON_OPTIONS);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [context?.siteId, fallbackMenuItems]);

    // Forward draft to canvas for live preview
    useEffect(() => {
        if (!onDraftBlockDataChange) return;
        onDraftBlockDataChange({
            ...(blockData || {}),
            mode: menuModeDraft,
            variant: menuVariantDraft,
            showPrices: menuShowPrices,
            showDescriptions: menuShowDescriptions,
            showImages: menuShowImages,
            showFeaturedImages: menuShowFeaturedImages,
            showMenuTabs: menuShowTabs,
            showMenuIcons: menuShowIcons,
            showMenuIconLegend: menuShowIconLegend,
            menuIconLegendPosition,
            menuIconLegendMode,
            menuIconLegendIds,
            categoryStyle: menuCategoryStyle,
            backgroundColor: menuBgColor,
            itemDetailEnabled: menuItemDetailEnabled,
            itemDetailShowPhoto: menuItemDetailShowPhoto,
            itemDetailPhotoVisibility: menuItemDetailPhotoVisibility,
            itemDetailShowName: menuItemDetailShowName,
            itemDetailShowDescription: menuItemDetailShowDescription,
            itemDetailShowPrice: menuItemDetailShowPrice,
            itemDetailShowCategory: menuItemDetailShowCategory,
            itemDetailShowIcons: menuItemDetailShowIcons,
            itemDetailImageFit: menuItemDetailImageFit,
            itemDetailCaptionBg: menuItemDetailCaptionBg,
            itemDetailTextColor: menuItemDetailTextColor,
            sectionSettings,
            __customCss: localCss,
            __customScript: localScript,
            __previewMenuSection: menuPreviewSection || undefined,
        });
    }, [
        blockData,
        menuModeDraft,
        menuVariantDraft,
        menuShowPrices,
        menuShowDescriptions,
        menuShowImages,
        menuShowFeaturedImages,
        menuShowTabs,
        menuShowIcons,
        menuShowIconLegend,
        menuIconLegendPosition,
        menuIconLegendMode,
        menuIconLegendIds,
        menuCategoryStyle,
        menuBgColor,
        menuItemDetailEnabled,
        menuItemDetailShowPhoto,
        menuItemDetailPhotoVisibility,
        menuItemDetailShowName,
        menuItemDetailShowDescription,
        menuItemDetailShowPrice,
        menuItemDetailShowCategory,
        menuItemDetailShowIcons,
        menuItemDetailImageFit,
        menuItemDetailCaptionBg,
        menuItemDetailTextColor,
        sectionSettings,
        localCss,
        localScript,
        menuPreviewSection,
        onDraftBlockDataChange,
    ]);

    const menuVariant = menuVariantDraft || blockData?.variant || 'list';
    const menuDisplayOptions = [
        { label: 'Show prices', value: menuShowPrices, setter: setMenuShowPrices },
        { label: 'Show descriptions', value: menuShowDescriptions, setter: setMenuShowDescriptions },
        { label: 'Show menu tabs', value: menuShowTabs, setter: setMenuShowTabs },
        { label: 'Show featured item photos', value: menuShowFeaturedImages, setter: setMenuShowFeaturedImages },
        { label: 'Show regular item photos', value: menuShowImages, setter: setMenuShowImages },
        { label: 'Show menu item icons', value: menuShowIcons, setter: setMenuShowIcons },
    ];
    const menuDetailComponentOptions = [
        { label: 'Show full-size photo', value: menuItemDetailShowPhoto, setter: setMenuItemDetailShowPhoto },
        { label: 'Show item name', value: menuItemDetailShowName, setter: setMenuItemDetailShowName },
        { label: 'Show description', value: menuItemDetailShowDescription, setter: setMenuItemDetailShowDescription },
        { label: 'Show price', value: menuItemDetailShowPrice, setter: setMenuItemDetailShowPrice },
        { label: 'Show category', value: menuItemDetailShowCategory, setter: setMenuItemDetailShowCategory },
        { label: 'Show menu icons', value: menuItemDetailShowIcons, setter: setMenuItemDetailShowIcons },
    ];
    const menuItemDetailImageFitOptions = [
        { id: 'contain', label: 'Fit Full Image', description: 'Shows the entire photo without cropping.' },
        { id: 'cover', label: 'Fill Frame', description: 'Fills the viewer and may crop edges.' },
        { id: 'center', label: 'Centered', description: 'Keeps the image centered at its natural size when possible.' },
        { id: 'stretch', label: 'Stretched', description: 'Stretches the image to fill the frame.' },
    ];
    const menuItemDetailPhotoVisibilityOptions = [
        { id: 'always', label: 'Always show photo', description: 'Show the item photo in the popup whenever one exists.' },
        { id: 'menu', label: 'Only if shown in menu', description: 'Show the popup photo only when that item already has a visible photo in the menu.' },
    ];
    const menuIconLegendModeOptions = [
        { id: 'all', label: 'All icons', description: 'Show every built-in and custom legend option.' },
        { id: 'used', label: 'Used only', description: 'Only show icons used by visible menu items.' },
        { id: 'custom', label: 'Custom', description: 'Choose exactly which legend icons appear.' },
    ];

    const handleSelectMenuIconLegendMode = (mode: string) => {
        setMenuIconLegendMode(mode);
        if (mode === 'custom' && menuIconLegendIds.length === 0) {
            setMenuIconLegendIds(visibleMenuIconOptions.map(option => option.id));
        }
    };
    const toggleMenuLegendIconId = (id: string) => {
        setMenuIconLegendIds((current) => (
            current.includes(id)
                ? current.filter(currentId => currentId !== id)
                : [...current, id]
        ));
    };

    const hasUnsavedChanges = useMemo(() => (
        menuModeDraft !== (blockData?.mode || 'items') ||
        menuVariantDraft !== (blockData?.variant || 'list') ||
        menuShowPrices !== (blockData?.showPrices !== false) ||
        menuShowDescriptions !== (blockData?.showDescriptions !== false) ||
        menuShowImages !== (blockData?.showImages === true) ||
        menuShowFeaturedImages !== (blockData?.showFeaturedImages !== false) ||
        menuShowTabs !== (blockData?.showMenuTabs !== false) ||
        menuShowIcons !== (blockData?.showMenuIcons !== false) ||
        menuShowIconLegend !== (blockData?.showMenuIconLegend === true) ||
        menuIconLegendPosition !== (blockData?.menuIconLegendPosition || 'bottom') ||
        menuIconLegendMode !== (blockData?.menuIconLegendMode || 'all') ||
        !areStringArraysEqual(menuIconLegendIds, normalizeMenuIconLegendIds(blockData?.menuIconLegendIds)) ||
        menuCategoryStyle !== (blockData?.categoryStyle || 'heading') ||
        menuBgColor !== (blockData?.backgroundColor || '') ||
        menuItemDetailEnabled !== (blockData?.itemDetailEnabled === true) ||
        menuItemDetailShowPhoto !== (blockData?.itemDetailShowPhoto !== false) ||
        menuItemDetailPhotoVisibility !== (blockData?.itemDetailPhotoVisibility || 'always') ||
        menuItemDetailShowName !== (blockData?.itemDetailShowName !== false) ||
        menuItemDetailShowDescription !== (blockData?.itemDetailShowDescription !== false) ||
        menuItemDetailShowPrice !== (blockData?.itemDetailShowPrice !== false) ||
        menuItemDetailShowCategory !== (blockData?.itemDetailShowCategory === true) ||
        menuItemDetailShowIcons !== (blockData?.itemDetailShowIcons === true) ||
        menuItemDetailImageFit !== (blockData?.itemDetailImageFit || 'contain') ||
        menuItemDetailCaptionBg !== (blockData?.itemDetailCaptionBg || '#0f172a') ||
        menuItemDetailTextColor !== (blockData?.itemDetailTextColor || '#ffffff') ||
        !areSectionSettingsEqual(sectionSettings, persistedSectionSettings) ||
        localCss !== customCss ||
        localScript !== persistedScript
    ), [
        blockData,
        menuModeDraft,
        menuVariantDraft,
        menuShowPrices,
        menuShowDescriptions,
        menuShowImages,
        menuShowFeaturedImages,
        menuShowTabs,
        menuShowIcons,
        menuShowIconLegend,
        menuIconLegendPosition,
        menuIconLegendMode,
        menuIconLegendIds,
        menuCategoryStyle,
        menuBgColor,
        menuItemDetailEnabled,
        menuItemDetailShowPhoto,
        menuItemDetailPhotoVisibility,
        menuItemDetailShowName,
        menuItemDetailShowDescription,
        menuItemDetailShowPrice,
        menuItemDetailShowCategory,
        menuItemDetailShowIcons,
        menuItemDetailImageFit,
        menuItemDetailCaptionBg,
        menuItemDetailTextColor,
        sectionSettings,
        persistedSectionSettings,
        localCss,
        customCss,
        localScript,
        persistedScript,
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
            mode: menuModeDraft,
            variant: menuVariantDraft,
            showPrices: menuShowPrices,
            showDescriptions: menuShowDescriptions,
            showImages: menuShowImages,
            showFeaturedImages: menuShowFeaturedImages,
            showMenuTabs: menuShowTabs,
            showMenuIcons: menuShowIcons,
            showMenuIconLegend: menuShowIconLegend,
            menuIconLegendPosition,
            menuIconLegendMode,
            menuIconLegendIds,
            categoryStyle: menuCategoryStyle,
            backgroundColor: menuBgColor,
            itemDetailEnabled: menuItemDetailEnabled,
            itemDetailShowPhoto: menuItemDetailShowPhoto,
            itemDetailPhotoVisibility: menuItemDetailPhotoVisibility,
            itemDetailShowName: menuItemDetailShowName,
            itemDetailShowDescription: menuItemDetailShowDescription,
            itemDetailShowPrice: menuItemDetailShowPrice,
            itemDetailShowCategory: menuItemDetailShowCategory,
            itemDetailShowIcons: menuItemDetailShowIcons,
            itemDetailImageFit: menuItemDetailImageFit,
            itemDetailCaptionBg: menuItemDetailCaptionBg,
            itemDetailTextColor: menuItemDetailTextColor,
        };
        if (!areSectionSettingsEqual(sectionSettings, persistedSectionSettings)) {
            updates.sectionSettings = normalizeSectionSettings(sectionSettings);
        }
        if (localCss !== customCss) {
            updates['__customCss'] = localCss;
        }
        if (localScript !== persistedScript) {
            updates['__customScript'] = localScript;
        }
        if (context?.updateBlockDataBatch) {
            context.updateBlockDataBatch(blockId, updates);
        }
        onClose();
    };

    const handleReset = () => {
        setMenuModeDraft(blockData?.mode || 'items');
        setMenuVariantDraft('list');
        setMenuShowPrices(true);
        setMenuShowDescriptions(true);
        setMenuShowImages(false);
        setMenuShowFeaturedImages(true);
        setMenuShowTabs(true);
        setMenuShowIcons(true);
        setMenuShowIconLegend(false);
        setMenuIconLegendPosition('bottom');
        setMenuIconLegendMode('all');
        setMenuIconLegendIds([]);
        setMenuCategoryStyle('heading');
        setMenuBgColor('');
        setMenuItemDetailEnabled(false);
        setMenuItemDetailShowPhoto(true);
        setMenuItemDetailPhotoVisibility('always');
        setMenuItemDetailShowName(true);
        setMenuItemDetailShowDescription(true);
        setMenuItemDetailShowPrice(true);
        setMenuItemDetailShowCategory(false);
        setMenuItemDetailShowIcons(false);
        setMenuItemDetailImageFit('contain');
        setMenuItemDetailCaptionBg('#0f172a');
        setMenuItemDetailTextColor('#ffffff');
        setSectionSettings(persistedSectionSettings);
        setLocalCss('');
        setLocalScript('');
        sectionState.reset();
    };

    return (
        <BlockSettingsPanel
            isOpen
            title="Menu Settings"
            subtitle="Design changes update the canvas preview instantly."
            blockId={blockId}
            blockType="menu"
            hasUnsavedChanges={hasUnsavedChanges}
            onClose={onClose}
            onSave={handleSave}
            onReset={handleReset}
            allCollapsed={sectionState.allCollapsed}
            onToggleAllCollapsed={() => sectionState.setAll(!sectionState.allCollapsed)}
            tourId="menu-settings-panel"
        >
            <InspectorSection
                id="content-source"
                title="Content Source"
                isCollapsed={sectionState.isCollapsed('content-source')}
                onToggle={() => sectionState.toggle('content-source')}
            >
                <div className="grid grid-cols-2 gap-2">
                    {[
                        { id: 'items', label: 'Item List' },
                        { id: 'pdf', label: 'PDF / Image' },
                    ].map((option) => {
                        const isSelected = menuModeDraft === option.id;
                        return (
                            <button
                                key={option.id}
                                type="button"
                                onClick={() => setMenuModeDraft(option.id)}
                                aria-pressed={isSelected}
                                className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    isSelected
                                        ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                                        : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                }`}
                            >
                                {option.label}
                            </button>
                        );
                    })}
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
                    blockType="menu"
                    value={sectionSettings}
                    onChange={setSectionSettings}
                />
            </InspectorSection>

            <InspectorSection
                id="block-layout"
                title="Block Layout"
                isCollapsed={sectionState.isCollapsed('block-layout')}
                onToggle={() => sectionState.toggle('block-layout')}
            >
                <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-3">
                        {MENU_VARIANTS.map((variantOption) => {
                            const isSelected = menuVariant === variantOption.id;
                            return (
                                <button
                                    key={variantOption.id}
                                    type="button"
                                    onClick={() => setMenuVariantDraft(variantOption.id)}
                                    aria-pressed={isSelected}
                                    className={`rounded-xl border p-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                        isSelected
                                            ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                    }`}
                                >
                                    <MenuLayoutThumbnail variant={variantOption.id} active={isSelected} />
                                    <span className="mt-3 block text-sm font-bold text-slate-900">{variantOption.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    <ResponsiveColumnsControl
                        value={sectionSettings.layout.columns}
                        onChange={(columns) => updateSectionLayout({ columns })}
                    />
                </div>
            </InspectorSection>

            <InspectorSection
                id="preview"
                title="Preview"
                isCollapsed={sectionState.isCollapsed('preview')}
                onToggle={() => sectionState.toggle('preview')}
            >
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor={`${blockId}-preview-menu`}>
                    Preview menu
                </label>
                <select
                    id={`${blockId}-preview-menu`}
                    value={menuPreviewSection}
                    onChange={(e) => setMenuPreviewSection(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">Public default</option>
                    {visibleMenuSections.map((section) => (
                        <option key={section} value={section}>{section}</option>
                    ))}
                </select>
            </InspectorSection>

            <InspectorSection
                id="display"
                title="Display"
                isCollapsed={sectionState.isCollapsed('display')}
                onToggle={() => sectionState.toggle('display')}
            >
                <div className="space-y-3">
                    {menuDisplayOptions.map(({ label, value, setter }) => (
                        <InspectorToggle
                            key={label}
                            label={label}
                            checked={value}
                            onChange={() => setter(!value)}
                        />
                    ))}
                </div>
            </InspectorSection>

            <InspectorSection
                id="menu-icons"
                title="Menu Icons"
                isCollapsed={sectionState.isCollapsed('menu-icons')}
                onToggle={() => sectionState.toggle('menu-icons')}
            >
                <div className="space-y-4">
                    <InspectorToggle
                        label="Show item icons"
                        checked={menuShowIcons}
                        onChange={() => setMenuShowIcons(!menuShowIcons)}
                    />
                    <InspectorToggle
                        label="Show icon legend"
                        checked={menuShowIconLegend}
                        onChange={() => setMenuShowIconLegend(!menuShowIconLegend)}
                    />

                    {menuShowIconLegend && (
                        <div className="space-y-4">
                            <div>
                                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Legend position</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { id: 'top', label: 'Above menu' },
                                        { id: 'bottom', label: 'Below menu' },
                                    ].map((option) => {
                                        const isSelected = menuIconLegendPosition === option.id;
                                        return (
                                            <button
                                                key={option.id}
                                                type="button"
                                                onClick={() => setMenuIconLegendPosition(option.id)}
                                                aria-pressed={isSelected}
                                                className={`rounded-xl border px-3 py-2.5 text-center text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                                    isSelected
                                                        ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                                                        : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                                }`}
                                            >
                                                {option.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Legend icons</p>
                                <div className="grid grid-cols-1 gap-2">
                                    {menuIconLegendModeOptions.map((option) => {
                                        const isSelected = menuIconLegendMode === option.id;
                                        return (
                                            <button
                                                key={option.id}
                                                type="button"
                                                onClick={() => handleSelectMenuIconLegendMode(option.id)}
                                                aria-pressed={isSelected}
                                                className={`rounded-xl border px-3 py-2.5 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                                    isSelected
                                                        ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                                                        : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                                }`}
                                            >
                                                <span className="block text-sm font-bold">{option.label}</span>
                                                <span className="mt-0.5 block text-xs leading-snug text-slate-500">{option.description}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {menuIconLegendMode === 'custom' && (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Choose icons</p>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setMenuIconLegendIds(visibleMenuIconOptions.map(option => option.id))}
                                                className="text-xs font-bold text-blue-600 transition-colors hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                Select all
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setMenuIconLegendIds([])}
                                                className="text-xs font-bold text-slate-500 transition-colors hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                Clear
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        {visibleMenuIconOptions.map((option) => {
                                            const isSelected = menuIconLegendIds.includes(option.id);
                                            return (
                                                <label
                                                    key={option.id}
                                                    className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300"
                                                >
                                                    <span>{option.label}</span>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleMenuLegendIconId(option.id)}
                                                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <p className="text-xs leading-relaxed text-slate-500">
                        Built-in and custom icon labels are managed from the Menu admin dashboard.
                    </p>
                </div>
            </InspectorSection>

            <InspectorSection
                id="item-detail-popup"
                title="Item Detail Popup"
                isCollapsed={sectionState.isCollapsed('item-detail-popup')}
                onToggle={() => sectionState.toggle('item-detail-popup')}
            >
                <div className="space-y-3">
                    <InspectorToggle
                        label="Enable click-to-expand item details"
                        checked={menuItemDetailEnabled}
                        onChange={() => setMenuItemDetailEnabled(!menuItemDetailEnabled)}
                    />

                    {menuItemDetailEnabled && (
                        <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <div>
                                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Image fit</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {menuItemDetailImageFitOptions.map((option) => {
                                        const isSelected = menuItemDetailImageFit === option.id;
                                        return (
                                            <button
                                                key={option.id}
                                                type="button"
                                                onClick={() => setMenuItemDetailImageFit(option.id)}
                                                aria-pressed={isSelected}
                                                className={`rounded-xl border bg-white px-3 py-2 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                                    isSelected
                                                        ? 'border-blue-600 text-blue-700 ring-1 ring-blue-600'
                                                        : 'border-slate-200 text-slate-700 hover:border-slate-300'
                                                }`}
                                            >
                                                <span className="block text-sm font-bold">{option.label}</span>
                                                <span className="mt-0.5 block text-xs leading-snug text-slate-500">{option.description}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Popup photo behavior</p>
                                <div className="grid grid-cols-1 gap-2">
                                    {menuItemDetailPhotoVisibilityOptions.map((option) => {
                                        const isSelected = menuItemDetailPhotoVisibility === option.id;
                                        return (
                                            <button
                                                key={option.id}
                                                type="button"
                                                onClick={() => setMenuItemDetailPhotoVisibility(option.id)}
                                                aria-pressed={isSelected}
                                                className={`rounded-xl border bg-white px-3 py-2 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                                    isSelected
                                                        ? 'border-blue-600 text-blue-700 ring-1 ring-blue-600'
                                                        : 'border-slate-200 text-slate-700 hover:border-slate-300'
                                                }`}
                                            >
                                                <span className="block text-sm font-bold">{option.label}</span>
                                                <span className="mt-0.5 block text-xs leading-snug text-slate-500">{option.description}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Popup components</p>
                                <div className="space-y-2">
                                    {menuDetailComponentOptions.map(({ label, value, setter }) => (
                                        <InspectorToggle
                                            key={label}
                                            label={label}
                                            checked={value}
                                            onChange={() => setter(!value)}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor={`${blockId}-item-detail-caption-bg`}>
                                    Caption background
                                </label>
                                <div className="mt-2 flex items-center gap-2">
                                    <input
                                        id={`${blockId}-item-detail-caption-bg`}
                                        type="color"
                                        value={menuItemDetailCaptionBgInputValue}
                                        onChange={(e) => setMenuItemDetailCaptionBg(e.target.value)}
                                        className="h-10 w-10 cursor-pointer rounded border border-slate-200 bg-white"
                                    />
                                    <input
                                        type="text"
                                        value={menuItemDetailCaptionBg}
                                        onChange={(e) => setMenuItemDetailCaptionBg(e.target.value)}
                                        className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor={`${blockId}-item-detail-text-color`}>
                                    Caption text color
                                </label>
                                <div className="mt-2 flex items-center gap-2">
                                    <input
                                        id={`${blockId}-item-detail-text-color`}
                                        type="color"
                                        value={menuItemDetailTextColorInputValue}
                                        onChange={(e) => setMenuItemDetailTextColor(e.target.value)}
                                        className="h-10 w-10 cursor-pointer rounded border border-slate-200 bg-white"
                                    />
                                    <input
                                        type="text"
                                        value={menuItemDetailTextColor}
                                        onChange={(e) => setMenuItemDetailTextColor(e.target.value)}
                                        className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </InspectorSection>

            <InspectorSection
                id="category-style"
                title="Category Style"
                isCollapsed={sectionState.isCollapsed('category-style')}
                onToggle={() => sectionState.toggle('category-style')}
            >
                <div className="grid grid-cols-3 gap-2">
                    {[
                        { id: 'heading', label: 'Heading' },
                        { id: 'badge', label: 'Badge' },
                        { id: 'divider', label: 'Divider' },
                    ].map((opt) => {
                        const isSelected = menuCategoryStyle === opt.id;
                        return (
                            <button
                                key={opt.id}
                                type="button"
                                onClick={() => setMenuCategoryStyle(opt.id)}
                                aria-pressed={isSelected}
                                className={`rounded-xl border px-3 py-2.5 text-center text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    isSelected
                                        ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                                        : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                }`}
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                </div>
            </InspectorSection>

            <InspectorSection
                id="style"
                title="Style"
                isCollapsed={sectionState.isCollapsed('style')}
                onToggle={() => sectionState.toggle('style')}
            >
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor={`${blockId}-menu-bg`}>
                    Section background color
                </label>
                <SideBySideBackgroundOverrideNotice />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                        id={`${blockId}-menu-bg`}
                        type="color"
                        value={menuBgColorInputValue}
                        onChange={(e) => setMenuBgColor(e.target.value)}
                        className="h-10 w-10 cursor-pointer rounded border border-slate-200 bg-white"
                    />
                    <PaletteTokenButtons
                        selected={menuBgColor}
                        palette={palette}
                        onSelect={(token) => setMenuBgColor(token)}
                    />
                </div>
                <div className="mt-3 flex gap-2">
                    <input
                        type="text"
                        value={menuBgColor}
                        onChange={(e) => setMenuBgColor(e.target.value)}
                        placeholder="Default"
                        className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        type="button"
                        onClick={() => setMenuBgColor('')}
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
                            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor={`${blockId}-menu-css`}>
                                Custom CSS
                            </label>
                            <textarea
                                id={`${blockId}-menu-css`}
                                value={localCss}
                                onChange={(e) => setLocalCss(e.target.value)}
                                placeholder={`/* Scoped to this Menu block */\nh3 {\n  letter-spacing: 0.04em;\n}`}
                                className="mt-2 min-h-40 w-full resize-y rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-sm text-green-400 outline-none selection:bg-green-900 focus:ring-2 focus:ring-blue-500"
                                spellCheck={false}
                            />
                        </div>
                        <div className="border-t border-slate-200 pt-4">
                            <KeyframeEditor
                                blockId={blockId}
                                blockType="menu"
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
