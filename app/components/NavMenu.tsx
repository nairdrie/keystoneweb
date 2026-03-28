'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus, X, Pencil, ChevronDown, GripVertical } from 'lucide-react';
import { useEditorContext, NavItem } from '@/lib/editor-context';
import NavItemEditModal from './NavItemEditModal';
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
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface NavMenuProps {
    /** Additional CSS classes for the nav container */
    className?: string;
    /** Additional CSS classes for each link item */
    itemClassName?: string;
    /** Additional CSS classes for the submenu dropdown panel (desktop) */
    submenuClassName?: string;
}

export default function NavMenu({ className = '', itemClassName = '', submenuClassName = '' }: NavMenuProps) {
    const context = useEditorContext();
    const navItems = context?.navItems || [];
    const isEditMode = context?.isEditMode || false;
    const updateNavItems = context?.updateNavItems;
    const pages = context?.pages || [];
    const blocks = context?.blocks || [];
    const siteContent = context?.siteContent;

    const pathname = usePathname();
    const isEditor = pathname?.startsWith('/editor') || pathname?.startsWith('/design');

    // Language prefix for published multilingual sites
    const currentLanguage = siteContent?.__currentLanguage as string | undefined;
    const translationsConfig = siteContent?.__translationsConfig as { enabled?: boolean; defaultLanguage?: string } | undefined;
    const defaultLanguage = translationsConfig?.defaultLanguage || 'en';
    const langPrefix = (!isEditor && translationsConfig?.enabled && currentLanguage && currentLanguage !== defaultLanguage)
        ? `/${currentLanguage}`
        : '';

    const [editingItem, setEditingItem] = useState<NavItem | null>(null);
    const [editingParentId, setEditingParentId] = useState<string | null>(null);

    const [expandedMobileItems, setExpandedMobileItems] = useState<Set<string>>(new Set());

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
    );

    const resolveHref = (item: NavItem): string => {
        if (item.linkType === 'page') {
            if (isEditor) {
                return `/design?siteId=${context?.siteId}&pageId=${item.pageId}`;
            }
            const targetPage = pages.find(p => p.id === item.pageId);
            const slug = targetPage ? targetPage.slug : '';
            const basePath = slug === 'home' ? '/' : `/${slug}`;
            return langPrefix ? `${langPrefix}${basePath === '/' ? '' : basePath}` : basePath;
        } else if (item.linkType === 'section') {
            if (item.pageId) {
                if (isEditor) {
                    const hash = item.href?.includes('#') ? `#${item.href.split('#')[1]}` : '';
                    return `/design?siteId=${context?.siteId}&pageId=${item.pageId}${hash}`;
                }
                return item.href || `#${item.blockId}`;
            }
            const blockIndex = blocks.findIndex(b => b.id === item.blockId);
            if (blockIndex !== -1) {
                return `#${getBlockSlug(blocks[blockIndex], blockIndex, blocks)}`;
            }
            return `#${item.blockId}`;
        }
        return item.href;
    };

    const isActivePage = (item: NavItem): boolean => {
        if (isEditMode || item.linkType !== 'page') return false;
        const targetPage = pages.find(p => p.id === item.pageId);
        const slug = targetPage?.slug || '';
        const basePath = slug === 'home' ? '/' : `/${slug}`;
        const itemPath = langPrefix ? `${langPrefix}${basePath === '/' ? '' : basePath}` : basePath;
        const normalizedPathname = pathname === '' ? '/' : pathname;
        return normalizedPathname === itemPath;
    };

    const handleSaveItem = (updated: NavItem) => {
        if (editingParentId) {
            const newItems = navItems.map((it) => {
                if (it.id === editingParentId) {
                    const newChildren = (it.children || []).map(c => c.id === updated.id ? updated : c);
                    return { ...it, children: newChildren };
                }
                return it;
            });
            updateNavItems?.(newItems);
        } else {
            const newItems = navItems.map((it) => (it.id === updated.id ? updated : it));
            updateNavItems?.(newItems);
        }
        setEditingItem(null);
        setEditingParentId(null);
    };

    const handleAddItem = () => {
        const newItem: NavItem = {
            id: `nav-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            label: 'New Link',
            linkType: 'custom',
            href: '#',
        };
        updateNavItems?.([...navItems, newItem]);
        setEditingItem(newItem);
        setEditingParentId(null);
    };

    const handleDeleteItem = (id: string) => {
        updateNavItems?.(navItems.filter((it) => it.id !== id));
    };

    const handleAddSubItem = (parentId: string) => {
        const newSub: NavItem = {
            id: `nav-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            label: 'New Sub Link',
            linkType: 'custom',
            href: '#',
        };
        const newItems = navItems.map((it) => {
            if (it.id === parentId) {
                return { ...it, children: [...(it.children || []), newSub] };
            }
            return it;
        });
        updateNavItems?.(newItems);
        setEditingItem(newSub);
        setEditingParentId(parentId);
    };

    const handleDeleteSubItem = (parentId: string, subId: string) => {
        const newItems = navItems.map((it) => {
            if (it.id === parentId) {
                return { ...it, children: (it.children || []).filter(c => c.id !== subId) };
            }
            return it;
        });
        updateNavItems?.(newItems);
    };

    const toggleMobileExpand = (id: string) => {
        setExpandedMobileItems(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleTopLevelDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = navItems.findIndex(item => item.id === active.id);
        const newIndex = navItems.findIndex(item => item.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
            updateNavItems?.(arrayMove(navItems, oldIndex, newIndex));
        }
    };

    const handleSubItemDragEnd = (parentId: string) => (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const newItems = navItems.map(item => {
            if (item.id !== parentId) return item;
            const children = item.children || [];
            const oldIndex = children.findIndex(c => c.id === active.id);
            const newIndex = children.findIndex(c => c.id === over.id);
            if (oldIndex === -1 || newIndex === -1) return item;
            return { ...item, children: arrayMove(children, oldIndex, newIndex) };
        });
        updateNavItems?.(newItems);
    };

    if (navItems.length === 0 && !isEditMode) {
        return null;
    }

    const isMobileLayout = className.includes('flex-col');
    const resolvedSubmenuClassName = submenuClassName || 'bg-white border border-gray-200 shadow-xl';
    const navItemIds = navItems.map(item => item.id);

    return (
        <>
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleTopLevelDragEnd}
            >
                <SortableContext
                    items={navItemIds}
                    strategy={isMobileLayout ? verticalListSortingStrategy : horizontalListSortingStrategy}
                >
                    <nav className={className}>
                        {navItems.map((item) => {
                            const hasChildren = !!(item.children && item.children.length > 0);
                            const isMobileExpanded = expandedMobileItems.has(item.id);

                            if (isMobileLayout) {
                                return (
                                    <SortableMobileItem
                                        key={item.id}
                                        item={item}
                                        hasChildren={hasChildren}
                                        isMobileExpanded={isMobileExpanded}
                                        isEditMode={isEditMode}
                                        itemClassName={itemClassName}
                                        resolveHref={resolveHref}
                                        isActivePage={isActivePage}
                                        sensors={sensors}
                                        onToggleExpand={toggleMobileExpand}
                                        onEdit={(target, parentId) => { setEditingItem(target); setEditingParentId(parentId); }}
                                        onDelete={handleDeleteItem}
                                        onAddSubItem={handleAddSubItem}
                                        onDeleteSubItem={handleDeleteSubItem}
                                        onSubItemDragEnd={handleSubItemDragEnd(item.id)}
                                    />
                                );
                            }

                            return (
                                <SortableDesktopNavItem
                                    key={item.id}
                                    item={item}
                                    hasChildren={hasChildren}
                                    itemClassName={itemClassName}
                                    submenuClassName={resolvedSubmenuClassName}
                                    isEditMode={isEditMode}
                                    sensors={sensors}
                                    resolveHref={resolveHref}
                                    isActivePage={isActivePage}
                                    onEdit={(target, parentId) => { setEditingItem(target); setEditingParentId(parentId); }}
                                    onDelete={handleDeleteItem}
                                    onAddSubItem={handleAddSubItem}
                                    onDeleteSubItem={handleDeleteSubItem}
                                    onSubItemDragEnd={handleSubItemDragEnd(item.id)}
                                />
                            );
                        })}

                        {isEditMode && (
                            <button
                                onClick={handleAddItem}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors border border-dashed border-blue-300 relative z-[60] ml-2"
                                title="Add menu item"
                            >
                                <Plus className="w-3 h-3" />
                            </button>
                        )}
                    </nav>
                </SortableContext>
            </DndContext>

            {editingItem && (
                <NavItemEditModal
                    item={editingItem}
                    pages={pages}
                    blocks={blocks}
                    siteId={context?.siteId}
                    onSave={handleSaveItem}
                    onClose={() => { setEditingItem(null); setEditingParentId(null); }}
                />
            )}
        </>
    );
}

