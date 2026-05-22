'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2 } from 'lucide-react';
import { NavItem, BlockData } from '@/lib/editor-context';
import { getBlockSlug } from '@/lib/block-utils';

interface NavItemEditModalProps {
    item: NavItem;
    pages: Array<{ id: string; slug: string; title: string }>;
    /** Blocks for the current (editor) page */
    blocks: BlockData[];
    /** Site ID, used to fetch blocks for other pages */
    siteId?: string;
    /** Current editor/public page id; blank section-page selection persists this */
    currentPageId?: string;
    onSave: (updated: NavItem) => void;
    onClose: () => void;
}

const PRODUCT_BLOCK_TYPE = 'productGrid';

type PageBlocksResponse = {
    pages?: Array<{
        id: string;
        design_data?: {
            blocks?: BlockData[];
            __blocks?: BlockData[];
        };
    }>;
};

function getHashFromHref(href: string | undefined): string {
    if (!href) return '';
    const hashIndex = href.indexOf('#');
    if (hashIndex === -1) return '';
    const hash = href.slice(hashIndex + 1);
    try {
        return decodeURIComponent(hash);
    } catch {
        return hash;
    }
}

function findBlockIdFromHash(hash: string, blocks: BlockData[]): string {
    if (!hash) return '';
    const normalizedHash = hash.replace(/^#/, '');
    const directMatch = blocks.find(block => block.id === normalizedHash);
    if (directMatch) return directMatch.id;

    const slugMatch = blocks.find((block, index) => getBlockSlug(block, index, blocks) === normalizedHash);
    return slugMatch?.id || '';
}

function cleanBlockTitle(block: BlockData): string {
    const rawTitle = block.data?.title || block.data?.heading || '';
    return String(rawTitle).replace(/<[^>]*>?/gm, '').trim().toLowerCase();
}

function findBlockIdFromLabel(label: string, blocks: BlockData[]): string {
    const normalizedLabel = label.trim().toLowerCase();
    if (!normalizedLabel) return '';
    return blocks.find(block => cleanBlockTitle(block) === normalizedLabel)?.id || '';
}

export default function NavItemEditModal({
    item,
    pages,
    blocks,
    siteId,
    currentPageId,
    onSave,
    onClose,
}: NavItemEditModalProps) {

    const mouseDownOnBackdrop = useRef(false);
    const [label, setLabel] = useState(item.label);
    const [linkType, setLinkType] = useState<'page' | 'section' | 'custom'>(item.linkType);
    const [pageId, setPageId] = useState(item.pageId || '');
    // For section links: which page the section lives on (stored as pageId on the nav item)
    const [sectionPageId, setSectionPageId] = useState(
        item.linkType === 'section' && item.pageId !== currentPageId ? (item.pageId || '') : ''
    );
    const initialHrefHash = getHashFromHref(item.href);
    const [blockId, setBlockId] = useState(
        item.blockId || findBlockIdFromHash(initialHrefHash, blocks) || findBlockIdFromLabel(item.label, blocks)
    );
    const [customHref, setCustomHref] = useState(
        item.linkType === 'custom' ? item.href : ''
    );
    const [categoryFilter, setCategoryFilter] = useState(item.categoryFilter || '');
    const [subcategoryFilter, setSubcategoryFilter] = useState(item.subcategoryFilter || '');

    // Blocks for the selected section page (fetched when different page is chosen)
    const [targetBlocks, setTargetBlocks] = useState<BlockData[]>(blocks);
    const [isFetchingBlocks, setIsFetchingBlocks] = useState(false);

    // Blocks for the page selected in the "page" link type (used to detect product blocks)
    const [pageBlocks, setPageBlocks] = useState<BlockData[]>([]);
    const [isFetchingPageBlocks, setIsFetchingPageBlocks] = useState(false);

    // All product categories for the site, used to populate the filter dropdown.
    const [categoryTree, setCategoryTree] = useState<Record<string, string[]>>({});
    const [categoryTreeLoaded, setCategoryTreeLoaded] = useState(false);

    // Track whether sectionPageId changed due to user interaction (not initial mount)
    const isInitialMount = useRef(true);
    const userChangedSectionPage = useRef(false);

    // When sectionPageId changes, fetch that page's blocks if needed
    useEffect(() => {
        if (linkType !== 'section') return;

        if (!sectionPageId) {
            // "Current page" selected — use the blocks prop as-is
            setTargetBlocks(blocks);
            if (!isInitialMount.current) setBlockId('');
            isInitialMount.current = false;
            return;
        }

        if (!siteId) {
            setTargetBlocks([]);
            isInitialMount.current = false;
            return;
        }

        // Fetch the target page's design_data to get its blocks
        setIsFetchingBlocks(true);
        if (!isInitialMount.current) setBlockId(''); // only reset when user changes page
        isInitialMount.current = false;

        fetch(`/api/pages?siteId=${siteId}`)
            .then(r => r.json())
            .then((data: PageBlocksResponse) => {
                const page = (data.pages || []).find(p => p.id === sectionPageId);
                const pageBlocks: BlockData[] = page?.design_data?.blocks || page?.design_data?.__blocks || [];
                setTargetBlocks(pageBlocks);
            })
            .catch(() => setTargetBlocks(blocks))
            .finally(() => setIsFetchingBlocks(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sectionPageId, linkType]);

    // Also update targetBlocks when the blocks prop changes (current page)
    useEffect(() => {
        if (!sectionPageId && linkType === 'section') {
            setTargetBlocks(blocks);
        }
    }, [blocks, sectionPageId, linkType]);

    useEffect(() => {
        if (linkType !== 'section' || userChangedSectionPage.current) return;
        if (blockId && targetBlocks.some(block => block.id === blockId)) return;
        const restoredBlockId = findBlockIdFromHash(initialHrefHash, targetBlocks) || findBlockIdFromLabel(item.label, targetBlocks);
        if (restoredBlockId) setBlockId(restoredBlockId);
    }, [blockId, initialHrefHash, item.label, linkType, targetBlocks]);

    // For "page" linkType: fetch the selected page's blocks so we can detect a Products block.
    useEffect(() => {
        if (linkType !== 'page' || !pageId || !siteId) {
            setPageBlocks([]);
            return;
        }
        setIsFetchingPageBlocks(true);
        fetch(`/api/pages?siteId=${siteId}`)
            .then(r => r.json())
            .then((data: PageBlocksResponse) => {
                const page = (data.pages || []).find(p => p.id === pageId);
                const blocks: BlockData[] = page?.design_data?.blocks || page?.design_data?.__blocks || [];
                setPageBlocks(blocks);
            })
            .catch(() => setPageBlocks([]))
            .finally(() => setIsFetchingPageBlocks(false));
    }, [pageId, linkType, siteId]);

    // Fetch the site's category tree once so we can render a category filter dropdown.
    useEffect(() => {
        if (!siteId) return;
        fetch(`/api/products?siteId=${siteId}&limit=1`)
            .then(r => r.json())
            .then(d => setCategoryTree(d.categoryTree || {}))
            .catch(() => setCategoryTree({}))
            .finally(() => setCategoryTreeLoaded(true));
    }, [siteId]);

    const hasProductBlock = (bs: BlockData[]) => bs.some(b => b.type === PRODUCT_BLOCK_TYPE);

    // Whether to show the category filter UI for the current selection.
    const showCategoryFilterForPage = linkType === 'page' && !!pageId && hasProductBlock(pageBlocks);
    const showCategoryFilterForSection =
        linkType === 'section' && !!blockId && targetBlocks.find(b => b.id === blockId)?.type === PRODUCT_BLOCK_TYPE;
    const showCategoryFilter = showCategoryFilterForPage || showCategoryFilterForSection;

    // Note: we deliberately do NOT auto-clear categoryFilter/subcategoryFilter when
    // showCategoryFilter is false. Doing so races with the async block/category fetches
    // and wipes the saved filter on initial mount before we know whether the target
    // page has a products block. handleSave filters by showCategoryFilter instead.

    // Clear subcategory when category changes to one that doesn't include it.
    // Wait for the category tree to load — otherwise the empty initial tree
    // would clear a saved subcategory before we know what's valid.
    useEffect(() => {
        if (!categoryTreeLoaded) return;
        if (!categoryFilter) {
            setSubcategoryFilter('');
            return;
        }
        const subs = categoryTree[categoryFilter] || [];
        if (subcategoryFilter && !subs.includes(subcategoryFilter)) {
            setSubcategoryFilter('');
        }
    }, [categoryFilter, categoryTree, subcategoryFilter, categoryTreeLoaded]);

    const buildQueryString = (): string => {
        if (!showCategoryFilter || !categoryFilter) return '';
        const params = new URLSearchParams();
        params.set('category', categoryFilter);
        if (subcategoryFilter) params.set('subcategory', subcategoryFilter);
        return `?${params.toString()}`;
    };

    // Resolve href based on linkType — uses targetBlocks so the slug is always correct
    const resolveHref = (): string => {
        const query = buildQueryString();
        if (linkType === 'page') {
            const page = pages.find(p => p.id === pageId);
            return page ? `/${page.slug}${query}` : '#';
        }
        if (linkType === 'section') {
            if (!blockId) return '#';
            const blockIndex = targetBlocks.findIndex(b => b.id === blockId);
            const hash = blockIndex !== -1
                ? `#${getBlockSlug(targetBlocks[blockIndex], blockIndex, targetBlocks)}`
                : `#${blockId}`;
            if (sectionPageId) {
                const page = pages.find(p => p.id === sectionPageId);
                if (page) {
                    const slug = page.slug === 'home' ? '' : `/${page.slug}`;
                    return `${slug}${query}${hash}`;
                }
            }
            return `${query}${hash}`;
        }
        return customHref || '#';
    };

    const handleSave = () => {
        const trimmedCategory = showCategoryFilter ? categoryFilter.trim() : '';
        const trimmedSubcategory = showCategoryFilter ? subcategoryFilter.trim() : '';
        onSave({
            ...item,
            label,
            linkType,
            href: resolveHref(),
            pageId: linkType === 'page' ? pageId : linkType === 'section' ? (sectionPageId || currentPageId || undefined) : undefined,
            blockId: linkType === 'section' ? blockId : undefined,
            categoryFilter: trimmedCategory || undefined,
            subcategoryFilter: trimmedCategory && trimmedSubcategory ? trimmedSubcategory : undefined,
        });
    };

    const renderBlockSelector = () => {
        if (isFetchingBlocks) {
            return (
                <div className="flex items-center gap-2 py-2 text-sm text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading sections…
                </div>
            );
        }
        if (targetBlocks.length === 0) {
            return <p className="text-sm text-slate-500 italic">No sections found on this page.</p>;
        }
        return (
            <select
                value={blockId}
                onChange={(e) => setBlockId(e.target.value)}
                className="w-full px-3 py-2 text-sm text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <option value="">Choose a section…</option>
                {targetBlocks.map((b) => {
                    const rawTitle = b.data?.title || b.data?.heading || '';
                    const cleanTitle = rawTitle.replace(/<[^>]*>?/gm, '').trim();
                    const typeName = b.type.charAt(0).toUpperCase() + b.type.slice(1);
                    const optLabel = cleanTitle ? `${cleanTitle} (${typeName})` : `${typeName} Block`;
                    return (
                        <option key={b.id} value={b.id}>
                            {optLabel}
                        </option>
                    );
                })}
            </select>
        );
    };

    const renderCategoryFilter = () => {
        if (!showCategoryFilter) return null;
        const categories = Object.keys(categoryTree).sort();
        const subs = categoryFilter ? (categoryTree[categoryFilter] || []) : [];
        return (
            <div className="mt-4 pt-4 border-t border-slate-200">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Filter by Category</label>
                <p className="text-xs text-slate-500 mb-2">
                    Optional — when set, the linked products list opens scoped to this category.
                </p>
                {isFetchingPageBlocks && linkType === 'page' ? (
                    <div className="flex items-center gap-2 py-2 text-sm text-slate-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Checking page…
                    </div>
                ) : categories.length === 0 ? (
                    <p className="text-sm text-slate-500 italic">No product categories defined yet.</p>
                ) : (
                    <>
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="w-full px-3 py-2 text-sm text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">All categories</option>
                            {categories.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                        {categoryFilter && subs.length > 0 && (
                            <select
                                value={subcategoryFilter}
                                onChange={(e) => setSubcategoryFilter(e.target.value)}
                                className="mt-2 w-full px-3 py-2 text-sm text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">All subcategories</option>
                                {subs.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        )}
                    </>
                )}
            </div>
        );
    };

    return createPortal(
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4"
            onMouseDown={(e) => { mouseDownOnBackdrop.current = e.target === e.currentTarget; }}
            onClick={() => { if (mouseDownOnBackdrop.current) onClose(); }}
        >
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
                            {renderCategoryFilter()}
                        </>
                    )}

                    {linkType === 'section' && (
                        <>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Page</label>
                            <select
                                value={sectionPageId}
                                onChange={(e) => {
                                    userChangedSectionPage.current = true;
                                    setSectionPageId(e.target.value);
                                }}
                                className="w-full px-3 py-2 text-sm text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                            >
                                <option value="">Current page</option>
                                {pages.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.title}
                                    </option>
                                ))}
                            </select>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Section</label>
                            {renderBlockSelector()}
                            <p className="mt-2 text-xs text-slate-400">
                                Link routes to <code className="bg-slate-100 px-1 rounded">/page#section</code> from any page.
                            </p>
                            {renderCategoryFilter()}
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
