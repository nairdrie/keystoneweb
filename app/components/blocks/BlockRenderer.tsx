'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useEditorContext, BlockData, BlockDataProvider } from '@/lib/editor-context';
import BlockWrapper from './BlockWrapper';
import { Plus, Crown } from 'lucide-react';
import MembershipGateBlock from './MembershipGateBlock';
import SideBySideBlock from './SideBySideBlock';
import { BLOCK_COMPONENTS as BASE_BLOCK_COMPONENTS, AVAILABLE_BLOCKS as BASE_AVAILABLE_BLOCKS } from './block-registry';
import { getBlockDisplayLabel, getBlockIcon } from './block-icons';

const WALKTHROUGH_RESET_EVENT = 'ks:walkthrough-reset-ui';

// Add container blocks here (not in block-registry.ts to avoid circular imports —
// these blocks themselves import from block-registry to render arbitrary children).
const BLOCK_COMPONENTS: Record<string, React.ComponentType<any>> = {
    ...BASE_BLOCK_COMPONENTS,
    membershipGate: MembershipGateBlock,
    sideBySide: SideBySideBlock,
};

const AVAILABLE_BLOCKS: Array<{ type: string; label: string; proOnly?: boolean }> = [
    ...BASE_AVAILABLE_BLOCKS,
    { type: 'sideBySide', label: 'Side by Side (2 Columns)' },
    { type: 'membershipGate', label: '🔒 Membership Gate', proOnly: true },
];

export default function BlockRenderer({ palette, headerOffset }: { palette: Record<string, string>; headerOffset?: number }) {
    const context = useEditorContext();
    const blocks = context?.blocks || [];
    const isEditMode = context?.isEditMode || false;
    const isProUser = context?.isProUser || false;

    const AddBlockMenu = ({ index }: { index: number }) => {
        const [isOpen, setIsOpen] = useState(false);
        const [searchQuery, setSearchQuery] = useState('');
        const menuRef = React.useRef<HTMLDivElement>(null);

        // Auto-focus search input when menu opens
        const inputRef = React.useRef<HTMLInputElement>(null);
        useEffect(() => {
            if (isOpen && inputRef.current) {
                inputRef.current.focus();
            }
        }, [isOpen]);

        useEffect(() => {
            const handleWalkthroughReset = () => {
                setIsOpen(false);
                setSearchQuery('');
            };

            window.addEventListener(WALKTHROUGH_RESET_EVENT, handleWalkthroughReset);
            return () => window.removeEventListener(WALKTHROUGH_RESET_EVENT, handleWalkthroughReset);
        }, []);

        if (!isEditMode) return null;

        const filteredBlocks = AVAILABLE_BLOCKS.filter(b =>
            getBlockDisplayLabel(b.label).toLowerCase().includes(searchQuery.toLowerCase())
        );

        return (
            <div className="relative w-full flex justify-center my-2 group">
                <div className="absolute inset-0 flex items-center px-4">
                    <div className="w-full border-t border-transparent group-hover:border-slate-200 transition-colors" />
                </div>
                <button
                    onClick={(e) => {
                        const nextState = !isOpen;
                        setIsOpen(nextState);
                        setSearchQuery('');

                        // Scroll menu into view if opening
                        if (nextState) {
                            setTimeout(() => {
                                if (menuRef.current) {
                                    menuRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                }
                            }, 50);
                        }
                    }}
                    className="relative rounded-full p-1.5 bg-white border border-transparent z-10 text-slate-400 group-hover:text-slate-600 group-hover:border-slate-300 hover:bg-slate-50 hover:scale-110 transition-all shadow-sm group-hover:shadow"
                >
                    <Plus className="w-4 h-4" />
                </button>

                {isOpen && (
                    <div data-tour="add-block-menu" ref={menuRef} className="absolute top-8 z-50 bg-white shadow-xl border border-slate-200 rounded-lg p-2 w-56 animate-in fade-in zoom-in duration-200 max-h-[300px] flex flex-col">
                        <h4 className="flex-shrink-0 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">Add Block</h4>
                        <div className="flex-shrink-0 px-2 mb-2">
                            <input
                                ref={inputRef}
                                type="search"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search blocks..."
                                className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 px-2 py-1.5 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        <div className="overflow-y-auto flex-1 space-y-0.5 px-0.5">
                            {filteredBlocks.length > 0 ? (
                                filteredBlocks.map(b => (
                                    <button
                                        key={b.type}
                                        className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors flex items-center justify-between gap-3"
                                        onClick={() => {
                                            if (b.proOnly && !isProUser) {
                                                window.location.href = '/pricing';
                                                return;
                                            }
                                            context?.addBlock?.(b.type, index);
                                            setIsOpen(false);
                                            setSearchQuery('');
                                        }}
                                    >
                                        <span className="flex min-w-0 items-center gap-2">
                                            {React.createElement(getBlockIcon(b.type), { className: 'h-4 w-4 shrink-0 text-slate-500' })}
                                            <span className="min-w-0">{getBlockDisplayLabel(b.label)}</span>
                                        </span>
                                        {b.proOnly && !isProUser && (
                                            <span className="flex items-center gap-1 text-[10px] font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white px-1.5 py-0.5 rounded-full">
                                                <Crown className="w-3 h-3" />
                                                PRO
                                            </span>
                                        )}
                                    </button>
                                ))
                            ) : (
                                <p className="text-xs text-slate-500 text-center py-4">No blocks found.</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    if (!blocks || blocks.length === 0) {
        if (!isEditMode) return <div className="py-24 text-center text-gray-400">This page has no content yet.</div>;
        return (
            <div className="py-24 flex flex-col items-center justify-center">
                <p className="text-slate-500 mb-6">Start building your page by adding a block.</p>
                <AddBlockMenu index={0} />
            </div>
        );
    }

    return (
        <div className="w-full relative flex flex-col">
            {blocks.map((block, i) => {
                const Component = BLOCK_COMPONENTS[block.type];
                if (!Component) return null;

                const isFirst = i === 0 && !!headerOffset;
                return (
                    <div
                        key={block.id}
                        data-tour="builder-section-frame"
                        className={`w-full${isFirst ? ' first-block-offset' : ''}`}
                        style={isFirst ? { '--header-offset': `${headerOffset}px` } as React.CSSProperties : undefined}
                    >
                        <AddBlockMenu index={i} />
                        <BlockWrapper
                            id={block.id}
                            type={block.type}
                            data={block.data || {}}
                            onUpdateBlockData={(key: string, value: any) => context?.updateBlockData?.(block.id, key, value)}
                            customCss={block.data?.__customCss || ''}
                            onUpdateCustomCss={(css) => context?.updateBlockData?.(block.id, '__customCss', css)}
                            palette={palette}
                        >
                            <BlockDataProvider value={block.data || {}}>
                                <Component
                                    id={block.id}
                                    data={block.data || {}}
                                    isEditMode={isEditMode}
                                    palette={palette}
                                    updateContent={(key: string, value: any) => context?.updateBlockData?.(block.id, key, value)}
                                    // We also pass the whole block object down for the simpler legacy blocks
                                    block={block}
                                />
                            </BlockDataProvider>
                        </BlockWrapper>
                    </div>
                );
            })}
            {/* Menu at the very bottom */}
            <AddBlockMenu index={blocks.length} />
        </div>
    );
}
