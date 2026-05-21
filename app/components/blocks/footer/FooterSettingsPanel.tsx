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
    Layout as LayoutIcon,
    AlignCenter,
    AlignLeft,
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
import type { SiteFooterDefaults, FooterBgType, FooterLayout } from '../../SiteFooter';

// ─── Constants ────────────────────────────────────────────────────────────

const SECTION_IDS = [
    'layout',
    'content',
    'logo',
    'navigation',
    'social',
    'contact',
    'copyright',
    'background',
    'typography',
    'advanced',
];

const LAYOUT_OPTIONS: Array<{ value: FooterLayout; label: string; description: string }> = [
    { value: 'simple', label: 'Simple Split', description: 'Brand left, info right.' },
    { value: 'centered', label: 'Centered', description: 'Stacked & centered.' },
    { value: 'columns', label: 'Columns', description: '4-column with bottom row.' },
    { value: 'minimal', label: 'Minimal', description: 'Single line, brand + ©.' },
    { value: 'card', label: 'Card', description: 'Centered inside a card.' },
];

// ─── Props ────────────────────────────────────────────────────────────────

interface FooterSettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    palette: Record<string, string>;
    defaults: SiteFooterDefaults;
    isProUser?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────

export default function FooterSettingsPanel({
    isOpen,
    onClose,
    palette,
    defaults,
    isProUser,
}: FooterSettingsPanelProps) {
    const context = useEditorContext();
    const siteContent = context?.siteContent || {};
    const updateSiteContent = context?.updateSiteContent || (() => {});

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    );

    const sectionState = useInspectorSectionState(SECTION_IDS, true);

    // Snapshot for Reset / Cancel
    const initialSnapshotRef = useRef<Record<string, unknown> | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        initialSnapshotRef.current = {
            footerLayout: siteContent.footerLayout,
            footerBgType: siteContent.footerBgType,
            footerBgColor: siteContent.footerBgColor,
            showFooterLogo: siteContent.showFooterLogo,
            footerLogo: siteContent.footerLogo,
            footerLogoHeight: siteContent.footerLogoHeight,
            footerLogoPosition: siteContent.footerLogoPosition,
            showFooterTitle: siteContent.showFooterTitle,
            showFooterTagline: siteContent.showFooterTagline,
            footerTagline: siteContent.footerTagline,
            showFooterCopyright: siteContent.showFooterCopyright,
            footerCopyrightText: siteContent.footerCopyrightText,
            footerNavMode: siteContent.footerNavMode,
            footerNavItems: siteContent.footerNavItems,
            showFooterSocial: siteContent.showFooterSocial,
            footerSocialFacebook: siteContent.footerSocialFacebook,
            footerSocialInstagram: siteContent.footerSocialInstagram,
            footerSocialX: siteContent.footerSocialX,
            footerSocialLinkedin: siteContent.footerSocialLinkedin,
            footerSocialYoutube: siteContent.footerSocialYoutube,
            footerSocialWhatsapp: siteContent.footerSocialWhatsapp,
            showFooterContact: siteContent.showFooterContact,
            footerContactPhone: siteContent.footerContactPhone,
            footerContactEmail: siteContent.footerContactEmail,
            footerContactAddress: siteContent.footerContactAddress,
            showFooterLegalLinks: siteContent.showFooterLegalLinks,
            footerLegalLinks: siteContent.footerLegalLinks,
            footerTextColor: siteContent.footerTextColor,
            footerLinkColor: siteContent.footerLinkColor,
            footerCustomCss: siteContent.footerCustomCss,
            footerSlogan: siteContent.footerSlogan,
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Dispatch inspector state so the editor canvas shifts margin
    useEffect(() => {
        if (!isOpen) return;
        dispatchBlockInspectorState({ open: true, blockId: '__footer__', blockType: 'footer' });
        return () => {
            dispatchBlockInspectorState({ open: false, blockId: '__footer__', blockType: 'footer' });
        };
    }, [isOpen]);

    // ── Resolved values ───────────────────────────────────────────────────
    const layout: FooterLayout = (siteContent.footerLayout as FooterLayout) || defaults.layout || 'simple';
    const bgType: FooterBgType = (siteContent.footerBgType as FooterBgType) || defaults.bgType || 'transparent';
    const bgColor: string = siteContent.footerBgColor || '';
    const showLogo: boolean = siteContent.showFooterLogo !== false;
    const showTitle: boolean = siteContent.showFooterTitle !== false;
    const showTagline: boolean = !!siteContent.showFooterTagline;
    const showCopyright: boolean = !!siteContent.showFooterCopyright;
    const showSocial: boolean = !!siteContent.showFooterSocial;
    const showContact: boolean = !!siteContent.showFooterContact;
    const showLegalLinks: boolean = !!siteContent.showFooterLegalLinks;
    const navMode: 'none' | 'header' | 'custom' = (siteContent.footerNavMode as 'none' | 'header' | 'custom') || 'none';
    const customFooterNavItems: NavItem[] = Array.isArray(siteContent.footerNavItems)
        ? (siteContent.footerNavItems as NavItem[])
        : [];
    const legalLinks: NavItem[] = Array.isArray(siteContent.footerLegalLinks)
        ? (siteContent.footerLegalLinks as NavItem[])
        : [];
    const logoPosition: 'left' | 'center' = (siteContent.footerLogoPosition as 'left' | 'center')
        || (layout === 'centered' || layout === 'card' ? 'center' : 'left');
    const logoHeight: number = siteContent.footerLogoHeight ? Number(siteContent.footerLogoHeight) : (defaults.logoSize || 28);
    const textColor: string = siteContent.footerTextColor || '';
    const linkColor: string = siteContent.footerLinkColor || '';
    const customCss: string = siteContent.footerCustomCss || '';

    const pPrimary = palette.primary || '#374151';
    const pSecondary = palette.secondary || '#10b981';

    // ── Bg preview swatch ─────────────────────────────────────────────────
    const getBgPreviewStyle = (value: FooterBgType): React.CSSProperties => {
        switch (value) {
            case 'white':
                return { backgroundColor: '#ffffff', border: '1px solid #e2e8f0' };
            case 'primary':
                return { backgroundColor: pPrimary };
            case 'secondary':
                return { backgroundColor: pSecondary };
            case 'gradient':
                return { background: `linear-gradient(135deg, ${pPrimary}, ${pSecondary})` };
            case 'dark':
                return { backgroundColor: '#0a0f1a' };
            case 'custom':
                return { backgroundColor: bgColor || '#e2e8f0' };
            case 'transparent':
                return {
                    backgroundImage:
                        'linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)',
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
    };

    const handleCancel = () => {
        handleResetAll();
        onClose();
    };

    // ── Custom footer nav-item editing ────────────────────────────────────
    const [editingItem, setEditingItem] = useState<NavItem | null>(null);
    const [editingTarget, setEditingTarget] = useState<'nav' | 'legal'>('nav');

    const setItems = (target: 'nav' | 'legal', items: NavItem[]) => {
        if (target === 'nav') updateSiteContent('footerNavItems', items);
        else updateSiteContent('footerLegalLinks', items);
    };

    const handleAddItem = (target: 'nav' | 'legal') => {
        const list = target === 'nav' ? customFooterNavItems : legalLinks;
        const newItem: NavItem = {
            id: `footer-${target}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            label: target === 'legal' ? 'Privacy Policy' : 'New Link',
            linkType: 'custom',
            href: '#',
        };
        setItems(target, [...list, newItem]);
        setEditingItem(newItem);
        setEditingTarget(target);
    };

    const handleDeleteItem = (target: 'nav' | 'legal', id: string) => {
        const list = target === 'nav' ? customFooterNavItems : legalLinks;
        setItems(target, list.filter((it) => it.id !== id));
    };

    const handleSaveEditedItem = (updated: NavItem) => {
        const list = editingTarget === 'nav' ? customFooterNavItems : legalLinks;
        setItems(editingTarget, list.map((it) => (it.id === updated.id ? updated : it)));
        setEditingItem(null);
    };

    const handleNavDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = customFooterNavItems.findIndex((i) => i.id === active.id);
        const newIndex = customFooterNavItems.findIndex((i) => i.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
            setItems('nav', arrayMove(customFooterNavItems, oldIndex, newIndex));
        }
    };

    const handleLegalDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = legalLinks.findIndex((i) => i.id === active.id);
        const newIndex = legalLinks.findIndex((i) => i.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
            setItems('legal', arrayMove(legalLinks, oldIndex, newIndex));
        }
    };

    if (!isOpen) return null;

    const panel = (
        <aside
            data-tour="footer-settings-panel"
            className="fixed inset-y-0 right-0 z-[10000] flex w-full max-w-md flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            aria-label="Footer Settings"
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
                <div>
                    <h2 className="text-base font-bold text-slate-900">Footer Settings</h2>
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
                    aria-label="Close footer settings"
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
                            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Preset</p>
                            <div className="grid grid-cols-1 gap-2">
                                {LAYOUT_OPTIONS.map((opt) => {
                                    const active = layout === opt.value;
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => updateSiteContent('footerLayout', opt.value)}
                                            aria-pressed={active}
                                            className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${
                                                active
                                                    ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                                                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                            }`}
                                        >
                                            <LayoutIcon className={`h-4 w-4 mt-0.5 shrink-0 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                                            <span className="flex-1">
                                                <span className={`block text-sm font-bold ${active ? 'text-blue-700' : 'text-slate-700'}`}>{opt.label}</span>
                                                <span className="block text-xs text-slate-500">{opt.description}</span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {(layout === 'simple' || layout === 'minimal' || layout === 'columns') && (
                            <div>
                                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Logo position</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {([
                                        { value: 'left', label: 'Left', Icon: AlignLeft },
                                        { value: 'center', label: 'Center', Icon: AlignCenter },
                                    ] as const).map(({ value, label, Icon }) => {
                                        const active = logoPosition === value;
                                        return (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => updateSiteContent('footerLogoPosition', value)}
                                                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold transition-all ${
                                                    active
                                                        ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                                                        : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                                }`}
                                            >
                                                <Icon className="h-3.5 w-3.5" />
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </InspectorSection>

                {/* ── CONTENT ELEMENTS ── */}
                <InspectorSection
                    id="content"
                    title="Content Elements"
                    isCollapsed={sectionState.isCollapsed('content')}
                    onToggle={() => sectionState.toggle('content')}
                >
                    <div className="space-y-1">
                        <InspectorToggle
                            label="Logo"
                            checked={showLogo}
                            onChange={() => updateSiteContent('showFooterLogo', !showLogo)}
                        />
                        <InspectorToggle
                            label="Site title"
                            checked={showTitle}
                            onChange={() => updateSiteContent('showFooterTitle', !showTitle)}
                        />
                        <InspectorToggle
                            label="Tagline"
                            description="Short descriptor under the brand."
                            checked={showTagline}
                            onChange={() => updateSiteContent('showFooterTagline', !showTagline)}
                        />
                        <InspectorToggle
                            label="Navigation"
                            description="Reuse header menu or set distinct footer links."
                            checked={navMode !== 'none'}
                            onChange={() => updateSiteContent('footerNavMode', navMode === 'none' ? 'header' : 'none')}
                        />
                        <InspectorToggle
                            label="Social links"
                            checked={showSocial}
                            onChange={() => updateSiteContent('showFooterSocial', !showSocial)}
                        />
                        <InspectorToggle
                            label="Contact info"
                            description="Phone, email, address."
                            checked={showContact}
                            onChange={() => updateSiteContent('showFooterContact', !showContact)}
                        />
                        <InspectorToggle
                            label="Copyright line"
                            checked={showCopyright}
                            onChange={() => updateSiteContent('showFooterCopyright', !showCopyright)}
                        />
                        <InspectorToggle
                            label="Legal links"
                            description="Small links like Privacy Policy, Terms."
                            checked={showLegalLinks}
                            onChange={() => updateSiteContent('showFooterLegalLinks', !showLegalLinks)}
                        />
                    </div>
                </InspectorSection>

                {/* ── LOGO ── */}
                <InspectorSection
                    id="logo"
                    title="Logo"
                    isCollapsed={sectionState.isCollapsed('logo')}
                    onToggle={() => sectionState.toggle('logo')}
                >
                    <div className="space-y-3">
                        <p className="text-xs text-slate-500">
                            Footer logo image is set via the global Site Logo. Override here if needed.
                        </p>
                        <div>
                            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                                Logo image URL
                            </label>
                            <input
                                type="url"
                                value={siteContent.footerLogo || ''}
                                onChange={(e) => updateSiteContent('footerLogo', e.target.value)}
                                placeholder="Leave empty to use the site logo"
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                                Logo height (px)
                            </label>
                            <input
                                type="number"
                                value={logoHeight}
                                min={12}
                                max={200}
                                onChange={(e) => updateSiteContent('footerLogoHeight', e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                </InspectorSection>

                {/* ── NAVIGATION ── */}
                <InspectorSection
                    id="navigation"
                    title="Navigation"
                    isCollapsed={sectionState.isCollapsed('navigation')}
                    onToggle={() => sectionState.toggle('navigation')}
                >
                    <div className="space-y-3">
                        <div>
                            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Menu source</p>
                            <div className="grid grid-cols-3 gap-2">
                                {([
                                    { value: 'none', label: 'None' },
                                    { value: 'header', label: 'Same as header' },
                                    { value: 'custom', label: 'Custom' },
                                ] as const).map((opt) => {
                                    const active = navMode === opt.value;
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => updateSiteContent('footerNavMode', opt.value)}
                                            className={`rounded-lg border px-2 py-2 text-center text-xs font-bold transition-all ${
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

                        {navMode === 'custom' && (
                            <div className="space-y-2">
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={handleNavDragEnd}
                                >
                                    <SortableContext
                                        items={customFooterNavItems.map((i) => i.id)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        <div className="space-y-1.5">
                                            {customFooterNavItems.map((item) => (
                                                <SimpleNavItemRow
                                                    key={item.id}
                                                    item={item}
                                                    onEdit={() => {
                                                        setEditingItem(item);
                                                        setEditingTarget('nav');
                                                    }}
                                                    onDelete={() => handleDeleteItem('nav', item.id)}
                                                />
                                            ))}
                                        </div>
                                    </SortableContext>
                                </DndContext>
                                <button
                                    type="button"
                                    onClick={() => handleAddItem('nav')}
                                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-blue-300 px-3 py-2 text-xs font-bold text-blue-600 transition-colors hover:bg-blue-50"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    Add footer link
                                </button>
                            </div>
                        )}

                        {navMode === 'header' && (
                            <p className="rounded-md bg-slate-50 p-2 text-xs text-slate-500">
                                Footer will mirror the header menu items.
                            </p>
                        )}
                    </div>
                </InspectorSection>

                {/* ── SOCIAL LINKS ── */}
                {showSocial && (
                    <InspectorSection
                        id="social"
                        title="Social Links"
                        isCollapsed={sectionState.isCollapsed('social')}
                        onToggle={() => sectionState.toggle('social')}
                    >
                        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                            {([
                                { key: 'footerSocialFacebook', label: 'Facebook' },
                                { key: 'footerSocialInstagram', label: 'Instagram' },
                                { key: 'footerSocialX', label: 'X / Twitter' },
                                { key: 'footerSocialLinkedin', label: 'LinkedIn' },
                                { key: 'footerSocialYoutube', label: 'YouTube' },
                                { key: 'footerSocialWhatsapp', label: 'WhatsApp' },
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
                            <button
                                type="button"
                                onClick={() => {
                                    // Mirror header social links
                                    if (siteContent.headerSocialFacebook) updateSiteContent('footerSocialFacebook', siteContent.headerSocialFacebook);
                                    if (siteContent.headerSocialInstagram) updateSiteContent('footerSocialInstagram', siteContent.headerSocialInstagram);
                                    if (siteContent.headerSocialX) updateSiteContent('footerSocialX', siteContent.headerSocialX);
                                    if (siteContent.headerSocialLinkedin) updateSiteContent('footerSocialLinkedin', siteContent.headerSocialLinkedin);
                                    if (siteContent.headerSocialYoutube) updateSiteContent('footerSocialYoutube', siteContent.headerSocialYoutube);
                                    if (siteContent.headerSocialWhatsapp) updateSiteContent('footerSocialWhatsapp', siteContent.headerSocialWhatsapp);
                                }}
                                className="mt-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                            >
                                Copy from header
                            </button>
                        </div>
                    </InspectorSection>
                )}

                {/* ── CONTACT INFO ── */}
                {showContact && (
                    <InspectorSection
                        id="contact"
                        title="Contact Info"
                        isCollapsed={sectionState.isCollapsed('contact')}
                        onToggle={() => sectionState.toggle('contact')}
                    >
                        <div className="space-y-2">
                            <div>
                                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Phone</label>
                                <input
                                    type="tel"
                                    value={siteContent.footerContactPhone || ''}
                                    onChange={(e) => updateSiteContent('footerContactPhone', e.target.value)}
                                    placeholder="(555) 123-4567"
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Email</label>
                                <input
                                    type="email"
                                    value={siteContent.footerContactEmail || ''}
                                    onChange={(e) => updateSiteContent('footerContactEmail', e.target.value)}
                                    placeholder="hello@example.com"
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Address</label>
                                <input
                                    type="text"
                                    value={siteContent.footerContactAddress || ''}
                                    onChange={(e) => updateSiteContent('footerContactAddress', e.target.value)}
                                    placeholder="123 Main St, City, ST 12345"
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    </InspectorSection>
                )}

                {/* ── COPYRIGHT & LEGAL ── */}
                <InspectorSection
                    id="copyright"
                    title="Copyright & Legal"
                    isCollapsed={sectionState.isCollapsed('copyright')}
                    onToggle={() => sectionState.toggle('copyright')}
                >
                    <div className="space-y-3">
                        {showCopyright && (
                            <div>
                                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                                    Copyright text
                                </label>
                                <input
                                    type="text"
                                    value={siteContent.footerCopyrightText || ''}
                                    onChange={(e) => updateSiteContent('footerCopyrightText', e.target.value)}
                                    placeholder="© {year} Your Business"
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <p className="mt-1 text-xs text-slate-500">
                                    Use <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px] font-mono">{'{year}'}</code> for current year.
                                </p>
                            </div>
                        )}
                        {showLegalLinks && (
                            <div className="space-y-2">
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Legal links</p>
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={handleLegalDragEnd}
                                >
                                    <SortableContext
                                        items={legalLinks.map((i) => i.id)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        <div className="space-y-1.5">
                                            {legalLinks.map((item) => (
                                                <SimpleNavItemRow
                                                    key={item.id}
                                                    item={item}
                                                    onEdit={() => {
                                                        setEditingItem(item);
                                                        setEditingTarget('legal');
                                                    }}
                                                    onDelete={() => handleDeleteItem('legal', item.id)}
                                                />
                                            ))}
                                        </div>
                                    </SortableContext>
                                </DndContext>
                                <button
                                    type="button"
                                    onClick={() => handleAddItem('legal')}
                                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-blue-300 px-3 py-2 text-xs font-bold text-blue-600 transition-colors hover:bg-blue-50"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    Add legal link
                                </button>
                            </div>
                        )}
                    </div>
                </InspectorSection>

                {/* ── BACKGROUND ── */}
                <InspectorSection
                    id="background"
                    title="Background"
                    isCollapsed={sectionState.isCollapsed('background')}
                    onToggle={() => sectionState.toggle('background')}
                >
                    <div>
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                            Footer background
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            {(['transparent', 'white', 'primary', 'secondary', 'gradient', 'dark', 'custom'] as FooterBgType[]).map((value) => {
                                const labels: Record<FooterBgType, string> = {
                                    transparent: 'Transparent',
                                    white: 'White',
                                    primary: 'Primary',
                                    secondary: 'Secondary',
                                    gradient: 'Gradient',
                                    dark: 'Dark',
                                    custom: 'Custom',
                                };
                                const active = bgType === value;
                                return (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => updateSiteContent('footerBgType', value)}
                                        className={`flex items-center gap-2 rounded-lg border p-2 text-left transition-all ${
                                            active
                                                ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                                                : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        <span
                                            className="h-7 w-7 shrink-0 rounded shadow-sm"
                                            style={getBgPreviewStyle(value)}
                                        />
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
                                    onChange={(e) => updateSiteContent('footerBgColor', e.target.value)}
                                    className="h-9 w-9 cursor-pointer rounded border border-slate-200"
                                />
                                <PaletteTokenButtons
                                    selected={bgColor}
                                    palette={palette}
                                    onSelect={(token) => updateSiteContent('footerBgColor', token)}
                                />
                                <input
                                    type="text"
                                    value={bgColor}
                                    onChange={(e) => updateSiteContent('footerBgColor', e.target.value)}
                                    placeholder="#ffffff"
                                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        )}
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
                            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                                Text color
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={getColorInputValue(textColor, palette, '#666666')}
                                    onChange={(e) => updateSiteContent('footerTextColor', e.target.value)}
                                    className="h-9 w-9 cursor-pointer rounded border border-slate-200"
                                />
                                <PaletteTokenButtons
                                    selected={textColor}
                                    palette={palette}
                                    onSelect={(token) => updateSiteContent('footerTextColor', token)}
                                />
                                <input
                                    type="text"
                                    value={textColor}
                                    onChange={(e) => updateSiteContent('footerTextColor', e.target.value)}
                                    placeholder="auto"
                                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                                Link color
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={getColorInputValue(linkColor, palette, '#666666')}
                                    onChange={(e) => updateSiteContent('footerLinkColor', e.target.value)}
                                    className="h-9 w-9 cursor-pointer rounded border border-slate-200"
                                />
                                <PaletteTokenButtons
                                    selected={linkColor}
                                    palette={palette}
                                    onSelect={(token) => updateSiteContent('footerLinkColor', token)}
                                />
                                <input
                                    type="text"
                                    value={linkColor}
                                    onChange={(e) => updateSiteContent('footerLinkColor', e.target.value)}
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
                            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                                Custom CSS
                            </label>
                            <p className="mb-2 text-xs text-slate-500">
                                Scoped to <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px] font-mono">.ks-site-footer</code>.
                            </p>
                            <textarea
                                value={customCss}
                                onChange={(e) => updateSiteContent('footerCustomCss', e.target.value)}
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
                    onClose={() => setEditingItem(null)}
                />
            )}
        </aside>
    );

    return createPortal(panel, document.body);
}

// ─── Sortable simple nav-item row (no submenus) ──────────────────────────

function SimpleNavItemRow({
    item,
    onEdit,
    onDelete,
}: {
    item: NavItem;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: item.id,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

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
                <span className="flex-1 truncate text-sm font-semibold text-slate-800">
                    {item.label || '(unnamed)'}
                </span>
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
        </div>
    );
}
