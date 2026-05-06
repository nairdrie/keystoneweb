'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useEditorContext } from '@/lib/editor-context';
import EditableText from '../EditableText';
import Reveal from '@/app/components/Reveal';
import { resolvePaletteColor } from '@/lib/palette-colors';
import UnsplashAttributionCaption from '../UnsplashAttributionCaption';
import type { UnsplashAttribution } from '@/lib/unsplash/types';
import {
  Plus, Trash2, Pencil, Check, X, Upload, Loader2,
  UtensilsCrossed, ExternalLink, Image as ImageIcon,
  FileText, List, Star, ChevronUp, ChevronDown, ChevronRight, GripVertical,
  Flame, Leaf, Vegan, WheatOff, Sprout, Salad, Sandwich, Soup, Pizza,
  Milk, Nut, Fish, Egg, Heart, Coffee, Circle,
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
  image_attribution?: UnsplashAttribution | null;
  is_available: boolean;
  is_featured: boolean;
  icon_tags?: string[] | null;
  sort_order: number;
}

interface MenuSectionRecord {
  id?: string;
  name: string;
  sort_order: number | null;
}

interface MenuIconOption {
  id: string;
  label: string;
  icon: string;
  sort_order?: number | null;
  isDefault?: boolean;
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
type ItemDetailImageFit = 'contain' | 'cover' | 'center' | 'stretch';
type ItemDetailPhotoVisibility = 'always' | 'menu';
type MenuIconLegendMode = 'all' | 'used' | 'custom';
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
const DEFAULT_MENU_ICON_OPTIONS: MenuIconOption[] = [
  { id: 'gluten_free', label: 'Gluten-free', icon: 'wheat-off', sort_order: 0, isDefault: true },
  { id: 'vegetarian', label: 'Vegetarian', icon: 'leaf', sort_order: 1, isDefault: true },
  { id: 'vegan', label: 'Vegan', icon: 'vegan', sort_order: 2, isDefault: true },
  { id: 'spicy', label: 'Spicy', icon: 'flame', sort_order: 3, isDefault: true },
];
const MENU_ICON_PICKER_OPTIONS = [
  { id: 'wheat-off', label: 'Wheat off' },
  { id: 'leaf', label: 'Leaf' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'flame', label: 'Flame' },
  { id: 'sprout', label: 'Sprout' },
  { id: 'salad', label: 'Salad' },
  { id: 'sandwich', label: 'Sandwich' },
  { id: 'soup', label: 'Soup' },
  { id: 'pizza', label: 'Pizza' },
  { id: 'milk', label: 'Milk' },
  { id: 'nut', label: 'Nut' },
  { id: 'fish', label: 'Fish' },
  { id: 'egg', label: 'Egg' },
  { id: 'star', label: 'Star' },
  { id: 'heart', label: 'Heart' },
  { id: 'coffee', label: 'Coffee' },
  { id: 'circle', label: 'Circle' },
];
const MENU_ICON_COMPONENTS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  'wheat-off': WheatOff,
  leaf: Leaf,
  vegan: Vegan,
  flame: Flame,
  sprout: Sprout,
  salad: Salad,
  sandwich: Sandwich,
  soup: Soup,
  pizza: Pizza,
  milk: Milk,
  nut: Nut,
  fish: Fish,
  egg: Egg,
  star: Star,
  heart: Heart,
  coffee: Coffee,
  circle: Circle,
};

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

function getOrderedCombinedMenuSections(groupedByMenu: Record<string, MenuItem[]>, sectionRecords: MenuSectionRecord[]): string[] {
  const orderBySection = new Map<string, number>();

  sectionRecords.forEach((section, index) => {
    const name = section.name.trim();
    if (!name) return;
    orderBySection.set(name, typeof section.sort_order === 'number' ? section.sort_order : index);
  });

  Object.entries(groupedByMenu).forEach(([section, sectionItems]) => {
    if (!orderBySection.has(section)) {
      orderBySection.set(section, getMenuSectionOrder(section, sectionItems));
    }
  });

  return Array.from(orderBySection.keys()).sort((a, b) => {
    const orderDiff = (orderBySection.get(a) ?? Number.MAX_SAFE_INTEGER) - (orderBySection.get(b) ?? Number.MAX_SAFE_INTEGER);
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

function normalizeMenuIconTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value
      .filter((tag): tag is string => typeof tag === 'string')
      .map(tag => tag.trim())
      .filter(Boolean),
  ));
}

function getCombinedMenuIconOptions(customOptions: MenuIconOption[]): MenuIconOption[] {
  const seen = new Set<string>();
  return [...DEFAULT_MENU_ICON_OPTIONS, ...customOptions]
    .filter(option => {
      if (!option.id || seen.has(option.id)) return false;
      seen.add(option.id);
      return true;
    })
    .sort((a, b) => {
      const orderDiff = (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER);
      if (orderDiff !== 0) return orderDiff;
      return a.label.localeCompare(b.label);
    });
}

function getMenuItemIconOptions(item: MenuItem, iconOptions: MenuIconOption[]): MenuIconOption[] {
  const selectedTags = normalizeMenuIconTags(item.icon_tags);
  if (selectedTags.length === 0) return [];

  const optionById = new Map(iconOptions.map(option => [option.id, option]));
  return selectedTags
    .map(tag => optionById.get(tag))
    .filter((option): option is MenuIconOption => !!option);
}

