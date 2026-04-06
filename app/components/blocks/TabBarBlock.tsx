'use client';

import { useState } from 'react';
import { useEditorContext, NavItem } from '@/lib/editor-context';
import { usePathname } from 'next/navigation';
import { Plus, X, Pencil } from 'lucide-react';
import { useLangPrefix } from '@/lib/hooks/useLangPrefix';
import NavItemEditModal from '../NavItemEditModal';
import { getBlockSlug } from '@/lib/block-utils';
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
    horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ─── Types ───────────────────────────────────────────────────────────────────

type TabStyle = 'underline' | 'pills' | 'tabs' | 'buttons';
type TabAlign = 'left' | 'center' | 'right' | 'stretch';

interface TabBarBlockProps {
    id: string;
    data: any;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: (key: string, value: any) => void;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function TabBarBlock({ id, data, isEditMode, palette, updateContent }: TabBarBlockProps) {
    const context = useEditorContext();
    const pathname = usePathname();
    const langPrefix = useLangPrefix();

    const items: NavItem[] = Array.isArray(data?.items) ? data.items : [];
    const tabStyle: TabStyle = data?.tabStyle || 'underline';
    const tabAlign: TabAlign = data?.tabAlign || 'left';
    const activeColor: string = data?.activeColor || palette.primary || '#374151';
    const bgColor: string = data?.bgColor || '';

    const pages = context?.pages || [];
    const blocks = context?.blocks || [];
    const isEditor = pathname?.startsWith('/editor') || pathname?.startsWith('/design');

    // ── Resolve href for a tab item ──────────────────────────────────────────
    const resolveHref = (item: NavItem): string => {
        if (item.linkType === 'page') {
            if (isEditor) return `/design?siteId=${context?.siteId}&pageId=${item.pageId}`;
            if (context?.previewSiteId) return `/preview?siteId=${context.previewSiteId}&pageId=${item.pageId}`;
            const target = pages.find(p => p.id === item.pageId);
            const slug = target?.slug || '';
            const base = slug === 'home' ? '/' : `/${slug}`;
            return langPrefix ? `${langPrefix}${base === '/' ? '' : base}` : base;
        }
        if (item.linkType === 'section') {
            if (item.pageId && isEditor) {
                const hash = item.href?.includes('#') ? `#${item.href.split('#')[1]}` : '';
                return `/design?siteId=${context?.siteId}&pageId=${item.pageId}${hash}`;
            }
            if (item.blockId) {
                const idx = blocks.findIndex(b => b.id === item.blockId);
                if (idx !== -1) return `#${getBlockSlug(blocks[idx], idx, blocks)}`;
            }
            return item.href || `#${item.blockId}`;
        }
        return item.href || '#';
    };

    // ── Determine active tab ─────────────────────────────────────────────────
    const isActive = (item: NavItem): boolean => {
        if (isEditMode || item.linkType !== 'page') return false;
        const target = pages.find(p => p.id === item.pageId);
        const slug = target?.slug || '';
        const base = slug === 'home' ? '/' : `/${slug}`;
        const itemPath = langPrefix ? `${langPrefix}${base === '/' ? '' : base}` : base;
        return (pathname || '/') === itemPath;
    };

    if (isEditMode) {
        return (
            <TabBarEditor
                items={items}
                tabStyle={tabStyle}
                tabAlign={tabAlign}
                activeColor={activeColor}
                bgColor={bgColor}
                palette={palette}
                updateContent={updateContent}
                resolveHref={resolveHref}
                pages={pages}
                blocks={blocks}
                siteId={context?.siteId}
            />
        );
    }

    return (
        <TabBarView
            items={items}
            tabStyle={tabStyle}
            tabAlign={tabAlign}
            activeColor={activeColor}
            bgColor={bgColor}
            resolveHref={resolveHref}
            isActive={isActive}
        />
    );
}

// ─── Published View ──────────────────────────────────────────────────────────

function TabBarView({ items, tabStyle, tabAlign, activeColor, bgColor, resolveHref, isActive }: {
    items: NavItem[];
    tabStyle: TabStyle;
    tabAlign: TabAlign;
    activeColor: string;
    bgColor: string;
    resolveHref: (item: NavItem) => string;
    isActive: (item: NavItem) => boolean;
}) {
    if (items.length === 0) return null;

    const containerAlign =
        tabAlign === 'center' ? 'justify-center' :
        tabAlign === 'right' ? 'justify-end' :
        tabAlign === 'stretch' ? '' : 'justify-start';

    const outerStyle = bgColor ? { backgroundColor: bgColor } : {};

    return (
        <div className={`w-full ${bgColor ? 'px-4 py-2' : ''}`} style={outerStyle}>
            <nav className={`flex flex-wrap gap-1 ${tabAlign !== 'stretch' ? containerAlign : ''}`}>
                {items.map(item => {
                    const active = isActive(item);
                    const href = resolveHref(item);
                    const external = item.linkType === 'custom' && (item.href?.startsWith('http') || item.href?.startsWith('//'));

                    return (
                        <a
                            key={item.id}
                            href={href}
                            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                            className={getTabClass(tabStyle, active, tabAlign)}
                            style={getTabStyle(tabStyle, active, activeColor)}
                        >
                            {item.label}
                        </a>
                    );
                })}
            </nav>
        </div>
    );
}

// ─── Editor View ─────────────────────────────────────────────────────────────

function TabBarEditor({ items, tabStyle, tabAlign, activeColor, bgColor, palette, updateContent, resolveHref, pages, blocks, siteId }: {
    items: NavItem[];
    tabStyle: TabStyle;
    tabAlign: TabAlign;
    activeColor: string;
    bgColor: string;
    palette: Record<string, string>;
    updateContent: (key: string, value: any) => void;
    resolveHref: (item: NavItem) => string;
    pages: Array<{ id: string; slug: string; title: string }>;
    blocks: any[];
    siteId?: string;
}) {
    const [editingItem, setEditingItem] = useState<NavItem | null>(null);
    const [showSettings, setShowSettings] = useState(false);

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
    );

