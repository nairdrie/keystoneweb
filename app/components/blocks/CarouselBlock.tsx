'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft, ChevronRight, Plus, X, Pencil,
  Star, Heart, Zap, Shield, Award, Trophy, Target, Rocket, Flame,
  Crown, CheckCircle, ThumbsUp, Users, User, Building, Home,
  Briefcase, Wrench, Settings, Phone, Mail, MessageCircle,
  Globe, Clock, Calendar, MapPin, Camera, Music,
  TrendingUp, Lock, Package, Truck, ShoppingCart, DollarSign,
  BookOpen, Lightbulb, Coffee, Code, Database, Wifi,
  Leaf, Sun, Palette, GraduationCap, Headphones,
} from 'lucide-react';
import EditableText from '../EditableText';
import BlockPretext from '../BlockPretext';
import EditableImage from '../EditableImage';
import type { ImageSettings } from '../ImageEditorModal';
import Reveal from '@/app/components/Reveal';
import { resolvePaletteColor } from '@/lib/palette-colors';
import InlineCardControls, { reorderItems } from './InlineCardControls';
import {
  ICON_STYLE_OPTIONS,
  SPACING_DENSITY_OPTIONS,
  getCardInlineStyle,
  getCardPaddingClass,
  getCardPresetShadowPaintBuffer,
  getCardPresetShadowTopPaintBuffer,
  getCardShadowPaintBuffer,
  getCardShadowTopPaintBuffer,
  getCardStyleClass,
  getCardTextPaddingClass,
  getMediaAspectClass,
  getMediaRadiusPxForTreatment,
  getMediaSizePercentForOption,
  getMediaTreatmentClass,
  getSurfaceStyle,
  getSurfaceTextColor,
  getTextAlignClass,
  getUniversalCardClassName,
  getUniversalCardInlineStyle,
  getUniversalCardPaddingClass,
  getUniversalCardTextColor,
  getUniversalCardTextPaddingClass,
  getUniversalCardTextPaddingStyle,
  readStyleOption,
  resolveCardPresetId,
  resolveUniversalCardSettings,
  shouldLockCardTextToSurface,
} from '@/lib/block-style-options';

// ── Icon registry ─────────────────────────────────────────────────────────────

type LucideIcon = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

const ICON_MAP: Record<string, LucideIcon> = {
  Star, Heart, Zap, Shield, Award, Trophy, Target, Rocket, Flame,
  Crown, CheckCircle, ThumbsUp, Users, User, Building, Home,
  Briefcase, Wrench, Settings, Phone, Mail, MessageCircle,
  Globe, Clock, Calendar, MapPin, Camera, Music,
  TrendingUp, Lock, Package, Truck, ShoppingCart, DollarSign,
  BookOpen, Lightbulb, Coffee, Code, Database, Wifi,
  Leaf, Sun, Palette, GraduationCap, Headphones,
};

const ICON_NAMES = Object.keys(ICON_MAP);

// ── Icon picker modal ─────────────────────────────────────────────────────────

