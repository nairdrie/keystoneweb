'use client';

import { GripVertical, Trash2 } from 'lucide-react';
import type React from 'react';

type InlineCardControlsProps = {
    canRemove?: boolean;
    dragTitle?: string;
    removeTitle?: string;
    dragData?: string;
    onDragStart: (event: React.DragEvent<HTMLButtonElement>) => void;
    onDragEnd?: () => void;
    onRemove?: () => void;
    className?: string;
};

export default function InlineCardControls({
    canRemove = true,
    dragTitle = 'Drag to reorder card',
    removeTitle = 'Delete card',
    dragData = 'card',
    onDragStart,
    onDragEnd,
    onRemove,
    className = '',
}: InlineCardControlsProps) {
    return (
        <div className={`absolute right-2 top-2 z-30 flex overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm opacity-0 transition-opacity group-hover/card:opacity-100 focus-within:opacity-100 ${className}`}>
            <button
                type="button"
                draggable
                onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', dragData);
                    onDragStart(event);
                }}
                onDragEnd={onDragEnd}
                className="cursor-grab p-1.5 text-slate-500 transition-colors hover:bg-slate-50 active:cursor-grabbing"
                title={dragTitle}
                aria-label={dragTitle}
            >
                <GripVertical className="h-3.5 w-3.5" />
            </button>
            {canRemove && onRemove && (
                <button
                    type="button"
                    onClick={onRemove}
                    className="border-l border-slate-100 p-1.5 text-red-500 transition-colors hover:bg-red-50"
                    title={removeTitle}
                    aria-label={removeTitle}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            )}
        </div>
    );
}

export function reorderItems<T>(items: T[], fromIndex: number, toIndex: number): T[] {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return items;
    if (fromIndex >= items.length || toIndex >= items.length) return items;
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
}
