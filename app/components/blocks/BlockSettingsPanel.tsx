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
    hasUnsavedChanges: boolean;
    onClose: () => void;
    onSave: () => void;
    onReset: () => void;
    onToggleAllCollapsed?: () => void;
    allCollapsed?: boolean;
    saveLabel?: string;
    children: ReactNode;
    /** Stable test/tour id for the aside element */
    tourId?: string;
}

/**
 * Generic right-sidebar settings panel. Hosts a block-specific panel component
 * via children. Dispatches `ks:block-inspector-state` so the editor can shift
 * the canvas right-margin while the panel is open.
 */
export default function BlockSettingsPanel({
    isOpen,
    title,
    subtitle,
    blockId,
    blockType,
    hasUnsavedChanges,
    onClose,
    onSave,
    onReset,
    onToggleAllCollapsed,
    allCollapsed,
    saveLabel = 'Apply',
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
                    <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-slate-900">{title}</h2>
                        {hasUnsavedChanges && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                                Unsaved
                            </span>
                        )}
                    </div>
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

            <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4">
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    Discard
                </button>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onReset}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        Reset
                    </button>
                    <button
                        type="button"
                        onClick={onSave}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                        {saveLabel}
                    </button>
                </div>
            </div>
        </aside>
    );

    return createPortal(panel, document.body);
}
