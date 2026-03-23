'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { NavItem, BlockData } from '@/lib/editor-context';
import { getBlockSlug } from '@/lib/block-utils';

interface NavItemEditModalProps {
    item: NavItem;
    pages: Array<{ id: string; slug: string; title: string }>;
    blocks: BlockData[];
    onSave: (updated: NavItem) => void;
    onClose: () => void;
}

export default function NavItemEditModal({
    item,
    pages,
    blocks,
    onSave,
    onClose,
}: NavItemEditModalProps) {
    const [label, setLabel] = useState(item.label);
    const [linkType, setLinkType] = useState<'page' | 'section' | 'custom'>(item.linkType);
    const [pageId, setPageId] = useState(item.pageId || '');
    // For section links, track the page the section lives on separately
    const [sectionPageId, setSectionPageId] = useState(
        item.linkType === 'section' ? (item.pageId || '') : ''
    );
    const [blockId, setBlockId] = useState(item.blockId || '');
    const [customHref, setCustomHref] = useState(
        item.linkType === 'custom' ? item.href : ''
    );

    // Resolve href based on linkType
    const resolveHref = (): string => {
        if (linkType === 'page') {
            const page = pages.find(p => p.id === pageId);
            return page ? `/${page.slug}` : '#';
        }
        if (linkType === 'section') {
            if (!blockId) return '#';
            const blockIndex = blocks.findIndex(b => b.id === blockId);
            const hash = blockIndex !== -1
                ? `#${getBlockSlug(blocks[blockIndex], blockIndex, blocks)}`
                : `#${blockId}`;
            if (sectionPageId) {
                const page = pages.find(p => p.id === sectionPageId);
                if (page) {
                    const slug = page.slug === 'home' ? '' : `/${page.slug}`;
                    return `${slug}${hash}`;
                }
            }
            return hash;
        }
        return customHref || '#';
    };

    const handleSave = () => {
        onSave({
            ...item,
            label,
            linkType,
            href: resolveHref(),
            pageId: linkType === 'page' ? pageId : linkType === 'section' ? sectionPageId || undefined : undefined,
            blockId: linkType === 'section' ? blockId : undefined,
        });
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold text-slate-900">Edit Menu Item</h3>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Label */}
                <div className="mb-4">
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Label</label>
                    <input
                        type="text"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        className="w-full px-3 py-2 text-sm text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Menu item text"
                        autoFocus
                    />
                </div>

                {/* Link Type */}
                <div className="mb-4">
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Link To</label>
                    <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                        {(['page', 'section', 'custom'] as const).map((type) => (
                            <button
                                key={type}
                                onClick={() => setLinkType(type)}
                                className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${linkType === type
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                {type === 'page' ? 'Page' : type === 'section' ? 'Section' : 'Custom URL'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Link Value */}
                <div className="mb-6">
                    {linkType === 'page' && (
                        <>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Select Page</label>
                            <select
                                value={pageId}
                                onChange={(e) => setPageId(e.target.value)}
                                className="w-full px-3 py-2 text-sm text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Choose a page...</option>
                                {pages.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.title}
                                    </option>
                                ))}
                            </select>
                        </>
                    )}

                    {linkType === 'section' && (
                        <>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Page (optional)</label>
                            <select
                                value={sectionPageId}
                                onChange={(e) => setSectionPageId(e.target.value)}
                                className="w-full px-3 py-2 text-sm text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                            >
                                <option value="">Current page</option>
                                {pages.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.title}
                                    </option>
                                ))}
                            </select>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Select Section</label>
                            {blocks.length > 0 ? (
                                <select
                                    value={blockId}
                                    onChange={(e) => setBlockId(e.target.value)}
                                    className="w-full px-3 py-2 text-sm text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Choose a block...</option>
                                    {blocks.map((b, i) => {
                                        const rawTitle = b.data?.title || b.data?.heading || '';
                                        const cleanTitle = rawTitle.replace(/<[^>]*>?/gm, '').trim();
                                        const typeName = b.type.charAt(0).toUpperCase() + b.type.slice(1);
                                        const label = cleanTitle ? `${cleanTitle} (${typeName} Block)` : `${typeName} Block`;
                                        return (
                                            <option key={b.id} value={b.id}>
                                                {label}
                                            </option>
                                        );
                                    })}
                                </select>
                            ) : (
                                <p className="text-sm text-slate-500 italic">No blocks on this page yet.</p>
                            )}
                            <p className="mt-2 text-xs text-slate-400">
                                Select the page the section lives on. The link will route to <code className="bg-slate-100 px-1 rounded">/page#section</code> from anywhere.
                            </p>
                        </>
                    )}

                    {linkType === 'custom' && (
                        <>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">URL</label>
                            <input
                                type="text"
                                value={customHref}
                                onChange={(e) => setCustomHref(e.target.value)}
                                className="w-full px-3 py-2 text-sm text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="https://... or /page#section"
                            />
                            <p className="mt-2 text-xs text-slate-400">
                                External URL, relative path, or path with anchor (e.g. <code className="bg-slate-100 px-1 rounded">/about#team</code>)
                            </p>
                        </>
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold rounded-lg transition-colors text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!label.trim()}
                        className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-40 text-sm"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