function IconPickerModal({ value, onChange, onClose }: {
  value: string;
  onChange: (name: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = search
    ? ICON_NAMES.filter(n => n.toLowerCase().includes(search.toLowerCase()))
    : ICON_NAMES;

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-4 flex flex-col gap-3"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-slate-900">Choose Icon</p>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <input
          autoFocus type="search" placeholder="Search icons…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="grid grid-cols-7 gap-1 max-h-64 overflow-y-auto">
          {filtered.map(name => {
            const Icon = ICON_MAP[name];
            return (
              <button
                key={name} title={name}
                onClick={() => { onChange(name); onClose(); }}
                className={`p-2.5 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors ${name === value ? 'ring-2 ring-blue-600 bg-blue-50' : ''}`}
              >
                <Icon className="w-5 h-5 text-slate-600" />
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="col-span-7 text-xs text-slate-500 text-center py-4">No icons found</p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Default content ───────────────────────────────────────────────────────────

const DEFAULT_ITEMS = [
  { mediaType: 'icon' as const, icon: 'Zap',    title: 'Fast & Reliable', text: 'Experience lightning-fast performance you can count on.'   },
  { mediaType: 'icon' as const, icon: 'Shield', title: 'Safe & Secure',   text: 'Your data is protected with enterprise-grade security.'    },
  { mediaType: 'icon' as const, icon: 'Star',   title: 'Award Winning',   text: 'Recognized for excellence by industry leaders worldwide.' },
  { mediaType: 'icon' as const, icon: 'Heart',  title: 'Customer First',  text: 'We go above and beyond to delight every customer.'        },
];

const CAROUSEL_CARD_MIN_TOP_PAINT_BUFFER = 28;

// ── Types ─────────────────────────────────────────────────────────────────────

interface SlideItem {
  mediaType: 'image' | 'icon';
  image?: string;
  icon?: string;
  title: string;
  text: string;
}

type CarouselBreakpoint = 'desktop' | 'tablet' | 'mobile';
type CarouselColumnSettings = Partial<Record<CarouselBreakpoint, number>>;

interface CarouselData {
  title?: string;
  subtitle?: string;
  variant?: 'cards' | 'slides' | 'minimal' | string;
  items?: SlideItem[];
  autoPlay?: boolean;
  interval?: number;
  cardStyle?: string;
  surfaceStyle?: string;
  mediaAspect?: string;
  mediaTreatment?: string;
  mediaSize?: string;
  iconStyle?: string;
  spacingDensity?: string;
  textAlign?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  sectionSettings?: {
    layout?: {
      columns?: CarouselColumnSettings;
    };
  };
  [key: string]: unknown;
}

interface CarouselBlockProps {
  id: string;
  data: CarouselData;
  isEditMode: boolean;
  palette: Record<string, string>;
  updateContent: (key: string, value: unknown) => void;
}

function useResponsiveCarouselBreakpoint(): CarouselBreakpoint {
  const [breakpoint, setBreakpoint] = useState<CarouselBreakpoint>('desktop');

  useEffect(() => {
    const updateBreakpoint = () => setBreakpoint(getCarouselBreakpoint());
    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);
    return () => window.removeEventListener('resize', updateBreakpoint);
  }, []);

  return breakpoint;
}

function getCarouselBreakpoint(): CarouselBreakpoint {
  if (typeof window === 'undefined') return 'desktop';
  if (window.innerWidth < 768) return 'mobile';
  if (window.innerWidth < 1024) return 'tablet';
  return 'desktop';
}

function getCarouselCardsPerPage(
  data: CarouselData,
  itemCount: number,
  breakpoint: CarouselBreakpoint,
): number {
  const columns = data.sectionSettings?.layout?.columns;
  const configuredColumns =
    breakpoint === 'desktop'
      ? columns?.desktop
      : breakpoint === 'tablet'
        ? columns?.tablet ?? columns?.desktop
        : columns?.mobile ?? columns?.tablet ?? columns?.desktop;
  const maxColumns = Math.max(1, itemCount);
  const fallback = Math.min(3, maxColumns);
  const numeric = Number(configuredColumns);

  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(maxColumns, Math.max(1, Math.round(numeric)));
}

function getCarouselIconShellClass(iconStyle: string, sizeClass: string): string {
  const base = `${sizeClass} relative flex items-center justify-center`;
  if (iconStyle === 'plain') return base;
  if (iconStyle === 'framed') return `${base} rounded-2xl border bg-white`;
  if (iconStyle === 'badge') return `${base} rounded-full`;
  return `${base} rounded-2xl`;
}

function getCarouselIconShellStyle(iconStyle: string, secondaryColor: string): React.CSSProperties {
  if (iconStyle === 'plain') return {};
  if (iconStyle === 'framed') return { borderColor: `${secondaryColor}55` };
  return { backgroundColor: `${secondaryColor}20` };
}

// ── Component ─────────────────────────────────────────────────────────────────

function getCarouselMediaShellStyle({
  mediaSizePercent,
  isSplitMediaCard,
  isFullBleedMediaCard,
  textAlignClass,
}: {
  mediaSizePercent: number;
  isSplitMediaCard: boolean;
  isFullBleedMediaCard: boolean;
  textAlignClass: string;
}): React.CSSProperties {
  if (isFullBleedMediaCard) return {};

  const widthPercent = Math.min(100, Math.max(35, mediaSizePercent));
  const width = `${widthPercent}%`;

  if (isSplitMediaCard) {
    return { '--ks-carousel-media-width': width } as React.CSSProperties;
  }

  return {
    width,
    maxWidth: '100%',
    marginLeft: textAlignClass === 'text-center' ? 'auto' : undefined,
    marginRight: textAlignClass === 'text-center' ? 'auto' : undefined,
  };
}

function getCarouselMediaBorderRadius(radiusPx: number, isFullBleedMediaCard: boolean): React.CSSProperties['borderRadius'] {
  if (isFullBleedMediaCard) return 0;
  return radiusPx >= 100 ? '50%' : radiusPx;
}

function hasCarouselCardDesignOverride(data: CarouselData): boolean {
  if (typeof data.cardStyle === 'string' && data.cardStyle.trim()) return true;
  if (!data.cardSettings || typeof data.cardSettings !== 'object' || Array.isArray(data.cardSettings)) return false;
  return Object.keys(data.cardSettings as Record<string, unknown>).length > 0;
}

function getCarouselCardFallback(variant: string, hasDesignOverride: boolean): 'minimal' | 'soft' {
  return variant === 'minimal' && !hasDesignOverride ? 'minimal' : 'soft';
}

function getSplitSlideMediaPanelStyle(mediaSizePercent: number, secondaryColor: string): React.CSSProperties {
  const mediaWidth = mediaSizePercent >= 90 ? 50 : mediaSizePercent <= 66 ? 38 : 44;
  return {
    '--ks-carousel-slide-media-width': `${mediaWidth}%`,
    minHeight: '280px',
    backgroundColor: `${secondaryColor}10`,
  } as React.CSSProperties;
}

function getMinimalMediaShellStyle(mediaSizePercent: number, textAlignClass: string): React.CSSProperties {
  const widthPercent = Math.min(100, Math.max(35, mediaSizePercent));
  return {
    width: `${widthPercent}%`,
    maxWidth: 260,
    marginLeft: textAlignClass === 'text-center' ? 'auto' : undefined,
    marginRight: textAlignClass === 'text-center' ? 'auto' : undefined,
  };
}

function getCarouselShadowSafeStyle(
  bufferPx: number,
  overflow: React.CSSProperties['overflow'] = 'hidden',
  options: { topBufferPx?: number; layoutNeutral?: boolean } = {},
): React.CSSProperties {
  const topBufferPx = Math.max(0, options.topBufferPx ?? bufferPx);
  if (bufferPx <= 0 && topBufferPx <= 0) return { overflow };
  const style: React.CSSProperties = {
    padding: bufferPx,
    paddingTop: topBufferPx,
    overflow,
  };

  if (options.layoutNeutral) {
    style.margin = -bufferPx;
    style.marginTop = -topBufferPx;
  }

  return style;
}

export default function CarouselBlock({ id, data, isEditMode, palette, updateContent }: CarouselBlockProps) {
  const pPrimary   = palette.primary   || '#1f2937';
  const pSecondary = palette.secondary || '#dc2626';
  const pAccent    = palette.accent    || '#f3f4f6';
  const bgColor = resolvePaletteColor(data.backgroundColor, palette, '');
  const fgOverride = resolvePaletteColor(data.foregroundColor, palette);
  const textColor = fgOverride || pPrimary;

  const variant    = data.variant  || 'cards';
  const items: SlideItem[] = Array.isArray(data.items) && data.items.length ? data.items : DEFAULT_ITEMS;
  const autoPlay   = data.autoPlay !== false;
  const intervalMs = (data.interval || 5) * 1000;
  const hasCardDesignOverride = hasCarouselCardDesignOverride(data);
  const fallbackCardStyle = getCarouselCardFallback(variant, hasCardDesignOverride);

  const [current, setCurrent] = useState(0);
  const [iconPickerIdx, setIconPickerIdx] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const carouselBreakpoint = useResponsiveCarouselBreakpoint();
  const cardsPerPage = getCarouselCardsPerPage(data, items.length, carouselBreakpoint);
  const universalCardSettings = resolveUniversalCardSettings(data, {
    fallbackPreset: fallbackCardStyle,
    fallbackIconStyle: 'badge',
    fallbackTextAlign: variant === 'minimal' ? 'center' : 'left',
  });
  const cardStyle = resolveCardPresetId(data, fallbackCardStyle);
  const surfaceStyle = getSurfaceStyle(data.surfaceStyle, cardStyle);
  const spacingDensity = readStyleOption(data.spacingDensity, SPACING_DENSITY_OPTIONS, 'standard');
  const iconStyle = universalCardSettings?.iconStyle || readStyleOption(data.iconStyle, ICON_STYLE_OPTIONS, 'badge');
  const activeSurfaceStyle = universalCardSettings?.surface || surfaceStyle;
  const surfaceCardTextColor = universalCardSettings ? getUniversalCardTextColor(universalCardSettings, palette) : getSurfaceTextColor(surfaceStyle, palette);
  const lockCardTextToSurface = shouldLockCardTextToSurface(activeSurfaceStyle);
  const cardTextColor = lockCardTextToSurface ? surfaceCardTextColor : fgOverride || surfaceCardTextColor;
  const cardMutedTextColor = lockCardTextToSurface ? surfaceCardTextColor : cardTextColor;
  const textAlignClass = universalCardSettings
    ? getTextAlignClass(universalCardSettings.textAlign)
    : getTextAlignClass(data.textAlign || (variant === 'minimal' ? 'center' : undefined));
  const mediaAlignClass = textAlignClass === 'text-center' ? 'text-center' : '';
  const mediaSizePercent = universalCardSettings?.mediaSizePercent ?? getMediaSizePercentForOption(data.mediaSize);
  const mediaRadiusPx = universalCardSettings?.mediaRadiusPx ?? getMediaRadiusPxForTreatment(data.mediaTreatment, cardStyle === 'poster' ? 'fullBleed' : 'contained');
  const mediaAspectClass = universalCardSettings ? getMediaAspectClass(universalCardSettings.mediaAspect) : getMediaAspectClass(data.mediaAspect);
  const mediaTreatmentClass = universalCardSettings
    ? ''
    : getMediaTreatmentClass(data.mediaTreatment, cardStyle === 'poster' ? 'fullBleed' : 'contained');
  const isCardMediaHidden = universalCardSettings?.mediaLayout === 'none';
  const isSplitMediaCard = !isCardMediaHidden && Boolean(universalCardSettings && universalCardSettings.mediaLayout === 'split');
  const isFullBleedMediaCard = !isCardMediaHidden && (universalCardSettings ? universalCardSettings.mediaLayout === 'fullBleed' : cardStyle === 'poster');
  const cardPaddingClass = universalCardSettings ? getUniversalCardPaddingClass(universalCardSettings) : getCardPaddingClass(cardStyle, spacingDensity);
  const cardBaseClass = universalCardSettings ? getUniversalCardClassName(universalCardSettings) : getCardStyleClass(cardStyle);
  const cardShellClass = universalCardSettings
    ? `${cardBaseClass} ${cardPaddingClass} ${textAlignClass} transition-[border-color,box-shadow,opacity,transform] flex h-full ${isSplitMediaCard ? 'flex-col md:flex-row' : 'flex-col'}`
    : `${cardBaseClass} ${cardPaddingClass} ${textAlignClass} transition-[border-color,box-shadow,opacity,transform] flex h-full ${isSplitMediaCard ? 'flex-col md:flex-row' : 'flex-col'}`;
  const cardInlineStyle = universalCardSettings
    ? getUniversalCardInlineStyle(universalCardSettings, palette)
    : getCardInlineStyle(cardStyle, surfaceStyle, palette);
  const cardShadowBuffer = universalCardSettings
    ? getCardShadowPaintBuffer(universalCardSettings)
    : getCardPresetShadowPaintBuffer(cardStyle);
  const cardShadowTopBuffer = universalCardSettings
    ? getCardShadowTopPaintBuffer(universalCardSettings)
    : getCardPresetShadowTopPaintBuffer(cardStyle);
  const cardsTopPaintBuffer = Math.max(cardShadowTopBuffer + 16, CAROUSEL_CARD_MIN_TOP_PAINT_BUFFER);
  const cardShadowSafeStyle = getCarouselShadowSafeStyle(cardShadowBuffer);
  const cardsShadowSafeStyle = getCarouselShadowSafeStyle(cardShadowBuffer, 'hidden', {
    topBufferPx: cardsTopPaintBuffer,
    layoutNeutral: true,
  });
  const cardTextWrapClass = isFullBleedMediaCard || isSplitMediaCard
    ? `flex flex-1 flex-col ${universalCardSettings ? getUniversalCardTextPaddingClass(universalCardSettings) : getCardTextPaddingClass(cardStyle, spacingDensity)}`
    : 'flex flex-1 flex-col';
  const cardTextWrapStyle = universalCardSettings ? getUniversalCardTextPaddingStyle(universalCardSettings) : undefined;
  const mediaSpacingClass = isFullBleedMediaCard || isSplitMediaCard ? 'mb-0' : 'mb-5';
  const cardMediaShellClass = isSplitMediaCard ? 'w-full md:shrink-0 md:basis-[var(--ks-carousel-media-width)] md:max-w-[var(--ks-carousel-media-width)]' : 'w-full';
  const cardEditMediaToggleClass = isFullBleedMediaCard ? 'px-5 pt-5' : '';
  const cardFullBleedIconInsetClass = isFullBleedMediaCard ? 'px-4' : '';
  const isCircleMediaCard = !isFullBleedMediaCard && mediaRadiusPx >= 100;
  const cardMediaShellStyle = getCarouselMediaShellStyle({
    mediaSizePercent,
    isSplitMediaCard,
    isFullBleedMediaCard,
    textAlignClass,
  });
  const cardMediaStyle: React.CSSProperties = { borderRadius: getCarouselMediaBorderRadius(mediaRadiusPx, isFullBleedMediaCard) };
  const cardMediaClass = `w-full ${isCircleMediaCard ? 'aspect-square' : isSplitMediaCard ? 'h-full min-h-56 md:min-h-full' : mediaAspectClass} ${mediaTreatmentClass} object-cover`;

  // Reset on block change, clamp on items shrink
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setCurrent(0); }, [id]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (current >= items.length) setCurrent(Math.max(0, items.length - 1));
  }, [items.length, current]);
  useEffect(() => {
    if (variant !== 'cards') return;
    const maxCurrent = Math.max(0, items.length - cardsPerPage);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (current > maxCurrent) setCurrent(maxCurrent);
  }, [cardsPerPage, current, items.length, variant]);

  // Auto-play (slides + minimal, not cards, not edit mode)
  useEffect(() => {
    if (isEditMode || !autoPlay || items.length <= 1 || variant === 'cards') return;
    const t = setInterval(() => setCurrent(c => (c + 1) % items.length), intervalMs);
    return () => clearInterval(t);
  }, [isEditMode, autoPlay, items.length, intervalMs, variant]);

  // ── Item CRUD ────────────────────────────────────────────────────────────────

  const updateItem = (idx: number, field: string, value: unknown) =>
    updateContent('items', items.map((item, i) => i === idx ? { ...item, [field]: value } : item));

  const handleCarouselImageSave = (idx: number, key: string, value: unknown) => {
    if (key === `carousel_${idx}_image`) {
      updateItem(idx, 'image', value);
      return;
    }
    updateContent(key, value);
  };

  const addItem = () => {
    updateContent('items', [...items, { mediaType: 'icon' as const, icon: 'Star', title: 'New Slide', text: 'Add your content here.' }]);
    setCurrent(items.length);
  };

  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    const next = items.filter((_, i) => i !== idx);
    updateContent('items', next);
    setCurrent(c => Math.min(c, next.length - 1));
  };

  const reorderItem = (fromIndex: number, toIndex: number) => {
    updateContent('items', reorderItems(items, fromIndex, toIndex));
    setCurrent(c => Math.min(c, items.length - 1));
  };

  const getItemDragHandlers = (idx: number) => ({
    onDragOver: (event: React.DragEvent) => {
      if (!isEditMode || draggedIndex === null) return;
      event.preventDefault();
      setDragOverIndex(idx);
    },
    onDrop: (event: React.DragEvent) => {
      if (!isEditMode || draggedIndex === null) return;
      event.preventDefault();
      reorderItem(draggedIndex, idx);
      setDraggedIndex(null);
      setDragOverIndex(null);
    },
  });

  const renderCardControls = (idx: number) => isEditMode ? (
    <InlineCardControls
      canRemove={items.length > 1}
      dragData={`carousel-card-${idx}`}
      dragTitle="Drag to reorder carousel card"
      removeTitle="Delete carousel card"
      onDragStart={() => {
        setDraggedIndex(idx);
        setDragOverIndex(null);
      }}
      onDragEnd={() => {
        setDraggedIndex(null);
        setDragOverIndex(null);
      }}
      onRemove={() => removeItem(idx)}
    />
  ) : null;

  // ── Carousel math ────────────────────────────────────────────────────────────
  // Track width  = items.length * (100% / perPage) of container
  // Item width   = 100% / items.length of track  (= container / perPage)
  // Translate    = -current * 100% / items.length of track (= -current * container / perPage)
  const trackStyle = (perPage: number): React.CSSProperties => ({
    display: 'flex',
    width: `${items.length * 100 / perPage}%`,
    transform: `translateX(-${current * 100 / items.length}%)`,
    transition: 'transform 500ms cubic-bezier(0.22,1,0.36,1)',
  });

  const itemWidthStyle = (): React.CSSProperties => ({
    width: `${100 / items.length}%`,
    flexShrink: 0,
  });

  // ── Shared JSX helpers ───────────────────────────────────────────────────────

  const renderDots = (count: number, onClick: (i: number) => void) => (
    <div className="flex gap-2 items-center">
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i} onClick={() => onClick(i)}
          className="rounded-full transition-all duration-300"
          style={{ width: i === current ? '20px' : '8px', height: '8px', opacity: i === current ? 1 : 0.3, backgroundColor: pSecondary }}
        />
      ))}
    </div>
  );

  const renderArrow = (dir: 'prev' | 'next', onClick: () => void, disabled?: boolean) => (
    <button
      onClick={onClick} disabled={disabled}
      className={`w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center transition-all ${disabled ? 'opacity-25 cursor-not-allowed' : 'bg-white hover:bg-slate-50 shadow-sm hover:shadow'}`}
      style={{ color: pPrimary }}
    >
      {dir === 'prev' ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
    </button>
  );

  const renderIconDisplay = (item: SlideItem, idx: number, size: 'sm' | 'md' | 'lg') => {
    const Icon = (item.icon && ICON_MAP[item.icon]) ? ICON_MAP[item.icon] : Star;
    const s = {
      sm: { c: 'w-12 h-12', i: 'w-6 h-6' },
      md: { c: 'w-16 h-16', i: 'w-8 h-8' },
      lg: { c: 'w-24 h-24', i: 'w-12 h-12' },
    }[size];
    const iconShellClass = getCarouselIconShellClass(iconStyle, s.c);
    const iconShellStyle = getCarouselIconShellStyle(iconStyle, pSecondary);
    return (
      <div className="relative group/icon inline-block">
        <div className={iconShellClass} style={iconShellStyle}>
          <Icon className={s.i} style={{ color: pSecondary }} />
          {iconStyle === 'numbered' && (
            <span
              className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full text-[11px] font-black text-white shadow-sm"
              style={{ backgroundColor: pSecondary }}
            >
              {idx + 1}
            </span>
          )}
        </div>
        {isEditMode && (
          <button
            onClick={e => { e.stopPropagation(); setIconPickerIdx(idx); }}
            className="absolute -bottom-1.5 -right-1.5 bg-white border border-slate-200 rounded-full p-1.5 shadow-sm opacity-0 group-hover/icon:opacity-100 transition-opacity hover:bg-slate-50 z-10"
            title="Change icon"
          >
            <Pencil className="w-3 h-3 text-slate-500" />
          </button>
        )}
      </div>
    );
  };

  const renderMediaTypeToggle = (idx: number, className = '') => (
    <div className={`mb-3 flex gap-1 ${className}`}>
      {(['image', 'icon'] as const).map(t => (
        <button
          key={t} onClick={() => updateItem(idx, 'mediaType', t)}
          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${items[idx]?.mediaType === t ? 'text-white' : 'text-slate-400 hover:text-slate-600'}`}
          style={items[idx]?.mediaType === t ? { backgroundColor: pSecondary } : {}}
        >
          {t === 'image' ? '🖼 Image' : '✦ Icon'}
        </button>
      ))}
    </div>
  );

  const renderEditControls = (idx: number) => (
    <div className="flex gap-2 mt-5">
      <button
        onClick={addItem}
        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg border border-dashed border-blue-300 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Add Slide
      </button>
      {items.length > 1 && (
        <button
          onClick={() => removeItem(idx)}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg border border-dashed border-red-300 transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Remove
        </button>
      )}
    </div>
  );

  const getImageSettings = (key: string): ImageSettings | undefined => {
    const value = data[key];
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as ImageSettings
      : undefined;
  };

  const pickerEl = iconPickerIdx !== null ? (
    <IconPickerModal
      value={items[iconPickerIdx]?.icon || 'Star'}
      onChange={icon => updateItem(iconPickerIdx, 'icon', icon)}
      onClose={() => setIconPickerIdx(null)}
    />
  ) : null;

  // ── VARIANT: cards ────────────────────────────────────────────────────────────

  if (variant === 'cards') {
    const perPage    = cardsPerPage;
    const maxCurrent = Math.max(0, items.length - perPage);
    const showNav    = items.length > perPage;
    const renderViewCard = (item: SlideItem, idx: number) => (
      <div className={cardShellClass} style={cardInlineStyle}>
        {!isCardMediaHidden && (
          <div className={`${mediaSpacingClass} ${mediaAlignClass} ${cardMediaShellClass} ${item.mediaType !== 'image' ? cardFullBleedIconInsetClass : ''} flex-shrink-0`} style={cardMediaShellStyle}>
            {item.mediaType === 'image' && item.image ? (
              <img src={item.image} alt={item.title} className={cardMediaClass} style={cardMediaStyle} />
            ) : item.mediaType === 'image' ? (
              <div className={`${cardMediaClass} bg-slate-100 flex items-center justify-center`} style={cardMediaStyle}>
                <Camera className="w-10 h-10 text-slate-300" />
              </div>
            ) : (
              renderIconDisplay(item, idx, 'md')
            )}
          </div>
        )}
        <div className={cardTextWrapClass} style={cardTextWrapStyle}>
          <EditableText as="h3" contentKey={`carousel_${idx}_title`} content={item.title}
            defaultValue={`Feature ${idx + 1}`} isEditMode={false}
            onSave={() => {}}
            className="text-xl font-bold mb-2" style={{ color: cardTextColor }} />
          <EditableText as="p" contentKey={`carousel_${idx}_text`} content={item.text}
            defaultValue="Add your description here." isEditMode={false}
            onSave={() => {}}
            className="text-sm leading-relaxed flex-1" style={{ color: cardMutedTextColor, opacity: 0.7 }} />
        </div>
      </div>
    );

    return (
      <section className="overflow-hidden py-24" style={{ backgroundColor: bgColor || '#ffffff' }}>
        <div className="max-w-7xl mx-auto px-4">

          {/* Section header */}
          {(data.title || data.subtitle || isEditMode) && (
            <div className="text-center max-w-2xl mx-auto mb-12">
              <Reveal>
                <BlockPretext data={data} isEditMode={isEditMode} palette={palette} updateContent={updateContent} defaultText="Highlights" />
                <EditableText as="h2" contentKey="title" content={data.title}
                  defaultValue="Why Choose Us" isEditMode={isEditMode}
                  onSave={(k, v) => updateContent(k, v)}
                  className="text-4xl font-bold mb-4" style={{ color: textColor }} />
              </Reveal>
              {(data.subtitle || isEditMode) && (
                <Reveal>
                  <EditableText as="p" contentKey="subtitle" content={data.subtitle}
                    defaultValue="Everything you need to succeed" isEditMode={isEditMode}
                    onSave={(k, v) => updateContent(k, v)}
                    className="text-lg" style={{ color: textColor, opacity: 0.6 }} />
                </Reveal>
              )}
            </div>
          )}

          {/* Edit mode → grid; View mode → carousel */}
          {isEditMode ? (
            <>
              <div className="ks-layout-grid grid md:grid-cols-3 gap-6" style={cardsShadowSafeStyle}>
                {items.map((item, idx) => {
                  const isDragging = draggedIndex === idx;
                  const isDragTarget = dragOverIndex === idx && draggedIndex !== idx;
                  return (
                  <div
                    key={idx}
                    className={`${cardShellClass} relative group/card ${
                      isDragTarget ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-100'
                    } ${isDragging ? 'scale-[0.99] opacity-60' : ''}`}
                    style={cardInlineStyle}
                    {...getItemDragHandlers(idx)}
                  >
                    {renderCardControls(idx)}
                    {!isCardMediaHidden && (
                      <>
                        {renderMediaTypeToggle(idx, cardEditMediaToggleClass)}
                        <div className={`${mediaSpacingClass} ${mediaAlignClass} ${cardMediaShellClass} ${item.mediaType !== 'image' ? cardFullBleedIconInsetClass : ''}`} style={cardMediaShellStyle}>
                          {item.mediaType === 'image' ? (
                            <EditableImage
                              contentKey={`carousel_${idx}_image`} imageUrl={item.image}
                              initialSettings={getImageSettings(`carousel_${idx}_image__settings`)}
                              isEditMode={isEditMode} onSave={(key, value) => handleCarouselImageSave(idx, key, value)}
                              className={cardMediaClass}
                              style={cardMediaStyle}
                              enableInlineCropControls
                              editorPreviewFrameClassName={`w-full ${isCircleMediaCard ? 'aspect-square' : isSplitMediaCard ? 'min-h-56 md:min-h-full' : mediaAspectClass}`}
                            />
                          ) : (
                            renderIconDisplay(item, idx, 'md')
                          )}
                        </div>
                      </>
                    )}
                    <div className={cardTextWrapClass} style={cardTextWrapStyle}>
                      <EditableText as="h3" contentKey={`carousel_${idx}_title`} content={item.title}
                        defaultValue={`Feature ${idx + 1}`} isEditMode={isEditMode}
                        onSave={(_, v) => updateItem(idx, 'title', v)}
                        className="text-xl font-bold mb-2" style={{ color: cardTextColor }} />
                      <EditableText as="p" contentKey={`carousel_${idx}_text`} content={item.text}
                        defaultValue="Add your description here." isEditMode={isEditMode}
                        onSave={(_, v) => updateItem(idx, 'text', v)}
                        className="text-sm leading-relaxed flex-1" style={{ color: cardMutedTextColor, opacity: 0.7 }} />
                    </div>
                  </div>
                  );
                })}
              </div>
              <div className="flex justify-center mt-6">
                <button
                  onClick={addItem}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg border border-dashed border-blue-300 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Slide
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-6 md:hidden" style={cardsShadowSafeStyle}>
                {items.map((item, idx) => (
                  <div key={idx}>
                    {renderViewCard(item, idx)}
                  </div>
                ))}
              </div>

              <div className="hidden md:block" style={cardsShadowSafeStyle}>
                <div style={trackStyle(perPage)}>
                  {items.map((item, idx) => (
                    <div key={idx} style={itemWidthStyle()} className="px-3">
                      {renderViewCard(item, idx)}
                    </div>
                  ))}
                </div>
              </div>

              {showNav && (
                <div className="hidden items-center justify-center gap-4 mt-8 md:flex">
                  {renderArrow('prev', () => setCurrent(c => Math.max(0, c - 1)), current === 0)}
                  {renderDots(maxCurrent + 1, i => setCurrent(i))}
                  {renderArrow('next', () => setCurrent(c => Math.min(maxCurrent, c + 1)), current >= maxCurrent)}
                </div>
              )}
            </>
          )}
        </div>
        {pickerEl}
      </section>
    );
  }

  // ── VARIANT: slides ───────────────────────────────────────────────────────────

  if (variant === 'slides') {
    const slideShellClass = `${cardBaseClass} ${textAlignClass} overflow-hidden transition-[border-color,box-shadow,opacity,transform] h-full`;
    const slideContentClass = 'ks-carousel-slide-enter flex min-h-[420px] flex-col md:flex-row';
    const slideShellStyle: React.CSSProperties = { ...cardInlineStyle, padding: 0, minHeight: '420px' };
    const slideMediaPanelStyle = getSplitSlideMediaPanelStyle(mediaSizePercent, pSecondary);
    const slideMediaPanelClass = 'flex items-center justify-center overflow-hidden md:shrink-0 md:basis-[var(--ks-carousel-slide-media-width)]';
    const slideMediaWrapClass = isFullBleedMediaCard
      ? 'h-full w-full'
      : 'flex w-full max-w-lg items-center justify-center p-8 md:p-10';
    const slideMediaClass = isFullBleedMediaCard
      ? 'h-full min-h-[280px] w-full object-cover md:min-h-[420px]'
      : `w-full object-cover ${isCircleMediaCard ? 'aspect-square' : mediaAspectClass} ${mediaTreatmentClass}`;
    const slideTextPanelStyle = universalCardSettings
      ? { padding: Math.max(32, universalCardSettings.paddingPx) }
      : undefined;
    const slideNavClass = textAlignClass === 'text-center' ? 'justify-center' : 'justify-start';
    const item = items[current] || items[0];
    const idx = current;

    return (
      <section className="py-24" style={{ backgroundColor: bgColor || pAccent }}>
        <div className="max-w-7xl mx-auto px-4">

          {(data.title || isEditMode) && (
            <Reveal>
              <BlockPretext data={data} isEditMode={isEditMode} palette={palette} updateContent={updateContent} defaultText="Our Story" />
              <EditableText as="h2" contentKey="title" content={data.title}
                defaultValue="Our Story" isEditMode={isEditMode}
                onSave={(k, v) => updateContent(k, v)}
                className="text-4xl font-bold text-center mb-10" style={{ color: textColor }} />
            </Reveal>
          )}

          <div style={cardShadowSafeStyle}>
            <div className={slideShellClass} style={slideShellStyle}>
              <div key={`carousel-slide-${idx}`} className={slideContentClass}>
              {!isCardMediaHidden && (
                <div className={slideMediaPanelClass} style={slideMediaPanelStyle}>
                  <div className={slideMediaWrapClass}>
                    {item.mediaType === 'image' ? (
                      <EditableImage
                        contentKey={`carousel_${idx}_image`} imageUrl={item.image}
                        initialSettings={getImageSettings(`carousel_${idx}_image__settings`)}
                        isEditMode={isEditMode}
                        onSave={(key, value) => handleCarouselImageSave(idx, key, value)}
                        className={slideMediaClass}
                        style={cardMediaStyle}
                        enableInlineCropControls
                        editorPreviewFrameClassName={isFullBleedMediaCard ? 'h-full min-h-[280px] w-full md:min-h-[420px]' : `w-full ${isCircleMediaCard ? 'aspect-square' : mediaAspectClass}`}
                      />
                    ) : (
                      renderIconDisplay(item, idx, 'lg')
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-1 flex-col justify-center p-8 md:p-12" style={slideTextPanelStyle}>
                {isEditMode && !isCardMediaHidden && renderMediaTypeToggle(idx)}
                <p className="mb-5 text-xs font-bold uppercase tracking-widest" style={{ color: pSecondary }}>
                  {String(idx + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
                </p>
                <EditableText as="h3" contentKey={`carousel_${idx}_title`} content={item.title}
                  defaultValue="Slide Title" isEditMode={isEditMode}
                  onSave={(_, v) => updateItem(idx, 'title', v)}
                  className="mb-4 text-3xl font-bold" style={{ color: cardTextColor }} />
                <EditableText as="p" contentKey={`carousel_${idx}_text`} content={item.text}
                  defaultValue="Add your description here." isEditMode={isEditMode}
                  onSave={(_, v) => updateItem(idx, 'text', v)}
                  className="text-lg leading-relaxed" style={{ color: cardMutedTextColor, opacity: 0.7 }} />

                <div className={`mt-8 flex flex-wrap items-center gap-3 ${slideNavClass}`}>
                  {renderArrow('prev', () => setCurrent(c => (c - 1 + items.length) % items.length))}
                  {renderArrow('next', () => setCurrent(c => (c + 1) % items.length))}
                  {renderDots(items.length, i => setCurrent(i))}
                  {isEditMode && (
                    <div className="ml-auto flex gap-2">
                      <button
                        onClick={addItem}
                        className="flex items-center gap-1 rounded-lg border border-dashed border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add
                      </button>
                      {items.length > 1 && (
                        <button
                          onClick={() => removeItem(idx)}
                          className="rounded-lg border border-dashed border-red-300 p-1.5 text-red-400 transition-colors hover:bg-red-50"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>
        {pickerEl}
      </section>
    );
  }

  // ── VARIANT: minimal (default fallback) ───────────────────────────────────────

  const minimalItemAlignClass = textAlignClass === 'text-center' ? 'items-center' : 'items-start';
  const minimalShellClass = `${cardBaseClass} ${cardPaddingClass} ${textAlignClass} mx-auto flex w-full max-w-xl flex-col ${minimalItemAlignClass} transition-[border-color,box-shadow,opacity,transform]`;
  const minimalMediaShellStyle = getMinimalMediaShellStyle(mediaSizePercent, textAlignClass);
  const minimalMediaClass = `w-full object-cover ${isCircleMediaCard ? 'aspect-square' : mediaAspectClass} ${mediaTreatmentClass}`;
  const minimalMediaFrameClass = `w-full ${isCircleMediaCard ? 'aspect-square' : mediaAspectClass}`;
  const minimalMediaOuterClass = isFullBleedMediaCard ? 'mb-6 w-full' : 'mb-6 mt-2';
  const minimalTextNeedsPadding = isFullBleedMediaCard || isSplitMediaCard;
  const minimalTextWrapClass = `flex flex-col ${minimalTextNeedsPadding ? (universalCardSettings ? getUniversalCardTextPaddingClass(universalCardSettings) : getCardTextPaddingClass(cardStyle, spacingDensity)) : ''}`;
  const minimalTextWrapStyle = minimalTextNeedsPadding ? cardTextWrapStyle : undefined;
  const minimalDescriptionClass = `max-w-sm text-base leading-relaxed ${textAlignClass === 'text-center' ? 'mx-auto' : ''}`;
  const minimalItem = items[current] || items[0];
  const minimalIdx = current;

  return (
    <section className="py-24" style={{ backgroundColor: bgColor || '#ffffff' }}>
      <div className={`max-w-2xl mx-auto px-4 ${textAlignClass}`}>

        {(data.title || data.subtitle || isEditMode) && (
          <div className="mb-14">
            <Reveal>
              <BlockPretext data={data} isEditMode={isEditMode} palette={palette} updateContent={updateContent} defaultText="Features" />
              <EditableText as="h2" contentKey="title" content={data.title}
                defaultValue="Features" isEditMode={isEditMode}
                onSave={(k, v) => updateContent(k, v)}
                className="text-4xl font-bold mb-3" style={{ color: textColor }} />
            </Reveal>
            {(data.subtitle || isEditMode) && (
              <Reveal>
                <EditableText as="p" contentKey="subtitle" content={data.subtitle}
                  defaultValue="Discover what makes us different" isEditMode={isEditMode}
                  onSave={(k, v) => updateContent(k, v)}
                  className="text-lg" style={{ color: textColor, opacity: 0.6 }} />
              </Reveal>
            )}
          </div>
        )}

        <div style={cardShadowSafeStyle}>
          <div className={minimalShellClass} style={cardInlineStyle}>
            {!isCardMediaHidden && (
              <>
                {isEditMode && renderMediaTypeToggle(minimalIdx)}
                <div className={minimalMediaOuterClass} style={isFullBleedMediaCard ? undefined : minimalMediaShellStyle}>
                  {minimalItem.mediaType === 'image' ? (
                    isEditMode ? (
                      <EditableImage
                        contentKey={`carousel_${minimalIdx}_image`} imageUrl={minimalItem.image}
                        initialSettings={getImageSettings(`carousel_${minimalIdx}_image__settings`)}
                        isEditMode={isEditMode} onSave={(key, value) => handleCarouselImageSave(minimalIdx, key, value)}
                        className={minimalMediaClass}
                        style={cardMediaStyle}
                        enableInlineCropControls
                        editorPreviewFrameClassName={minimalMediaFrameClass}
                      />
                    ) : minimalItem.image ? (
                      <img src={minimalItem.image} alt={minimalItem.title} className={minimalMediaClass} style={cardMediaStyle} />
                    ) : null
                  ) : (
                    renderIconDisplay(minimalItem, minimalIdx, 'lg')
                  )}
                </div>
              </>
            )}
            <div className={minimalTextWrapClass} style={minimalTextWrapStyle}>
              <EditableText as="h3" contentKey={`carousel_${minimalIdx}_title`} content={minimalItem.title}
                defaultValue={`Feature ${minimalIdx + 1}`} isEditMode={isEditMode}
                onSave={(_, v) => updateItem(minimalIdx, 'title', v)}
                className="mb-2 text-2xl font-bold" style={{ color: cardTextColor }} />
              <EditableText as="p" contentKey={`carousel_${minimalIdx}_text`} content={minimalItem.text}
                defaultValue="Describe this feature here." isEditMode={isEditMode}
                onSave={(_, v) => updateItem(minimalIdx, 'text', v)}
                className={minimalDescriptionClass} style={{ color: cardMutedTextColor, opacity: 0.7 }} />
              {isEditMode && renderEditControls(minimalIdx)}
              </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col items-center gap-4 mt-8">
          {renderDots(items.length, i => setCurrent(i))}
          <div className="flex gap-2">
            {renderArrow('prev', () => setCurrent(c => (c - 1 + items.length) % items.length))}
            {renderArrow('next', () => setCurrent(c => (c + 1) % items.length))}
          </div>
        </div>
      </div>
      {pickerEl}
    </section>
  );
}
