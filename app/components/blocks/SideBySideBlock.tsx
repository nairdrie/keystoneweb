'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { BlockData, EditorContextType, EditorProvider, useEditorContext, BlockDataProvider } from '@/lib/editor-context';
import { Plus, Crown } from 'lucide-react';
import { BLOCK_COMPONENTS, AVAILABLE_BLOCKS } from './block-registry';
import { getBlockDisplayLabel, getBlockIcon } from './block-icons';
import BlockWrapper from './BlockWrapper';

type ColumnRatio = '50-50' | '60-40' | '40-60' | '33-67' | '67-33';
type VerticalAlign = 'start' | 'center' | 'end' | 'stretch';

interface SideBySideBlockProps {
    id: string;
    data: any;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: (key: string, value: any) => void;
}

const RATIO_TO_FRACTIONS: Record<ColumnRatio, [string, string]> = {
    '50-50': ['1fr', '1fr'],
    '60-40': ['3fr', '2fr'],
    '40-60': ['2fr', '3fr'],
    '33-67': ['1fr', '2fr'],
    '67-33': ['2fr', '1fr'],
};

const ALIGN_TO_CSS: Record<VerticalAlign, string> = {
    start: 'start',
    center: 'center',
    end: 'end',
    stretch: 'stretch',
};

function resolveColor(value: string | undefined, palette: Record<string, string>): string | undefined {
    if (!value) return undefined;
    if (value.startsWith('palette:')) {
        const key = value.slice('palette:'.length);
        return palette[key];
    }
    return value;
}

export default function SideBySideBlock({ data, isEditMode, palette, updateContent }: SideBySideBlockProps) {
    const leftBlocks: BlockData[] = Array.isArray(data?.leftBlocks) ? data.leftBlocks : [];
    const rightBlocks: BlockData[] = Array.isArray(data?.rightBlocks) ? data.rightBlocks : [];
    const columnRatio: ColumnRatio = (data?.columnRatio as ColumnRatio) || '50-50';
    const gap: number = typeof data?.gap === 'number' ? data.gap : 32;
    const verticalAlign: VerticalAlign = (data?.verticalAlign as VerticalAlign) || 'start';
    const stackOnMobile: boolean = data?.stackOnMobile !== false;
    const reverseOnMobile: boolean = Boolean(data?.reverseOnMobile);
    const background = resolveColor(data?.backgroundColor, palette);

    const [leftFr, rightFr] = RATIO_TO_FRACTIONS[columnRatio] || RATIO_TO_FRACTIONS['50-50'];

    const containerStyle: React.CSSProperties = {
        backgroundColor: background,
    };

    const gridStyle: React.CSSProperties = {
        display: 'grid',
        gridTemplateColumns: `${leftFr} ${rightFr}`,
        alignItems: ALIGN_TO_CSS[verticalAlign],
        gap: `${gap}px`,
    };

    return (
        <section style={containerStyle} className="w-full py-8 px-4 sm:px-6 ks-side-by-side">
            <div className="ks-side-by-side-grid mx-auto max-w-7xl" style={gridStyle}>
                <SideBySideColumn
                    side="left"
                    blocks={leftBlocks}
                    isEditMode={isEditMode}
                    palette={palette}
                    onChange={(next) => updateContent('leftBlocks', next)}
                />
                <SideBySideColumn
                    side="right"
                    blocks={rightBlocks}
                    isEditMode={isEditMode}
                    palette={palette}
                    onChange={(next) => updateContent('rightBlocks', next)}
                />
            </div>
            <style dangerouslySetInnerHTML={{
                __html: `@media (max-width: 767px) {
                    .ks-side-by-side .ks-side-by-side-grid {
                        ${stackOnMobile ? 'grid-template-columns: 1fr !important;' : ''}
                    }
                    ${stackOnMobile && reverseOnMobile ? '.ks-side-by-side .ks-side-by-side-grid > [data-side="left"] { order: 2; } .ks-side-by-side .ks-side-by-side-grid > [data-side="right"] { order: 1; }' : ''}
                }`,
            }} />
        </section>
    );
}

// ─── Column ─────────────────────────────────────────────────────────────────

