'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useEditorContext, NavItem } from '@/lib/editor-context';
import NavItemEditModal from './NavItemEditModal';

interface NavMenuProps {
    /** Additional CSS classes for the nav container */
    className?: string;
    /** Additional CSS classes for each link item */
    itemClassName?: string;
}

export default function NavMenu({ className = '', itemClassName = '' }: NavMenuProps) {
    const context = useEditorContext();
    const navItems = context?.navItems || [];
    const isEditMode = context?.isEditMode || false;
    const updateNavItems = context?.updateNavItems;
    const pages = context?.pages || [];
    const blocks = context?.blocks || [];

    const [editingItem, setEditingItem] = useState<NavItem | null>(null);

    const handleItemClick = (e: React.MouseEvent, item: NavItem) => {
        if (isEditMode) {
            e.preventDefault();
            e.stopPropagation();
            setEditingItem(item);
        }
    };

    const handleSaveItem = (updated: NavItem) => {
        const newItems = navItems.map((it) => (it.id === updated.id ? updated : it));
        updateNavItems?.(newItems);
        setEditingItem(null);
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
    };

    const handleDeleteItem = (id: string) => {
        updateNavItems?.(navItems.filter((it) => it.id !== id));
    };

    if (navItems.length === 0 && !isEditMode) {
        return null;
    }

    return (
        <>
            <nav className={className}>
                {navItems.map((item) => (
                    <span key={item.id} className="relative group/navitem inline-flex items-center">
                        <a
                            href={isEditMode ? undefined : item.href}
                            onClick={(e) => handleItemClick(e, item)}
                            className={`${itemClassName} ${isEditMode ? 'cursor-pointer ring-1 ring-transparent hover:ring-blue-400 rounded px-1 -mx-1 transition-all' : ''
                                }`}
                        >
                            {item.label}
                        </a>
                        {isEditMode && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteItem(item.id);
                                }}
                                className="ml-0.5 opacity-0 group-hover/navitem:opacity-100 transition-opacity p-0.5 hover:bg-red-100 rounded-full"
                                title="Remove"
                            >
                                <X className="w-3 h-3 text-red-500" />
                            </button>
                        )}
                    </span>
                ))}

                {isEditMode && (
                    <button
                        onClick={handleAddItem}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors border border-dashed border-blue-300"
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
                    blocks={blocks.map((b) => ({ id: b.id, type: b.type }))}
                    onSave={handleSaveItem}
                    onClose={() => setEditingItem(null)}
                />
            )}
        </>
    );
}