    const addTab = () => {
        const newItem: NavItem = {
            id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            label: 'New Tab',
            linkType: 'custom',
            href: '#',
        };
        const updated = [...items, newItem];
        updateContent('items', updated);
        setEditingItem(newItem);
    };

    const removeTab = (tabId: string) => {
        updateContent('items', items.filter(t => t.id !== tabId));
    };

    const saveTab = (updated: NavItem) => {
        updateContent('items', items.map(t => t.id === updated.id ? updated : t));
        setEditingItem(null);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIdx = items.findIndex(t => t.id === active.id);
            const newIdx = items.findIndex(t => t.id === over.id);
            updateContent('items', arrayMove(items, oldIdx, newIdx));
        }
    };

    const containerAlign =
        tabAlign === 'center' ? 'justify-center' :
        tabAlign === 'right' ? 'justify-end' : 'justify-start';

    return (
        <div className="w-full">
            {/* Tab bar */}
            <div className="relative rounded-lg border-2 border-dashed border-slate-200 p-3" style={bgColor ? { backgroundColor: bgColor } : {}}>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={items.map(t => t.id)} strategy={horizontalListSortingStrategy}>
                        <div className={`flex flex-wrap gap-1 ${tabAlign !== 'stretch' ? containerAlign : ''} min-h-[36px]`}>
                            {items.length === 0 && (
                                <span className="text-xs text-slate-400 italic self-center">No tabs yet — click + to add one</span>
                            )}
                            {items.map(item => (
                                <SortableTab
                                    key={item.id}
                                    item={item}
                                    tabStyle={tabStyle}
                                    tabAlign={tabAlign}
                                    activeColor={activeColor}
                                    onEdit={() => setEditingItem(item)}
                                    onRemove={() => removeTab(item.id)}
                                />
                            ))}
                            <button
                                onClick={addTab}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-700 border border-dashed border-slate-300 hover:border-slate-400 rounded-md transition-colors"
                                title="Add tab"
                            >
                                <Plus style={{ width: 13, height: 13 }} />
                                Add tab
                            </button>
                        </div>
                    </SortableContext>
                </DndContext>
            </div>

            {/* Settings bar */}
            <div className="flex items-center gap-3 mt-2 px-1 flex-wrap">
                {/* Style */}
                <div className="flex items-center gap-1">
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mr-1">Style</span>
                    {(['underline', 'pills', 'tabs', 'buttons'] as TabStyle[]).map(s => (
                        <button
                            key={s}
                            onClick={() => updateContent('tabStyle', s)}
                            className={`px-2 py-0.5 text-xs rounded transition-colors ${tabStyle === s ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
                {/* Alignment */}
                <div className="flex items-center gap-1">
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mr-1">Align</span>
                    {(['left', 'center', 'right', 'stretch'] as TabAlign[]).map(a => (
                        <button
                            key={a}
                            onClick={() => updateContent('tabAlign', a)}
                            className={`px-2 py-0.5 text-xs rounded transition-colors ${tabAlign === a ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                            {a}
                        </button>
                    ))}
                </div>
                {/* Active color */}
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Color</span>
                    <input
                        type="color"
                        value={activeColor}
                        onChange={e => updateContent('activeColor', e.target.value)}
                        className="w-6 h-6 rounded cursor-pointer border border-slate-200"
                        title="Active tab color"
                    />
                </div>
                {/* Background color */}
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Bar BG</span>
                    <input
                        type="color"
                        value={bgColor || '#ffffff'}
                        onChange={e => updateContent('bgColor', e.target.value === '#ffffff' ? '' : e.target.value)}
                        className="w-6 h-6 rounded cursor-pointer border border-slate-200"
                        title="Bar background color"
                    />
                    {bgColor && (
                        <button
                            onClick={() => updateContent('bgColor', '')}
                            className="text-[10px] text-slate-400 hover:text-slate-600"
                        >
                            clear
                        </button>
                    )}
                </div>
            </div>

            {/* Edit modal */}
            {editingItem && (
                <NavItemEditModal
                    item={editingItem}
                    pages={pages}
                    blocks={blocks}
                    siteId={siteId}
                    onSave={saveTab}
                    onClose={() => setEditingItem(null)}
                />
            )}
        </div>
    );
}

// ─── Sortable Tab (edit mode) ─────────────────────────────────────────────────

function SortableTab({ item, tabStyle, tabAlign, activeColor, onEdit, onRemove }: {
    item: NavItem;
    tabStyle: TabStyle;
    tabAlign: TabAlign;
    activeColor: string;
    onEdit: () => void;
    onRemove: () => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="relative group/tab flex items-center"
        >
            {/* Drag handle */}
            <span
                {...attributes}
                {...listeners}
                className="absolute -left-1 top-1/2 -translate-y-1/2 p-0.5 text-slate-300 opacity-0 group-hover/tab:opacity-100 cursor-grab active:cursor-grabbing transition-opacity"
            >
                <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor">
                    <circle cx="2" cy="2" r="1.5"/><circle cx="6" cy="2" r="1.5"/>
                    <circle cx="2" cy="6" r="1.5"/><circle cx="6" cy="6" r="1.5"/>
                    <circle cx="2" cy="10" r="1.5"/><circle cx="6" cy="10" r="1.5"/>
                </svg>
            </span>

            {/* Tab itself */}
            <button
                onClick={onEdit}
                className={`${getTabClass(tabStyle, false, tabAlign)} pr-5 cursor-pointer`}
                style={getTabStyle(tabStyle, false, activeColor)}
                title="Click to edit"
            >
                {item.label}
            </button>

            {/* Edit / remove overlay */}
            <div className="absolute top-0 right-0 flex opacity-0 group-hover/tab:opacity-100 transition-opacity z-10">
                <button
                    onClick={onEdit}
                    className="p-0.5 bg-white border border-slate-200 rounded-tl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title="Edit"
                >
                    <Pencil style={{ width: 10, height: 10 }} />
                </button>
                <button
                    onClick={onRemove}
                    className="p-0.5 bg-white border border-slate-200 rounded-tr text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Remove"
                >
                    <X style={{ width: 10, height: 10 }} />
                </button>
            </div>
        </div>
    );
}

// ─── Style helpers ────────────────────────────────────────────────────────────

function getTabClass(style: TabStyle, active: boolean, align: TabAlign): string {
    const stretch = align === 'stretch' ? 'flex-1 justify-center text-center' : '';
    const base = `inline-flex items-center text-sm font-medium transition-all whitespace-nowrap ${stretch}`;

    switch (style) {
        case 'underline':
            return `${base} px-3 py-2 border-b-2 ${
                active
                    ? 'border-current'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`;
        case 'pills':
            return `${base} px-4 py-1.5 rounded-full ${
                active
                    ? 'text-white'
                    : 'text-slate-600 hover:bg-slate-100'
            }`;
        case 'tabs':
            return `${base} px-4 py-2 rounded-t-lg border border-b-0 ${
                active
                    ? 'bg-white border-slate-200 text-slate-900'
                    : 'bg-transparent border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200'
            }`;
        case 'buttons':
            return `${base} px-4 py-2 rounded-lg border ${
                active
                    ? 'text-white border-transparent'
                    : 'text-slate-600 border-slate-200 hover:border-slate-400 hover:text-slate-800'
            }`;
        default:
            return base;
    }
}

function getTabStyle(style: TabStyle, active: boolean, activeColor: string): React.CSSProperties {
    if (!active) return {};
    switch (style) {
        case 'underline': return { color: activeColor, borderColor: activeColor };
        case 'pills':     return { backgroundColor: activeColor };
        case 'buttons':   return { backgroundColor: activeColor };
        case 'tabs':      return { color: activeColor };
        default:          return { color: activeColor };
    }
}
