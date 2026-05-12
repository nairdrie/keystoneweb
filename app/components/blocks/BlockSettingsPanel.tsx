'use client';

import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { dispatchBlockInspectorState } from './panel-shared';

interface BlockSettingsPanelProps {
    isOpen: boolean;
    title: string;
    subtitle?: string;
    blockId: string;
    blockType: string;
    onClose: () => void;
    onToggleAllCollapsed?: () => void;
    allCollapsed?: boolean;
    children: ReactNode;
    /** Stable test/tour id for the aside element */
    tourId?: string;
}

/**
 * Generic right-sidebar settings panel. Hosts a block-specific panel component
 * via children. Dispatches `ks:block-inspector-state` so the editor can shift
 * the canvas right-margin while the panel is open.
 *
 * Edits made inside the panel commit immediately to the editor's change
 * tracker, so the panel doesn't need its own apply/cancel workflow — closing
 * just dismisses the UI. The main editor toolbar handles undo/save draft.
 */
export default function BlockSettingsPanel({
    isOpen,
    title,
    subtitle,
    blockId,
    blockType,
    onClose,
    onToggleAllCollapsed,
    allCollapsed,
    children,
    tourId,
}: BlockSettingsPanelProps) {
    useEffect(() => {
        if (!isOpen) return;
        dispatchBlockInspectorState({ open: true, blockId, blockType });
        return () => {
            dispatchBlockInspectorState({ open: false, blockId, blockType });
        };
    }, [isOpen, blockId, blockType]);

    if (!isOpen) return null;

    const panel = (
        <aside
            data-tour={tourId}
            className="fixed inset-y-0 right-0 z-[10000] flex w-full max-w-md flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            aria-label={title}
        >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
                <div>
                    <h2 className="text-base font-bold text-slate-900">{title}</h2>
                    {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
                    {onToggleAllCollapsed && (
                        <button
                            type="button"
                            onClick={onToggleAllCollapsed}
                            className="mt-2 text-xs font-bold text-blue-600 transition-colors hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {allCollapsed ? 'Expand all' : 'Collapse all'}
                        </button>
                    )}
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label={`Close ${title}`}
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
                {children}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4">
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    Dismiss
                </button>
            </div>
        </aside>
    );

    return createPortal(panel, document.body);
}
