'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useEditorContext } from '@/lib/editor-context';
import EditableText from '../EditableText';
import Reveal from '@/app/components/Reveal';
import {
  Plus, Trash2, Pencil, Check, X, Upload, Loader2,
  UtensilsCrossed, ExternalLink, Image as ImageIcon,
  FileText, List,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MenuItem {
  id: string;
  site_id: string;
  name: string;
  description: string | null;
  price: string | null;
  category: string;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
}

interface MenuBlockProps {
  id: string;
  data: any;
  isEditMode: boolean;
  palette: Record<string, string>;
  updateContent: (key: string, value: any) => void;
}

type MenuVariant = 'list' | 'grid' | 'cards' | 'compact';
type CategoryStyle = 'heading' | 'badge' | 'divider';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupByCategory(items: MenuItem[]): Record<string, MenuItem[]> {
  return items.reduce((acc, item) => {
    const cat = item.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);
}

// ─── Main Block ───────────────────────────────────────────────────────────────

export default function MenuBlock({ id, data, isEditMode, palette, updateContent }: MenuBlockProps) {
  const router = useRouter();
  const context = useEditorContext();
  const siteId = context?.siteId;
  const requestNavigation = context?.requestNavigation;

  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const mode: 'items' | 'pdf' = data.mode || 'items';
  const variant: MenuVariant = data.variant || 'list';
  const showPrices: boolean = data.showPrices !== false;
  const showDescriptions: boolean = data.showDescriptions !== false;
  const showImages: boolean = data.showImages === true;
  const categoryStyle: CategoryStyle = data.categoryStyle || 'heading';
  const pPrimary = palette.primary || '#1f2937';
  const pSecondary = palette.secondary || '#dc2626';
  const pAccent = palette.accent || '#f3f4f6';
  const bgColor = data.backgroundColor || '';

  useEffect(() => {
    if (!siteId) { setLoading(false); return; }
    fetch(`/api/menu?siteId=${siteId}`)
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => setItems(d.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [siteId]);

  // ── PDF Mode View ────────────────────────────────────────────────────────────
  if (mode === 'pdf' && !isEditMode) {
    const pdfUrl = data.pdfUrl;
    const isPdf = pdfUrl?.toLowerCase().includes('.pdf');
    return (
      <section className="py-20" style={{ backgroundColor: bgColor || pAccent }}>
        <div className="max-w-4xl mx-auto px-4 text-center">
          {(data.menuTitle || isEditMode) && (
            <Reveal>
              <h2 className="text-4xl font-bold mb-4" style={{ color: pPrimary }}>
                {data.menuTitle || 'Our Menu'}
              </h2>
            </Reveal>
          )}
          {data.menuSubtitle && (
            <Reveal>
              <p className="text-lg mb-10 opacity-70" style={{ color: pPrimary }}>{data.menuSubtitle}</p>
            </Reveal>
          )}
          {pdfUrl ? (
            <Reveal className="flex flex-col items-center gap-4">
              {isPdf ? (
                <iframe
                  src={pdfUrl}
                  className="w-full rounded-xl shadow-lg border border-slate-200"
                  style={{ height: '70vh' }}
                  title="Menu"
                />
              ) : (
                <img src={pdfUrl} alt="Menu" className="max-w-full rounded-xl shadow-lg" />
              )}
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 font-bold rounded-xl text-white transition-all hover:opacity-90"
                style={{ backgroundColor: pSecondary }}
              >
                <ExternalLink className="w-4 h-4" />
                {data.pdfLabel || 'Open Full Menu'}
              </a>
            </Reveal>
          ) : (
            <div className="text-slate-400 py-16">No menu file uploaded.</div>
          )}
        </div>
      </section>
    );
  }

  // ── Items Mode View ──────────────────────────────────────────────────────────
  if (mode === 'items' && !isEditMode) {
    const grouped = groupByCategory(items.filter(i => i.is_available));
    const categories = Object.keys(grouped);

    if (loading) {
      return (
        <section className="py-20" style={{ backgroundColor: bgColor || '#fff' }}>
          <div className="max-w-4xl mx-auto px-4 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
          </div>
        </section>
      );
    }

    return (
      <section className="py-20" style={{ backgroundColor: bgColor || '#fff' }}>
        <div className="max-w-5xl mx-auto px-4">
          {/* Section heading */}
          {(data.menuTitle || data.menuSubtitle) && (
            <div className="text-center mb-14">
              {data.menuTitle && (
                <Reveal>
                  <h2 className="text-4xl font-bold mb-3" style={{ color: pPrimary }}>{data.menuTitle}</h2>
                </Reveal>
              )}
              {data.menuSubtitle && (
                <Reveal>
                  <p className="text-lg opacity-70" style={{ color: pPrimary }}>{data.menuSubtitle}</p>
                </Reveal>
              )}
              <Reveal>
                <div className="w-20 h-1 mx-auto mt-5 rounded-full" style={{ backgroundColor: pSecondary }} />
              </Reveal>
            </div>
          )}

          {categories.length === 0 ? (
            <p className="text-center text-slate-400 py-12">No menu items yet.</p>
          ) : (
            <div className="space-y-12">
              {categories.map(cat => (
                <div key={cat}>
                  {/* Category header */}
                  <CategoryHeader label={cat} style={categoryStyle} pPrimary={pPrimary} pSecondary={pSecondary} pAccent={pAccent} />

                  {/* Items */}
                  {variant === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-5">
                      {grouped[cat].map(item => (
                        <GridItem key={item.id} item={item} palette={palette} showPrices={showPrices} showDescriptions={showDescriptions} showImages={showImages} />
                      ))}
                    </div>
                  ) : variant === 'cards' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-5">
                      {grouped[cat].map(item => (
                        <CardItem key={item.id} item={item} palette={palette} showPrices={showPrices} showDescriptions={showDescriptions} showImages={showImages} />
                      ))}
                    </div>
                  ) : variant === 'compact' ? (
                    <div className="mt-3 divide-y" style={{ borderColor: `${pPrimary}15` }}>
                      {grouped[cat].map(item => (
                        <CompactItem key={item.id} item={item} palette={palette} showPrices={showPrices} />
                      ))}
                    </div>
                  ) : (
                    // Default: list
                    <div className="mt-4 space-y-0">
                      {grouped[cat].map(item => (
                        <ListItem key={item.id} item={item} palette={palette} showPrices={showPrices} showDescriptions={showDescriptions} showImages={showImages} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  // ── Edit Mode ────────────────────────────────────────────────────────────────
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !siteId) return;
    setUploadingPdf(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('siteId', siteId);
      const res = await fetch('/api/menu/upload', { method: 'POST', body: fd });
      if (res.ok) {
        const { fileUrl } = await res.json();
        updateContent('pdfUrl', fileUrl);
        updateContent('mode', 'pdf');
      }
    } finally {
      setUploadingPdf(false);
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div className="py-8 px-6 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 min-h-[200px]">
      {/* Mode picker */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="w-5 h-5 text-slate-400" />
          <div>
            <EditableText
              as="span"
              contentKey="menuTitle"
              content={data.menuTitle}
              defaultValue="Our Menu"
              isEditMode={isEditMode}
              onSave={(key, val) => updateContent(key, val)}
              className="font-bold text-slate-800 text-lg"
            />
          </div>
        </div>
        <div className="flex items-center gap-1 p-0.5 bg-white rounded-full border border-slate-200 text-xs font-bold">
          <button
            onClick={() => updateContent('mode', 'items')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full transition-all ${mode === 'items' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <List className="w-3 h-3" />
            Item List
          </button>
          <button
            onClick={() => updateContent('mode', 'pdf')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full transition-all ${mode === 'pdf' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <FileText className="w-3 h-3" />
            PDF / Image
          </button>
        </div>
      </div>

      {/* Optional subtitle editable */}
      <EditableText
        as="p"
        contentKey="menuSubtitle"
        content={data.menuSubtitle}
        defaultValue=""
        isEditMode={isEditMode}
        onSave={(key, val) => updateContent(key, val)}
        className="text-sm text-slate-500 mb-6"
      />

      {mode === 'pdf' ? (
        <div className="space-y-4">
          {data.pdfUrl ? (
            <div className="relative group rounded-xl overflow-hidden border border-slate-200 bg-white">
              {data.pdfUrl.toLowerCase().includes('.pdf') ? (
                <div className="flex items-center gap-3 p-4">
                  <FileText className="w-8 h-8 text-red-500 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 text-sm">PDF Menu uploaded</div>
                    <a href={data.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline truncate block">
                      {data.pdfUrl}
                    </a>
                  </div>
                  <button
                    onClick={() => updateContent('pdfUrl', '')}
                    className="ml-auto p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <img src={data.pdfUrl} alt="Menu" className="w-full max-h-64 object-contain" />
                  <button
                    onClick={() => updateContent('pdfUrl', '')}
                    className="absolute top-2 right-2 p-1.5 bg-white/90 text-slate-400 hover:text-red-500 rounded-lg shadow"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ) : null}
          <label className="flex flex-col items-center justify-center w-full bg-white hover:bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 cursor-pointer transition-colors">
            <input ref={pdfInputRef} type="file" className="hidden" accept=".pdf,image/*" onChange={handlePdfUpload} disabled={uploadingPdf} />
            <div className="flex items-center gap-2 text-slate-600 font-semibold">
              {uploadingPdf ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
              {uploadingPdf ? 'Uploading…' : data.pdfUrl ? 'Replace file' : 'Upload PDF or image of your menu'}
            </div>
            <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG — max 20 MB</p>
          </label>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Button label</label>
            <EditableText
              as="span"
              contentKey="pdfLabel"
              content={data.pdfLabel}
              defaultValue="Open Full Menu"
              isEditMode={isEditMode}
              onSave={(key, val) => updateContent(key, val)}
              className="text-sm text-slate-700 bg-white border border-slate-200 px-3 py-1.5 rounded-lg inline-block"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Inline preview of items */}
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
          ) : items.length > 0 ? (
            <div className="space-y-2">
              {Object.entries(groupByCategory(items)).map(([cat, catItems]) => (
                <div key={cat} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">{cat}</span>
                    <span className="ml-2 text-xs text-slate-400">{catItems.length} item{catItems.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {catItems.slice(0, 4).map(item => (
                      <div key={item.id} className="flex items-center justify-between px-4 py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${item.is_available ? 'bg-green-400' : 'bg-slate-200'}`} />
                          <span className="text-sm font-medium text-slate-800 truncate">{item.name}</span>
                          {item.description && <span className="text-xs text-slate-400 truncate hidden sm:block">— {item.description}</span>}
                        </div>
                        {item.price && <span className="text-sm font-bold shrink-0 ml-2" style={{ color: pSecondary }}>{item.price}</span>}
                      </div>
                    ))}
                    {catItems.length > 4 && (
                      <div className="px-4 py-2 text-xs text-slate-400">+{catItems.length - 4} more items</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 text-sm">No menu items yet. Add items in the Menu tab of your admin panel.</div>
          )}

          {/* Admin link */}
          {siteId && (
            <button
              onClick={() => {
                const go = () => router.push(`/admin/menu?siteId=${siteId}`);
                if (requestNavigation) requestNavigation(go);
                else go();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition-colors"
            >
              <UtensilsCrossed className="w-4 h-4" />
              Manage Menu Items in Admin
              <ExternalLink className="w-3.5 h-3.5 opacity-60" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Item View Sub-components ─────────────────────────────────────────────────

function CategoryHeader({ label, style, pPrimary, pSecondary, pAccent }: { label: string; style: CategoryStyle; pPrimary: string; pSecondary: string; pAccent: string }) {
  if (style === 'badge') {
    return (
      <Reveal>
        <span className="inline-block px-4 py-1.5 text-sm font-bold rounded-full mb-4" style={{ backgroundColor: `${pSecondary}15`, color: pSecondary }}>
          {label}
        </span>
      </Reveal>
    );
  }
  if (style === 'divider') {
    return (
      <Reveal className="flex items-center gap-4 mb-6">
        <h3 className="text-xl font-black whitespace-nowrap" style={{ color: pPrimary }}>{label}</h3>
        <div className="flex-1 h-px" style={{ backgroundColor: `${pPrimary}20` }} />
      </Reveal>
    );
  }
  // Default: heading
  return (
    <Reveal>
      <h3 className="text-2xl font-black mb-1" style={{ color: pPrimary }}>{label}</h3>
      <div className="w-10 h-0.5 mb-6 rounded-full" style={{ backgroundColor: pSecondary }} />
    </Reveal>
  );
}

function ListItem({ item, palette, showPrices, showDescriptions, showImages }: { item: MenuItem; palette: Record<string, string>; showPrices: boolean; showDescriptions: boolean; showImages: boolean }) {
  const pPrimary = palette.primary || '#1f2937';
  const pSecondary = palette.secondary || '#dc2626';
  return (
    <Reveal>
      <div className="flex gap-4 py-4 border-b last:border-b-0" style={{ borderColor: `${pPrimary}10` }}>
        {showImages && item.image_url && (
          <img src={item.image_url} alt={item.name} className="w-16 h-16 object-cover rounded-lg shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-bold" style={{ color: pPrimary }}>{item.name}</span>
            {showPrices && item.price && (
              <span className="font-bold shrink-0 text-sm" style={{ color: pSecondary }}>{item.price}</span>
            )}
          </div>
          {showDescriptions && item.description && (
            <p className="text-sm mt-0.5 leading-snug opacity-60" style={{ color: pPrimary }}>{item.description}</p>
          )}
        </div>
      </div>
    </Reveal>
  );
}

function GridItem({ item, palette, showPrices, showDescriptions, showImages }: { item: MenuItem; palette: Record<string, string>; showPrices: boolean; showDescriptions: boolean; showImages: boolean }) {
  const pPrimary = palette.primary || '#1f2937';
  const pSecondary = palette.secondary || '#dc2626';
  const pAccent = palette.accent || '#f3f4f6';
  return (
    <Reveal>
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: pAccent, borderColor: `${pPrimary}10` }}>
        {showImages && item.image_url && (
          <div className="aspect-video w-full overflow-hidden">
            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-1">
            <span className="font-bold text-sm leading-tight" style={{ color: pPrimary }}>{item.name}</span>
            {showPrices && item.price && (
              <span className="font-black text-sm shrink-0" style={{ color: pSecondary }}>{item.price}</span>
            )}
          </div>
          {showDescriptions && item.description && (
            <p className="text-xs leading-snug opacity-60" style={{ color: pPrimary }}>{item.description}</p>
          )}
        </div>
      </div>
    </Reveal>
  );
}

function CardItem({ item, palette, showPrices, showDescriptions, showImages }: { item: MenuItem; palette: Record<string, string>; showPrices: boolean; showDescriptions: boolean; showImages: boolean }) {
  const pPrimary = palette.primary || '#1f2937';
  const pSecondary = palette.secondary || '#dc2626';
  return (
    <Reveal>
      <div className="flex gap-4 rounded-xl border p-4 bg-white" style={{ borderColor: `${pPrimary}10` }}>
        {showImages && item.image_url ? (
          <img src={item.image_url} alt={item.name} className="w-24 h-24 object-cover rounded-lg shrink-0" />
        ) : showImages ? (
          <div className="w-24 h-24 rounded-lg shrink-0 flex items-center justify-center" style={{ backgroundColor: `${pSecondary}10` }}>
            <UtensilsCrossed className="w-8 h-8 opacity-20" style={{ color: pSecondary }} />
          </div>
        ) : null}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <span className="font-bold text-base leading-tight" style={{ color: pPrimary }}>{item.name}</span>
            {showPrices && item.price && (
              <span className="font-black text-lg shrink-0" style={{ color: pSecondary }}>{item.price}</span>
            )}
          </div>
          {showDescriptions && item.description && (
            <p className="text-sm leading-relaxed mt-1 opacity-70" style={{ color: pPrimary }}>{item.description}</p>
          )}
        </div>
      </div>
    </Reveal>
  );
}

function CompactItem({ item, palette, showPrices }: { item: MenuItem; palette: Record<string, string>; showPrices: boolean }) {
  const pPrimary = palette.primary || '#1f2937';
  const pSecondary = palette.secondary || '#dc2626';
  return (
    <Reveal className="flex items-center justify-between py-2 gap-4">
      <span className="text-sm" style={{ color: pPrimary }}>{item.name}</span>
      {showPrices && item.price && (
        <span className="font-bold text-sm shrink-0" style={{ color: pSecondary }}>{item.price}</span>
      )}
    </Reveal>
  );
}

// ─── Menu Manager (admin panel component) ─────────────────────────────────────

interface ItemForm {
  name: string;
  description: string;
  price: string;
  category: string;
  image_url: string;
  is_available: boolean;
}

const EMPTY_FORM: ItemForm = {
  name: '',
  description: '',
  price: '',
  category: 'General',
  image_url: '',
  is_available: true,
};

export function MenuManager({ siteId, palette }: { siteId: string; palette: Record<string, string> }) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<ItemForm>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<ItemForm>(EMPTY_FORM);
  const [imageUploading, setImageUploading] = useState<string | null>(null); // itemId or 'new'
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const pSecondary = palette.secondary || '#dc2626';

  // Derived: known categories
  const knownCategories = Array.from(new Set(items.map(i => i.category).filter(Boolean)));

  useEffect(() => {
    fetchItems();
  }, [siteId]);

  async function fetchItems() {
    setLoading(true);
    try {
      const res = await fetch(`/api/menu?siteId=${siteId}`);
      const data = await res.json();
      setItems(data.items || []);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!addForm.name.trim()) { setError('Item name is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, ...addForm }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to add item.'); return; }
      setItems(prev => [...prev, data.item]);
      setAddForm(EMPTY_FORM);
      setShowAdd(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(id: string) {
    if (!editForm.name.trim()) { setError('Item name is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, siteId, ...editForm }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to update item.'); return; }
      setItems(prev => prev.map(i => i.id === id ? data.item : i));
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this menu item?')) return;
    setDeletingId(id);
    try {
      await fetch(`/api/menu?id=${id}&siteId=${siteId}`, { method: 'DELETE' });
      setItems(prev => prev.filter(i => i.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggleAvailable(item: MenuItem) {
    const res = await fetch('/api/menu', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, siteId, is_available: !item.is_available }),
    });
    if (res.ok) {
      const data = await res.json();
      setItems(prev => prev.map(i => i.id === item.id ? data.item : i));
    }
  }

  async function handleImageUpload(file: File, target: 'new' | string) {
    setImageUploading(target);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('siteId', siteId);
      const res = await fetch('/api/menu/upload', { method: 'POST', body: fd });
      if (!res.ok) { setError('Image upload failed.'); return; }
      const { fileUrl } = await res.json();
      if (target === 'new') {
        setAddForm(f => ({ ...f, image_url: fileUrl }));
      } else {
        setEditForm(f => ({ ...f, image_url: fileUrl }));
        // also patch immediately if editing
        await fetch('/api/menu', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: target, siteId, image_url: fileUrl }),
        });
        setItems(prev => prev.map(i => i.id === target ? { ...i, image_url: fileUrl } : i));
      }
    } finally {
      setImageUploading(null);
    }
  }

  function startEdit(item: MenuItem) {
    setEditingId(item.id);
    setEditForm({
      name: item.name,
      description: item.description || '',
      price: item.price || '',
      category: item.category,
      image_url: item.image_url || '',
      is_available: item.is_available,
    });
    setError('');
  }

  const grouped = groupByCategory(items);
  const categories = Object.keys(grouped);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>
      )}

      {/* Header actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{items.length} item{items.length !== 1 ? 's' : ''} across {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'}</p>
        <button
          onClick={() => { setShowAdd(true); setAddForm(EMPTY_FORM); setError(''); }}
          className="flex items-center gap-1.5 px-4 py-2 text-white text-sm font-bold rounded-lg transition-colors hover:opacity-90"
          style={{ backgroundColor: pSecondary }}
        >
          <Plus className="w-4 h-4" />
          Add Item
        </button>
      </div>

      {/* Add Item form */}
      {showAdd && (
        <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
            <span className="text-sm font-bold text-blue-800">New Menu Item</span>
            <button onClick={() => setShowAdd(false)} className="text-blue-400 hover:text-blue-700"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-4">
            <ItemFormFields
              form={addForm}
              onChange={setAddForm}
              knownCategories={knownCategories}
              onImageUpload={f => handleImageUpload(f, 'new')}
              imageUploading={imageUploading === 'new'}
            />
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
              <button
                onClick={handleAdd}
                disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2 text-white text-sm font-bold rounded-lg disabled:opacity-60 hover:opacity-90 transition-colors"
                style={{ backgroundColor: pSecondary }}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Add Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item list by category */}
      {items.length === 0 && !showAdd ? (
        <div className="text-center py-16 text-slate-400">
          <UtensilsCrossed className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No menu items yet</p>
          <p className="text-sm mt-1">Add your first item above.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {categories.map(cat => (
            <div key={cat} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{cat}</span>
                <span className="text-xs text-slate-400">{grouped[cat].length} item{grouped[cat].length !== 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y divide-slate-100">
                {grouped[cat].map(item => (
                  <div key={item.id}>
                    {editingId === item.id ? (
                      <div className="p-4 bg-blue-50/50">
                        <ItemFormFields
                          form={editForm}
                          onChange={setEditForm}
                          knownCategories={knownCategories}
                          onImageUpload={f => handleImageUpload(f, item.id)}
                          imageUploading={imageUploading === item.id}
                        />
                        <div className="flex gap-2 mt-4 justify-end">
                          <button onClick={() => setEditingId(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-white rounded-lg">Cancel</button>
                          <button
                            onClick={() => handleUpdate(item.id)}
                            disabled={saving}
                            className="flex items-center gap-1.5 px-5 py-2 text-white text-sm font-bold rounded-lg disabled:opacity-60 hover:opacity-90"
                            style={{ backgroundColor: pSecondary }}
                          >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-3 group">
                        {/* Availability dot */}
                        <button
                          onClick={() => handleToggleAvailable(item)}
                          title={item.is_available ? 'Mark unavailable' : 'Mark available'}
                          className="shrink-0"
                        >
                          <span className={`w-2.5 h-2.5 rounded-full block transition-colors ${item.is_available ? 'bg-green-400' : 'bg-slate-200'}`} />
                        </button>

                        {/* Item image thumbnail */}
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-10 h-10 object-cover rounded-lg shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                            <ImageIcon className="w-4 h-4 text-slate-300" />
                          </div>
                        )}

                        {/* Name + desc */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className={`font-semibold text-sm ${item.is_available ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{item.name}</span>
                            {item.price && <span className="text-xs font-bold" style={{ color: pSecondary }}>{item.price}</span>}
                          </div>
                          {item.description && (
                            <p className="text-xs text-slate-400 truncate">{item.description}</p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={() => startEdit(item)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            disabled={deletingId === item.id}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {deletingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Item Form Fields ─────────────────────────────────────────────────────────

function ItemFormFields({
  form,
  onChange,
  knownCategories,
  onImageUpload,
  imageUploading,
}: {
  form: ItemForm;
  onChange: (f: ItemForm) => void;
  knownCategories: string[];
  onImageUpload: (f: File) => void;
  imageUploading: boolean;
}) {
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const suggestions = knownCategories.filter(c => c !== form.category && c.toLowerCase().includes(form.category.toLowerCase()));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {/* Name */}
      <div className="sm:col-span-2">
        <label className="text-xs font-semibold text-slate-600 block mb-1">Item name <span className="text-red-400">*</span></label>
        <input
          type="text"
          value={form.name}
          onChange={e => onChange({ ...form, name: e.target.value })}
          placeholder="e.g. Margherita Pizza"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Price */}
      <div>
        <label className="text-xs font-semibold text-slate-600 block mb-1">Price</label>
        <input
          type="text"
          value={form.price}
          onChange={e => onChange({ ...form, price: e.target.value })}
          placeholder="$12.99 or Market Price"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Category */}
      <div className="relative">
        <label className="text-xs font-semibold text-slate-600 block mb-1">Category</label>
        <input
          type="text"
          value={form.category}
          onChange={e => { onChange({ ...form, category: e.target.value }); setShowCategorySuggestions(true); }}
          onFocus={() => setShowCategorySuggestions(true)}
          onBlur={() => setTimeout(() => setShowCategorySuggestions(false), 150)}
          placeholder="e.g. Appetizers"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {showCategorySuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 overflow-hidden">
            {suggestions.map(s => (
              <button
                key={s}
                onMouseDown={() => { onChange({ ...form, category: s }); setShowCategorySuggestions(false); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 text-slate-700"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Description */}
      <div className="sm:col-span-2">
        <label className="text-xs font-semibold text-slate-600 block mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={e => onChange({ ...form, description: e.target.value })}
          placeholder="Optional — e.g. Tomato, mozzarella, fresh basil"
          rows={2}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* Image */}
      <div className="sm:col-span-2">
        <label className="text-xs font-semibold text-slate-600 block mb-1">Photo</label>
        <div className="flex items-center gap-3">
          {form.image_url ? (
            <div className="relative group">
              <img src={form.image_url} alt="Item" className="w-14 h-14 object-cover rounded-lg border border-slate-200" />
              <button
                onClick={() => onChange({ ...form, image_url: '' })}
                className="absolute -top-1 -right-1 w-5 h-5 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 shadow"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : null}
          <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 rounded-lg cursor-pointer transition-colors text-sm text-slate-600">
            <input type="file" className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) onImageUpload(f); e.target.value = ''; }} disabled={imageUploading} />
            {imageUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {imageUploading ? 'Uploading…' : form.image_url ? 'Change photo' : 'Upload photo'}
          </label>
        </div>
      </div>

      {/* Availability */}
      <div className="sm:col-span-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange({ ...form, is_available: !form.is_available })}
          className={`relative w-10 h-5 rounded-full transition-colors ${form.is_available ? 'bg-green-400' : 'bg-slate-200'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_available ? 'left-5.5 translate-x-0.5' : 'left-0.5'}`} />
        </button>
        <span className="text-sm text-slate-600">{form.is_available ? 'Available' : 'Unavailable (hidden on site)'}</span>
      </div>
    </div>
  );
}