function getLegendMenuIconOptions(
  items: MenuItem[],
  iconOptions: MenuIconOption[],
  mode: MenuIconLegendMode,
  selectedIds: string[],
): MenuIconOption[] {
  if (mode === 'custom') {
    const selected = new Set(selectedIds);
    return iconOptions.filter(option => selected.has(option.id));
  }

  if (mode === 'used') {
    const usedTags = new Set(items.flatMap(item => normalizeMenuIconTags(item.icon_tags)));
    return iconOptions.filter(option => usedTags.has(option.id));
  }

  return iconOptions;
}

// ─── Main Block ───────────────────────────────────────────────────────────────

export default function MenuBlock({ id, data, isEditMode, palette, updateContent }: MenuBlockProps) {
  const router = useRouter();
  const context = useEditorContext();
  const siteId = context?.siteId;
  const requestNavigation = context?.requestNavigation;

  const [items, setItems] = useState<MenuItem[]>([]);
  const [menuIconOptions, setMenuIconOptions] = useState<MenuIconOption[]>([]);
  const [activeMenu, setActiveMenu] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<MenuItem | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const mode: 'items' | 'pdf' = data.mode || 'items';
  const variant: MenuVariant = data.variant || 'list';
  const showPrices: boolean = data.showPrices !== false;
  const showDescriptions: boolean = data.showDescriptions !== false;
  const showRegularImages: boolean = data.showImages === true;
  const showFeaturedImages: boolean = data.showFeaturedImages !== false;
  const showMenuTabs: boolean = data.showMenuTabs !== false;
  const showMenuIcons: boolean = data.showMenuIcons !== false;
  const showMenuIconLegend: boolean = data.showMenuIconLegend === true;
  const menuIconLegendPosition: 'top' | 'bottom' = data.menuIconLegendPosition === 'top' ? 'top' : 'bottom';
  const menuIconLegendMode: MenuIconLegendMode = data.menuIconLegendMode === 'used' || data.menuIconLegendMode === 'custom'
    ? data.menuIconLegendMode
    : 'all';
  const menuIconLegendIds = normalizeMenuIconTags(data.menuIconLegendIds);
  const categoryStyle: CategoryStyle = data.categoryStyle || 'heading';
  const itemDetailEnabled: boolean = data.itemDetailEnabled === true;
  const itemDetailShowPhoto: boolean = data.itemDetailShowPhoto !== false;
  const itemDetailPhotoVisibility: ItemDetailPhotoVisibility = data.itemDetailPhotoVisibility === 'menu' ? 'menu' : 'always';
  const itemDetailShowName: boolean = data.itemDetailShowName !== false;
  const itemDetailShowDescription: boolean = data.itemDetailShowDescription !== false;
  const itemDetailShowPrice: boolean = data.itemDetailShowPrice !== false;
  const itemDetailShowCategory: boolean = data.itemDetailShowCategory === true;
  const itemDetailShowIcons: boolean = data.itemDetailShowIcons === true;
  const itemDetailImageFit: ItemDetailImageFit = ['contain', 'cover', 'center', 'stretch'].includes(data.itemDetailImageFit)
    ? data.itemDetailImageFit
    : 'contain';
  const itemDetailCaptionBg = resolvePaletteColor(data.itemDetailCaptionBg, palette, '#0f172a');
  const itemDetailTextColor = resolvePaletteColor(data.itemDetailTextColor, palette, '#ffffff');
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
      icon_tags: normalizeMenuIconTags(item.icon_tags),
      sort_order: item.sort_order ?? index,
    }))
    : [];

  useEffect(() => {
    if (!siteId) { setLoading(false); return; }
    fetch(`/api/menu?siteId=${siteId}`)
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => {
        setItems(d.items || []);
        setMenuIconOptions(Array.isArray(d.iconOptions) ? d.iconOptions : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [siteId]);

  useEffect(() => {
    if (!itemDetailEnabled) setSelectedDetailItem(null);
  }, [itemDetailEnabled]);

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
  if (mode === 'items') {
    const publishedItems = items.filter(i => i.is_available);
    const displayItems = publishedItems.length > 0 ? publishedItems : fallbackItems;
    const groupedByMenu = groupByMenuSection(displayItems);
    const menuSections = getOrderedMenuSections(groupedByMenu);
    const previewMenu = isEditMode && typeof data.__previewMenuSection === 'string' ? data.__previewMenuSection : '';
    const selectedMenu = previewMenu && menuSections.includes(previewMenu)
      ? previewMenu
      : menuSections.includes(activeMenu)
        ? activeMenu
        : (menuSections[0] || DEFAULT_MENU_SECTION);
    const shouldFilterByMenu = !!previewMenu || (showMenuTabs && menuSections.length > 1);
    const sectionItems = shouldFilterByMenu ? (groupedByMenu[selectedMenu] || []) : displayItems;
    const grouped = groupByCategory(sectionItems);
    const categories = getOrderedCategories(grouped);
    const shouldShowImage = (item: MenuItem) => item.is_featured ? showFeaturedImages : showRegularImages;
    const shouldShowDetailPhoto = (item: MenuItem) => (
      itemDetailShowPhoto &&
      (
        itemDetailPhotoVisibility === 'always' ||
        (Boolean(item.image_url) && variant !== 'compact' && shouldShowImage(item))
      )
    );
    const handleSelectDetailItem = itemDetailEnabled ? (item: MenuItem) => setSelectedDetailItem(item) : undefined;
    const combinedMenuIconOptions = getCombinedMenuIconOptions(menuIconOptions);
    const legendIconOptions = showMenuIcons && showMenuIconLegend
      ? getLegendMenuIconOptions(sectionItems, combinedMenuIconOptions, menuIconLegendMode, menuIconLegendIds)
      : [];

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
          {(data.menuTitle || data.menuSubtitle || isEditMode) && (
            <div className="text-center mb-14">
              {(data.menuTitle || isEditMode) && (
                <Reveal>
                  {isEditMode ? (
                    <EditableText
                      as="h2"
                      contentKey="menuTitle"
                      content={data.menuTitle}
                      defaultValue="Our Menu"
                      isEditMode={isEditMode}
                      onSave={(key, val) => updateContent(key, val)}
                      className="text-4xl font-bold mb-3"
                      style={{ color: pPrimary }}
                    />
                  ) : (
                    <h2 className="text-4xl font-bold mb-3" style={{ color: pPrimary }}>{data.menuTitle}</h2>
                  )}
                </Reveal>
              )}
              {(data.menuSubtitle || isEditMode) && (
                <Reveal>
                  {isEditMode ? (
                    <EditableText
                      as="p"
                      contentKey="menuSubtitle"
                      content={data.menuSubtitle}
                      defaultValue=""
                      isEditMode={isEditMode}
                      onSave={(key, val) => updateContent(key, val)}
                      className="text-lg opacity-70"
                      style={{ color: pPrimary }}
                    />
                  ) : (
                    <p className="text-lg opacity-70" style={{ color: pPrimary }}>{data.menuSubtitle}</p>
                  )}
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
              {legendIconOptions.length > 0 && menuIconLegendPosition === 'top' && (
                <MenuIconLegend iconOptions={legendIconOptions} palette={palette} />
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
                        <GridItem key={item.id} item={item} palette={palette} iconOptions={showMenuIcons ? combinedMenuIconOptions : []} showPrices={showPrices} showDescriptions={showDescriptions} showImages={shouldShowImage(item)} onSelect={handleSelectDetailItem} />
                      ))}
                    </div>
                  ) : variant === 'cards' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-5">
                      {sortMenuItems(grouped[cat]).map(item => (
                        <CardItem key={item.id} item={item} palette={palette} iconOptions={showMenuIcons ? combinedMenuIconOptions : []} showPrices={showPrices} showDescriptions={showDescriptions} showImages={shouldShowImage(item)} onSelect={handleSelectDetailItem} />
                      ))}
                    </div>
                  ) : variant === 'compact' ? (
                    <div className="mt-3 divide-y divide-slate-100/80">
                      {sortMenuItems(grouped[cat]).map(item => (
                        <CompactItem key={item.id} item={item} palette={palette} iconOptions={showMenuIcons ? combinedMenuIconOptions : []} showPrices={showPrices} showDescriptions={showDescriptions} onSelect={handleSelectDetailItem} />
                      ))}
                    </div>
                  ) : (
                    // Default: list
                    <div className="mt-4 space-y-0">
                      {sortMenuItems(grouped[cat]).map(item => (
                        <ListItem key={item.id} item={item} palette={palette} iconOptions={showMenuIcons ? combinedMenuIconOptions : []} showPrices={showPrices} showDescriptions={showDescriptions} showImages={shouldShowImage(item)} onSelect={handleSelectDetailItem} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
              </div>
              {legendIconOptions.length > 0 && menuIconLegendPosition === 'bottom' && (
                <MenuIconLegend iconOptions={legendIconOptions} palette={palette} />
              )}
            </>
          )}
        </div>
        {itemDetailEnabled && selectedDetailItem && (
          <MenuItemDetailViewer
            item={selectedDetailItem}
            palette={palette}
            onClose={() => setSelectedDetailItem(null)}
            showPhoto={shouldShowDetailPhoto(selectedDetailItem)}
            showName={itemDetailShowName}
            showDescription={itemDetailShowDescription}
            showPrice={itemDetailShowPrice}
            showCategory={itemDetailShowCategory}
            showIcons={itemDetailShowIcons}
            iconOptions={combinedMenuIconOptions}
            imageFit={itemDetailImageFit}
            captionBg={itemDetailCaptionBg}
            textColor={itemDetailTextColor}
          />
        )}
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
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full transition-all ${data.mode === 'items' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'}`}
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

function MenuItemFrame({
  item,
  onSelect,
  className,
  style,
  children,
}: {
  item: MenuItem;
  onSelect?: (item: MenuItem) => void;
  className: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  if (!onSelect) {
    return <div className={className} style={style}>{children}</div>;
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelect(item);
      }}
      className={`${className} cursor-zoom-in appearance-none bg-transparent text-left transition-colors hover:bg-slate-900/[0.03] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
      style={style}
      aria-label={`View details for ${item.name}`}
    >
      {children}
    </button>
  );
}

function MenuIconGlyph({ icon, className }: { icon: string; className?: string }) {
  const Icon = MENU_ICON_COMPONENTS[icon] || Circle;
  return <Icon className={className || 'h-3.5 w-3.5'} aria-hidden="true" />;
}

function MenuItemIconBadges({ item, iconOptions, palette }: { item: MenuItem; iconOptions: MenuIconOption[]; palette: Record<string, string> }) {
  const pSecondary = palette.secondary || '#dc2626';
  const itemIconOptions = getMenuItemIconOptions(item, iconOptions);
  if (itemIconOptions.length === 0) return null;

  return (
    <span className="inline-flex flex-wrap items-center gap-1 align-middle">
      {itemIconOptions.map(option => (
        <span
          key={option.id}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border bg-white text-[10px]"
          style={{ borderColor: `${pSecondary}30`, color: pSecondary }}
          title={option.label}
          aria-label={option.label}
        >
          <MenuIconGlyph icon={option.icon} className="h-3 w-3" />
        </span>
      ))}
    </span>
  );
}

function MenuIconLegend({ iconOptions, palette }: { iconOptions: MenuIconOption[]; palette: Record<string, string> }) {
  const pPrimary = palette.primary || '#1f2937';
  const pSecondary = palette.secondary || '#dc2626';

  return (
    <Reveal>
      <div className="my-8 rounded-xl border bg-white/70 px-4 py-3" style={{ borderColor: `${pPrimary}12` }}>
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm" style={{ color: pPrimary }}>
          {iconOptions.map(option => (
            <span key={option.id} className="inline-flex items-center gap-2">
              <span
                className="inline-flex h-6 w-6 items-center justify-center rounded-full border bg-white"
                style={{ borderColor: `${pSecondary}30`, color: pSecondary }}
              >
                <MenuIconGlyph icon={option.icon} className="h-3.5 w-3.5" />
              </span>
              <span className="font-medium opacity-80">{option.label}</span>
            </span>
          ))}
        </div>
      </div>
    </Reveal>
  );
}

function ListItem({ item, palette, iconOptions, showPrices, showDescriptions, showImages, onSelect }: { item: MenuItem; palette: Record<string, string>; iconOptions: MenuIconOption[]; showPrices: boolean; showDescriptions: boolean; showImages: boolean; onSelect?: (item: MenuItem) => void }) {
  const pPrimary = palette.primary || '#1f2937';
  const pSecondary = palette.secondary || '#dc2626';
  return (
    <Reveal>
      <MenuItemFrame item={item} onSelect={onSelect} className="flex w-full gap-4 rounded-lg border-b py-4 last:border-b-0" style={{ borderColor: `${pPrimary}08` }}>
        {showImages && item.image_url && (
          <div className="relative w-16 h-16 shrink-0">
            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover rounded-lg" />
            <UnsplashAttributionCaption attribution={item.image_attribution} imageUrl={item.image_url} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 font-bold" style={{ color: pPrimary }}>
              {item.name}
              {item.is_featured && <FeaturedMark color={pSecondary} />}
              <MenuItemIconBadges item={item} iconOptions={iconOptions} palette={palette} />
            </span>
            {showPrices && item.price && (
              <span className="font-bold shrink-0 text-sm" style={{ color: pSecondary }}>{item.price}</span>
            )}
          </div>
          {showDescriptions && item.description && (
            <p className="text-sm mt-0.5 leading-snug opacity-60" style={{ color: pPrimary }}>{item.description}</p>
          )}
        </div>
      </MenuItemFrame>
    </Reveal>
  );
}

function GridItem({ item, palette, iconOptions, showPrices, showDescriptions, showImages, onSelect }: { item: MenuItem; palette: Record<string, string>; iconOptions: MenuIconOption[]; showPrices: boolean; showDescriptions: boolean; showImages: boolean; onSelect?: (item: MenuItem) => void }) {
  const pPrimary = palette.primary || '#1f2937';
  const pSecondary = palette.secondary || '#dc2626';
  const pAccent = palette.accent || '#f3f4f6';
  return (
    <Reveal>
      <MenuItemFrame item={item} onSelect={onSelect} className="block w-full overflow-hidden rounded-xl border" style={{ backgroundColor: pAccent, borderColor: `${pPrimary}10` }}>
        {showImages && item.image_url && (
          <div className="relative aspect-video w-full overflow-hidden">
            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
            <UnsplashAttributionCaption attribution={item.image_attribution} imageUrl={item.image_url} />
          </div>
        )}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 font-bold text-sm leading-tight" style={{ color: pPrimary }}>
              {item.name}
              {item.is_featured && <FeaturedMark color={pSecondary} />}
              <MenuItemIconBadges item={item} iconOptions={iconOptions} palette={palette} />
            </span>
            {showPrices && item.price && (
              <span className="font-black text-sm shrink-0" style={{ color: pSecondary }}>{item.price}</span>
            )}
          </div>
          {showDescriptions && item.description && (
            <p className="text-xs leading-snug opacity-60" style={{ color: pPrimary }}>{item.description}</p>
          )}
        </div>
      </MenuItemFrame>
    </Reveal>
  );
}

function CardItem({ item, palette, iconOptions, showPrices, showDescriptions, showImages, onSelect }: { item: MenuItem; palette: Record<string, string>; iconOptions: MenuIconOption[]; showPrices: boolean; showDescriptions: boolean; showImages: boolean; onSelect?: (item: MenuItem) => void }) {
  const pPrimary = palette.primary || '#1f2937';
  const pSecondary = palette.secondary || '#dc2626';
  return (
    <Reveal>
      <MenuItemFrame item={item} onSelect={onSelect} className="flex w-full gap-4 rounded-xl border bg-white p-4" style={{ borderColor: `${pPrimary}10` }}>
        {showImages && item.image_url ? (
          <div className="relative w-24 h-24 shrink-0">
            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover rounded-lg" />
            <UnsplashAttributionCaption attribution={item.image_attribution} imageUrl={item.image_url} />
          </div>
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
              <MenuItemIconBadges item={item} iconOptions={iconOptions} palette={palette} />
            </span>
            {showPrices && item.price && (
              <span className="font-black text-lg shrink-0" style={{ color: pSecondary }}>{item.price}</span>
            )}
          </div>
          {showDescriptions && item.description && (
            <p className="text-sm leading-relaxed mt-1 opacity-70" style={{ color: pPrimary }}>{item.description}</p>
          )}
        </div>
      </MenuItemFrame>
    </Reveal>
  );
}

function CompactItem({ item, palette, iconOptions, showPrices, showDescriptions, onSelect }: { item: MenuItem; palette: Record<string, string>; iconOptions: MenuIconOption[]; showPrices: boolean; showDescriptions: boolean; onSelect?: (item: MenuItem) => void }) {
  const pPrimary = palette.primary || '#1f2937';
  const pSecondary = palette.secondary || '#dc2626';
  return (
    <Reveal>
      <MenuItemFrame item={item} onSelect={onSelect} className="flex w-full items-start justify-between gap-4 rounded-lg py-2.5">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: pPrimary }}>
            {item.name}
            {item.is_featured && <FeaturedMark color={pSecondary} />}
            <MenuItemIconBadges item={item} iconOptions={iconOptions} palette={palette} />
          </span>
          {showDescriptions && item.description && (
            <p className="mt-0.5 text-xs leading-snug opacity-55" style={{ color: pPrimary }}>{item.description}</p>
          )}
        </div>
        {showPrices && item.price && (
          <span className="font-bold text-sm shrink-0" style={{ color: pSecondary }}>{item.price}</span>
        )}
      </MenuItemFrame>
    </Reveal>
  );
}

function MenuItemDetailViewer({
  item,
  palette,
  onClose,
  showPhoto,
  showName,
  showDescription,
  showPrice,
  showCategory,
  showIcons,
  iconOptions,
  imageFit,
  captionBg,
  textColor,
}: {
  item: MenuItem;
  palette: Record<string, string>;
  onClose: () => void;
  showPhoto: boolean;
  showName: boolean;
  showDescription: boolean;
  showPrice: boolean;
  showCategory: boolean;
  showIcons: boolean;
  iconOptions: MenuIconOption[];
  imageFit: ItemDetailImageFit;
  captionBg: string;
  textColor: string;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const itemIconOptions = showIcons ? getMenuItemIconOptions(item, iconOptions) : [];
  const hasCaption = showName || showDescription || showPrice || showCategory || itemIconOptions.length > 0;
  const hasPhotoArea = showPhoto;
  const pSecondary = palette.secondary || '#dc2626';
  const imageFitClass: Record<ItemDetailImageFit, string> = {
    contain: 'h-full w-full object-contain',
    cover: 'h-full w-full object-cover',
    center: 'max-h-full max-w-full object-contain',
    stretch: 'h-full w-full object-fill',
  };
  const imageFitLabel: Record<ItemDetailImageFit, string> = {
    contain: 'Full image',
    cover: 'Fill frame',
    center: 'Centered image',
    stretch: 'Stretched image',
  };

  useEffect(() => {
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const viewer = (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-slate-950/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${item.name} menu item details`}
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] w-[min(96vw,1100px)] flex-col overflow-hidden rounded-2xl bg-slate-950 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full bg-black/55 p-2 text-white shadow-lg transition-colors hover:bg-black/75 focus:outline-none focus:ring-2 focus:ring-white"
          aria-label="Close menu item details"
        >
          <X className="h-5 w-5" />
        </button>

        {hasPhotoArea && (
          <div className={`relative flex min-h-0 items-center justify-center bg-slate-950 ${hasCaption ? 'h-[min(62vh,680px)]' : 'h-[min(88vh,860px)]'}`}>
            {item.image_url ? (
              <>
                <img
                  src={item.image_url}
                  alt={item.name}
                  className={imageFitClass[imageFit]}
                />
                <UnsplashAttributionCaption attribution={item.image_attribution} imageUrl={item.image_url} />
              </>
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-slate-900">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/10">
                  <UtensilsCrossed className="h-12 w-12 text-white/35" />
                </div>
              </div>
            )}
          </div>
        )}

        {hasCaption && (
          <div
            className={`${hasPhotoArea ? 'max-h-[28vh] shadow-[0_-18px_60px_rgba(0,0,0,0.35)]' : 'max-h-[86vh]'} shrink-0 overflow-y-auto p-5 sm:p-7`}
            style={{ backgroundColor: captionBg, color: textColor }}
          >
            {(showCategory || (showPrice && item.price) || itemIconOptions.length > 0) && (
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide opacity-80">
                <span className="sr-only">Image display mode: {imageFitLabel[imageFit]}</span>
                {showCategory && <span>{item.category || getMenuSection(item)}</span>}
                {showPrice && item.price && (
                  <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ backgroundColor: pSecondary, color: '#ffffff' }}>
                    {item.price}
                  </span>
                )}
                {itemIconOptions.length > 0 && (
                  <MenuItemIconBadges item={item} iconOptions={iconOptions} palette={palette} />
                )}
              </div>
            )}
            {showName && (
              <h3 className="text-2xl font-black leading-tight sm:text-4xl">
                {item.name}
              </h3>
            )}
            {showDescription && item.description && (
              <p className="mt-2 max-w-3xl text-sm leading-relaxed opacity-85 sm:text-base">
                {item.description}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(viewer, document.body);
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
  icon_tags: string[];
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
  icon_tags: [],
};

export function MenuManager({ siteId, palette }: { siteId: string; palette: Record<string, string> }) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [menuSectionRecords, setMenuSectionRecords] = useState<MenuSectionRecord[]>([]);
  const [customMenuIconOptions, setCustomMenuIconOptions] = useState<MenuIconOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showIconManager, setShowIconManager] = useState(false);
  const [newMenuName, setNewMenuName] = useState('');
  const [newIconLabel, setNewIconLabel] = useState('');
  const [newIconName, setNewIconName] = useState('circle');
  const [addForm, setAddForm] = useState<ItemForm>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<ItemForm>(EMPTY_FORM);
  const [imageUploading, setImageUploading] = useState<string | null>(null); // itemId or 'new'
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingMenuSection, setDeletingMenuSection] = useState<string | null>(null);
  const [deletingCategoryKey, setDeletingCategoryKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [collapsedMenus, setCollapsedMenus] = useState<Set<string>>(new Set());
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  const pSecondary = palette.secondary || '#dc2626';
  const allMenuIconOptions = getCombinedMenuIconOptions(customMenuIconOptions);

  // Derived: known categories
  const knownCategories = Array.from(new Set(items.map(i => i.category).filter(Boolean)));
  const knownMenuSections = Array.from(new Set([
    ...menuSectionRecords.map(section => section.name).filter(Boolean),
    ...items.map(i => getMenuSection(i)).filter(Boolean),
  ]));

  useEffect(() => {
    fetchItems();
  }, [siteId]);

  async function fetchItems() {
    setLoading(true);
    try {
      const res = await fetch(`/api/menu?siteId=${siteId}`);
      const data = await res.json();
      setItems(data.items || []);
      setMenuSectionRecords(Array.isArray(data.sections) ? data.sections : []);
      setCustomMenuIconOptions(Array.isArray(data.iconOptions) ? data.iconOptions : []);
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
      setMenuSectionRecords(prev => {
        const sectionName = getMenuSection(data.item);
        if (prev.some(section => section.name === sectionName)) return prev;
        return [...prev, { name: sectionName, sort_order: data.item.menu_section_order ?? menuSections.length }];
      });
      setAddForm(EMPTY_FORM);
      setShowAdd(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddMenu() {
    const menuName = newMenuName.trim();
    if (!menuName) { setError('Menu name is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-menu-section', siteId, name: menuName }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to add menu.'); return; }
      setMenuSectionRecords(prev => {
        const withoutDuplicate = prev.filter(section => section.name.toLowerCase() !== menuName.toLowerCase());
        return [...withoutDuplicate, data.section || { name: menuName, sort_order: menuSections.length }];
      });
      setNewMenuName('');
      setShowAddMenu(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddMenuIconOption() {
    const label = newIconLabel.trim();
    if (!label) { setError('Icon label is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-menu-icon-option', siteId, label, icon: newIconName }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to add menu icon.'); return; }
      setCustomMenuIconOptions(prev => [...prev, data.option]);
      setNewIconLabel('');
      setNewIconName('circle');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateMenuIconOption(option: MenuIconOption, changes: Partial<MenuIconOption>) {
    if (option.isDefault) return;
    const next = { ...option, ...changes };
    if (!next.label.trim()) return;
    setCustomMenuIconOptions(prev => prev.map(current => current.id === option.id ? next : current));

    const res = await fetch('/api/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update-menu-icon-option',
        siteId,
        id: option.id,
        label: next.label,
        icon: next.icon,
      }),
    });
    if (!res.ok) {
      setError('Failed to update menu icon.');
      await fetchItems();
    }
  }

  async function handleDeleteMenuIconOption(option: MenuIconOption) {
    if (option.isDefault || !confirm(`Delete "${option.label}" menu icon?`)) return;
    setCustomMenuIconOptions(prev => prev.filter(current => current.id !== option.id));
    setItems(prev => prev.map(item => ({
      ...item,
      icon_tags: normalizeMenuIconTags(item.icon_tags).filter(tag => tag !== option.id),
    })));

    const res = await fetch('/api/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete-menu-icon-option', siteId, id: option.id }),
    });
    if (!res.ok) {
      setError('Failed to delete menu icon.');
      await fetchItems();
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

  async function handleDeleteMenuSection(section: string) {
    const sectionItems = items.filter(item => getMenuSection(item) === section);
    const itemCount = sectionItems.length;
    const itemText = `${itemCount} item${itemCount !== 1 ? 's' : ''}`;
    const message = itemCount > 0
      ? `Delete the "${section}" menu? This will also delete ${itemText} inside it.`
      : `Delete the empty "${section}" menu?`;

    if (!confirm(message)) return;

    setDeletingMenuSection(section);
    setError('');
    try {
      const res = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-menu-section', siteId, name: section }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Failed to delete menu.');
        return;
      }

      const deletedIds = new Set(sectionItems.map(item => item.id));
      setItems(prev => prev.filter(item => getMenuSection(item) !== section));
      setMenuSectionRecords(prev => prev.filter(record => record.name !== section));
      setCollapsedMenus(prev => {
        const next = new Set(prev);
        next.delete(section);
        return next;
      });
      setCollapsedCategories(prev => {
        const next = new Set(Array.from(prev).filter(key => !key.startsWith(`${section}::`)));
        return next;
      });
      if (editingId && deletedIds.has(editingId)) setEditingId(null);
    } finally {
      setDeletingMenuSection(null);
    }
  }

  async function handleDeleteMenuCategory(section: string, category: string) {
    const categoryItems = items.filter(item => getMenuSection(item) === section && item.category === category);
    const itemCount = categoryItems.length;
    const itemText = `${itemCount} item${itemCount !== 1 ? 's' : ''}`;
    const message = `Delete the "${category}" category from "${section}"? This will also delete ${itemText} inside it.`;

    if (!confirm(message)) return;

    const categoryKey = getCategoryKey(section, category);
    setDeletingCategoryKey(categoryKey);
    setError('');
    try {
      const res = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-menu-category', siteId, menu_section: section, category }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Failed to delete category.');
        return;
      }

      const deletedIds = new Set(categoryItems.map(item => item.id));
      setItems(prev => prev.filter(item => !(getMenuSection(item) === section && item.category === category)));
      setCollapsedCategories(prev => {
        const next = new Set(prev);
        next.delete(categoryKey);
        return next;
      });
      if (editingId && deletedIds.has(editingId)) setEditingId(null);
    } finally {
      setDeletingCategoryKey(null);
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

    setMenuSectionRecords(prev => reorderedSections.map((name, index) => (
      prev.find(section => section.name === name) || { name, sort_order: index }
    )).map((section, index) => ({ ...section, sort_order: index })));

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

    const sectionResponse = await fetch('/api/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reorder-menu-sections', siteId, sections: reorderedSections }),
    });

    if (responses.some(res => !res.ok) || !sectionResponse.ok) {
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
      icon_tags: normalizeMenuIconTags(item.icon_tags),
    });
    setError('');
  }

  const groupedByMenu = groupByMenuSection(items);
  const menuSections = getOrderedCombinedMenuSections(groupedByMenu, menuSectionRecords);

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
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowAddMenu(true); setShowAdd(false); setNewMenuName(''); setError(''); }}
            className="flex items-center gap-1.5 px-4 py-2 border border-blue-200 bg-blue-50 text-blue-700 text-sm font-bold rounded-lg transition-colors hover:bg-blue-100"
          >
            <Plus className="w-4 h-4" />
            Add Menu
          </button>
          <button
            onClick={() => setShowIconManager(!showIconManager)}
            className="flex items-center gap-1.5 px-4 py-2 border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-bold rounded-lg transition-colors hover:bg-emerald-100"
          >
            <Leaf className="w-4 h-4" />
            Menu Icons
          </button>
          <button
            onClick={() => { setShowAdd(true); setShowAddMenu(false); setAddForm(EMPTY_FORM); setError(''); }}
            className="flex items-center gap-1.5 px-4 py-2 text-white text-sm font-bold rounded-lg transition-colors hover:opacity-90"
            style={{ backgroundColor: pSecondary }}
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        </div>
      </div>

      {showIconManager && (
        <MenuIconManager
          options={allMenuIconOptions}
          customOptions={customMenuIconOptions}
          newLabel={newIconLabel}
          newIcon={newIconName}
          saving={saving}
          onNewLabelChange={setNewIconLabel}
          onNewIconChange={setNewIconName}
          onAdd={handleAddMenuIconOption}
          onUpdate={handleUpdateMenuIconOption}
          onDelete={handleDeleteMenuIconOption}
        />
      )}

      {/* Add Menu form */}
      {showAddMenu && (
        <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
            <span className="text-sm font-bold text-blue-800">New Blank Menu</span>
            <button onClick={() => setShowAddMenu(false)} className="text-blue-400 hover:text-blue-700"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-4">
            <label className="text-xs font-semibold text-slate-500 block mb-1">Menu name</label>
            <input
              autoFocus
              value={newMenuName}
              onChange={e => setNewMenuName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddMenu();
                if (e.key === 'Escape') setShowAddMenu(false);
              }}
              placeholder="Breakfast, Lunch, Dinner..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setShowAddMenu(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
              <button
                onClick={handleAddMenu}
                disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2 border border-blue-200 bg-blue-600 text-white text-sm font-bold rounded-lg disabled:opacity-60 hover:bg-blue-700 transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Add Menu
              </button>
            </div>
          </div>
        </div>
      )}

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
              menuIconOptions={allMenuIconOptions}
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
      {menuSections.length === 0 && !showAdd && !showAddMenu ? (
        <div className="text-center py-16 text-slate-400">
          <UtensilsCrossed className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No menus yet</p>
          <p className="text-sm mt-1">Add a blank menu or create your first item above.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {menuSections.map((section, sectionIndex) => {
            const sectionItems = groupedByMenu[section] || [];
            const sectionGrouped = groupByCategory(sectionItems);
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
                    <span className="text-xs text-white/60">{sectionItems.length} item{sectionItems.length !== 1 ? 's' : ''}</span>
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
                      <button
                        type="button"
                        onClick={() => handleDeleteMenuSection(section)}
                        disabled={deletingMenuSection === section}
                        title="Delete menu"
                        aria-label={`Delete ${section} menu`}
                        className="rounded-md p-1 text-white/70 transition-colors hover:bg-red-500/20 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingMenuSection === section ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                {!isMenuCollapsed && orderedCategories.length === 0 && (
                  <div
                    onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragOverTarget(`empty-menu:${section}`); }}
                    onDragLeave={e => { e.stopPropagation(); setDragOverTarget(current => current === `empty-menu:${section}` ? null : current); }}
                    onDrop={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverTarget(null);
                      handleDropMenuItemIntoSection(e.dataTransfer.getData(ITEM_DRAG_TYPE), section);
                    }}
                    className={`px-4 py-8 text-center text-sm text-slate-400 ${dragOverTarget === `empty-menu:${section}` ? 'bg-blue-50 text-blue-500' : 'bg-white'}`}
                  >
                    <p className="font-medium text-slate-500">This menu is empty.</p>
                    <p className="mt-1 text-xs">
                      Add an item and choose <span className="font-medium">{section}</span> as its menu.
                    </p>
                  </div>
                )}
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
                          <button
                            type="button"
                            onClick={() => handleDeleteMenuCategory(section, cat)}
                            disabled={deletingCategoryKey === categoryKey}
                            title="Delete category"
                            aria-label={`Delete ${cat} category`}
                            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingCategoryKey === categoryKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
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
                          menuIconOptions={allMenuIconOptions}
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
                            <MenuItemIconBadges item={item} iconOptions={allMenuIconOptions} palette={palette} />
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

function MenuIconManager({
  customOptions,
  newLabel,
  newIcon,
  saving,
  onNewLabelChange,
  onNewIconChange,
  onAdd,
  onUpdate,
  onDelete,
}: {
  options: MenuIconOption[];
  customOptions: MenuIconOption[];
  newLabel: string;
  newIcon: string;
  saving: boolean;
  onNewLabelChange: (label: string) => void;
  onNewIconChange: (icon: string) => void;
  onAdd: () => void;
  onUpdate: (option: MenuIconOption, changes: Partial<MenuIconOption>) => void;
  onDelete: (option: MenuIconOption) => void;
}) {
  const [draftCustomOptions, setDraftCustomOptions] = useState<MenuIconOption[]>(customOptions);

  useEffect(() => {
    setDraftCustomOptions(customOptions);
  }, [customOptions]);

  return (
    <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
      <h4 className="text-sm font-bold text-emerald-900">Menu Icons</h4>
      <p className="mt-0.5 text-xs text-emerald-700/80">Assign dietary or custom icons to each menu item.</p>

      <div className="mt-4 space-y-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-800">Built-in icons</p>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_MENU_ICON_OPTIONS.map(option => (
              <span key={option.id} className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800">
                <MenuIconGlyph icon={option.icon} className="h-3.5 w-3.5" />
                {option.label}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-white p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Custom icons</p>
          <div className="space-y-2">
            {draftCustomOptions.length === 0 && (
              <p className="text-xs text-slate-400">No custom menu icons yet.</p>
            )}
            {draftCustomOptions.map(option => (
              <div key={option.id} className="flex items-center gap-2">
                <MenuIconPicker
                  value={option.icon}
                  onChange={icon => {
                    const next = { ...option, icon };
                    setDraftCustomOptions(prev => prev.map(current => current.id === option.id ? next : current));
                    onUpdate(option, { icon });
                  }}
                  compact
                />
                <input
                  value={option.label}
                  onChange={e => {
                    const label = e.target.value;
                    setDraftCustomOptions(prev => prev.map(current => current.id === option.id ? { ...current, label } : current));
                  }}
                  onBlur={() => onUpdate(option, { label: option.label })}
                  onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => onDelete(option)}
                  className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                  aria-label={`Delete ${option.label}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <MenuIconPicker value={newIcon} onChange={onNewIconChange} compact />
            <input
              value={newLabel}
              onChange={e => onNewLabelChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onAdd(); }}
              placeholder="Custom label, e.g. Dairy-free"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={onAdd}
              disabled={saving}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add Icon
            </button>
          </div>
        </div>

        <p className="text-xs text-emerald-700/75">
          These options appear in the item editor below. The public menu legend is controlled in the Menu block settings.
        </p>
      </div>
    </div>
  );
}

function MenuIconPicker({ value, onChange, compact = false }: { value: string; onChange: (icon: string) => void; compact?: boolean }) {
  if (compact) {
    return (
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
        aria-label="Choose menu icon"
      >
        {MENU_ICON_PICKER_OPTIONS.map(option => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
    );
  }

  return (
    <div className="grid grid-cols-6 gap-2">
      {MENU_ICON_PICKER_OPTIONS.map(option => {
        const isSelected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            title={option.label}
            aria-pressed={isSelected}
            className={`flex h-10 items-center justify-center rounded-lg border transition-colors ${
              isSelected
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
            }`}
          >
            <MenuIconGlyph icon={option.id} className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}

function ItemFormFields({
  form,
  onChange,
  knownMenuSections,
  knownCategories,
  menuIconOptions,
  onImageUpload,
  imageUploading,
}: {
  form: ItemForm;
  onChange: (f: ItemForm) => void;
  knownMenuSections: string[];
  knownCategories: string[];
  menuIconOptions: MenuIconOption[];
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

      {/* Menu icons */}
      <div className="sm:col-span-2">
        <label className="text-xs font-semibold text-slate-600 block mb-2">Menu icons</label>
        <div className="flex flex-wrap gap-2">
          {menuIconOptions.map(option => {
            const selectedTags = normalizeMenuIconTags(form.icon_tags);
            const isSelected = selectedTags.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  const nextTags = isSelected
                    ? selectedTags.filter(tag => tag !== option.id)
                    : [...selectedTags, option.id];
                  onChange({ ...form, icon_tags: nextTags });
                }}
                aria-pressed={isSelected}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isSelected
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                <MenuIconGlyph icon={option.icon} className="h-3.5 w-3.5" />
                {option.label}
              </button>
            );
          })}
        </div>
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
