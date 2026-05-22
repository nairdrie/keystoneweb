'use client';

import { useState } from 'react';
import { NavItem } from '@/lib/editor-context';
import { Plus, X, Pencil } from 'lucide-react';
import NavItemEditModal from '../NavItemEditModal';
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
import { getTabClass, getTabStyle, TabStyle, TabAlign } from './tab-bar-styles';

interface TabBarEditorProps {
    items: NavItem[];
    tabStyle: TabStyle;
    tabAlign: TabAlign;
    activeColor: string;
    bgColor: string;
    activeColorSource: string;
    bgColorSource: string;
    palette: Record<string, string>;
    updateContent: (key: string, value: any) => void;
    resolveHref: (item: NavItem) => string;
    pages: Array<{ id: string; slug: string; title: string }>;
    blocks: any[];
    siteId?: string;
    currentPageId?: string;
}

export default function TabBarEditor({
    items, tabStyle, tabAlign, activeColor, bgColor, activeColorSource, bgColorSource, palette, updateContent, pages, blocks, siteId, currentPageId,
}: TabBarEditorProps) {
    const [editingItem, setEditingItem] = useState<NavItem | null>(null);

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
        updateContent('items', [...items, newItem]);
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
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Color</span>
                    <input
                        type="color"
                        value={activeColor}
                        onChange={e => updateContent('activeColor', e.target.value)}
                        className="w-6 h-6 rounded cursor-pointer border border-slate-200"
                        title="Active tab color"
                    />
                    <PaletteTokenButtons
                        selected={activeColorSource}
                        palette={palette}
                        onSelect={(token) => updateContent('activeColor', token)}
                    />
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Bar BG</span>
                    <input
                        type="color"
                        value={bgColor || '#ffffff'}
                        onChange={e => updateContent('bgColor', e.target.value)}
                        className="w-6 h-6 rounded cursor-pointer border border-slate-200"
                        title="Bar background color"
                    />
                    <PaletteTokenButtons
                        selected={bgColorSource}
                        palette={palette}
                        onSelect={(token) => updateContent('bgColor', token)}
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

            {editingItem && (
                <NavItemEditModal
                    item={editingItem}
                    pages={pages}
                    blocks={blocks}
                    siteId={siteId}
                    currentPageId={currentPageId}
                    onSave={saveTab}
                    onClose={() => setEditingItem(null)}
                />
            )}
        </div>
    );
}

function PaletteTokenButtons({ selected, palette, onSelect }: {
    selected: string;
    palette: Record<string, string>;
    onSelect: (token: string) => void;
}) {
    const tokens = [
        { key: 'primary', title: 'Use palette primary' },
        { key: 'secondary', title: 'Use palette secondary' },
        { key: 'accent', title: 'Use palette accent' },
    ];

    return (
        <div className="flex items-center gap-0.5">
            {tokens.map(({ key, title }) => {
                const token = `palette:${key}`;
                const active = selected === token;
                return (
                    <button
                        key={key}
                        type="button"
                        onClick={() => onSelect(token)}
                        className={`w-5 h-5 rounded-full border transition-transform ${active ? 'border-slate-900 scale-110' : 'border-white shadow-sm'}`}
                        style={{ backgroundColor: palette[key] || '#ffffff' }}
                        title={title}
                    />
                );
            })}
        </div>
    );
}

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
        <div ref={setNodeRef} style={style} className="relative group/tab flex items-center">
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
            <button
                onClick={onEdit}
                className={`${getTabClass(tabStyle, false, tabAlign)} pr-5 cursor-pointer`}
                style={getTabStyle(tabStyle, false, activeColor)}
                title="Click to edit"
            >
                {item.label}
            </button>
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