function SideBySideColumn({
    side, blocks, isEditMode, palette, onChange,
}: {
    side: 'left' | 'right';
    blocks: BlockData[];
    isEditMode: boolean;
    palette: Record<string, string>;
    onChange: (next: BlockData[]) => void;
}) {
    if (!isEditMode) {
        return (
            <div data-side={side} className="min-w-0">
                {blocks.map(block => {
                    const Component = BLOCK_COMPONENTS[block.type];
                    if (!Component) return null;
                    return (
                        <BlockWrapper
                            key={block.id}
                            id={block.id}
                            type={block.type}
                            data={block.data || {}}
                            customCss={block.data?.__customCss || ''}
                            palette={palette}
                        >
                            <BlockDataProvider value={block.data || {}}>
                                <Component
                                    id={block.id}
                                    data={block.data || {}}
                                    isEditMode={false}
                                    palette={palette}
                                    updateContent={() => {}}
                                    block={block}
                                />
                            </BlockDataProvider>
                        </BlockWrapper>
                    );
                })}
            </div>
        );
    }

    return (
        <ScopedEditMode blocks={blocks} onChange={onChange} palette={palette}>
            <div
                data-side={side}
                className="min-w-0 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/40 p-2"
            >
                <div className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {side === 'left' ? 'Left column' : 'Right column'}
                </div>

                {blocks.length === 0 ? (
                    <ScopedAddButton index={0} label="Add block" alwaysVisible />
                ) : (
                    <>
                        {blocks.map((block, i) => {
                            const Component = BLOCK_COMPONENTS[block.type];
                            if (!Component) return null;
                            return (
                                <div key={block.id} className="relative">
                                    <ScopedAddButton index={i} position="top" />
                                    <BlockWrapper
                                        id={block.id}
                                        type={block.type}
                                        data={block.data || {}}
                                        customCss={block.data?.__customCss || ''}
                                        palette={palette}
                                        onUpdateBlockData={(key: string, value: unknown) => {
                                            // Handled via the scoped context's updateBlockData,
                                            // but BlockWrapper also calls this prop directly — wire it through.
                                            onChange(blocks.map(b =>
                                                b.id === block.id ? { ...b, data: { ...b.data, [key]: value } } : b
                                            ));
                                        }}
                                        onUpdateCustomCss={(css: string) => {
                                            onChange(blocks.map(b =>
                                                b.id === block.id ? { ...b, data: { ...b.data, __customCss: css } } : b
                                            ));
                                        }}
                                    >
                                        <BlockDataProvider value={block.data || {}}>
                                            <Component
                                                id={block.id}
                                                data={block.data || {}}
                                                isEditMode={true}
                                                palette={palette}
                                                updateContent={(key: string, value: unknown) => {
                                                    onChange(blocks.map(b =>
                                                        b.id === block.id ? { ...b, data: { ...b.data, [key]: value } } : b
                                                    ));
                                                }}
                                                block={block}
                                            />
                                        </BlockDataProvider>
                                    </BlockWrapper>
                                </div>
                            );
                        })}
                        <ScopedAddButton index={blocks.length} label="Add block" alwaysVisible />
                    </>
                )}
            </div>
        </ScopedEditMode>
    );
}

// ─── Scoped editor context for nested blocks ─────────────────────────────────
//
// BlockWrapperEditor (which renders the cog/move/delete buttons and the
// settings modal) reads `useEditorContext()` to find the block in `blocks`
// and to invoke moveBlock/removeBlock/updateBlockDataBatch. We replace that
// context with a column-scoped one so every operation acts on the column
// array instead of the page-level blocks array.

