'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus, X, Pencil, ChevronDown, ChevronRight } from 'lucide-react';
import { useEditorContext, NavItem } from '@/lib/editor-context';
import NavItemEditModal from './NavItemEditModal';
import { getBlockSlug } from '@/lib/block-utils';

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

    const pathname = usePathname();
    const isEditor = pathname?.startsWith('/editor');

    const [editingItem, setEditingItem] = useState<NavItem | null>(null);
    const [editingParentId, setEditingParentId] = useState<string | null>(null);
    const [expandedMobileItems, setExpandedMobileItems] = useState<Set<string>>(new Set());

    const resolveHref = (item: NavItem): string => {
        if (item.linkType === 'page') {
            if (isEditor) {
                return `/editor?siteId=${context?.siteId}&pageId=${item.pageId}`;
            }
            const targetPage = pages.find(p => p.id === item.pageId);
            const slug = targetPage ? targetPage.slug : '';
            return slug === 'home' ? '/' : `/${slug}`;
        } else if (item.linkType === 'section') {
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
        const itemPath = slug === 'home' ? '/' : `/${slug}`;
        const normalizedPathname = pathname === '' ? '/' : pathname;
        return normalizedPathname === itemPath;
    };

    const handleSaveItem = (updated: NavItem) => {
        if (editingParentId) {
            // Saving a sub-item — update within parent's children
            const newItems = navItems.map((it) => {
                if (it.id === editingParentId) {
                    const newChildren = (it.children || []).map(c => c.id === updated.id ? updated : c);
                    return { ...it, children: newChildren };
                }
                return it;
            });
            updateNavItems?.(newItems);
        } else {
            // Saving a top-level item
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

    if (navItems.length === 0 && !isEditMode) {
        return null;
    }

    // Detect if we're in a mobile/vertical layout by checking className
    const isMobileLayout = className.includes('flex-col');

    // Default submenu panel styling if none provided
    const resolvedSubmenuClassName = submenuClassName || 'bg-white border border-gray-200 shadow-xl';

    return (
        <>
            <nav className={className}>
                {navItems.map((item) => {
                    const hasChildren = item.children && item.children.length > 0;
                    const isMobileExpanded = expandedMobileItems.has(item.id);

                    if (isMobileLayout) {
                        // === MOBILE / VERTICAL LAYOUT ===
                        return (
                            <div key={item.id}>
                                <span className="relative group/navitem flex items-center">
                                    {hasChildren ? (
                                        // Parent with children: render as button toggle + link
                                        <>
                                            <Link
                                                href={resolveHref(item)}
                                                className={`${itemClassName} flex-1 ${isEditMode ? 'hover:text-blue-500 transition-colors' : ''} ${isActivePage(item) ? 'underline underline-offset-4 decoration-2' : ''}`}
                                                aria-current={isActivePage(item) ? 'page' as const : undefined}
                                                onClick={isEditMode ? (e) => { e.preventDefault(); e.stopPropagation(); setEditingItem(item); setEditingParentId(null); } : undefined}
                                            >
                                                {item.label}
                                            </Link>
                                            <button
                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleMobileExpand(item.id); }}
                                                className="p-2 transition-transform"
                                                aria-expanded={isMobileExpanded}
                                                aria-label={`Expand ${item.label} submenu`}
                                            >
                                                <ChevronDown className={`w-4 h-4 transition-transform ${isMobileExpanded ? 'rotate-180' : ''}`} />
                                            </button>
                                        </>
                                    ) : (
                                        // Regular item without children
                                        <Link
                                            href={resolveHref(item)}
                                            target={item.linkType === 'custom' && item.href.startsWith('http') ? '_blank' : undefined}
                                            className={`${itemClassName} ${isEditMode ? 'hover:text-blue-500 transition-colors' : ''} ${isActivePage(item) ? 'underline underline-offset-4 decoration-2' : ''}`}
                                            aria-current={isActivePage(item) ? 'page' as const : undefined}
                                            onClick={isEditMode ? (e) => { e.preventDefault(); e.stopPropagation(); setEditingItem(item); setEditingParentId(null); } : undefined}
                                        >
                                            {item.label}
                                        </Link>
                                    )}
                                    {isEditMode && (
                                        <div className="ml-1 flex items-center gap-0.5 opacity-0 group-hover/navitem:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingItem(item); setEditingParentId(null); }}
                                                className="p-0.5 hover:bg-blue-100 rounded-full"
                                                title="Edit"
                                            >
                                                <Pencil className="w-3 h-3 text-blue-500" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAddSubItem(item.id); }}
                                                className="p-0.5 hover:bg-green-100 rounded-full"
                                                title="Add sub-item"
                                            >
                                                <Plus className="w-3 h-3 text-green-600" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteItem(item.id); }}
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
                                    <div className="pl-4 flex flex-col gap-0.5 mt-0.5">
                                        {item.children!.map((sub) => (
                                            <span key={sub.id} className="relative group/subitem flex items-center">
                                                <Link
                                                    href={resolveHref(sub)}
                                                    target={sub.linkType === 'custom' && sub.href.startsWith('http') ? '_blank' : undefined}
                                                    className={`${itemClassName} text-[0.8125rem] opacity-80 ${isEditMode ? 'hover:text-blue-500 transition-colors' : ''}`}
                                                    onClick={isEditMode ? (e) => { e.preventDefault(); e.stopPropagation(); setEditingItem(sub); setEditingParentId(item.id); } : undefined}
                                                >
                                                    {sub.label}
                                                </Link>
                                                {isEditMode && (
                                                    <div className="ml-1 flex items-center gap-0.5 opacity-0 group-hover/subitem:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingItem(sub); setEditingParentId(item.id); }}
                                                            className="p-0.5 hover:bg-blue-100 rounded-full"
                                                            title="Edit"
                                                        >
                                                            <Pencil className="w-3 h-3 text-blue-500" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteSubItem(item.id, sub.id); }}
                                                            className="p-0.5 hover:bg-red-100 rounded-full"
                                                            title="Remove"
                                                        >
                                                            <X className="w-3 h-3 text-red-500" />
                                                        </button>
                                                    </div>
                                                )}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    }

                    // === DESKTOP / HORIZONTAL LAYOUT ===
                    return (
                        <DesktopNavItem
                            key={item.id}
                            item={item}
                            hasChildren={!!hasChildren}
                            itemClassName={itemClassName}
                            submenuClassName={resolvedSubmenuClassName}
                            isEditMode={isEditMode}
                            resolveHref={resolveHref}
                            isActivePage={isActivePage}
                            onEdit={(target, parentId) => { setEditingItem(target); setEditingParentId(parentId); }}
                            onDelete={handleDeleteItem}
                            onAddSubItem={handleAddSubItem}
                            onDeleteSubItem={handleDeleteSubItem}
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

            {/* Edit Modal */}
            {editingItem && (
                <NavItemEditModal
                    item={editingItem}
                    pages={pages}
                    blocks={blocks}
                    onSave={handleSaveItem}
                    onClose={() => { setEditingItem(null); setEditingParentId(null); }}
                />
            )}
        </>
    );
}

/** Desktop nav item with hover-reveal submenu dropdown */
function DesktopNavItem({
    item,
    hasChildren,
    itemClassName,
    submenuClassName,
    isEditMode,
    resolveHref,
    isActivePage,
    onEdit,
    onDelete,
    onAddSubItem,
    onDeleteSubItem,
}: {
    item: NavItem;
    hasChildren: boolean;
    itemClassName: string;
    submenuClassName: string;
    isEditMode: boolean;
    resolveHref: (item: NavItem) => string;
    isActivePage: (item: NavItem) => boolean;
    onEdit: (item: NavItem, parentId: string | null) => void;
    onDelete: (id: string) => void;
    onAddSubItem: (parentId: string) => void;
    onDeleteSubItem: (parentId: string, subId: string) => void;
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

    return (
        <span
            className="relative group/navitem inline-flex items-center"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
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
            {hasChildren && (open || isEditMode) && (
                <div
                    className={`absolute top-full left-0 pt-2 z-[60] ${!open && !isEditMode ? 'hidden' : ''}`}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    <div className={`rounded-lg py-1.5 min-w-[180px] ${submenuClassName}`}>
                        {item.children!.map((sub) => (
                            <span key={sub.id} className="relative group/subitem flex items-center">
                                <Link
                                    href={resolveHref(sub)}
                                    target={sub.linkType === 'custom' && sub.href.startsWith('http') ? '_blank' : undefined}
                                    className={`block w-full px-4 py-2 text-sm transition-colors hover:bg-black/5 ${isEditMode ? 'hover:text-blue-500' : ''}`}
                                    onClick={isEditMode ? (e) => { e.preventDefault(); e.stopPropagation(); onEdit(sub, item.id); } : undefined}
                                >
                                    {sub.label}
                                </Link>
                                {isEditMode && (
                                    <div className="mr-2 flex items-center gap-0.5 opacity-0 group-hover/subitem:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(sub, item.id); }}
                                            className="p-0.5 hover:bg-blue-100 rounded-full"
                                            title="Edit"
                                        >
                                            <Pencil className="w-3 h-3 text-blue-500" />
                                        </button>
                                        <button
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDeleteSubItem(item.id, sub.id); }}
                                            className="p-0.5 hover:bg-red-100 rounded-full"
                                            title="Remove"
                                        >
                                            <X className="w-3 h-3 text-red-500" />
                                        </button>
                                    </div>
                                )}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </span>
    );
}
