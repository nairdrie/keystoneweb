'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    X,
    Crown,
    Plus,
    Pencil,
    Trash2,
    GripVertical,
    ChevronDown,
} from 'lucide-react';
import {
    DndContext,
    closestCenter,
    MouseSensor,
    TouchSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    useSortable,
    arrayMove,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { useEditorContext, NavItem } from '@/lib/editor-context';
import {
    InspectorSection,
    InspectorToggle,
    PaletteTokenButtons,
    getColorInputValue,
    useInspectorSectionState,
    dispatchBlockInspectorState,
} from '../panel-shared';
import NavItemEditModal from '../../NavItemEditModal';
import type {
    SiteHeaderDefaults,
    HeaderBgType,
    HeaderLayout,
    LogoPosition,
    NavPosition,
    DesktopMenuStyle,
    HamburgerPosition,
} from '../../HeaderSettingsModal';

// ─── Constants ────────────────────────────────────────────────────────────

export const HEADER_RIGHT_ELEMENTS = ['language', 'search', 'cart', 'profile', 'cta'] as const;
export type HeaderRightElement = typeof HEADER_RIGHT_ELEMENTS[number];

export const DEFAULT_HEADER_ELEMENT_ORDER: HeaderRightElement[] = [
    'language',
    'search',
    'cart',
    'profile',
    'cta',
];

const ELEMENT_LABELS: Record<HeaderRightElement, string> = {
    language: 'Language Selector',
    search: 'Product Search',
    cart: 'Cart Icon',
    profile: 'Profile Icon',
    cta: 'CTA / Right Element',
};

const SECTION_IDS = [
    'layout',
    'menu-items',
    'right-element',
    'membership',
    'product-search',
    'element-order',
    'secondary-bar',
    'banner',
    'background',
    'typography',
    'advanced',
];

// ─── Props ────────────────────────────────────────────────────────────────

interface HeaderSettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    palette: Record<string, string>;
    defaults: SiteHeaderDefaults;
    isProUser?: boolean;
}

// ─── Utility: normalize element order ─────────────────────────────────────

function normalizeElementOrder(value: unknown): HeaderRightElement[] {
    if (!Array.isArray(value)) return [...DEFAULT_HEADER_ELEMENT_ORDER];
    const valid = value.filter((v): v is HeaderRightElement =>
        typeof v === 'string' && (HEADER_RIGHT_ELEMENTS as readonly string[]).includes(v)
    );
    // Append any missing defaults so we never lose elements
    DEFAULT_HEADER_ELEMENT_ORDER.forEach((el) => {
        if (!valid.includes(el)) valid.push(el);
    });
    return valid;
}

// ─── Component ────────────────────────────────────────────────────────────