// ─── Sortable Desktop Nav Item ────────────────────────────────────────────────

function SortableDesktopNavItem({
    item,
    hasChildren,
    itemClassName,
    submenuClassName,
    isEditMode,
    sensors,
    resolveHref,
    isActivePage,
    onEdit,
    onDelete,
    onAddSubItem,
    onDeleteSubItem,
    onSubItemDragEnd,
}: {
    item: NavItem;
    hasChildren: boolean;
    itemClassName: string;
    submenuClassName: string;
    isEditMode: boolean;
    sensors: ReturnType<typeof useSensors>;
    resolveHref: (item: NavItem) => string;
    isActivePage: (item: NavItem) => boolean;
    onEdit: (item: NavItem, parentId: string | null) => void;
    onDelete: (id: string) => void;
    onAddSubItem: (parentId: string) => void;
    onDeleteSubItem: (parentId: string, subId: string) => void;
    onSubItemDragEnd: (event: DragEndEvent) => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 50 : undefined,
    };

    return (
        <span ref={setNodeRef} style={style} className="inline-flex items-center">
            <DesktopNavItem
                item={item}
                hasChildren={hasChildren}
                itemClassName={itemClassName}
                submenuClassName={submenuClassName}
                isEditMode={isEditMode}
                sensors={sensors}
                resolveHref={resolveHref}
                isActivePage={isActivePage}
                onEdit={onEdit}
                onDelete={onDelete}
                onAddSubItem={onAddSubItem}
                onDeleteSubItem={onDeleteSubItem}
                onSubItemDragEnd={onSubItemDragEnd}
                dragHandleAttributes={attributes}
                dragHandleListeners={listeners}
            />
        </span>
    );
}