function ScopedEditMode({
    blocks, onChange, palette, children,
}: {
    blocks: BlockData[];
    onChange: (next: BlockData[]) => void;
    palette: Record<string, string>;
    children: React.ReactNode;
}) {
    const parent = useEditorContext();

    const scopedValue = useMemo<EditorContextType>(() => {
        const base: EditorContextType = parent
            ? { ...parent }
            : {
                content: {},
                siteContent: {},
                updateSiteContent: () => {},
                navItems: [],
                updateNavItems: () => {},
                isEditMode: true,
                updateContent: () => {},
            };

        return {
            ...base,
            isEditMode: true,
            blocks,
            palette: palette || base.palette,
            addBlock: (type: string, index?: number) => {
                const newBlock: BlockData = {
                    id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                    type,
                    data: {},
                };
                const next = [...blocks];
                const insertAt = typeof index === 'number' && index >= 0 && index <= next.length ? index : next.length;
                next.splice(insertAt, 0, newBlock);
                onChange(next);
            },
            removeBlock: (id: string) => {
                onChange(blocks.filter(b => b.id !== id));
            },
            moveBlock: (id: string, direction: 'up' | 'down') => {
                const idx = blocks.findIndex(b => b.id === id);
                if (idx < 0) return;
                const target = direction === 'up' ? idx - 1 : idx + 1;
                if (target < 0 || target >= blocks.length) return;
                const next = [...blocks];
                [next[idx], next[target]] = [next[target], next[idx]];
                onChange(next);
            },
            updateBlockData: (id: string, key: string, value: unknown) => {
                onChange(blocks.map(b => b.id === id ? { ...b, data: { ...b.data, [key]: value } } : b));
            },
            updateBlockDataBatch: (id: string, updates: Record<string, unknown>) => {
                onChange(blocks.map(b => b.id === id ? { ...b, data: { ...b.data, ...updates } } : b));
            },
        };
    }, [parent, blocks, onChange, palette]);

    return <EditorProvider value={scopedValue}>{children}</EditorProvider>;
}

// ─── Scoped Add Button (uses scoped context.addBlock) ────────────────────────

function ScopedAddButton({
    index, label, position, alwaysVisible,
}: {
    index: number;
    label?: string;
    position?: 'top';
    alwaysVisible?: boolean;
}) {
    const ctx = useEditorContext();
    const isProUser = ctx?.isProUser ?? false;
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open && inputRef.current) inputRef.current.focus();
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const filtered = AVAILABLE_BLOCKS.filter(b =>
        b.type !== 'sideBySide' &&
        getBlockDisplayLabel(b.label).toLowerCase().includes(search.toLowerCase()),
    );

    return (
        <div
            ref={ref}
            className={`relative flex justify-center ${alwaysVisible ? 'my-2' : 'my-1 group/add'}`}
        >
            {!alwaysVisible && (
                <div className="absolute inset-0 flex items-center px-2">
                    <div className="w-full border-t border-transparent transition-colors group-hover/add:border-blue-200" />
                </div>
            )}
            <button
                onClick={() => { setOpen(o => !o); setSearch(''); }}
                className={`relative z-10 flex items-center gap-1.5 rounded-full text-xs font-medium transition-all ${
                    alwaysVisible
                        ? 'border border-blue-200 bg-blue-50 px-3 py-1.5 text-blue-700 hover:bg-blue-100'
                        : 'border border-transparent bg-white p-1.5 text-slate-300 shadow-sm hover:bg-blue-50 group-hover/add:border-blue-200 group-hover/add:text-blue-500'
                }`}
            >
                <Plus style={{ width: 13, height: 13 }} />
                {label && <span>{label}</span>}
            </button>

            {open && (
                <div className={`absolute ${position === 'top' ? 'bottom-7' : 'top-8'} z-[200] flex max-h-72 w-56 flex-col rounded-lg border border-slate-200 bg-white p-2 shadow-xl`}>
                    <p className="mb-1.5 flex-shrink-0 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Add block</p>
                    <div className="mb-2 flex-shrink-0 px-2">
                        <input
                            ref={inputRef}
                            type="search"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search blocks…"
                            className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                    </div>
                    <div className="flex-1 space-y-0.5 overflow-y-auto px-0.5">
                        {filtered.length > 0 ? filtered.map(b => (
                            <button
                                key={b.type}
                                className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
                                onClick={() => {
                                    if (b.proOnly && !isProUser) {
                                        window.location.href = '/pricing';
                                        return;
                                    }
                                    ctx?.addBlock?.(b.type, index);
                                    setOpen(false);
                                    setSearch('');
                                }}
                            >
                                <span className="flex min-w-0 items-center gap-2">
                                    {React.createElement(getBlockIcon(b.type), { className: 'h-4 w-4 shrink-0 text-slate-500' })}
                                    <span className="min-w-0 truncate">{getBlockDisplayLabel(b.label)}</span>
                                </span>
                                {b.proOnly && !isProUser && (
                                    <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                        <Crown style={{ width: 10, height: 10 }} />
                                        PRO
                                    </span>
                                )}
                            </button>
                        )) : (
                            <p className="py-4 text-center text-xs text-slate-400">No blocks found.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
