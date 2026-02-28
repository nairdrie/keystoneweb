'use client';

import { ReactNode } from 'react';
import { useEditorContext } from '@/lib/editor-context';
import { ArrowUp, ArrowDown, Trash2 } from 'lucide-react';

interface BlockWrapperProps {
    id: string;
    type: string;
    children: ReactNode;
}

export default function BlockWrapper({ id, type, children }: BlockWrapperProps) {
    const context = useEditorContext();
    const isEditMode = context?.isEditMode || false;

    if (!isEditMode) {
        return <div className="w-full">{children}</div>;
    }

    return (
        <div className="relative group w-full border-2 border-transparent hover:border-slate-300 transition-colors">
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white shadow-md border border-slate-200 rounded-md flex overflow-hidden z-[100]">
                <button
                    onClick={() => context?.moveBlock?.(id, 'up')}
                    className="p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-900 border-r border-slate-100 transition-colors"
                    title="Move Up"
                >
                    <ArrowUp className="w-4 h-4" />
                </button>
                <button
                    onClick={() => context?.moveBlock?.(id, 'down')}
                    className="p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-900 border-r border-slate-100 transition-colors"
                    title="Move Down"
                >
                    <ArrowDown className="w-4 h-4" />
                </button>
                <button
                    onClick={() => context?.removeBlock?.(id)}
                    className="p-1.5 text-red-500 hover:bg-red-50 transition-colors"
                    title="Delete Block"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
            {children}
        </div>
    );
}