// ─── Sortable Mobile Nav Item ─────────────────────────────────────────────────

function SortableMobileItem({
    item,
    hasChildren,
    isMobileExpanded,
    isEditMode,
    itemClassName,
    sensors,
    resolveHref,
    isActivePage,
    onToggleExpand,
    onEdit,
    onDelete,
    onAddSubItem,
    onDeleteSubItem,
    onSubItemDragEnd,
}: {
    item: NavItem;
    hasChildren: boolean;
    isMobileExpanded: boolean;
    isEditMode: boolean;
    itemClassName: string;
    sensors: ReturnType<typeof useSensors>;
    resolveHref: (item: NavItem) => string;
    isActivePage: (item: NavItem) => boolean;
    onToggleExpand: (id: string) => void;
    onEdit: (item: NavItem, parentId: string | null) => void;
    onDelete: (id: string) => void;
    onAddSubItem: (parentId: string) => void;
    onDeleteSubItem: (parentId: string, subId: string) => void;
    onSubItemDragEnd: (event: DragEndEvent) => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    const subItemIds = (item.children || []).map(c => c.id);

    return (
        <div ref={setNodeRef} style={style}>
            <span className="relative group/navitem flex items-center">
                {isEditMode && (
                    <span
                        {...attributes}
                        {...listeners}
                        className="cursor-grab active:cursor-grabbing touch-none p-0.5 mr-0.5 flex-shrink-0"
                        title="Drag to reorder"
                    >
                        <GripVertical className="w-3.5 h-3.5 text-gray-400" />
                    </span>
                )}
                {hasChildren ? (
                    <>
                        <Link
                            href={resolveHref(item)}
                            className={`${itemClassName} flex-1 ${isEditMode ? 'hover:text-blue-500 transition-colors' : ''} ${isActivePage(item) ? 'underline underline-offset-4 decoration-2' : ''}`}
                            aria-current={isActivePage(item) ? 'page' as const : undefined}
                            onClick={isEditMode ? (e) => { e.preventDefault(); e.stopPropagation(); onEdit(item, null); } : undefined}
                        >
                            {item.label}
                        </Link>
                        <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleExpand(item.id); }}
                            className="p-2 transition-transform"
                            aria-expanded={isMobileExpanded}
                            aria-label={`Expand ${item.label} submenu`}
                        >
                            <ChevronDown className={`w-4 h-4 transition-transform ${isMobileExpanded ? 'rotate-180' : ''}`} />
                        </button>
                    </>
                ) : (
                    <Link
                        href={resolveHref(item)}
                        target={item.linkType === 'custom' && item.href.startsWith('http') ? '_blank' : undefined}
                        className={`${itemClassName} ${isEditMode ? 'hover:text-blue-500 transition-colors' : ''} ${isActivePage(item) ? 'underline underline-offset-4 decoration-2' : ''}`}
                        aria-current={isActivePage(item) ? 'page' as const : undefined}
                        onClick={isEditMode ? (e) => { e.preventDefault(); e.stopPropagation(); onEdit(item, null); } : undefined}
                    >
                        {item.label}
                    </Link>
                )}
                {isEditMode && (
                    <div className="ml-1 flex items-center gap-0.5">
                        <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(item, null); }}
                            className="p-0.5 hover:bg-blue-100 rounded-full"
                            title="Edit"
                        >
                            <Pencil className="w-3 h-3 text-blue-500" />
                        </button>
                        <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAddSubItem(item.id); }}
                            className="p-0.5 hover:bg-green-100 rounded-full"
                            title="Add sub-item"
                        >
                            <Plus className="w-3 h-3 text-green-600" />
                        </button>
                        <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(item.id); }}
                            className="p-0.5 hover:bg-red-100 rounded-full"
                            title="Remove"
                        >
                            <X className="w-3 h-3 text-red-500" />
                        </button>
                    </div>
                )}
            </span>

            {/* Mobile sub-items (accordion) */}
            {hasChildren && (isMobileExpanded || isEditMode) && (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={onSubItemDragEnd}
                >
                    <SortableContext items={subItemIds} strategy={verticalListSortingStrategy}>
                        <div className="pl-4 flex flex-col gap-0.5 mt-0.5">
                            {item.children!.map((sub) => (
                                <SortableSubItemRow
                                    key={sub.id}
                                    sub={sub}
                                    parentId={item.id}
                                    itemClassName={itemClassName}
                                    isEditMode={isEditMode}
                                    resolveHref={resolveHref}
                                    onEdit={onEdit}
                                    onDeleteSubItem={onDeleteSubItem}
                                    variant="mobile"
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}
        </div>
    );
}

// ─── Sortable Sub-item Row ────────────────────────────────────────────────────

function SortableSubItemRow({
    sub,
    parentId,
    itemClassName,
    isEditMode,
    resolveHref,
    onEdit,
    onDeleteSubItem,
    variant,
}: {
    sub: NavItem;
    parentId: string;
    itemClassName: string;
    isEditMode: boolean;
    resolveHref: (item: NavItem) => string;
    onEdit: (item: NavItem, parentId: string | null) => void;
    onDeleteSubItem: (parentId: string, subId: string) => void;
    variant: 'mobile' | 'desktop';
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: sub.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    if (variant === 'desktop') {
        return (
            <span
                ref={setNodeRef}
                style={style}
                className="relative group/subitem flex items-center"
            >
                {isEditMode && (
                    <span
                        {...attributes}
                        {...listeners}
                        className="cursor-grab active:cursor-grabbing touch-none pl-2 py-2 opacity-0 group-hover/subitem:opacity-100 transition-opacity flex-shrink-0"
                        title="Drag to reorder"
                    >
                        <GripVertical className="w-3 h-3 text-gray-400" />
                    </span>
                )}
                <Link
                    href={resolveHref(sub)}
                    target={sub.linkType === 'custom' && sub.href.startsWith('http') ? '_blank' : undefined}
                    className={`block w-full px-4 py-2 text-sm transition-colors hover:bg-black/5 ${isEditMode ? 'hover:text-blue-500' : ''}`}
                    onClick={isEditMode ? (e) => { e.preventDefault(); e.stopPropagation(); onEdit(sub, parentId); } : undefined}
                >
                    {sub.label}
                </Link>
                {isEditMode && (
                    <div className="mr-2 flex items-center gap-0.5 opacity-0 group-hover/subitem:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(sub, parentId); }}
                            className="p-0.5 hover:bg-blue-100 rounded-full"
                            title="Edit"
                        >
                            <Pencil className="w-3 h-3 text-blue-500" />
                        </button>
                        <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDeleteSubItem(parentId, sub.id); }}
                            className="p-0.5 hover:bg-red-100 rounded-full"
                            title="Remove"
                        >
                            <X className="w-3 h-3 text-red-500" />
                        </button>
                    </div>
                )}
            </span>
        );
    }

    // mobile variant
    return (
        <span
            ref={setNodeRef}
            style={style}
            className="relative flex items-center"
        >
            {isEditMode && (
                <span
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing touch-none p-0.5 mr-0.5 flex-shrink-0"
                    title="Drag to reorder"
                >
                    <GripVertical className="w-3 h-3 text-gray-400" />
                </span>
            )}
            <Link
                href={resolveHref(sub)}
                target={sub.linkType === 'custom' && sub.href.startsWith('http') ? '_blank' : undefined}
                className={`${itemClassName} text-[0.8125rem] opacity-80 ${isEditMode ? 'hover:text-blue-500 transition-colors' : ''}`}
                onClick={isEditMode ? (e) => { e.preventDefault(); e.stopPropagation(); onEdit(sub, parentId); } : undefined}
            >
                {sub.label}
            </Link>
            {isEditMode && (
                <div className="ml-1 flex items-center gap-0.5">
                    <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(sub, parentId); }}
                        className="p-0.5 hover:bg-blue-100 rounded-full"
                        title="Edit"
                    >
                        <Pencil className="w-3 h-3 text-blue-500" />
                    </button>
                    <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDeleteSubItem(parentId, sub.id); }}
                        className="p-0.5 hover:bg-red-100 rounded-full"
                        title="Remove"
                    >
                        <X className="w-3 h-3 text-red-500" />
                    </button>
                </div>
            )}
        </span>
    );
}

