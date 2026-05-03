'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useEditorContext } from '@/lib/editor-context';
import EditableText from '../EditableText';
import Reveal from '@/app/components/Reveal';
import { resolvePaletteColor } from '@/lib/palette-colors';
import {
  Plus, Trash2, Pencil, Check, X, Upload, Loader2,
  UtensilsCrossed, ExternalLink, Image as ImageIcon,
  FileText, List, Star, ChevronUp, ChevronDown, ChevronRight, GripVertical,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MenuItem {
  id: string;
  site_id: string;
  menu_section: string | null;
  menu_section_order: number | null;
  name: string;
  description: string | null;
  price: string | null;
  category: string;
  category_order: number | null;
  image_url: string | null;
  is_available: boolean;
  is_featured: boolean;
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
const DEFAULT_MENU_SECTION = 'Main Menu';
const DEFAULT_MENU_SECTION_ORDERS: Record<string, number> = {
  breakfast: 0,
  brunch: 1,
  lunch: 2,
  dinner: 3,
  drinks: 4,
};
const MENU_DRAG_TYPE = 'application/x-keystone-menu-section';
const CATEGORY_DRAG_TYPE = 'application/x-keystone-menu-category';
const ITEM_DRAG_TYPE = 'application/x-keystone-menu-item';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupByCategory(items: MenuItem[]): Record<string, MenuItem[]> {
  return items.reduce((acc, item) => {
    const cat = item.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);
}

function getMenuSection(item: MenuItem): string {
  return item.menu_section || DEFAULT_MENU_SECTION;
}

function getCategoryKey(section: string, category: string): string {
  return `${section}::${category}`;
}

function groupByMenuSection(items: MenuItem[]): Record<string, MenuItem[]> {
  return items.reduce((acc, item) => {
    const section = getMenuSection(item);
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);
}

function getDefaultMenuSectionOrder(section: string): number {
  return DEFAULT_MENU_SECTION_ORDERS[section.trim().toLowerCase()] ?? Number.MAX_SAFE_INTEGER;
}

function getMenuSectionOrder(section: string, items: MenuItem[]): number {
  const explicitOrders = items
    .map(item => item.menu_section_order)
    .filter((order): order is number => typeof order === 'number' && Number.isFinite(order));

  if (explicitOrders.length > 0) return Math.min(...explicitOrders);
  return getDefaultMenuSectionOrder(section);
}

function getOrderedMenuSections(groupedByMenu: Record<string, MenuItem[]>): string[] {
  return Object.keys(groupedByMenu).sort((a, b) => {
    const orderDiff = getMenuSectionOrder(a, groupedByMenu[a]) - getMenuSectionOrder(b, groupedByMenu[b]);
    if (orderDiff !== 0) return orderDiff;
    return a.localeCompare(b);
  });
}

function getCategoryOrder(category: string, items: MenuItem[]): number {
  const explicitOrders = items
    .map(item => item.category_order)
    .filter((order): order is number => typeof order === 'number' && Number.isFinite(order));

  if (explicitOrders.length > 0) return Math.min(...explicitOrders);
  return Number.MAX_SAFE_INTEGER;
}

function getOrderedCategories(groupedByCategory: Record<string, MenuItem[]>): string[] {
  return Object.keys(groupedByCategory).sort((a, b) => {
    const orderDiff = getCategoryOrder(a, groupedByCategory[a]) - getCategoryOrder(b, groupedByCategory[b]);
    if (orderDiff !== 0) return orderDiff;
    return a.localeCompare(b);
  });
}

function sortMenuItems(items: MenuItem[]): MenuItem[] {
  return [...items].sort((a, b) => {
    const orderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return a.name.localeCompare(b.name);
  });
}

// ─── Main Block ───────────────────────────────────────────────────────────────

export default function MenuBlock({ id, data, isEditMode, palette, updateContent }: MenuBlockProps) {
  const router = useRouter();
  const context = useEditorContext();
  const siteId = context?.siteId;
  const requestNavigation = context?.requestNavigation;

  const [items, setItems] = useState<MenuItem[]>([]);
  const [activeMenu, setActiveMenu] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const mode: 'items' | 'pdf' = data.mode || 'items';
  const variant: MenuVariant = data.variant || 'list';
  const showPrices: boolean = data.showPrices !== false;
  const showDescriptions: boolean = data.showDescriptions !== false;
  const showRegularImages: boolean = data.showImages === true;
  const showFeaturedImages: boolean = data.showFeaturedImages !== false;
  const showMenuTabs: boolean = data.showMenuTabs !== false;
  const categoryStyle: CategoryStyle = data.categoryStyle || 'heading';
  const pPrimary = palette.primary || '#1f2937';
  const pSecondary = palette.secondary || '#dc2626';
  const pAccent = palette.accent || '#f3f4f6';
  const bgColor = resolvePaletteColor(data.backgroundColor, palette, '');
  const fallbackItems: MenuItem[] = Array.isArray(data.fallbackItems)
    ? data.fallbackItems.map((item: Partial<MenuItem>, index: number) => ({
      id: item.id || `fallback-${index}`,
      site_id: item.site_id || '',
      name: item.name || `Menu item ${index + 1}`,
      description: item.description ?? null,
      price: item.price ?? null,
      menu_section: item.menu_section || DEFAULT_MENU_SECTION,
      menu_section_order: item.menu_section_order ?? getDefaultMenuSectionOrder(item.menu_section || DEFAULT_MENU_SECTION),
      category: item.category || 'Menu',
      category_order: item.category_order ?? index,
      image_url: item.image_url ?? null,
      is_available: item.is_available !== false,
      is_featured: item.is_featured === true,
      sort_order: item.sort_order ?? index,
    }))
    : [];

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
    const publishedItems = items.filter(i => i.is_available);
    const displayItems = publishedItems.length > 0 ? publishedItems : fallbackItems;
    const groupedByMenu = groupByMenuSection(displayItems);
    const menuSections = getOrderedMenuSections(groupedByMenu);
    const selectedMenu = menuSections.includes(activeMenu) ? activeMenu : (menuSections[0] || DEFAULT_MENU_SECTION);
    const sectionItems = showMenuTabs && menuSections.length > 1 ? (groupedByMenu[selectedMenu] || []) : displayItems;
    const grouped = groupByCategory(sectionItems);
    const categories = getOrderedCategories(grouped);
    const shouldShowImage = (item: MenuItem) => item.is_featured ? showFeaturedImages : showRegularImages;

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
            <>
              {showMenuTabs && menuSections.length > 1 && (
                <MenuSectionTabs
                  sections={menuSections}
                  activeSection={selectedMenu}
                  onSelect={setActiveMenu}
                  pPrimary={pPrimary}
                  pSecondary={pSecondary}
                />
              )}
              <div className="space-y-12">
              {categories.map(cat => (
                <div key={cat}>
                  {/* Category header */}
                  <CategoryHeader label={cat} style={categoryStyle} pPrimary={pPrimary} pSecondary={pSecondary} pAccent={pAccent} />

                  {/* Items */}
                  {variant === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-5">
                      {sortMenuItems(grouped[cat]).map(item => (
                        <GridItem key={item.id} item={item} palette={palette} showPrices={showPrices} showDescriptions={showDescriptions} showImages={shouldShowImage(item)} />
                      ))}
                    </div>
                  ) : variant === 'cards' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-5">
                      {sortMenuItems(grouped[cat]).map(item => (
                        <CardItem key={item.id} item={item} palette={palette} showPrices={showPrices} showDescriptions={showDescriptions} showImages={shouldShowImage(item)} />
                      ))}
                    </div>
                  ) : variant === 'compact' ? (
                    <div className="mt-3 divide-y divide-slate-100/80">
                      {sortMenuItems(grouped[cat]).map(item => (
                        <CompactItem key={item.id} item={item} palette={palette} showPrices={showPrices} showDescriptions={showDescriptions} />
                      ))}
                    </div>
                  ) : (
                    // Default: list
                    <div className="mt-4 space-y-0">
                      {sortMenuItems(grouped[cat]).map(item => (
                        <ListItem key={item.id} item={item} palette={palette} showPrices={showPrices} showDescriptions={showDescriptions} showImages={shouldShowImage(item)} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
              </div>
            </>
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
              {Object.entries(groupByCategory(items))
                .sort(([a, aItems], [b, bItems]) => {
                  const orderDiff = getCategoryOrder(a, aItems) - getCategoryOrder(b, bItems);
                  if (orderDiff !== 0) return orderDiff;
                  return a.localeCompare(b);
                })
                .map(([cat, catItems]) => (
                <div key={cat} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">{cat}</span>
                    <span className="ml-2 text-xs text-slate-400">{catItems.length} item{catItems.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {sortMenuItems(catItems).slice(0, 4).map(item => (
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

function MenuSectionTabs({
  sections,
  activeSection,
  onSelect,
  pPrimary,
  pSecondary,
}: {
  sections: string[];
  activeSection: string;
  onSelect: (section: string) => void;
  pPrimary: string;
  pSecondary: string;
}) {
  return (
    <div className="mb-10 flex flex-wrap items-center justify-center gap-2">
      {sections.map(section => {
        const isActive = section === activeSection;
        return (
          <button
            key={section}
            type="button"
            onClick={() => onSelect(section)}
            className="rounded-full border px-5 py-2 text-sm font-bold transition-all"
            style={{
              borderColor: isActive ? pSecondary : `${pPrimary}20`,
              backgroundColor: isActive ? pSecondary : 'transparent',
              color: isActive ? '#ffffff' : pPrimary,
            }}
          >
            {section}
          </button>
        );
      })}
    </div>
  );
}

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
      <div className="flex gap-4 py-4 border-b last:border-b-0" style={{ borderColor: `${pPrimary}08` }}>
        {showImages && item.image_url && (
          <img src={item.image_url} alt={item.name} className="w-16 h-16 object-cover rounded-lg shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 font-bold" style={{ color: pPrimary }}>
              {item.name}
              {item.is_featured && <FeaturedMark color={pSecondary} />}
            </span>
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
            <span className="inline-flex items-center gap-1.5 font-bold text-sm leading-tight" style={{ color: pPrimary }}>
              {item.name}
              {item.is_featured && <FeaturedMark color={pSecondary} />}
            </span>
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
            <span className="inline-flex items-center gap-1.5 font-bold text-base leading-tight" style={{ color: pPrimary }}>
              {item.name}
              {item.is_featured && <FeaturedMark color={pSecondary} />}
            </span>
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

function CompactItem({ item, palette, showPrices, showDescriptions }: { item: MenuItem; palette: Record<string, string>; showPrices: boolean; showDescriptions: boolean }) {
  const pPrimary = palette.primary || '#1f2937';
  const pSecondary = palette.secondary || '#dc2626';
  return (
    <Reveal className="flex items-start justify-between py-2.5 gap-4">
      <div className="min-w-0">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: pPrimary }}>
          {item.name}
          {item.is_featured && <FeaturedMark color={pSecondary} />}
        </span>
        {showDescriptions && item.description && (
          <p className="mt-0.5 text-xs leading-snug opacity-55" style={{ color: pPrimary }}>{item.description}</p>
        )}
      </div>
      {showPrices && item.price && (
        <span className="font-bold text-sm shrink-0" style={{ color: pSecondary }}>{item.price}</span>
      )}
    </Reveal>
  );
}

function FeaturedMark({ color }: { color: string }) {
  return <Star className="w-3.5 h-3.5 shrink-0" style={{ color, fill: color }} aria-label="Featured" />;
}

// ─── Menu Manager (admin panel component) ─────────────────────────────────────

interface ItemForm {
  menu_section: string;
  name: string;
  description: string;
  price: string;
  category: string;
  image_url: string;
  is_available: boolean;
  is_featured: boolean;
}

const EMPTY_FORM: ItemForm = {
  menu_section: DEFAULT_MENU_SECTION,
  name: '',
  description: '',
  price: '',
  category: 'General',
  image_url: '',
  is_available: true,
  is_featured: false,
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
  const [collapsedMenus, setCollapsedMenus] = useState<Set<string>>(new Set());
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  const pSecondary = palette.secondary || '#dc2626';

  // Derived: known categories
  const knownCategories = Array.from(new Set(items.map(i => i.category).filter(Boolean)));
  const knownMenuSections = Array.from(new Set(items.map(i => getMenuSection(i)).filter(Boolean)));

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

  async function handleToggleFeatured(item: MenuItem) {
    const res = await fetch('/api/menu', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, siteId, is_featured: !item.is_featured }),
    });
    if (res.ok) {
      const data = await res.json();
      setItems(prev => prev.map(i => i.id === item.id ? data.item : i));
    }
  }

  function toggleMenuCollapsed(section: string) {
    setCollapsedMenus(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }

  function toggleCategoryCollapsed(section: string, category: string) {
    const key = getCategoryKey(section, category);
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function persistMenuSectionOrder(reorderedSections: string[]) {
    const orderBySection = new Map(reorderedSections.map((name, index) => [name, index]));
    const affectedItems = items.filter(item => orderBySection.has(getMenuSection(item)));

    setItems(prev => prev.map(item => {
      const order = orderBySection.get(getMenuSection(item));
      return order === undefined ? item : { ...item, menu_section_order: order };
    }));

    const responses = await Promise.all(affectedItems.map(item => {
      const order = orderBySection.get(getMenuSection(item));
      return fetch('/api/menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, siteId, menu_section_order: order }),
      });
    }));

    if (responses.some(res => !res.ok)) {
      setError('Failed to reorder menus.');
      await fetchItems();
    }
  }

  async function handleMoveMenuSection(section: string, direction: -1 | 1) {
    const currentIndex = menuSections.indexOf(section);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= menuSections.length) return;

    const reorderedSections = [...menuSections];
    [reorderedSections[currentIndex], reorderedSections[targetIndex]] = [reorderedSections[targetIndex], reorderedSections[currentIndex]];
    await persistMenuSectionOrder(reorderedSections);
  }

  async function handleDropMenuSection(sourceSection: string, targetSection: string) {
    if (!sourceSection || sourceSection === targetSection) return;
    const sourceIndex = menuSections.indexOf(sourceSection);
    const targetIndex = menuSections.indexOf(targetSection);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const reorderedSections = [...menuSections];
    const [moved] = reorderedSections.splice(sourceIndex, 1);
    reorderedSections.splice(targetIndex, 0, moved);
    await persistMenuSectionOrder(reorderedSections);
  }

  async function persistCategoryOrder(section: string, reorderedCategories: string[]) {
    const orderByCategory = new Map(reorderedCategories.map((name, index) => [name, index]));
    const affectedItems = items.filter(item => getMenuSection(item) === section && orderByCategory.has(item.category));

    setItems(prev => prev.map(item => {
      if (getMenuSection(item) !== section) return item;
      const order = orderByCategory.get(item.category);
      return order === undefined ? item : { ...item, category_order: order };
    }));

    const responses = await Promise.all(affectedItems.map(item => {
      const order = orderByCategory.get(item.category);
      return fetch('/api/menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, siteId, category_order: order }),
      });
    }));

    if (responses.some(res => !res.ok)) {
      setError('Failed to reorder categories.');
      await fetchItems();
    }
  }

  async function handleMoveMenuCategory(section: string, category: string, direction: -1 | 1) {
    const sectionGrouped = groupByCategory(groupedByMenu[section] || []);
    const orderedCategories = getOrderedCategories(sectionGrouped);
    const currentIndex = orderedCategories.indexOf(category);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= orderedCategories.length) return;

    const reorderedCategories = [...orderedCategories];
    [reorderedCategories[currentIndex], reorderedCategories[targetIndex]] = [reorderedCategories[targetIndex], reorderedCategories[currentIndex]];
    await persistCategoryOrder(section, reorderedCategories);
  }

  async function handleDropMenuCategory(section: string, sourceCategory: string, targetCategory: string) {
    if (!sourceCategory || sourceCategory === targetCategory) return;
    const sectionGrouped = groupByCategory(groupedByMenu[section] || []);
    const orderedCategories = getOrderedCategories(sectionGrouped);
    const sourceIndex = orderedCategories.indexOf(sourceCategory);
    const targetIndex = orderedCategories.indexOf(targetCategory);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const reorderedCategories = [...orderedCategories];
    const [moved] = reorderedCategories.splice(sourceIndex, 1);
    reorderedCategories.splice(targetIndex, 0, moved);
    await persistCategoryOrder(section, reorderedCategories);
  }

  async function persistMenuItemOrder(reorderedItems: MenuItem[]) {
    const orderById = new Map(reorderedItems.map((menuItem, index) => [menuItem.id, index]));

    setItems(prev => prev.map(menuItem => {
      const order = orderById.get(menuItem.id);
      return order === undefined ? menuItem : { ...menuItem, sort_order: order };
    }));

    const responses = await Promise.all(reorderedItems.map((menuItem, index) => (
      fetch('/api/menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: menuItem.id, siteId, sort_order: index }),
      })
    )));

    if (responses.some(res => !res.ok)) {
      setError('Failed to reorder menu items.');
      await fetchItems();
    }
  }

  async function persistMenuItemPlacement(
    sourceItemId: string,
    targetSection: string,
    targetCategory: string,
    targetIndex: number,
  ) {
    const movedItem = items.find(item => item.id === sourceItemId);
    if (!movedItem) return;

    const sourceSection = getMenuSection(movedItem);
    const sourceCategory = movedItem.category;
    const sameGroup = sourceSection === targetSection && sourceCategory === targetCategory;
    const targetSectionItems = groupedByMenu[targetSection] || [];
    const targetSectionGrouped = groupByCategory(targetSectionItems);
    const targetCategoryItems = sortMenuItems(
      items.filter(item => getMenuSection(item) === targetSection && item.category === targetCategory && item.id !== sourceItemId),
    );
    const clampedIndex = Math.max(0, Math.min(targetIndex, targetCategoryItems.length));
    const menuSectionOrder = getMenuSectionOrder(targetSection, targetSectionItems);
    const categoryOrder = getCategoryOrder(targetCategory, targetSectionGrouped[targetCategory] || []);
    const movedItemUpdate: MenuItem = {
      ...movedItem,
      menu_section: targetSection,
      menu_section_order: menuSectionOrder,
      category: targetCategory,
      category_order: categoryOrder,
    };

    const targetReordered = [...targetCategoryItems];
    targetReordered.splice(clampedIndex, 0, movedItemUpdate);
    const sourceReordered = sameGroup
      ? []
      : sortMenuItems(items.filter(item => getMenuSection(item) === sourceSection && item.category === sourceCategory && item.id !== sourceItemId));

    const updateById = new Map<string, Partial<MenuItem>>();
    targetReordered.forEach((item, index) => {
      updateById.set(item.id, {
        menu_section: targetSection,
        menu_section_order: menuSectionOrder,
        category: targetCategory,
        category_order: categoryOrder,
        sort_order: index,
      });
    });
    sourceReordered.forEach((item, index) => {
      updateById.set(item.id, { sort_order: index });
    });

    setItems(prev => prev.map(item => {
      const update = updateById.get(item.id);
      return update ? { ...item, ...update } : item;
    }));

    const responses = await Promise.all(Array.from(updateById.entries()).map(([id, update]) => (
      fetch('/api/menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, siteId, ...update }),
      })
    )));

    if (responses.some(res => !res.ok)) {
      setError('Failed to move menu item.');
      await fetchItems();
    }
  }

  async function handleMoveMenuItem(item: MenuItem, direction: -1 | 1) {
    const section = getMenuSection(item);
    const groupItems = sortMenuItems(items.filter(i => getMenuSection(i) === section && i.category === item.category));
    const currentIndex = groupItems.findIndex(i => i.id === item.id);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= groupItems.length) return;

    const reorderedItems = [...groupItems];
    [reorderedItems[currentIndex], reorderedItems[targetIndex]] = [reorderedItems[targetIndex], reorderedItems[currentIndex]];
    await persistMenuItemOrder(reorderedItems);
  }

  async function handleDropMenuItem(sourceItemId: string, targetItem: MenuItem) {
    if (!sourceItemId || sourceItemId === targetItem.id) return;
    const section = getMenuSection(targetItem);
    const groupItems = sortMenuItems(items.filter(i => getMenuSection(i) === section && i.category === targetItem.category));
    const targetIndex = groupItems.findIndex(i => i.id === targetItem.id);
    if (targetIndex < 0) return;

    await persistMenuItemPlacement(sourceItemId, section, targetItem.category, targetIndex);
  }

  async function handleDropMenuItemIntoCategory(sourceItemId: string, targetSection: string, targetCategory: string) {
    if (!sourceItemId) return;
    const targetCount = items.filter(item => getMenuSection(item) === targetSection && item.category === targetCategory && item.id !== sourceItemId).length;
    await persistMenuItemPlacement(sourceItemId, targetSection, targetCategory, targetCount);
  }

  async function handleDropMenuItemIntoSection(sourceItemId: string, targetSection: string) {
    if (!sourceItemId) return;
    const sectionGrouped = groupByCategory(groupedByMenu[targetSection] || []);
    const targetCategory = getOrderedCategories(sectionGrouped)[0] || 'General';
    await handleDropMenuItemIntoCategory(sourceItemId, targetSection, targetCategory);
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
      menu_section: getMenuSection(item),
      name: item.name,
      description: item.description || '',
      price: item.price || '',
      category: item.category,
      image_url: item.image_url || '',
      is_available: item.is_available,
      is_featured: item.is_featured === true,
    });
    setError('');
  }

  const groupedByMenu = groupByMenuSection(items);
  const menuSections = getOrderedMenuSections(groupedByMenu);

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
        <p className="text-sm text-slate-500">{items.length} item{items.length !== 1 ? 's' : ''} across {menuSections.length} menu{menuSections.length !== 1 ? 's' : ''}</p>
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
              knownMenuSections={knownMenuSections}
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
          {menuSections.map((section, sectionIndex) => {
            const sectionGrouped = groupByCategory(groupedByMenu[section]);
            const orderedCategories = getOrderedCategories(sectionGrouped);
            const isMenuCollapsed = collapsedMenus.has(section);
            const menuDragKey = `menu:${section}`;
            return (
              <div
                key={section}
                onDragOver={e => { e.preventDefault(); setDragOverTarget(menuDragKey); }}
                onDragLeave={() => setDragOverTarget(current => current === menuDragKey ? null : current)}
                onDrop={e => {
                  e.preventDefault();
                  setDragOverTarget(null);
                  const itemId = e.dataTransfer.getData(ITEM_DRAG_TYPE);
                  if (itemId) {
                    handleDropMenuItemIntoSection(itemId, section);
                    return;
                  }
                  handleDropMenuSection(e.dataTransfer.getData(MENU_DRAG_TYPE), section);
                }}
                className={`bg-white rounded-xl border overflow-hidden shadow-sm transition-all ${
                  dragOverTarget === menuDragKey ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200'
                }`}
              >
                <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleMenuCollapsed(section)}
                      title={isMenuCollapsed ? 'Expand menu' : 'Collapse menu'}
                      className="rounded-md p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      {isMenuCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      draggable
                      onDragStart={e => {
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData(MENU_DRAG_TYPE, section);
                      }}
                      onDragEnd={() => setDragOverTarget(null)}
                      title="Drag menu to reorder"
                      className="cursor-grab rounded-md p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white active:cursor-grabbing"
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                    <span className="truncate text-sm font-bold">{section}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/60">{groupedByMenu[section].length} item{groupedByMenu[section].length !== 1 ? 's' : ''}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveMenuSection(section, -1)}
                        disabled={sectionIndex === 0}
                        title="Move menu up"
                        className="rounded-md p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveMenuSection(section, 1)}
                        disabled={sectionIndex === menuSections.length - 1}
                        title="Move menu down"
                        className="rounded-md p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
                {!isMenuCollapsed && orderedCategories.map((cat, categoryIndex) => {
                  const catItems = sectionGrouped[cat];
                  const orderedCatItems = sortMenuItems(catItems);
                  const categoryKey = getCategoryKey(section, cat);
                  const categoryDragKey = `category:${categoryKey}`;
                  const isCategoryCollapsed = collapsedCategories.has(categoryKey);
                  return (
                  <div
                    key={`${section}-${cat}`}
                    onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragOverTarget(categoryDragKey); }}
                    onDragLeave={e => { e.stopPropagation(); setDragOverTarget(current => current === categoryDragKey ? null : current); }}
                    onDrop={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverTarget(null);
                      const itemId = e.dataTransfer.getData(ITEM_DRAG_TYPE);
                      if (itemId) {
                        handleDropMenuItemIntoCategory(itemId, section, cat);
                        return;
                      }
                      handleDropMenuCategory(section, e.dataTransfer.getData(CATEGORY_DRAG_TYPE), cat);
                    }}
                    className={dragOverTarget === categoryDragKey ? 'ring-2 ring-blue-100' : ''}
                  >
                    <div className="px-4 py-2.5 bg-slate-50 border-y border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          type="button"
                          onClick={() => toggleCategoryCollapsed(section, cat)}
                          title={isCategoryCollapsed ? 'Expand category' : 'Collapse category'}
                          className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        >
                          {isCategoryCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          type="button"
                          draggable
                          onDragStart={e => {
                            e.stopPropagation();
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData(CATEGORY_DRAG_TYPE, cat);
                          }}
                          onDragEnd={() => setDragOverTarget(null)}
                          title="Drag category to reorder"
                          className="cursor-grab rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing"
                        >
                          <GripVertical className="h-3.5 w-3.5" />
                        </button>
                        <span className="truncate text-xs font-bold text-slate-700 uppercase tracking-wide">{cat}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">{catItems.length} item{catItems.length !== 1 ? 's' : ''}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleMoveMenuCategory(section, cat, -1)}
                            disabled={categoryIndex === 0}
                            title="Move category up"
                            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveMenuCategory(section, cat, 1)}
                            disabled={categoryIndex === orderedCategories.length - 1}
                            title="Move category down"
                            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                    {!isCategoryCollapsed && <div className="divide-y divide-slate-100">
                      {orderedCatItems.map((item, itemIndex) => (
                        <div
                          key={item.id}
                          onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragOverTarget(`item:${item.id}`); }}
                          onDragLeave={e => { e.stopPropagation(); setDragOverTarget(current => current === `item:${item.id}` ? null : current); }}
                          onDrop={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDragOverTarget(null);
                            handleDropMenuItem(e.dataTransfer.getData(ITEM_DRAG_TYPE), item);
                          }}
                          className={dragOverTarget === `item:${item.id}` ? 'bg-blue-50/60' : ''}
                        >
                    {editingId === item.id ? (
                      <div className="p-4 bg-blue-50/50">
                        <ItemFormFields
                          form={editForm}
                          onChange={setEditForm}
                          knownMenuSections={knownMenuSections}
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
                        <button
                          type="button"
                          draggable
                          onDragStart={e => {
                            e.stopPropagation();
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData(ITEM_DRAG_TYPE, item.id);
                          }}
                          onDragEnd={() => setDragOverTarget(null)}
                          title="Drag item to reorder"
                          className="shrink-0 cursor-grab rounded-md p-1 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing"
                        >
                          <GripVertical className="h-4 w-4" />
                        </button>
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
                            {item.is_featured && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600">
                                <Star className="w-3 h-3 fill-current" />
                                Featured
                              </span>
                            )}
                            {item.price && <span className="text-xs font-bold" style={{ color: pSecondary }}>{item.price}</span>}
                          </div>
                          {item.description && (
                            <p className="text-xs text-slate-400 truncate">{item.description}</p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={() => handleMoveMenuItem(item, -1)}
                            disabled={itemIndex === 0}
                            title="Move item up"
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleMoveMenuItem(item, 1)}
                            disabled={itemIndex === orderedCatItems.length - 1}
                            title="Move item down"
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleFeatured(item)}
                            title={item.is_featured ? 'Remove featured' : 'Mark featured'}
                            className={`p-1.5 rounded-lg transition-colors ${
                              item.is_featured
                                ? 'text-amber-500 bg-amber-50 hover:bg-amber-100'
                                : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50'
                            }`}
                          >
                            <Star className={`w-3.5 h-3.5 ${item.is_featured ? 'fill-current' : ''}`} />
                          </button>
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
                    </div>}
                  </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Item Form Fields ─────────────────────────────────────────────────────────

function ItemFormFields({
  form,
  onChange,
  knownMenuSections,
  knownCategories,
  onImageUpload,
  imageUploading,
}: {
  form: ItemForm;
  onChange: (f: ItemForm) => void;
  knownMenuSections: string[];
  knownCategories: string[];
  onImageUpload: (f: File) => void;
  imageUploading: boolean;
}) {
  const [showMenuSuggestions, setShowMenuSuggestions] = useState(false);
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const [menuIsFiltering, setMenuIsFiltering] = useState(false);
  const [categoryIsFiltering, setCategoryIsFiltering] = useState(false);
  const menuSearch = form.menu_section.trim().toLowerCase();
  const categorySearch = form.category.trim().toLowerCase();
  const menuSuggestions = knownMenuSections.filter(section => (
    section !== form.menu_section &&
    (!menuIsFiltering || !menuSearch || section.toLowerCase().includes(menuSearch))
  ));
  const suggestions = knownCategories.filter(c => (
    c !== form.category &&
    (!categoryIsFiltering || !categorySearch || c.toLowerCase().includes(categorySearch))
  ));

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

      {/* Menu section */}
      <div className="relative">
        <label className="text-xs font-semibold text-slate-600 block mb-1">Menu</label>
        <input
          type="text"
          value={form.menu_section}
          onChange={e => { onChange({ ...form, menu_section: e.target.value }); setMenuIsFiltering(true); setShowMenuSuggestions(true); }}
          onClick={() => { setMenuIsFiltering(false); setShowMenuSuggestions(true); }}
          onFocus={() => { setMenuIsFiltering(false); setShowMenuSuggestions(true); }}
          onBlur={() => setTimeout(() => { setShowMenuSuggestions(false); setMenuIsFiltering(false); }, 150)}
          placeholder="e.g. Breakfast, Lunch, Dinner"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <ChevronDown className="pointer-events-none absolute right-3 top-8 h-4 w-4 text-slate-400" />
        {showMenuSuggestions && menuSuggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-auto bg-white border border-slate-200 rounded-lg shadow-lg z-10">
            {menuSuggestions.map(section => (
              <button
                key={section}
                onMouseDown={() => { onChange({ ...form, menu_section: section }); setMenuIsFiltering(false); setShowMenuSuggestions(false); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 text-slate-700"
              >
                {section}
              </button>
            ))}
          </div>
        )}
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
          onChange={e => { onChange({ ...form, category: e.target.value }); setCategoryIsFiltering(true); setShowCategorySuggestions(true); }}
          onClick={() => { setCategoryIsFiltering(false); setShowCategorySuggestions(true); }}
          onFocus={() => { setCategoryIsFiltering(false); setShowCategorySuggestions(true); }}
          onBlur={() => setTimeout(() => { setShowCategorySuggestions(false); setCategoryIsFiltering(false); }, 150)}
          placeholder="e.g. Appetizers"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <ChevronDown className="pointer-events-none absolute right-3 top-8 h-4 w-4 text-slate-400" />
        {showCategorySuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-auto bg-white border border-slate-200 rounded-lg shadow-lg z-10">
            {suggestions.map(s => (
              <button
                key={s}
                onMouseDown={() => { onChange({ ...form, category: s }); setCategoryIsFiltering(false); setShowCategorySuggestions(false); }}
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
      <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <button
            type="button"
            onClick={() => onChange({ ...form, is_available: !form.is_available })}
            className={`relative w-10 h-5 rounded-full transition-colors ${form.is_available ? 'bg-green-400' : 'bg-slate-200'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_available ? 'left-5.5 translate-x-0.5' : 'left-0.5'}`} />
          </button>
          <span className="text-sm text-slate-600">{form.is_available ? 'Available' : 'Unavailable (hidden on site)'}</span>
        </label>
        <button
          type="button"
          onClick={() => onChange({ ...form, is_featured: !form.is_featured })}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
            form.is_featured
              ? 'border-amber-200 bg-amber-50 text-amber-600'
              : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Star className={`w-4 h-4 ${form.is_featured ? 'fill-current' : ''}`} />
          Featured item
        </button>
      </div>
    </div>
  );
}
