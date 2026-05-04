'use client';

import { useCallback, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { resolvePaletteColor } from '@/lib/palette-colors';

export const BLOCK_INSPECTOR_STATE_EVENT = 'ks:block-inspector-state';

export type BlockInspectorStateDetail = {
    open: boolean;
    blockType?: string;
    blockId?: string;
};

export function dispatchBlockInspectorState(detail: BlockInspectorStateDetail): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent<BlockInspectorStateDetail>(BLOCK_INSPECTOR_STATE_EVENT, { detail }));
}

export function InspectorSection({
    id,
    title,
    children,
    isCollapsed,
    onToggle,
}: {
    id: string;
    title: string;
    children: React.ReactNode;
    isCollapsed: boolean;
    onToggle: () => void;
}) {
    const contentId = `${id}-inspector-content`;

    return (
        <section className="border-b border-slate-100 pb-5 last:border-b-0 last:pb-0">
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={!isCollapsed}
                aria-controls={contentId}
                className="flex w-full items-center justify-between gap-3 rounded-lg py-1 text-left transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h3>
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isCollapsed ? '-rotate-90' : 'rotate-0'}`} />
            </button>
            {!isCollapsed && (
                <div id={contentId} className="mt-3">
                    {children}
                </div>
            )}
        </section>
    );
}

export function InspectorToggle({
    label,
    description,
    checked,
    onChange,
}: {
    label: string;
    description?: string;
    checked: boolean;
    onChange: () => void;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={onChange}
            className="flex w-full items-center justify-between gap-4 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
            <span className="flex flex-col">
                <span className="text-sm font-medium text-slate-700">{label}</span>
                {description && <span className="text-xs text-slate-500">{description}</span>}
            </span>
            <span className={`relative h-5 w-10 shrink-0 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-200'}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
            </span>
        </button>
    );
}

export function PaletteTokenButtons({ selected, palette, onSelect }: {
    selected: string;
    palette: Record<string, string>;
    onSelect: (token: string) => void;
}) {
    const tokens = [
        { key: 'primary', label: 'P', title: 'Use palette primary' },
        { key: 'secondary', label: 'S', title: 'Use palette secondary' },
        { key: 'accent', label: 'A', title: 'Use palette accent' },
    ];

    return (
        <div className="flex items-center gap-1">
            {tokens.map(({ key, label, title }) => {
                const token = `palette:${key}`;
                const active = selected === token;
                return (
                    <button
                        key={key}
                        type="button"
                        onClick={() => onSelect(token)}
                        className={`w-8 h-8 rounded-full border text-[10px] font-bold shadow-sm transition-transform ${active ? 'border-slate-900 scale-105' : 'border-white'}`}
                        style={{ backgroundColor: palette[key] || '#ffffff', color: key === 'accent' ? (palette.primary || '#0f172a') : '#ffffff' }}
                        title={title}
                    >
                        {label}
                    </button>
                );
            })}
        </div>
    );
}

export function getColorInputValue(value: string, palette: Record<string, string>, fallback: string): string {
    const resolved = resolvePaletteColor(value, palette, fallback);
    return /^#[0-9a-f]{6}$/i.test(resolved) ? resolved : fallback;
}

export function useInspectorSectionState(sectionIds: string[], defaultCollapsed: boolean = true) {
    const [collapsed, setCollapsed] = useState<Set<string>>(() =>
        defaultCollapsed ? new Set(sectionIds) : new Set()
    );

    const toggle = useCallback((id: string) => {
        setCollapsed((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const allCollapsed = sectionIds.every(id => collapsed.has(id));

    const setAll = useCallback((shouldCollapse: boolean) => {
        setCollapsed(shouldCollapse ? new Set(sectionIds) : new Set());
    }, [sectionIds]);

    const reset = useCallback(() => {
        setCollapsed(defaultCollapsed ? new Set(sectionIds) : new Set());
    }, [sectionIds, defaultCollapsed]);

    return { collapsed, toggle, allCollapsed, setAll, reset, isCollapsed: (id: string) => collapsed.has(id) };
}