// ─── Desktop Nav Item ─────────────────────────────────────────────────────────

function DesktopNavItem({
    item,
    hasChildren,
    itemClassName,
    submenuClassName,
    isEditMode,
    sensors,
    resolveHref,
    isActivePage,
    onEdit,
    onDelete,
    onAddSubItem,
    onDeleteSubItem,
    onSubItemDragEnd,
    dragHandleAttributes,
    dragHandleListeners,
}: {
    item: NavItem;
    hasChildren: boolean;
    itemClassName: string;
    submenuClassName: string;
    isEditMode: boolean;
    sensors: ReturnType<typeof useSensors>;
    resolveHref: (item: NavItem) => string;
    isActivePage: (item: NavItem) => boolean;
    onEdit: (item: NavItem, parentId: string | null) => void;
    onDelete: (id: string) => void;
    onAddSubItem: (parentId: string) => void;
    onDeleteSubItem: (parentId: string, subId: string) => void;
    onSubItemDragEnd: (event: DragEndEvent) => void;
    dragHandleAttributes?: ReturnType<typeof useSortable>['attributes'];
    dragHandleListeners?: ReturnType<typeof useSortable>['listeners'];
}) {
    const [open, setOpen] = useState(false);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleMouseEnter = () => {
        if (closeTimer.current) clearTimeout(closeTimer.current);
        if (hasChildren) setOpen(true);
    };
    const handleMouseLeave = () => {
        closeTimer.current = setTimeout(() => setOpen(false), 150);
    };

    useEffect(() => {
        return () => { if (closeTimer.current) clearTimeout(closeTimer.current); };
    }, []);

    const subItemIds = (item.children || []).map(c => c.id);

    return (
        <span
            className="relative group/navitem inline-flex items-center"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {isEditMode && dragHandleListeners && (
                <span
                    {...dragHandleAttributes}
                    {...dragHandleListeners}
                    className="cursor-grab active:cursor-grabbing touch-none p-0.5 mr-0.5 opacity-0 group-hover/navitem:opacity-100 transition-opacity flex-shrink-0"
                    title="Drag to reorder"
                >
                    <GripVertical className="w-3.5 h-3.5 text-gray-400" />
                </span>
            )}
            <Link
                href={resolveHref(item)}
                target={item.linkType === 'custom' && item.href.startsWith('http') ? '_blank' : undefined}
                className={`${itemClassName} ${isEditMode ? 'hover:text-blue-500 transition-colors' : ''} ${isActivePage(item) ? 'underline underline-offset-4 decoration-2' : ''} ${hasChildren ? 'inline-flex items-center gap-1' : ''}`}
                aria-current={isActivePage(item) ? 'page' as const : undefined}
                onClick={isEditMode ? (e) => { e.preventDefault(); e.stopPropagation(); onEdit(item, null); } : undefined}
            >
                {item.label}
                {hasChildren && (
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                )}
            </Link>

            {isEditMode && (
                <div className="ml-1 flex items-center gap-0.5 opacity-0 group-hover/navitem:opacity-100 transition-opacity">
                    <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(item, null); }}
                        className="p-0.5 hover:bg-blue-100 rounded-full"
                        title="Edit"
                    >
                        <Pencil className="w-3 h-3 text-blue-500" />
                    </button>
                    <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAddSubItem(item.id); }}
                        className="p-0.5 hover:bg-green-100 rounded-full"
                        title="Add sub-item"
                    >
                        <Plus className="w-3 h-3 text-green-600" />
                    </button>
                    <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(item.id); }}
                        className="p-0.5 hover:bg-red-100 rounded-full"
                        title="Remove"
                    >
                        <X className="w-3 h-3 text-red-500" />
                    </button>
                </div>
            )}

            {/* Desktop dropdown submenu */}
            {hasChildren && open && (
                <div
                    className="absolute top-full left-0 pt-2 z-[60]"
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    <div className={`rounded-lg py-1.5 min-w-[180px] ${submenuClassName}`}>
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={onSubItemDragEnd}
                        >
                            <SortableContext items={subItemIds} strategy={verticalListSortingStrategy}>
                                {item.children!.map((sub) => (
                                    <SortableSubItemRow
                                        key={sub.id}
                                        sub={sub}
                                        parentId={item.id}
                                        itemClassName={itemClassName}
                                        isEditMode={isEditMode}
                                        resolveHref={resolveHref}
                                        onEdit={onEdit}
                                        onDeleteSubItem={onDeleteSubItem}
                                        variant="desktop"
                                    />
                                ))}
                            </SortableContext>
                        </DndContext>
                    </div>
                </div>
            )}
        </span>
    );
}