export default function HeaderSettingsPanel({
    isOpen,
    onClose,
    palette,
    defaults,
    isProUser,
}: HeaderSettingsPanelProps) {
    const context = useEditorContext();
    const siteContent = context?.siteContent || {};
    const updateSiteContent = context?.updateSiteContent || (() => {});
    const navItems = context?.navItems || [];
    const updateNavItems = context?.updateNavItems;

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
    );

    const sectionState = useInspectorSectionState(SECTION_IDS, true);

    // Snapshot initial state for Reset / Cancel
    const initialSnapshotRef = useRef<Record<string, unknown> | null>(null);
    const initialNavItemsRef = useRef<NavItem[] | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        initialSnapshotRef.current = {
            headerLogoPosition: siteContent.headerLogoPosition,
            headerNavPosition: siteContent.headerNavPosition,
            headerDesktopMenuStyle: siteContent.headerDesktopMenuStyle,
            headerHamburgerPosition: siteContent.headerHamburgerPosition,
            headerOverlay: siteContent.headerOverlay,
            headerLayout: siteContent.headerLayout,
            headerRightSide: siteContent.headerRightSide,
            headerShowBanner: siteContent.headerShowBanner,
            headerBannerText: siteContent.headerBannerText,
            headerBannerBgType: siteContent.headerBannerBgType,
            headerBannerBgColor: siteContent.headerBannerBgColor,
            headerSocialFacebook: siteContent.headerSocialFacebook,
            headerSocialInstagram: siteContent.headerSocialInstagram,
            headerSocialX: siteContent.headerSocialX,
            headerSocialLinkedin: siteContent.headerSocialLinkedin,
            headerSocialYoutube: siteContent.headerSocialYoutube,
            headerBgType: siteContent.headerBgType,
            headerBgColor: siteContent.headerBgColor,
            headerSticky: siteContent.headerSticky,
            headerNavFontSize: siteContent.headerNavFontSize,
            headerNavFontWeight: siteContent.headerNavFontWeight,
            headerNavColor: siteContent.headerNavColor,
            headerCustomCss: siteContent.headerCustomCss,
            headerShowMemberSignIn: siteContent.headerShowMemberSignIn,
            headerMemberSignInText: siteContent.headerMemberSignInText,
            headerShowProductSearch: siteContent.headerShowProductSearch,
            headerSearchStyle: siteContent.headerSearchStyle,
            headerProfileAlwaysVisible: siteContent.headerProfileAlwaysVisible,
            headerElementOrder: siteContent.headerElementOrder,
            headerSecondaryBarEnabled: siteContent.headerSecondaryBarEnabled,
            headerSecondaryBarBgType: siteContent.headerSecondaryBarBgType,
            headerSecondaryBarBgColor: siteContent.headerSecondaryBarBgColor,
        };
        initialNavItemsRef.current = navItems;
        // Only snapshot when the panel first opens
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Dispatch inspector state so the editor canvas shifts margin
    useEffect(() => {
        if (!isOpen) return;
        dispatchBlockInspectorState({ open: true, blockId: '__header__', blockType: 'header' });
        return () => {
            dispatchBlockInspectorState({ open: false, blockId: '__header__', blockType: 'header' });
        };
    }, [isOpen]);

    // ── Resolved values (live read from siteContent) ──────────────────────
    const legacyLayout: HeaderLayout = siteContent.headerLayout || defaults.layout || 'default';
    const derivedLogoPos: LogoPosition = legacyLayout === 'centeredAboveNav' ? 'above' : 'left';
    const derivedNavPos: NavPosition = legacyLayout === 'centeredAboveNav' ? 'center' : 'right';
    const logoPosition: LogoPosition = siteContent.headerLogoPosition || defaults.logoPosition || derivedLogoPos;
    const navPosition: NavPosition = siteContent.headerNavPosition || defaults.navPosition || derivedNavPos;
    const desktopMenuStyle: DesktopMenuStyle = siteContent.headerDesktopMenuStyle || defaults.desktopMenuStyle || 'inline';
    const hamburgerPosition: HamburgerPosition = siteContent.headerHamburgerPosition || defaults.hamburgerPosition || 'right';
    const overlay: boolean = siteContent.headerOverlay != null
        ? Boolean(siteContent.headerOverlay)
        : (defaults.overlay ?? false);
    const rightSide: 'cta' | 'social' | 'none' = siteContent.headerRightSide || 'cta';
    const showBanner: boolean = siteContent.headerShowBanner != null
        ? Boolean(siteContent.headerShowBanner)
        : (defaults.showBanner ?? false);
    const bannerText: string = siteContent.headerBannerText || '';
    const bannerBgType: 'primary' | 'secondary' | 'custom' = siteContent.headerBannerBgType || 'primary';
    const bannerBgColor: string = siteContent.headerBannerBgColor || '';
    const bgType: HeaderBgType = siteContent.headerBgType || defaults.bgType || 'white';
    const bgColor: string = siteContent.headerBgColor || '';
    const sticky: 'always' | 'none' = siteContent.headerSticky || (defaults.sticky === false ? 'none' : 'always');
    const navFontSize: string = siteContent.headerNavFontSize || '';
    const navFontWeight: string = siteContent.headerNavFontWeight || '';
    const navColor: string = siteContent.headerNavColor || '';
    const customCss: string = siteContent.headerCustomCss || '';
    const showMemberSignIn: boolean = siteContent.headerShowMemberSignIn !== false;
    const memberSignInText: string = siteContent.headerMemberSignInText || '';
    const showProductSearch: boolean = siteContent.headerShowProductSearch !== false;
    const searchStyle: 'icon' | 'wide' = siteContent.headerSearchStyle || 'icon';
    const profileAlwaysVisible: boolean = !!siteContent.headerProfileAlwaysVisible;
    const elementOrder: HeaderRightElement[] = normalizeElementOrder(siteContent.headerElementOrder);
    const secondaryBarEnabled: boolean = !!siteContent.headerSecondaryBarEnabled;
    const secondaryBarBgType: 'primary' | 'secondary' | 'custom' = siteContent.headerSecondaryBarBgType || 'secondary';
    const secondaryBarBgColor: string = siteContent.headerSecondaryBarBgColor || '';

    const pPrimary = palette.primary || '#374151';
    const pSecondary = palette.secondary || '#10b981';

    // Detection: are these auth/membership/product features available?
    const hasMembershipBlock = !!siteContent.__hasMembershipBlock;
    const hasProductBlock = !!siteContent.__hasProductBlock
        || !!context?.blocks?.some(b => b.type === 'productGrid');

    // ── Bg preview swatch helper ──────────────────────────────────────────
    const getBgPreviewStyle = (value: HeaderBgType): React.CSSProperties => {
        switch (value) {
            case 'white': return { backgroundColor: '#ffffff', border: '1px solid #e2e8f0' };
            case 'primary': return { backgroundColor: pPrimary };
            case 'secondary': return { backgroundColor: pSecondary };
            case 'gradient': return { background: `linear-gradient(135deg, ${pPrimary}, ${pSecondary})` };
            case 'custom': return { backgroundColor: bgColor || '#e2e8f0' };
            case 'transparent': return {
                backgroundImage: 'linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)',
                backgroundSize: '8px 8px',
                backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
                border: '1px solid #e2e8f0',
            };
        }
    };

    // ── Reset & cancel ────────────────────────────────────────────────────
    const handleResetAll = () => {
        const snap = initialSnapshotRef.current;
        if (!snap) return;
        Object.entries(snap).forEach(([k, v]) => updateSiteContent(k, v));
        if (initialNavItemsRef.current) {
            updateNavItems?.(initialNavItemsRef.current);
        }
    };

    const handleCancel = () => {
        handleResetAll();
        onClose();
    };

    // ── Nav item editing ──────────────────────────────────────────────────
    const [editingItem, setEditingItem] = useState<NavItem | null>(null);
    const [editingParentId, setEditingParentId] = useState<string | null>(null);

    const handleAddItem = (bar: 'primary' | 'secondary' = 'primary') => {
        const newItem: NavItem = {
            id: `nav-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            label: 'New Link',
            linkType: 'custom',
            href: '#',
            ...(bar === 'secondary' ? { bar } as Partial<NavItem> : {}),
        };
        updateNavItems?.([...navItems, newItem]);
        setEditingItem(newItem);
        setEditingParentId(null);
    };

    const handleAddSubItem = (parentId: string) => {
        const newSub: NavItem = {
            id: `nav-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            label: 'New Sub Link',
            linkType: 'custom',
            href: '#',
        };
        const next = navItems.map((it) => (
            it.id === parentId
                ? { ...it, children: [...(it.children || []), newSub] }
                : it
        ));
        updateNavItems?.(next);
        setEditingItem(newSub);
        setEditingParentId(parentId);
    };

    const handleDeleteItem = (id: string) => {
        updateNavItems?.(navItems.filter((it) => it.id !== id));
    };

    const handleDeleteSubItem = (parentId: string, subId: string) => {
        const next = navItems.map((it) => (
            it.id === parentId
                ? { ...it, children: (it.children || []).filter((c) => c.id !== subId) }
                : it
        ));
        updateNavItems?.(next);
    };

    const handleSaveEditedItem = (updated: NavItem) => {
        if (editingParentId) {
            const next = navItems.map((it) => {
                if (it.id !== editingParentId) return it;
                return { ...it, children: (it.children || []).map(c => c.id === updated.id ? updated : c) };
            });
            updateNavItems?.(next);
        } else {
            updateNavItems?.(navItems.map((it) => it.id === updated.id ? updated : it));
        }
        setEditingItem(null);
        setEditingParentId(null);
    };

    const handleNavItemDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = navItems.findIndex(i => i.id === active.id);
        const newIndex = navItems.findIndex(i => i.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
            updateNavItems?.(arrayMove(navItems, oldIndex, newIndex));
        }
    };

    const toggleItemBar = (id: string) => {
        const next = navItems.map((it) => {
            if (it.id !== id) return it;
            const current = (it as NavItem & { bar?: 'primary' | 'secondary' }).bar || 'primary';
            return { ...it, bar: current === 'secondary' ? 'primary' : 'secondary' } as NavItem;
        });
        updateNavItems?.(next);
    };

    // ── Element order drag ────────────────────────────────────────────────
    const handleElementOrderDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = elementOrder.indexOf(active.id as HeaderRightElement);
        const newIndex = elementOrder.indexOf(over.id as HeaderRightElement);
        if (oldIndex !== -1 && newIndex !== -1) {
            updateSiteContent('headerElementOrder', arrayMove(elementOrder, oldIndex, newIndex));
        }
    };

    // ── Render ────────────────────────────────────────────────────────────
    const navItemIds = navItems.map(i => i.id);

    if (!isOpen) return null;

    const panel = (
        <aside
            data-tour="header-settings-panel"
            className="fixed inset-y-0 right-0 z-[10000] flex w-full max-w-md flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            aria-label="Header Settings"
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
                <div>
                    <h2 className="text-base font-bold text-slate-900">Header Settings</h2>
                    <p className="mt-1 text-xs text-slate-500">Changes update the canvas instantly.</p>
                    <button
                        type="button"
                        onClick={() => sectionState.setAll(!sectionState.allCollapsed)}
                        className="mt-2 text-xs font-bold text-blue-600 transition-colors hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {sectionState.allCollapsed ? 'Expand all' : 'Collapse all'}
                    </button>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Close Header Settings"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            {/* Body */}
            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">

                {/* ── LAYOUT ── */}
                <InspectorSection
                    id="layout"
                    title="Layout"
                    isCollapsed={sectionState.isCollapsed('layout')}
                    onToggle={() => sectionState.toggle('layout')}
                >
                    <div className="space-y-4">
                        <div>
                            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Logo position</p>
                            <div className="grid grid-cols-3 gap-2">
                                {([
                                    { value: 'left', label: 'Left' },
                                    { value: 'center', label: 'Center' },
                                    { value: 'above', label: 'Above' },
                                ] as const).map((opt) => {
                                    const active = logoPosition === opt.value;
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => {
                                                updateSiteContent('headerLogoPosition', opt.value);
                                                updateSiteContent('headerLayout', opt.value === 'above' ? 'centeredAboveNav' : 'default');
                                            }}
                                            className={`rounded-lg border px-3 py-2 text-center text-sm font-bold transition-all ${
                                                active
                                                    ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                                                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Nav position</p>
                            <div className="grid grid-cols-3 gap-2">
                                {(['left', 'center', 'right'] as const).map((opt) => {
                                    const active = navPosition === opt;
                                    return (
                                        <button
                                            key={opt}
                                            type="button"
                                            onClick={() => updateSiteContent('headerNavPosition', opt)}
                                            className={`rounded-lg border px-3 py-2 text-center text-sm font-bold capitalize transition-all ${
                                                active
                                                    ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                                                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                            }`}
                                        >
                                            {opt}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Desktop menu style</p>
                            <div className="grid grid-cols-2 gap-2">
                                {([
                                    { value: 'inline', label: 'Inline Links' },
                                    { value: 'hamburger', label: 'Hamburger' },
                                ] as const).map((opt) => {
                                    const active = desktopMenuStyle === opt.value;
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => updateSiteContent('headerDesktopMenuStyle', opt.value)}
                                            className={`rounded-lg border px-3 py-2 text-center text-sm font-bold transition-all ${
                                                active
                                                    ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                                                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    );
                                })}
                            </div>
                            {desktopMenuStyle === 'hamburger' && (
                                <div className="mt-3">
                                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Hamburger position</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(['left', 'right'] as const).map((opt) => {
                                            const active = hamburgerPosition === opt;
                                            return (
                                                <button
                                                    key={opt}
                                                    type="button"
                                                    onClick={() => updateSiteContent('headerHamburgerPosition', opt)}
                                                    className={`rounded-lg border px-3 py-2 text-center text-sm font-bold capitalize transition-all ${
                                                        active
                                                            ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                                                            : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    {opt}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        <InspectorToggle
                            label="Float over content"
                            description="Header overlays the next block (e.g. video hero) instead of taking its own space."
                            checked={overlay}
                            onChange={() => updateSiteContent('headerOverlay', !overlay)}
                        />
                    </div>
                </InspectorSection>

                {/* ── MENU ITEMS ── */}
                <InspectorSection
                    id="menu-items"
                    title="Menu Items"
                    isCollapsed={sectionState.isCollapsed('menu-items')}
                    onToggle={() => sectionState.toggle('menu-items')}
                >
                    <div className="space-y-2">
                        {navItems.length === 0 && (
                            <p className="text-xs text-slate-500">
                                No menu items yet. Click below to add one.
                            </p>
                        )}
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleNavItemDragEnd}
                        >
                            <SortableContext items={navItemIds} strategy={verticalListSortingStrategy}>
                                <div className="space-y-1.5">
                                    {navItems.map((item) => (
                                        <NavItemRow
                                            key={item.id}
                                            item={item}
                                            secondaryBarEnabled={secondaryBarEnabled}
                                            onEdit={() => { setEditingItem(item); setEditingParentId(null); }}
                                            onDelete={() => handleDeleteItem(item.id)}
                                            onAddSub={() => handleAddSubItem(item.id)}
                                            onToggleBar={() => toggleItemBar(item.id)}
                                            onEditChild={(child) => { setEditingItem(child); setEditingParentId(item.id); }}
                                            onDeleteChild={(childId) => handleDeleteSubItem(item.id, childId)}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>

                        <button
                            type="button"
                            onClick={() => handleAddItem('primary')}
                            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-blue-300 px-3 py-2 text-xs font-bold text-blue-600 transition-colors hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Add menu item
                        </button>
                    </div>
                </InspectorSection>

                {/* ── RIGHT-SIDE ELEMENT ── */}
                <InspectorSection
                    id="right-element"
                    title="Right-Side Element"
                    isCollapsed={sectionState.isCollapsed('right-element')}
                    onToggle={() => sectionState.toggle('right-element')}
                >
                    <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-2">
                            {([
                                { value: 'cta', label: 'CTA' },
                                { value: 'social', label: 'Social' },
                                { value: 'none', label: 'None' },
                            ] as const).map((opt) => {
                                const active = rightSide === opt.value;
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => updateSiteContent('headerRightSide', opt.value)}
                                        className={`rounded-lg border px-3 py-2 text-center text-sm font-bold transition-all ${
                                            active
                                                ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                                                : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>

                        {rightSide === 'social' && (
                            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Social URLs</p>
                                {([
                                    { key: 'headerSocialFacebook', label: 'Facebook' },
                                    { key: 'headerSocialInstagram', label: 'Instagram' },
                                    { key: 'headerSocialX', label: 'X / Twitter' },
                                    { key: 'headerSocialLinkedin', label: 'LinkedIn' },
                                    { key: 'headerSocialYoutube', label: 'YouTube' },
                                ]).map(({ key, label }) => (
                                    <div key={key} className="flex items-center gap-2">
                                        <span className="w-20 shrink-0 text-xs text-slate-600">{label}</span>
                                        <input
                                            type="url"
                                            value={(siteContent as Record<string, string>)[key] || ''}
                                            onChange={(e) => updateSiteContent(key, e.target.value)}
                                            placeholder="https://..."
                                            className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </InspectorSection>

                {/* ── MEMBERSHIP ── */}
                {hasMembershipBlock && (
                    <InspectorSection
                        id="membership"
                        title="Membership"
                        isCollapsed={sectionState.isCollapsed('membership')}
                        onToggle={() => sectionState.toggle('membership')}
                    >
                        <div className="space-y-3">
                            {rightSide === 'cta' && (
                                <>
                                    <InspectorToggle
                                        label='"Already a member?" link'
                                        description="Shown below the CTA button — links to /signin."
                                        checked={showMemberSignIn}
                                        onChange={() => updateSiteContent('headerShowMemberSignIn', !showMemberSignIn)}
                                    />
                                    {showMemberSignIn && (
                                        <input
                                            type="text"
                                            value={memberSignInText}
                                            onChange={(e) => updateSiteContent('headerMemberSignInText', e.target.value)}
                                            placeholder="Already a member? Sign In"
                                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    )}
                                </>
                            )}
                            <InspectorToggle
                                label="Always show profile icon"
                                description="Show the profile icon even when no member is signed in. Clicking takes visitors to /signin."
                                checked={profileAlwaysVisible}
                                onChange={() => updateSiteContent('headerProfileAlwaysVisible', !profileAlwaysVisible)}
                            />
                        </div>
                    </InspectorSection>
                )}

                {/* ── PRODUCT SEARCH ── */}
                {hasProductBlock && (
                    <InspectorSection
                        id="product-search"
                        title="Product Search"
                        isCollapsed={sectionState.isCollapsed('product-search')}
                        onToggle={() => sectionState.toggle('product-search')}
                    >
                        <div className="space-y-3">
                            <InspectorToggle
                                label="Show product search"
                                description="A search affordance in the header to let visitors find products."
                                checked={showProductSearch}
                                onChange={() => updateSiteContent('headerShowProductSearch', !showProductSearch)}
                            />
                            {showProductSearch && (
                                <div>
                                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Display style</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {([
                                            { value: 'icon', label: 'Icon (compact)' },
                                            { value: 'wide', label: 'Wide search bar' },
                                        ] as const).map((opt) => {
                                            const active = searchStyle === opt.value;
                                            return (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    onClick={() => updateSiteContent('headerSearchStyle', opt.value)}
                                                    className={`rounded-lg border px-3 py-2 text-center text-sm font-bold transition-all ${
                                                        active
                                                            ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                                                            : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </InspectorSection>
                )}

                {/* ── ELEMENT ORDER ── */}
                <InspectorSection
                    id="element-order"
                    title="Element Order"
                    isCollapsed={sectionState.isCollapsed('element-order')}
                    onToggle={() => sectionState.toggle('element-order')}
                >
                    <p className="mb-2 text-xs text-slate-500">
                        Drag to reorder the right-side cluster on desktop. Hidden elements will simply be skipped.
                    </p>
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleElementOrderDragEnd}
                    >
                        <SortableContext items={elementOrder} strategy={verticalListSortingStrategy}>
                            <div className="space-y-1.5">
                                {elementOrder.map((id) => (
                                    <ElementOrderRow key={id} id={id} label={ELEMENT_LABELS[id]} />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                    <button
                        type="button"
                        onClick={() => updateSiteContent('headerElementOrder', [...DEFAULT_HEADER_ELEMENT_ORDER])}
                        className="mt-2 text-xs font-semibold text-slate-500 hover:text-slate-700"
                    >
                        Reset to default order
                    </button>
                </InspectorSection>

                {/* ── SECONDARY NAV BAR ── */}
                <InspectorSection
                    id="secondary-bar"
                    title="Secondary Nav Bar"
                    isCollapsed={sectionState.isCollapsed('secondary-bar')}
                    onToggle={() => sectionState.toggle('secondary-bar')}
                >
                    <div className="space-y-3">
                        <InspectorToggle
                            label="Enable second navigation bar"
                            description="Adds a lower bar below the header for additional links with its own background."
                            checked={secondaryBarEnabled}
                            onChange={() => updateSiteContent('headerSecondaryBarEnabled', !secondaryBarEnabled)}
                        />
                        {secondaryBarEnabled && (
                            <>
                                <div>
                                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Bar background</p>
                                    <div className="flex flex-wrap gap-2">
                                        {([
                                            { value: 'primary', label: 'Primary', color: pPrimary },
                                            { value: 'secondary', label: 'Secondary', color: pSecondary },
                                            { value: 'custom', label: 'Custom', color: secondaryBarBgColor || '#000000' },
                                        ] as const).map((opt) => {
                                            const active = secondaryBarBgType === opt.value;
                                            return (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    onClick={() => updateSiteContent('headerSecondaryBarBgType', opt.value)}
                                                    className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
                                                        active ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600' : 'border-slate-200 hover:border-slate-300'
                                                    }`}
                                                >
                                                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: opt.color }} />
                                                    {opt.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {secondaryBarBgType === 'custom' && (
                                        <div className="mt-2 flex items-center gap-2">
                                            <input
                                                type="color"
                                                value={secondaryBarBgColor || '#000000'}
                                                onChange={(e) => updateSiteContent('headerSecondaryBarBgColor', e.target.value)}
                                                className="h-9 w-9 cursor-pointer rounded border border-slate-200"
                                            />
                                            <input
                                                type="text"
                                                value={secondaryBarBgColor}
                                                onChange={(e) => updateSiteContent('headerSecondaryBarBgColor', e.target.value)}
                                                placeholder="#000000"
                                                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500">
                                    Tip: in <strong>Menu Items</strong> above, toggle the <em>2nd bar</em> chip on any
                                    item to move it to the secondary bar.
                                </p>
                            </>
                        )}
                    </div>
                </InspectorSection>

                {/* ── ANNOUNCEMENT BANNER ── */}
                <InspectorSection
                    id="banner"
                    title="Announcement Banner"
                    isCollapsed={sectionState.isCollapsed('banner')}
                    onToggle={() => sectionState.toggle('banner')}
                >
                    <div className="space-y-3">
                        <InspectorToggle
                            label="Show banner"
                            description="A thin bar above the navigation."
                            checked={showBanner}
                            onChange={() => updateSiteContent('headerShowBanner', !showBanner)}
                        />
                        {showBanner && !defaults.isBannerClassic && (
                            <input
                                type="text"
                                value={bannerText}
                                onChange={(e) => updateSiteContent('headerBannerText', e.target.value)}
                                placeholder="🎉 Special offer — Limited time only!"
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        )}
                        {showBanner && (
                            <div>
                                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Banner background</p>
                                <div className="flex flex-wrap gap-2">
                                    {([
                                        { value: 'primary', label: 'Primary', color: pPrimary },
                                        { value: 'secondary', label: 'Secondary', color: pSecondary },
                                        { value: 'custom', label: 'Custom', color: bannerBgColor || '#000000' },
                                    ] as const).map((opt) => {
                                        const active = bannerBgType === opt.value;
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => updateSiteContent('headerBannerBgType', opt.value)}
                                                className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
                                                    active ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600' : 'border-slate-200 hover:border-slate-300'
                                                }`}
                                            >
                                                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: opt.color }} />
                                                {opt.label}
                                            </button>
                                        );
                                    })}
                                </div>
                                {bannerBgType === 'custom' && (
                                    <div className="mt-2 flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={bannerBgColor || '#000000'}
                                            onChange={(e) => updateSiteContent('headerBannerBgColor', e.target.value)}
                                            className="h-9 w-9 cursor-pointer rounded border border-slate-200"
                                        />
                                        <input
                                            type="text"
                                            value={bannerBgColor}
                                            onChange={(e) => updateSiteContent('headerBannerBgColor', e.target.value)}
                                            placeholder="#000000"
                                            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </InspectorSection>

                {/* ── BACKGROUND ── */}
                <InspectorSection
                    id="background"
                    title="Background & Sticky"
                    isCollapsed={sectionState.isCollapsed('background')}
                    onToggle={() => sectionState.toggle('background')}
                >
                    <div className="space-y-4">
                        <div>
                            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Header background</p>
                            <div className="grid grid-cols-2 gap-2">
                                {(['white', 'transparent', 'primary', 'secondary', 'gradient', 'custom'] as HeaderBgType[]).map((value) => {
                                    const labels: Record<HeaderBgType, string> = {
                                        white: 'White',
                                        transparent: 'Transparent',
                                        primary: 'Primary',
                                        secondary: 'Secondary',
                                        gradient: 'Gradient',
                                        custom: 'Custom',
                                    };
                                    const active = bgType === value;
                                    return (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => updateSiteContent('headerBgType', value)}
                                            className={`flex items-center gap-2 rounded-lg border p-2 text-left transition-all ${
                                                active ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-slate-200 hover:border-slate-300'
                                            }`}
                                        >
                                            <span className="h-7 w-7 shrink-0 rounded shadow-sm" style={getBgPreviewStyle(value)} />
                                            <span className="text-sm font-medium text-slate-700">{labels[value]}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            {bgType === 'custom' && (
                                <div className="mt-2 flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={getColorInputValue(bgColor, palette, '#ffffff')}
                                        onChange={(e) => updateSiteContent('headerBgColor', e.target.value)}
                                        className="h-9 w-9 cursor-pointer rounded border border-slate-200"
                                    />
                                    <input
                                        type="text"
                                        value={bgColor}
                                        onChange={(e) => updateSiteContent('headerBgColor', e.target.value)}
                                        placeholder="#ffffff"
                                        className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            )}
                        </div>

                        <div>
                            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Scroll behavior</p>
                            <div className="grid grid-cols-2 gap-2">
                                {([
                                    { value: 'always', label: 'Always Visible' },
                                    { value: 'none', label: 'Scrolls Away' },
                                ] as const).map((opt) => {
                                    const active = sticky === opt.value;
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => updateSiteContent('headerSticky', opt.value)}
                                            className={`rounded-lg border px-3 py-2 text-center text-sm font-bold transition-all ${
                                                active
                                                    ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                                                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </InspectorSection>

                {/* ── TYPOGRAPHY ── */}
                <InspectorSection
                    id="typography"
                    title="Typography"
                    isCollapsed={sectionState.isCollapsed('typography')}
                    onToggle={() => sectionState.toggle('typography')}
                >
                    <div className="space-y-4">
                        <div>
                            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Nav font size</label>
                            <input
                                type="text"
                                value={navFontSize}
                                onChange={(e) => updateSiteContent('headerNavFontSize', e.target.value)}
                                placeholder="e.g. 14px"
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <div className="mt-2 flex flex-wrap gap-1">
                                {['12px', '13px', '14px', '15px', '16px', '18px'].map((size) => (
                                    <button
                                        key={size}
                                        type="button"
                                        onClick={() => updateSiteContent('headerNavFontSize', navFontSize === size ? '' : size)}
                                        className={`rounded border px-2 py-1 text-xs transition-colors ${
                                            navFontSize === size ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                                        }`}
                                    >
                                        {size}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Nav font weight</label>
                            <div className="grid grid-cols-3 gap-1.5">
                                {[
                                    { v: '300', l: 'Light' },
                                    { v: '400', l: 'Regular' },
                                    { v: '500', l: 'Medium' },
                                    { v: '600', l: 'Semi' },
                                    { v: '700', l: 'Bold' },
                                    { v: '800', l: 'Heavy' },
                                ].map((opt) => {
                                    const active = navFontWeight === opt.v;
                                    return (
                                        <button
                                            key={opt.v}
                                            type="button"
                                            onClick={() => updateSiteContent('headerNavFontWeight', active ? '' : opt.v)}
                                            className={`rounded border px-2 py-1 text-xs transition-colors ${
                                                active ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                                            }`}
                                            style={{ fontWeight: parseInt(opt.v, 10) }}
                                        >
                                            {opt.l}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Nav color</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={getColorInputValue(navColor, palette, '#666666')}
                                    onChange={(e) => updateSiteContent('headerNavColor', e.target.value)}
                                    className="h-9 w-9 cursor-pointer rounded border border-slate-200"
                                />
                                <PaletteTokenButtons
                                    selected={navColor}
                                    palette={palette}
                                    onSelect={(token) => updateSiteContent('headerNavColor', token)}
                                />
                                <input
                                    type="text"
                                    value={navColor}
                                    onChange={(e) => updateSiteContent('headerNavColor', e.target.value)}
                                    placeholder="auto"
                                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    </div>
                </InspectorSection>

                {/* ── ADVANCED / CUSTOM CSS ── */}
                <InspectorSection
                    id="advanced"
                    title="Advanced"
                    isCollapsed={sectionState.isCollapsed('advanced')}
                    onToggle={() => sectionState.toggle('advanced')}
                >
                    {isProUser ? (
                        <div>
                            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Custom CSS</label>
                            <p className="mb-2 text-xs text-slate-500">Scoped to <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px] font-mono">.ks-site-header</code>.</p>
                            <textarea
                                value={customCss}
                                onChange={(e) => updateSiteContent('headerCustomCss', e.target.value)}
                                placeholder={`/* Example */\na { letter-spacing: 0.05em; }`}
                                className="min-h-40 w-full resize-y rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-sm text-green-400 outline-none focus:ring-2 focus:ring-blue-500"
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
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4">
                <button
                    type="button"
                    onClick={handleCancel}
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    Cancel
                </button>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleResetAll}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        Reset
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        Done
                    </button>
                </div>
            </div>

            {/* Nav item edit modal */}
            {editingItem && (
                <NavItemEditModal
                    item={editingItem}
                    pages={context?.pages || []}
                    blocks={context?.blocks || []}
                    siteId={context?.siteId}
                    onSave={handleSaveEditedItem}
                    onClose={() => { setEditingItem(null); setEditingParentId(null); }}
                />
            )}
        </aside>
    );

    return createPortal(panel, document.body);
}

// ─── Sortable nav-item row ────────────────────────────────────────────────

function NavItemRow({
    item,
    secondaryBarEnabled,
    onEdit,
    onDelete,
    onAddSub,
    onToggleBar,
    onEditChild,
    onDeleteChild,
}: {
    item: NavItem;
    secondaryBarEnabled: boolean;
    onEdit: () => void;
    onDelete: () => void;
    onAddSub: () => void;
    onToggleBar: () => void;
    onEditChild: (child: NavItem) => void;
    onDeleteChild: (childId: string) => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
    const [expanded, setExpanded] = useState(false);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    const itemBar: 'primary' | 'secondary' = (item as NavItem & { bar?: 'primary' | 'secondary' }).bar || 'primary';
    const hasChildren = !!(item.children && item.children.length > 0);

    return (
        <div ref={setNodeRef} style={style} className="rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center gap-1.5 px-2 py-1.5">
                <span
                    {...attributes}
                    {...listeners}
                    className="cursor-grab touch-none p-0.5 text-slate-400 hover:text-slate-600 active:cursor-grabbing"
                    title="Drag to reorder"
                >
                    <GripVertical className="h-4 w-4" />
                </span>
                <button
                    type="button"
                    onClick={() => setExpanded(!expanded)}
                    className="flex flex-1 items-center gap-1.5 rounded px-1 py-0.5 text-left transition-colors hover:bg-slate-50"
                >
                    {hasChildren && (
                        <ChevronDown className={`h-3 w-3 shrink-0 text-slate-400 transition-transform ${expanded ? '' : '-rotate-90'}`} />
                    )}
                    <span className="truncate text-sm font-semibold text-slate-800">{item.label || '(unnamed)'}</span>
                    {hasChildren && <span className="text-xs text-slate-400">({item.children!.length})</span>}
                </button>
                {secondaryBarEnabled && (
                    <button
                        type="button"
                        onClick={onToggleBar}
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide transition-colors ${
                            itemBar === 'secondary'
                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
                        }`}
                        title={itemBar === 'secondary' ? 'On secondary bar — click to move to primary' : 'On primary bar — click to move to secondary'}
                    >
                        {itemBar === 'secondary' ? '2nd bar' : '1st bar'}
                    </button>
                )}
                <button
                    type="button"
                    onClick={onAddSub}
                    className="rounded p-1 text-slate-400 transition-colors hover:bg-green-50 hover:text-green-600"
                    title="Add submenu item"
                >
                    <Plus className="h-3.5 w-3.5" />
                </button>
                <button
                    type="button"
                    onClick={onEdit}
                    className="rounded p-1 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                    title="Edit"
                >
                    <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                    type="button"
                    onClick={onDelete}
                    className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    title="Delete"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            </div>

            {hasChildren && expanded && (
                <div className="space-y-1 border-t border-slate-100 bg-slate-50 px-2 py-1.5">
                    {item.children!.map((sub) => (
                        <div key={sub.id} className="flex items-center gap-1.5 rounded bg-white px-2 py-1">
                            <span className="ml-3 flex-1 truncate text-xs text-slate-700">{sub.label || '(unnamed)'}</span>
                            <button
                                type="button"
                                onClick={() => onEditChild(sub)}
                                className="rounded p-0.5 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                                title="Edit"
                            >
                                <Pencil className="h-3 w-3" />
                            </button>
                            <button
                                type="button"
                                onClick={() => onDeleteChild(sub.id)}
                                className="rounded p-0.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                                title="Delete"
                            >
                                <Trash2 className="h-3 w-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Sortable element-order row ───────────────────────────────────────────

function ElementOrderRow({ id, label }: { id: string; label: string }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };
    return (
        <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
            <span
                {...attributes}
                {...listeners}
                className="cursor-grab touch-none p-0.5 text-slate-400 hover:text-slate-600 active:cursor-grabbing"
                title="Drag to reorder"
            >
                <GripVertical className="h-4 w-4" />
            </span>
            <span className="flex-1 text-sm font-medium text-slate-700">{label}</span>
        </div>
    );
}
