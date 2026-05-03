'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Code, Lock, Crown, Image as ImageIcon, Upload, Trash2, LayoutTemplate, Palette, ChevronDown } from 'lucide-react';
import { useEditorContext } from '@/lib/editor-context';
import { AVAILABLE_BLOCKS } from './block-registry';
import { resolvePaletteColor } from '@/lib/palette-colors';

const MENU_INSPECTOR_STATE_EVENT = 'ks:menu-inspector-state';
const MENU_INSPECTOR_SECTION_IDS = [
    'content-source',
    'layout',
    'preview',
    'display',
    'menu-icons',
    'item-detail-popup',
    'category-style',
    'background',
    'advanced',
];

interface BlockSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    blockId: string;
    blockType: string;
    blockData?: any;
    onUpdateBlockData?: (key: string, value: any) => void;
    customCss: string;
    onSaveCustomCss: (css: string) => void;
    isProUser: boolean;
    palette?: Record<string, string>;
    onDraftBlockDataChange?: (data: Record<string, unknown> | null) => void;
}

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

export default function BlockSettingsModal({
    isOpen,
    onClose,
    blockId,
    blockType,
    blockData,
    onUpdateBlockData,
    customCss,
    onSaveCustomCss,
    isProUser,
    palette = {},
    onDraftBlockDataChange,
}: BlockSettingsModalProps) {
    const mouseDownOnBackdrop = useRef(false);
    const context = useEditorContext();
    const { uploadImage } = context || {};

    useEffect(() => {
        if (blockType !== 'menu' || !isOpen) return;

        window.dispatchEvent(new CustomEvent(MENU_INSPECTOR_STATE_EVENT, { detail: { open: true } }));
        setCollapsedMenuInspectorSections(new Set(MENU_INSPECTOR_SECTION_IDS));
        return () => {
            window.dispatchEvent(new CustomEvent(MENU_INSPECTOR_STATE_EVENT, { detail: { open: false } }));
        };
    }, [blockType, isOpen]);

    const VARIANTS: Record<string, { id: string, label: string }[]> = {
        hero: [
            { id: 'split', label: 'Split (Text / Image)' },
            { id: 'centered', label: 'Centered Hero' },
            { id: 'fullImage', label: 'Full Image Background' },
            { id: 'minimal', label: 'Minimal / Clean' },
            { id: 'video', label: 'Video Background' }
        ],
        testimonials: [
            { id: 'cards', label: 'Multiple Cards' },
            { id: 'single', label: 'Single Focus' }
        ],
        team: [
            { id: 'grid', label: 'Simple Grid' },
            { id: 'cards', label: 'Detailed Cards' },
            { id: 'minimal', label: 'Minimalist' }
        ],
        stats: [
            { id: 'banner', label: 'Horizontal Banner' },
            { id: 'cards', label: 'Statistic Cards' }
        ],
        pricing: [
            { id: 'cards', label: 'Pricing Cards' },
            { id: 'comparison', label: 'Comparison Table' },
            { id: 'simple', label: 'Simple List' }
        ],
        logoCloud: [
            { id: 'inline', label: 'Inline Row' },
            { id: 'grid', label: 'Logo Grid' },
            { id: 'marquee', label: 'Scrolling Marquee' }
        ],
        aboutImageText: [
            { id: 'landscape', label: 'Landscape Image (4:3)' },
            { id: 'square', label: 'Square Image (1:1)' },
            { id: 'tall', label: 'Tall Image (3:4)' }
        ],
        menu: [
            { id: 'list', label: 'Classic List' },
            { id: 'grid', label: 'Item Grid' },
            { id: 'cards', label: 'Detail Cards' },
            { id: 'compact', label: 'Compact / Dense' }
        ],
        featuredQuote: [
            { id: 'centered', label: 'Centered' },
            { id: 'split', label: 'Split (Photo + Quote)' },
            { id: 'minimal', label: 'Minimal / Pull Quote' },
            { id: 'essay', label: 'Essay / Longform' },
            { id: 'multiGrid', label: 'Multi-Person Grid' }
        ],
        carousel: [
            { id: 'cards', label: 'Scrolling Cards' },
            { id: 'slides', label: 'Split Slides' },
            { id: 'minimal', label: 'Minimal / Centered' },
        ],
        video: [
            { id: 'contained', label: 'Contained (Centered)' },
            { id: 'fullWidth', label: 'Full Width' },
        ],
        estimateForm: [
            { id: 'simple', label: 'Inquiry Form' },
            { id: 'calculator', label: 'Estimate Calculator' },
        ],
        productGrid: [
            { id: 'grid', label: 'Grid' },
            { id: 'row', label: 'Scrolling Row' },
            { id: 'gridWithSidebar', label: 'Grid + Category Sidebar' },
            { id: 'list', label: 'List View' },
        ],
    };

    const hasVariantSettings = !!VARIANTS[blockType];
    const hasBackgroundSettings = blockType === 'hero';
    const hasMenuSettings = blockType === 'menu';
    const hasGallerySettings = blockType === 'gallery';

    type TabType = 'layout' | 'background' | 'menu' | 'gallery' | 'css';
    const defaultTab: TabType = hasVariantSettings
        ? 'layout'
        : hasBackgroundSettings
            ? 'background'
            : hasMenuSettings
                ? 'menu'
                : hasGallerySettings
                    ? 'gallery'
                    : 'css';

    const [localCss, setLocalCss] = useState(customCss);
    const [activeTab, setActiveTab] = useState<TabType>(defaultTab);

    // Background State
    const [bgType, setBgType] = useState<string>(blockData?.bgType || 'color');
    const [bgColor, setBgColor] = useState<string>(blockData?.backgroundColor || '');
    const [bgImage, setBgImage] = useState<string>(blockData?.bgImage || '');
    const [bgCarouselImages, setBgCarouselImages] = useState<string[]>(blockData?.bgCarouselImages || []);
    const [bgCarouselTiming, setBgCarouselTiming] = useState<number>(blockData?.bgCarouselTiming || 5);
    const [bgCarouselTransition, setBgCarouselTransition] = useState<string>(blockData?.bgCarouselTransition || 'fade');
    const [isUploading, setIsUploading] = useState(false);

    // Menu Style State
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
    const [menuPreviewSection, setMenuPreviewSection] = useState<string>('');
    const [menuSections, setMenuSections] = useState<string[]>([]);
    const [menuIconOptions, setMenuIconOptions] = useState<MenuIconOptionSource[]>(DEFAULT_MENU_ICON_OPTIONS);
    const [collapsedMenuInspectorSections, setCollapsedMenuInspectorSections] = useState<Set<string>>(new Set());

    // Team Style State
    const [teamShowBio, setTeamShowBio] = useState<boolean>(blockData?.showBio !== false);

    // Hero Style State
    const [heroShowButton, setHeroShowButton] = useState<boolean>(blockData?.showButton !== false);

    // Carousel State
    const [carouselAutoPlay, setCarouselAutoPlay] = useState<boolean>(blockData?.autoPlay !== false);
    const [carouselInterval, setCarouselInterval] = useState<number>(blockData?.interval || 5);

    // Gallery State
    const [galleryColumns, setGalleryColumns] = useState<number>(blockData?.columns || 3);
    const [galleryShowLightboxNav, setGalleryShowLightboxNav] = useState<boolean>(blockData?.showLightboxNav !== false);
    const [galleryShowLightboxThumbs, setGalleryShowLightboxThumbs] = useState<boolean>(blockData?.showLightboxThumbs !== false);
    const [galleryShowSeeMore, setGalleryShowSeeMore] = useState<boolean>(blockData?.showSeeMore === true);
    const [galleryAutoScroll, setGalleryAutoScroll] = useState<boolean>(blockData?.autoScroll === true);
    const [galleryAutoScrollRows, setGalleryAutoScrollRows] = useState<number>(blockData?.autoScrollRows || 2);
    const bgColorInputValue = getColorInputValue(bgColor, palette, '#000000');
    const menuBgColorInputValue = getColorInputValue(menuBgColor, palette, '#ffffff');
    const menuItemDetailCaptionBgInputValue = getColorInputValue(menuItemDetailCaptionBg, palette, '#0f172a');
    const menuItemDetailTextColorInputValue = getColorInputValue(menuItemDetailTextColor, palette, '#ffffff');

    useEffect(() => {
        if (isOpen) {
            setLocalCss(customCss);
            setActiveTab(defaultTab);
            setBgType(blockData?.bgType || 'color');
            setBgColor(blockData?.backgroundColor || '');
            setBgImage(blockData?.bgImage || '');
            setBgCarouselImages(blockData?.bgCarouselImages || []);
            setBgCarouselTiming(blockData?.bgCarouselTiming || 5);
            setBgCarouselTransition(blockData?.bgCarouselTransition || 'fade');
            setMenuModeDraft(blockData?.mode || 'items');
            setMenuVariantDraft(blockData?.variant || 'list');
            setMenuShowPrices(blockData?.showPrices !== false);
            setMenuShowDescriptions(blockData?.showDescriptions !== false);
            setMenuShowImages(blockData?.showImages === true);
            setMenuShowFeaturedImages(blockData?.showFeaturedImages !== false);
            setMenuShowTabs(blockData?.showMenuTabs !== false);
            setMenuShowIcons(blockData?.showMenuIcons !== false);
            setMenuShowIconLegend(blockData?.showMenuIconLegend === true);
            setMenuIconLegendPosition(blockData?.menuIconLegendPosition || 'bottom');
            setMenuIconLegendMode(blockData?.menuIconLegendMode || 'all');
            setMenuIconLegendIds(normalizeMenuIconLegendIds(blockData?.menuIconLegendIds));
            setMenuCategoryStyle(blockData?.categoryStyle || 'heading');
            setMenuBgColor(blockData?.backgroundColor || '');
            setMenuItemDetailEnabled(blockData?.itemDetailEnabled === true);
            setMenuItemDetailShowPhoto(blockData?.itemDetailShowPhoto !== false);
            setMenuItemDetailPhotoVisibility(blockData?.itemDetailPhotoVisibility || 'always');
            setMenuItemDetailShowName(blockData?.itemDetailShowName !== false);
            setMenuItemDetailShowDescription(blockData?.itemDetailShowDescription !== false);
            setMenuItemDetailShowPrice(blockData?.itemDetailShowPrice !== false);
            setMenuItemDetailShowCategory(blockData?.itemDetailShowCategory === true);
            setMenuItemDetailShowIcons(blockData?.itemDetailShowIcons === true);
            setMenuItemDetailImageFit(blockData?.itemDetailImageFit || 'contain');
            setMenuItemDetailCaptionBg(blockData?.itemDetailCaptionBg || '#0f172a');
            setMenuItemDetailTextColor(blockData?.itemDetailTextColor || '#ffffff');
            setMenuPreviewSection('');
            setTeamShowBio(blockData?.showBio !== false);
            setHeroShowButton(blockData?.showButton !== false);
            setCarouselAutoPlay(blockData?.autoPlay !== false);
            setCarouselInterval(blockData?.interval || 5);
            setGalleryColumns(blockData?.columns || 3);
            setGalleryShowLightboxNav(blockData?.showLightboxNav !== false);
            setGalleryShowLightboxThumbs(blockData?.showLightboxThumbs !== false);
            setGalleryShowSeeMore(blockData?.showSeeMore === true);
            setGalleryAutoScroll(blockData?.autoScroll === true);
            setGalleryAutoScrollRows(blockData?.autoScrollRows || 2);
        }
    }, [isOpen, customCss, blockType, blockData, defaultTab]);

    useEffect(() => {
        if (!isOpen || blockType !== 'menu') return;

        let isMounted = true;
        const fallbackItems: MenuSectionSourceItem[] = Array.isArray(blockData?.fallbackItems)
            ? blockData.fallbackItems
            : [];

        if (!context?.siteId) {
            setMenuSections(extractMenuSectionNames(fallbackItems));
            setMenuIconOptions(DEFAULT_MENU_ICON_OPTIONS);
            return;
        }

        fetch(`/api/menu?siteId=${context.siteId}`)
            .then((res) => res.ok ? res.json() : { items: [] })
            .then((data: { items?: MenuSectionSourceItem[]; iconOptions?: MenuIconOptionSource[] }) => {
                if (!isMounted) return;
                const availableItems = Array.isArray(data.items)
                    ? data.items.filter((item) => item?.is_available !== false)
                    : [];
                setMenuSections(extractMenuSectionNames(availableItems.length > 0 ? availableItems : fallbackItems));
                setMenuIconOptions(getCombinedMenuIconOptions(Array.isArray(data.iconOptions) ? data.iconOptions : []));
            })
            .catch(() => {
                if (isMounted) {
                    setMenuSections(extractMenuSectionNames(fallbackItems));
                    setMenuIconOptions(DEFAULT_MENU_ICON_OPTIONS);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [isOpen, blockType, context?.siteId, blockData?.fallbackItems]);

    useEffect(() => {
        if (!isOpen || blockType !== 'menu' || !onDraftBlockDataChange) return;

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
            __customCss: localCss,
            __previewMenuSection: menuPreviewSection || undefined,
        });
    }, [
        isOpen,
        blockType,
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
        localCss,
        menuPreviewSection,
        onDraftBlockDataChange,
    ]);

    if (!isOpen) return null;

    const handleSave = () => {
        const updates: Record<string, unknown> = {};

        if (localCss !== customCss) {
            updates['__customCss'] = localCss;
        }

        if (blockType === 'hero') {
            updates['bgType'] = bgType;
            updates['backgroundColor'] = bgColor;
            updates['bgImage'] = bgImage;
            updates['bgCarouselImages'] = bgCarouselImages;
            updates['bgCarouselTiming'] = bgCarouselTiming;
            updates['bgCarouselTransition'] = bgCarouselTransition;
            updates['showButton'] = heroShowButton;
        }

        if (blockType === 'menu') {
            updates['mode'] = menuModeDraft;
            updates['variant'] = menuVariantDraft;
            updates['showPrices'] = menuShowPrices;
            updates['showDescriptions'] = menuShowDescriptions;
            updates['showImages'] = menuShowImages;
            updates['showFeaturedImages'] = menuShowFeaturedImages;
            updates['showMenuTabs'] = menuShowTabs;
            updates['showMenuIcons'] = menuShowIcons;
            updates['showMenuIconLegend'] = menuShowIconLegend;
            updates['menuIconLegendPosition'] = menuIconLegendPosition;
            updates['menuIconLegendMode'] = menuIconLegendMode;
            updates['menuIconLegendIds'] = menuIconLegendIds;
            updates['categoryStyle'] = menuCategoryStyle;
            updates['backgroundColor'] = menuBgColor;
            updates['itemDetailEnabled'] = menuItemDetailEnabled;
            updates['itemDetailShowPhoto'] = menuItemDetailShowPhoto;
            updates['itemDetailPhotoVisibility'] = menuItemDetailPhotoVisibility;
            updates['itemDetailShowName'] = menuItemDetailShowName;
            updates['itemDetailShowDescription'] = menuItemDetailShowDescription;
            updates['itemDetailShowPrice'] = menuItemDetailShowPrice;
            updates['itemDetailShowCategory'] = menuItemDetailShowCategory;
            updates['itemDetailShowIcons'] = menuItemDetailShowIcons;
            updates['itemDetailImageFit'] = menuItemDetailImageFit;
            updates['itemDetailCaptionBg'] = menuItemDetailCaptionBg;
            updates['itemDetailTextColor'] = menuItemDetailTextColor;
        }

        if (blockType === 'team') {
            updates['showBio'] = teamShowBio;
        }

        if (blockType === 'carousel') {
            updates['autoPlay'] = carouselAutoPlay;
            updates['interval'] = carouselInterval;
        }

        if (blockType === 'gallery') {
            updates['columns'] = galleryColumns;
            updates['showLightboxNav'] = galleryShowLightboxNav;
            updates['showLightboxThumbs'] = galleryShowLightboxThumbs;
            updates['showSeeMore'] = galleryShowSeeMore;
            updates['autoScroll'] = galleryAutoScroll;
            updates['autoScrollRows'] = galleryAutoScrollRows;
        }

        if (Object.keys(updates).length > 0 && context?.updateBlockDataBatch) {
            context.updateBlockDataBatch(blockId, updates);
        } else {
            // Fallbacks for independent saves if batch is somehow unavailable
            if (localCss !== customCss) {
                onSaveCustomCss(localCss);
            }
            if (onUpdateBlockData && blockType === 'hero') {
                onUpdateBlockData('bgType', bgType);
                onUpdateBlockData('backgroundColor', bgColor);
                onUpdateBlockData('bgImage', bgImage);
                onUpdateBlockData('bgCarouselImages', bgCarouselImages);
                onUpdateBlockData('bgCarouselTiming', bgCarouselTiming);
                onUpdateBlockData('bgCarouselTransition', bgCarouselTransition);
            }
            if (onUpdateBlockData && blockType === 'menu') {
                Object.entries(updates).forEach(([key, value]) => {
                    if (key === '__customCss') return;
                    onUpdateBlockData(key, value);
                });
            }
        }
        onClose();
    };

    const handleSelectVariant = (variantId: string) => {
        if (blockType === 'menu') {
            setMenuVariantDraft(variantId);
            return;
        }
        if (onUpdateBlockData) {
            onUpdateBlockData('variant', variantId);
        }
    };

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
            setMenuIconLegendIds(menuIconOptions.map(option => option.id));
        }
    };
    const toggleMenuLegendIconId = (id: string) => {
        setMenuIconLegendIds((current) => (
            current.includes(id)
                ? current.filter(currentId => currentId !== id)
                : [...current, id]
        ));
    };
    const menuHasUnsavedChanges =
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
        localCss !== customCss;

    const handleResetMenuSettings = () => {
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
        setLocalCss('');
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isCarousel: boolean) => {
        const file = e.target.files?.[0];
        if (!file || !uploadImage) return;

        setIsUploading(true);
        try {
            const url = await uploadImage(file, isCarousel ? 'bgCarouselImages' : 'bgImage');
            if (isCarousel) {
                setBgCarouselImages(prev => [...prev, url]);
            } else {
                setBgImage(url);
            }
        } catch (error) {
            console.error('Image upload failed:', error);
            alert('Failed to upload image. Please try again.');
        } finally {
            setIsUploading(false);
            if (e.target) e.target.value = '';
        }
    };

    const toggleMenuInspectorSection = (sectionId: string) => {
        setCollapsedMenuInspectorSections((current) => {
            const next = new Set(current);
            if (next.has(sectionId)) {
                next.delete(sectionId);
            } else {
                next.add(sectionId);
            }
            return next;
        });
    };

    const allMenuInspectorSectionsCollapsed = MENU_INSPECTOR_SECTION_IDS.every((sectionId) => collapsedMenuInspectorSections.has(sectionId));
    const setAllMenuInspectorSectionsCollapsed = (collapsed: boolean) => {
        setCollapsedMenuInspectorSections(collapsed ? new Set(MENU_INSPECTOR_SECTION_IDS) : new Set());
    };

    if (blockType === 'menu') {
        const panel = (
            <aside
                data-tour="menu-settings-panel"
                className="fixed inset-y-0 right-0 z-[10000] flex w-full max-w-md flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                aria-label="Menu Settings"
            >
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-base font-bold text-slate-900">Menu Settings</h2>
                            {menuHasUnsavedChanges && (
                                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                                    Unsaved
                                </span>
                            )}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">Design changes update the canvas preview instantly.</p>
                        <button
                            type="button"
                            onClick={() => setAllMenuInspectorSectionsCollapsed(!allMenuInspectorSectionsCollapsed)}
                            className="mt-2 text-xs font-bold text-blue-600 transition-colors hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {allMenuInspectorSectionsCollapsed ? 'Expand all' : 'Collapse all'}
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        aria-label="Close Menu Settings"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
                    <MenuInspectorSection
                        id="content-source"
                        title="Content Source"
                        isCollapsed={collapsedMenuInspectorSections.has('content-source')}
                        onToggle={() => toggleMenuInspectorSection('content-source')}
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
                    </MenuInspectorSection>

                    <MenuInspectorSection
                        id="layout"
                        title="Layout"
                        isCollapsed={collapsedMenuInspectorSections.has('layout')}
                        onToggle={() => toggleMenuInspectorSection('layout')}
                    >
                        <div className="grid grid-cols-2 gap-3">
                            {VARIANTS.menu.map((variantOption) => {
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
                    </MenuInspectorSection>

                    <MenuInspectorSection
                        id="preview"
                        title="Preview"
                        isCollapsed={collapsedMenuInspectorSections.has('preview')}
                        onToggle={() => toggleMenuInspectorSection('preview')}
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
                            {menuSections.map((section) => (
                                <option key={section} value={section}>{section}</option>
                            ))}
                        </select>
                    </MenuInspectorSection>

                    <MenuInspectorSection
                        id="display"
                        title="Display"
                        isCollapsed={collapsedMenuInspectorSections.has('display')}
                        onToggle={() => toggleMenuInspectorSection('display')}
                    >
                        <div className="space-y-3">
                            {menuDisplayOptions.map(({ label, value, setter }) => (
                                <MenuToggle
                                    key={label}
                                    label={label}
                                    checked={value}
                                    onChange={() => setter(!value)}
                                />
                            ))}
                        </div>
                    </MenuInspectorSection>

                    <MenuInspectorSection
                        id="menu-icons"
                        title="Menu Icons"
                        isCollapsed={collapsedMenuInspectorSections.has('menu-icons')}
                        onToggle={() => toggleMenuInspectorSection('menu-icons')}
                    >
                        <div className="space-y-4">
                            <MenuToggle
                                label="Show item icons"
                                checked={menuShowIcons}
                                onChange={() => setMenuShowIcons(!menuShowIcons)}
                            />
                            <MenuToggle
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
                                                        onClick={() => setMenuIconLegendIds(menuIconOptions.map(option => option.id))}
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
                                                {menuIconOptions.map((option) => {
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
                    </MenuInspectorSection>

                    <MenuInspectorSection
                        id="item-detail-popup"
                        title="Item Detail Popup"
                        isCollapsed={collapsedMenuInspectorSections.has('item-detail-popup')}
                        onToggle={() => toggleMenuInspectorSection('item-detail-popup')}
                    >
                        <div className="space-y-3">
                            <MenuToggle
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
                                                <MenuToggle
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
                    </MenuInspectorSection>

                    <MenuInspectorSection
                        id="category-style"
                        title="Category Style"
                        isCollapsed={collapsedMenuInspectorSections.has('category-style')}
                        onToggle={() => toggleMenuInspectorSection('category-style')}
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
                    </MenuInspectorSection>

                    <MenuInspectorSection
                        id="background"
                        title="Background"
                        isCollapsed={collapsedMenuInspectorSections.has('background')}
                        onToggle={() => toggleMenuInspectorSection('background')}
                    >
                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor={`${blockId}-menu-bg`}>
                            Section background color
                        </label>
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
                    </MenuInspectorSection>

                    <MenuInspectorSection
                        id="advanced"
                        title="Advanced"
                        isCollapsed={collapsedMenuInspectorSections.has('advanced')}
                        onToggle={() => toggleMenuInspectorSection('advanced')}
                    >
                        {isProUser ? (
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
                        ) : (
                            <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800">
                                <div className="flex items-center gap-2 font-bold">
                                    <Crown className="h-4 w-4" />
                                    Custom CSS is a Pro feature
                                </div>
                            </div>
                        )}
                    </MenuInspectorSection>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        Cancel
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleResetMenuSettings}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            Reset
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                            Save Changes
                        </button>
                    </div>
                </div>
            </aside>
        );

        return createPortal(panel, document.body);
    }

    const modal = (
        <div
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onMouseDown={(e) => { mouseDownOnBackdrop.current = e.target === e.currentTarget; }}
                onClick={() => { if (mouseDownOnBackdrop.current) onClose(); }}
            />

            {/* Modal */}
            <div data-tour="block-settings-modal" className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                    <h2 className="text-lg font-bold text-slate-900">
                        {(() => {
                            const blockLabel = AVAILABLE_BLOCKS.find(b => b.type === blockType)?.label;
                            return blockLabel ? `${blockLabel} Settings` : 'Block Settings';
                        })()}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Tab bar */}
                <div className="flex border-b border-slate-200 px-6">
                    {hasVariantSettings && (
                        <button
                            onClick={() => setActiveTab('layout')}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === 'layout' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <LayoutTemplate className="w-4 h-4" />
                            Layout
                        </button>
                    )}
                    {hasBackgroundSettings && (
                        <button
                            onClick={() => setActiveTab('background')}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === 'background' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <ImageIcon className="w-4 h-4" />
                            Background
                        </button>
                    )}
                    {hasMenuSettings && (
                        <button
                            onClick={() => setActiveTab('menu')}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === 'menu' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <Palette className="w-4 h-4" />
                            Style
                        </button>
                    )}
                    {hasGallerySettings && (
                        <button
                            onClick={() => setActiveTab('gallery')}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === 'gallery' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <LayoutTemplate className="w-4 h-4" />
                            Style
                        </button>
                    )}
                    <button
                        onClick={() => setActiveTab('css')}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === 'css' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <Code className="w-4 h-4" />
                        Custom CSS
                        {!isProUser && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'layout' && hasVariantSettings ? (
                        <div className="space-y-6">
                            <div>
                                <p className="text-sm font-medium text-slate-700 mb-4">Select a Layout Variant</p>
                                <div className="grid grid-cols-2 gap-3">
                                    {VARIANTS[blockType].map((variantOption) => {
                                        const currentVariant = blockData?.variant || VARIANTS[blockType][0].id;
                                        const isSelected = currentVariant === variantOption.id;
                                        return (
                                            <button
                                                key={variantOption.id}
                                                onClick={() => handleSelectVariant(variantOption.id)}
                                                className={`p-4 border rounded-xl text-left transition-all ${
                                                    isSelected
                                                        ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600 shadow-sm'
                                                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                                }`}
                                            >
                                                <div className="font-semibold text-sm text-slate-900">{variantOption.label}</div>
                                                <div className="text-xs text-slate-500 mt-1 capitalize font-mono text-[10px]">{variantOption.id} Variant</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            {blockType === 'hero' && (blockData?.variant || 'split') === 'minimal' && (
                                <div className="pt-4 border-t border-slate-100">
                                    <p className="text-sm font-medium text-slate-700 mb-3">Content Options</p>
                                    <label className="flex items-center justify-between cursor-pointer group">
                                        <div className="flex flex-col">
                                            <span className="text-sm text-slate-700 group-hover:text-slate-900 font-medium">Show CTA button</span>
                                            <span className="text-xs text-slate-500">Hide the call-to-action button for a cleaner look</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setHeroShowButton(!heroShowButton)}
                                            className={`relative w-10 h-5 rounded-full transition-colors ${heroShowButton ? 'bg-blue-600' : 'bg-slate-200'}`}
                                        >
                                            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${heroShowButton ? 'left-[22px]' : 'left-0.5'}`} />
                                        </button>
                                    </label>

                                    <div className="flex justify-end pt-8">
                                        <button
                                            onClick={handleSave}
                                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg transition-colors"
                                        >
                                            Save Settings
                                        </button>
                                    </div>
                                </div>
                            )}
                            {blockType === 'team' && (
                                <div>
                                    <p className="text-sm font-medium text-slate-700 mb-3">Columns</p>
                                    <div className="grid grid-cols-4 gap-2">
                                        {[
                                            { value: 0, label: 'Auto' },
                                            { value: 2, label: '2' },
                                            { value: 3, label: '3' },
                                            { value: 4, label: '4' },
                                        ].map(opt => {
                                            const current = blockData?.columns || 0;
                                            const isSelected = current === opt.value;
                                            return (
                                                <button
                                                    key={opt.value}
                                                    onClick={() => onUpdateBlockData && onUpdateBlockData('columns', opt.value)}
                                                    className={`p-3 border rounded-xl text-center text-sm font-medium transition-all ${
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
                                    <p className="text-xs text-slate-500 mt-2">Auto adjusts columns based on member count.</p>
                                </div>
                            )}

                            {blockType === 'team' && (
                                <div className="pt-4 border-t border-slate-100">
                                    <p className="text-sm font-medium text-slate-700 mb-3">Content Options</p>
                                    <label className="flex items-center justify-between cursor-pointer group">
                                        <div className="flex flex-col">
                                            <span className="text-sm text-slate-700 group-hover:text-slate-900 font-medium">Show Descriptions (Bio)</span>
                                            <span className="text-xs text-slate-500">Toggle the detailed biography text for each member</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setTeamShowBio(!teamShowBio)}
                                            className={`relative w-10 h-5 rounded-full transition-colors ${teamShowBio ? 'bg-blue-600' : 'bg-slate-200'}`}
                                        >
                                            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${teamShowBio ? 'left-[22px]' : 'left-0.5'}`} />
                                        </button>
                                    </label>

                                    <div className="flex justify-end pt-8">
                                        <button
                                            onClick={handleSave}
                                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg transition-colors"
                                        >
                                            Save Settings
                                        </button>
                                    </div>
                                </div>
                            )}

                            {blockType === 'carousel' && (
                                <div className="pt-4 border-t border-slate-100 space-y-5">
                                    <p className="text-sm font-medium text-slate-700">Auto-Scroll</p>
                                    <label className="flex items-center justify-between cursor-pointer group">
                                        <div className="flex flex-col">
                                            <span className="text-sm text-slate-700 group-hover:text-slate-900 font-medium">Auto-scroll slides</span>
                                            <span className="text-xs text-slate-500">Automatically advance to the next slide</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setCarouselAutoPlay(!carouselAutoPlay)}
                                            className={`relative w-10 h-5 rounded-full transition-colors ${carouselAutoPlay ? 'bg-blue-600' : 'bg-slate-200'}`}
                                        >
                                            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${carouselAutoPlay ? 'left-[22px]' : 'left-0.5'}`} />
                                        </button>
                                    </label>

                                    {carouselAutoPlay && (
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                Scroll interval: {carouselInterval}s
                                            </label>
                                            <input
                                                type="range" min="2" max="15"
                                                value={carouselInterval}
                                                onChange={e => setCarouselInterval(parseInt(e.target.value))}
                                                className="w-full accent-blue-600"
                                            />
                                            <div className="flex justify-between text-xs text-slate-500 mt-1">
                                                <span>Faster (2s)</span>
                                                <span>Slower (15s)</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-end pt-2">
                                        <button
                                            onClick={handleSave}
                                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg transition-colors"
                                        >
                                            Save Settings
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : activeTab === 'background' && hasBackgroundSettings ? (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Background Type</label>
                                <select 
                                    value={bgType}
                                    onChange={(e) => setBgType(e.target.value)}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="color">Color / Gradient</option>
                                    <option value="image">Single Image</option>
                                    <option value="carousel">Image Carousel</option>
                                </select>
                            </div>

                            {bgType === 'color' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Background Color</label>
                                    <div className="flex items-center gap-3">
                                        <input 
                                            type="color" 
                                            value={bgColorInputValue} 
                                            onChange={(e) => setBgColor(e.target.value)}
                                            className="w-10 h-10 rounded cursor-pointer"
                                        />
                                        <PaletteTokenButtons
                                            selected={bgColor}
                                            palette={palette}
                                            onSelect={(token) => setBgColor(token)}
                                        />
                                        <input 
                                            type="text" 
                                            value={bgColor} 
                                            onChange={(e) => setBgColor(e.target.value)}
                                            placeholder="Default (Palette Secondary)"
                                            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <button 
                                            onClick={() => setBgColor('')}
                                            className="px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                                        >
                                            Reset
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2">Leave blank to use the site's default style.</p>
                                </div>
                            )}

                            {bgType === 'image' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Background Image</label>
                                    {bgImage && (
                                        <div className="relative w-full h-40 rounded-lg overflow-hidden border border-slate-200 mb-3 group">
                                            <img src={bgImage} alt="Background" className="w-full h-full object-cover" />
                                            <button 
                                                onClick={() => setBgImage('')}
                                                className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-md hover:bg-red-50 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                    <label className="flex items-center justify-center w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 border-dashed rounded-lg p-4 cursor-pointer transition-colors">
                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, false)} disabled={isUploading} />
                                        <div className="flex items-center gap-2 text-slate-600 font-medium">
                                            {isUploading ? <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}
                                            {isUploading ? 'Uploading...' : 'Upload Image'}
                                        </div>
                                    </label>
                                </div>
                            )}

                            {bgType === 'carousel' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Carousel Images</label>
                                    <div className="grid grid-cols-3 gap-3 mb-3">
                                        {bgCarouselImages.map((img, i) => (
                                            <div key={i} className="relative aspect-video rounded-lg overflow-hidden border border-slate-200 group">
                                                <img src={img} alt={`Slide ${i}`} className="w-full h-full object-cover" />
                                                <button 
                                                    onClick={() => setBgCarouselImages(prev => prev.filter((_, idx) => idx !== i))}
                                                    className="absolute top-1 right-1 bg-white/90 p-1 rounded-md hover:bg-red-50 hover:text-red-500 opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <label className="flex items-center justify-center w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 border-dashed rounded-lg p-3 cursor-pointer transition-colors mb-6">
                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, true)} disabled={isUploading} />
                                        <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                                            {isUploading ? <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}
                                            {isUploading ? 'Uploading...' : 'Add Image'}
                                        </div>
                                    </label>

                                    <label className="block text-sm font-medium text-slate-700 mb-2">Transition Time: {bgCarouselTiming}s</label>
                                    <input 
                                        type="range" 
                                        min="2" max="15" 
                                        value={bgCarouselTiming} 
                                        onChange={(e) => setBgCarouselTiming(parseInt(e.target.value))}
                                        className="w-full accent-blue-600"
                                    />
                                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                                        <span>Faster (2s)</span>
                                        <span>Slower (15s)</span>
                                    </div>

                                    <label className="block text-sm font-medium text-slate-700 mt-6 mb-2">Transition Style</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { value: 'fade', label: 'Fade' },
                                            { value: 'swipe', label: 'Swipe' },
                                            { value: 'scroll', label: 'Smooth Scroll' },
                                        ].map((opt) => (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => setBgCarouselTransition(opt.value)}
                                                className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                                                    bgCarouselTransition === opt.value
                                                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                                }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2">
                                        {bgCarouselTransition === 'fade' && 'Images crossfade into each other.'}
                                        {bgCarouselTransition === 'swipe' && 'Images slide in from the right.'}
                                        {bgCarouselTransition === 'scroll' && 'Images scroll continuously from right to left.'}
                                    </p>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg transition-colors"
                                >
                                    Save Options
                                </button>
                            </div>
                        </div>
                    ) : activeTab === 'menu' && hasMenuSettings ? (
                        <div className="space-y-6">
                            {/* Show / hide toggles */}
                            <div>
                                <p className="text-sm font-medium text-slate-700 mb-3">Display Options</p>
                                <div className="space-y-3">
                                    {menuDisplayOptions.map(({ label, value, setter }) => (
                                        <label key={label} className="flex items-center justify-between cursor-pointer group">
                                            <span className="text-sm text-slate-600 group-hover:text-slate-800">{label}</span>
                                            <button
                                                type="button"
                                                onClick={() => setter(!value)}
                                                className={`relative w-10 h-5 rounded-full transition-colors ${value ? 'bg-blue-600' : 'bg-slate-200'}`}
                                            >
                                                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${value ? 'left-[22px]' : 'left-0.5'}`} />
                                            </button>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Category style */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Category Style</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { id: 'heading', label: 'Heading' },
                                        { id: 'badge', label: 'Badge' },
                                        { id: 'divider', label: 'Divider' },
                                    ].map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => setMenuCategoryStyle(opt.id)}
                                            className={`p-3 border rounded-xl text-center text-sm font-medium transition-all ${
                                                menuCategoryStyle === opt.id
                                                    ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                                                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Background color */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Section Background</label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={menuBgColorInputValue}
                                        onChange={(e) => setMenuBgColor(e.target.value)}
                                        className="w-10 h-10 rounded cursor-pointer"
                                    />
                                    <PaletteTokenButtons
                                        selected={menuBgColor}
                                        palette={palette}
                                        onSelect={(token) => setMenuBgColor(token)}
                                    />
                                    <input
                                        type="text"
                                        value={menuBgColor}
                                        onChange={(e) => setMenuBgColor(e.target.value)}
                                        placeholder="Default (site accent)"
                                        className="flex-1 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                    />
                                    <button
                                        onClick={() => setMenuBgColor('')}
                                        className="px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                                    >
                                        Reset
                                    </button>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">Leave blank to use the site's default style.</p>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                                <button onClick={handleSave} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg transition-colors">Save Style</button>
                            </div>
                        </div>
                    ) : activeTab === 'gallery' && hasGallerySettings ? (
                        <div className="space-y-6">
                            {/* Columns */}
                            <div>
                                <p className="text-sm font-medium text-slate-700 mb-3">Columns</p>
                                <div className="grid grid-cols-3 gap-2">
                                    {[2, 3, 4].map(n => (
                                        <button
                                            key={n}
                                            onClick={() => setGalleryColumns(n)}
                                            className={`p-3 border rounded-xl text-center text-sm font-medium transition-all ${
                                                galleryColumns === n
                                                    ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                                                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                            }`}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Lightbox options */}
                            <div className="pt-4 border-t border-slate-100">
                                <p className="text-sm font-medium text-slate-700 mb-3">Expanded Image (Lightbox)</p>
                                <div className="space-y-3">
                                    {[
                                        { label: 'Show prev / next nav buttons', desc: 'Click arrows to step through images', value: galleryShowLightboxNav, setter: setGalleryShowLightboxNav },
                                        { label: 'Show thumbnail strip', desc: 'Click thumbnails along the bottom to jump', value: galleryShowLightboxThumbs, setter: setGalleryShowLightboxThumbs },
                                    ].map(({ label, desc, value, setter }) => (
                                        <label key={label} className="flex items-center justify-between cursor-pointer group">
                                            <div className="flex flex-col">
                                                <span className="text-sm text-slate-700 group-hover:text-slate-900 font-medium">{label}</span>
                                                <span className="text-xs text-slate-500">{desc}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setter(!value)}
                                                className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${value ? 'bg-blue-600' : 'bg-slate-200'}`}
                                            >
                                                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${value ? 'left-[22px]' : 'left-0.5'}`} />
                                            </button>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* See More button */}
                            <div className="pt-4 border-t border-slate-100">
                                <p className="text-sm font-medium text-slate-700 mb-3">See More Button</p>
                                <label className="flex items-center justify-between cursor-pointer group">
                                    <div className="flex flex-col">
                                        <span className="text-sm text-slate-700 group-hover:text-slate-900 font-medium">Show "See More" button</span>
                                        <span className="text-xs text-slate-500">Click the button on the page to customize text and link</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setGalleryShowSeeMore(!galleryShowSeeMore)}
                                        className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${galleryShowSeeMore ? 'bg-blue-600' : 'bg-slate-200'}`}
                                    >
                                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${galleryShowSeeMore ? 'left-[22px]' : 'left-0.5'}`} />
                                    </button>
                                </label>
                            </div>

                            {/* Auto-scroll */}
                            <div className="pt-4 border-t border-slate-100 space-y-4">
                                <p className="text-sm font-medium text-slate-700">Auto-Scroll</p>
                                <label className="flex items-center justify-between cursor-pointer group">
                                    <div className="flex flex-col">
                                        <span className="text-sm text-slate-700 group-hover:text-slate-900 font-medium">Auto-scroll images</span>
                                        <span className="text-xs text-slate-500">Continuously scroll through images horizontally</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setGalleryAutoScroll(!galleryAutoScroll)}
                                        className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${galleryAutoScroll ? 'bg-blue-600' : 'bg-slate-200'}`}
                                    >
                                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${galleryAutoScroll ? 'left-[22px]' : 'left-0.5'}`} />
                                    </button>
                                </label>

                                {galleryAutoScroll && (
                                    <div>
                                        <p className="text-sm font-medium text-slate-700 mb-2">Rows: {galleryAutoScrollRows}</p>
                                        <div className="grid grid-cols-4 gap-2">
                                            {[1, 2, 3, 4].map(n => (
                                                <button
                                                    key={n}
                                                    onClick={() => setGalleryAutoScrollRows(n)}
                                                    className={`p-2 border rounded-lg text-center text-sm font-medium transition-all ${
                                                        galleryAutoScrollRows === n
                                                            ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                                                            : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    {n}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                                <button onClick={handleSave} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg transition-colors">Save Style</button>
                            </div>
                        </div>
                    ) : isProUser ? (
                        <div className="space-y-4">
                            <div>
                                <p className="text-sm font-medium text-slate-700 mb-1">
                                    Custom CSS for this block
                                </p>
                                <p className="text-xs text-slate-500 mb-3">
                                    Styles are scoped to <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono">#{blockId}</code>.
                                    Use child selectors to target elements inside this block,
                                    e.g. <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono">h1 {'{'} color: red; {'}'}</code>
                                </p>
                                <p className="text-xs text-slate-500 mb-3">
                                    Block class: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono">.ks-block-{blockType}</code>
                                </p>
                            </div>
                            <textarea
                                value={localCss}
                                onChange={(e) => setLocalCss(e.target.value)}
                                placeholder={`/* Example: */\nh1 {\n  color: red;\n  font-size: 3rem;\n}\n\np {\n  line-height: 1.8;\n}`}
                                className="w-full bg-slate-950 text-green-400 font-mono text-sm p-4 min-h-[300px] outline-none border border-slate-700 rounded-lg resize-y selection:bg-green-900"
                                spellCheck={false}
                            />
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg transition-colors"
                                >
                                    Apply CSS
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Paywall for non-pro users */
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mb-4">
                                <Lock className="w-8 h-8 text-amber-500" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">
                                Custom CSS is a Pro Feature
                            </h3>
                            <p className="text-sm text-slate-500 max-w-sm mb-6">
                                Upgrade to Pro to add custom CSS to any block on your site.
                                Get full control over styling with scoped CSS that targets individual blocks.
                            </p>
                            <a
                                href="/pricing"
                                className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105"
                            >
                                <Crown className="w-5 h-5" />
                                Upgrade to Pro
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(modal, document.body);
}

function getColorInputValue(value: string, palette: Record<string, string>, fallback: string) {
    const resolved = resolvePaletteColor(value, palette, fallback);
    return /^#[0-9a-f]{6}$/i.test(resolved) ? resolved : fallback;
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

function MenuInspectorSection({
    id,
    title,
    children,
    isCollapsed,
    onToggle,
}: {
    id: string;
    title: string;
    children: React.ReactNode;
    isCollapsed: boolean;
    onToggle: () => void;
}) {
    const contentId = `${id}-menu-inspector-content`;

    return (
        <section className="border-b border-slate-100 pb-5 last:border-b-0 last:pb-0">
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={!isCollapsed}
                aria-controls={contentId}
                className="flex w-full items-center justify-between gap-3 rounded-lg py-1 text-left transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h3>
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isCollapsed ? '-rotate-90' : 'rotate-0'}`} />
            </button>
            {!isCollapsed && (
                <div id={contentId} className="mt-3">
                    {children}
                </div>
            )}
        </section>
    );
}

function MenuToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={onChange}
            className="flex w-full items-center justify-between gap-4 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
            <span className="text-sm font-medium text-slate-700">{label}</span>
            <span className={`relative h-5 w-10 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-200'}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
            </span>
        </button>
    );
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

function PaletteTokenButtons({ selected, palette, onSelect }: {
    selected: string;
    palette: Record<string, string>;
    onSelect: (token: string) => void;
}) {
    const tokens = [
        { key: 'primary', label: 'P', title: 'Use palette primary' },
        { key: 'secondary', label: 'S', title: 'Use palette secondary' },
        { key: 'accent', label: 'A', title: 'Use palette accent' },
    ];

    return (
        <div className="flex items-center gap-1">
            {tokens.map(({ key, label, title }) => {
                const token = `palette:${key}`;
                const active = selected === token;
                return (
                    <button
                        key={key}
                        type="button"
                        onClick={() => onSelect(token)}
                        className={`w-8 h-8 rounded-full border text-[10px] font-bold shadow-sm transition-transform ${active ? 'border-slate-900 scale-105' : 'border-white'}`}
                        style={{ backgroundColor: palette[key] || '#ffffff', color: key === 'accent' ? (palette.primary || '#0f172a') : '#ffffff' }}
                        title={title}
                    >
                        {label}
                    </button>
                );
            })}
        </div>
    );
}
