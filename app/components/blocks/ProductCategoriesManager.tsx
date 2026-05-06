'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, FolderTree, Loader2, Pencil, Plus, Trash2, X, Check } from 'lucide-react';

interface SubcategoryNode {
    name: string;
    productCount: number;
}

interface CategoryNode {
    name: string;
    productCount: number;
    subcategories: SubcategoryNode[];
}

export default function ProductCategoriesManager({
    siteId,
    isOpen,
    onClose,
    onChanged,
}: {
    siteId: string;
    isOpen: boolean;
    onClose: () => void;
    onChanged?: () => void;
}) {
    const [categories, setCategories] = useState<CategoryNode[]>([]);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);
    const [newCatName, setNewCatName] = useState('');
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [editing, setEditing] = useState<{ parent: string | null; name: string; draft: string } | null>(null);
    const [subInputs, setSubInputs] = useState<Record<string, string>>({});
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/products/categories?siteId=${siteId}`);
            const data = await res.json();
            setCategories(data.categories || []);
        } catch (e) {
            setError('Failed to load categories');
        } finally {
            setLoading(false);
        }
    }, [siteId]);

    useEffect(() => {
        if (!isOpen) return;
        load();
    }, [isOpen, load]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const refresh = async () => {
        await load();
        onChanged?.();
    };

    const handleAddCategory = async () => {
        const name = newCatName.trim();
        if (!name) return;
        setBusy('add-cat');
        setError(null);
        try {
            const res = await fetch('/api/products/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ siteId, name }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || 'Failed to add');
            }
            setNewCatName('');
            await refresh();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setBusy(null);
        }
    };

    const handleAddSubcategory = async (parent: string) => {
        const name = (subInputs[parent] || '').trim();
        if (!name) return;
        setBusy(`add-sub-${parent}`);
        setError(null);
        try {
            const res = await fetch('/api/products/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ siteId, name, parent_name: parent }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || 'Failed to add');
            }
            setSubInputs(prev => ({ ...prev, [parent]: '' }));
            setExpanded(prev => new Set(prev).add(parent));
            await refresh();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setBusy(null);
        }
    };

    const handleDelete = async (name: string, parent: string | null, productCount: number, hasSubs: boolean) => {
        const what = parent ? 'subcategory' : 'category';
        const cascade = parent
            ? `This will uncategorize ${productCount} product${productCount === 1 ? '' : 's'} from this subcategory (the parent category remains).`
            : `This will uncategorize ${productCount} product${productCount === 1 ? '' : 's'}${hasSubs ? ' and remove its subcategories' : ''}.`;
        if (!confirm(`Delete ${what} "${name}"?\n\n${cascade}`)) return;
        setBusy(`del-${parent || ''}-${name}`);
        setError(null);
        try {
            const params = new URLSearchParams({ siteId, name });
            if (parent) params.set('parent_name', parent);
            const res = await fetch(`/api/products/categories?${params}`, { method: 'DELETE' });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || 'Failed to delete');
            }
            await refresh();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setBusy(null);
        }
    };

    const handleRename = async () => {
        if (!editing) return;
        const newName = editing.draft.trim();
        if (!newName || newName === editing.name) { setEditing(null); return; }
        setBusy(`rename-${editing.parent || ''}-${editing.name}`);
        setError(null);
        try {
            const res = await fetch('/api/products/categories', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    siteId,
                    oldName: editing.name,
                    newName,
                    parent_name: editing.parent,
                }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || 'Failed to rename');
            }
            setEditing(null);
            await refresh();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setBusy(null);
        }
    };

    const toggleExpand = (name: string) => {
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    };

    return (
        <div
            className="fixed inset-0 z-[10001] flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
                    <div className="flex items-center gap-2">
                        <FolderTree className="w-4 h-4 text-blue-600" />
                        <h3 className="font-bold text-slate-900 text-sm">Manage Categories</h3>
                    </div>
                    <button onClick={onClose} className="p-1 rounded hover:bg-slate-200 text-slate-500">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {error && (
                        <div className="text-xs px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700">{error}</div>
                    )}

                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={newCatName}
                            onChange={e => setNewCatName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleAddCategory(); }}
                            placeholder="New category name"
                            className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        <button
                            onClick={handleAddCategory}
                            disabled={!newCatName.trim() || busy === 'add-cat'}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg disabled:opacity-40"
                        >
                            {busy === 'add-cat' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                            Add Category
                        </button>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                        {loading ? (
                            <div className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400 mx-auto" /></div>
                        ) : categories.length === 0 ? (
                            <p className="py-8 text-sm text-slate-400 text-center">No categories yet. Add one above.</p>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {categories.map(cat => {
                                    const isExpanded = expanded.has(cat.name);
                                    const editingCat = editing && editing.parent === null && editing.name === cat.name ? editing : null;
                                    const isEditingCat = !!editingCat;
                                    return (
                                        <li key={cat.name}>
                                            <div className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50">
                                                <button
                                                    onClick={() => toggleExpand(cat.name)}
                                                    className="p-0.5 text-slate-400 hover:text-slate-700 shrink-0"
                                                    aria-label={isExpanded ? 'Collapse' : 'Expand'}
                                                >
                                                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                </button>
                                                {editingCat ? (
                                                    <input
                                                        autoFocus
                                                        value={editingCat.draft}
                                                        onChange={e => setEditing({ ...editingCat, draft: e.target.value })}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') handleRename();
                                                            if (e.key === 'Escape') setEditing(null);
                                                        }}
                                                        className="flex-1 text-sm border border-slate-300 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                                    />
                                                ) : (
                                                    <span className="flex-1 text-sm font-semibold text-slate-800 truncate">{cat.name}</span>
                                                )}
                                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                                                    {cat.productCount} product{cat.productCount === 1 ? '' : 's'}
                                                </span>
                                                {isEditingCat ? (
                                                    <>
                                                        <button onClick={handleRename} className="p-1 rounded text-green-600 hover:bg-green-50" aria-label="Save">
                                                            <Check className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => setEditing(null)} className="p-1 rounded text-slate-500 hover:bg-slate-100" aria-label="Cancel">
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => setEditing({ parent: null, name: cat.name, draft: cat.name })}
                                                            className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                                            title="Rename"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(cat.name, null, cat.productCount, cat.subcategories.length > 0)}
                                                            disabled={busy === `del--${cat.name}`}
                                                            className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>

                                            {isExpanded && (
                                                <div className="bg-slate-50/60 pl-9 pr-3 pb-3 pt-1 border-t border-slate-100">
                                                    {cat.subcategories.length === 0 && (
                                                        <p className="text-[11px] text-slate-400 py-1">No subcategories.</p>
                                                    )}
                                                    {cat.subcategories.map(sub => {
                                                        const editingSub = editing && editing.parent === cat.name && editing.name === sub.name ? editing : null;
                                                        return (
                                                            <div key={sub.name} className="flex items-center gap-2 py-1">
                                                                {editingSub ? (
                                                                    <input
                                                                        autoFocus
                                                                        value={editingSub.draft}
                                                                        onChange={e => setEditing({ ...editingSub, draft: e.target.value })}
                                                                        onKeyDown={e => {
                                                                            if (e.key === 'Enter') handleRename();
                                                                            if (e.key === 'Escape') setEditing(null);
                                                                        }}
                                                                        className="flex-1 text-xs border border-slate-300 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                                                    />
                                                                ) : (
                                                                    <span className="flex-1 text-xs text-slate-700 truncate">{sub.name}</span>
                                                                )}
                                                                <span className="text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded-full shrink-0">
                                                                    {sub.productCount}
                                                                </span>
                                                                {editingSub ? (
                                                                    <>
                                                                        <button onClick={handleRename} className="p-1 rounded text-green-600 hover:bg-green-50" aria-label="Save">
                                                                            <Check className="w-3.5 h-3.5" />
                                                                        </button>
                                                                        <button onClick={() => setEditing(null)} className="p-1 rounded text-slate-500 hover:bg-slate-100" aria-label="Cancel">
                                                                            <X className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <button
                                                                            onClick={() => setEditing({ parent: cat.name, name: sub.name, draft: sub.name })}
                                                                            className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                                                            title="Rename"
                                                                        >
                                                                            <Pencil className="w-3.5 h-3.5" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDelete(sub.name, cat.name, sub.productCount, false)}
                                                                            className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50"
                                                                            title="Delete"
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        );
                                                    })}

                                                    <div className="flex items-center gap-2 mt-2">
                                                        <input
                                                            type="text"
                                                            value={subInputs[cat.name] || ''}
                                                            onChange={e => setSubInputs(prev => ({ ...prev, [cat.name]: e.target.value }))}
                                                            onKeyDown={e => { if (e.key === 'Enter') handleAddSubcategory(cat.name); }}
                                                            placeholder="New subcategory"
                                                            className="flex-1 text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                                        />
                                                        <button
                                                            onClick={() => handleAddSubcategory(cat.name)}
                                                            disabled={!(subInputs[cat.name] || '').trim() || busy === `add-sub-${cat.name}`}
                                                            className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-800 text-white text-[11px] font-bold rounded disabled:opacity-40"
                                                        >
                                                            {busy === `add-sub-${cat.name}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                                                            Add
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                        Renaming updates every product using that category. Deleting clears the category from products (uncategorizes them) but doesn't delete the products themselves.
                    </p>
                </div>

                <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
                    <button onClick={onClose} className="px-4 py-1.5 text-xs font-bold rounded-lg bg-slate-700 hover:bg-slate-800 text-white">
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
