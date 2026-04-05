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
import EditableImage from '../EditableImage';
import Reveal from '@/app/components/Reveal';

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

// ── Types ─────────────────────────────────────────────────────────────────────

interface SlideItem {
  mediaType: 'image' | 'icon';
  image?: string;
  icon?: string;
  title: string;
  text: string;
}

interface CarouselBlockProps {
  id: string;
  data: any;
  isEditMode: boolean;
  palette: Record<string, string>;
  updateContent: (key: string, value: any) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CarouselBlock({ id, data, isEditMode, palette, updateContent }: CarouselBlockProps) {
  const pPrimary   = palette.primary   || '#1f2937';
  const pSecondary = palette.secondary || '#dc2626';
  const pAccent    = palette.accent    || '#f3f4f6';

  const variant    = data.variant  || 'cards';
  const items: SlideItem[] = data.items?.length ? data.items : DEFAULT_ITEMS;
  const autoPlay   = data.autoPlay !== false;
  const intervalMs = (data.interval || 5) * 1000;

  const [current, setCurrent] = useState(0);
  const [iconPickerIdx, setIconPickerIdx] = useState<number | null>(null);

  // Reset on block change, clamp on items shrink
  useEffect(() => { setCurrent(0); }, [id]);
  useEffect(() => {
    if (current >= items.length) setCurrent(Math.max(0, items.length - 1));
  }, [items.length, current]);

  // Auto-play (slides + minimal, not cards, not edit mode)
  useEffect(() => {
    if (isEditMode || !autoPlay || items.length <= 1 || variant === 'cards') return;
    const t = setInterval(() => setCurrent(c => (c + 1) % items.length), intervalMs);
    return () => clearInterval(t);
  }, [isEditMode, autoPlay, items.length, intervalMs, variant]);

  // ── Item CRUD ────────────────────────────────────────────────────────────────

  const updateItem = (idx: number, field: string, value: any) =>
    updateContent('items', items.map((item, i) => i === idx ? { ...item, [field]: value } : item));

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
    return (
      <div className="relative group/icon inline-block">
        <div className={`${s.c} rounded-2xl flex items-center justify-center`} style={{ backgroundColor: `${pSecondary}20` }}>
          <Icon className={s.i} style={{ color: pSecondary }} />
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

  const renderMediaTypeToggle = (idx: number) => (
    <div className="flex gap-1 mb-3">
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

  const pickerEl = iconPickerIdx !== null ? (
    <IconPickerModal
      value={items[iconPickerIdx]?.icon || 'Star'}
      onChange={icon => updateItem(iconPickerIdx, 'icon', icon)}
      onClose={() => setIconPickerIdx(null)}
    />
  ) : null;

  // ── VARIANT: cards ────────────────────────────────────────────────────────────

  if (variant === 'cards') {
    const perPage    = 3;
    const maxCurrent = Math.max(0, items.length - perPage);
    const showNav    = items.length > perPage;

    return (
      <section className="py-24" style={{ backgroundColor: data.backgroundColor || '#ffffff' }}>
        <div className="max-w-7xl mx-auto px-4">

          {/* Section header */}
          {(data.title || data.subtitle || isEditMode) && (
            <div className="text-center max-w-2xl mx-auto mb-12">
              <Reveal>
                <EditableText as="h2" contentKey="title" content={data.title}
                  defaultValue="Why Choose Us" isEditMode={isEditMode}
                  onSave={(k, v) => updateContent(k, v)}
                  className="text-4xl font-bold mb-4" style={{ color: pPrimary }} />
              </Reveal>
              {(data.subtitle || isEditMode) && (
                <Reveal>
                  <EditableText as="p" contentKey="subtitle" content={data.subtitle}
                    defaultValue="Everything you need to succeed" isEditMode={isEditMode}
                    onSave={(k, v) => updateContent(k, v)}
                    className="text-lg" style={{ color: pPrimary, opacity: 0.6 }} />
                </Reveal>
              )}
            </div>
          )}

          {/* Edit mode → grid; View mode → carousel */}
          {isEditMode ? (
            <>
              <div className="grid md:grid-cols-3 gap-6">
                {items.map((item, idx) => (
                  <div key={idx} className="bg-white rounded-2xl p-7 border border-slate-100 shadow-sm relative group flex flex-col">
                    {items.length > 1 && (
                      <button
                        onClick={() => removeItem(idx)}
                        className="absolute top-3 right-3 p-1.5 bg-red-50 hover:bg-red-100 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      >
                        <X className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    )}
                    {renderMediaTypeToggle(idx)}
                    <div className="mb-5">
                      {item.mediaType === 'image' ? (
                        <EditableImage
                          contentKey={`carousel_${idx}_image`} imageUrl={item.image}
                          initialSettings={data[`carousel_${idx}_image__settings`]}
                          isEditMode={isEditMode} onSave={(_, v) => updateItem(idx, 'image', v)}
                          className="w-full h-44 object-cover rounded-xl"
                        />
                      ) : (
                        renderIconDisplay(item, idx, 'md')
                      )}
                    </div>
                    <EditableText as="h3" contentKey={`carousel_${idx}_title`} content={item.title}
                      defaultValue={`Feature ${idx + 1}`} isEditMode={isEditMode}
                      onSave={(_, v) => updateItem(idx, 'title', v)}
                      className="text-xl font-bold mb-2" style={{ color: pPrimary }} />
                    <EditableText as="p" contentKey={`carousel_${idx}_text`} content={item.text}
                      defaultValue="Add your description here." isEditMode={isEditMode}
                      onSave={(_, v) => updateItem(idx, 'text', v)}
                      className="text-sm leading-relaxed flex-1" style={{ color: pPrimary, opacity: 0.7 }} />
                  </div>
                ))}
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
              <div className="overflow-hidden">
                <div style={trackStyle(perPage)}>
                  {items.map((item, idx) => (
                    <div key={idx} style={itemWidthStyle()} className="px-3">
                      <div className="bg-white rounded-2xl p-7 border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
                        <div className="mb-5 flex-shrink-0">
                          {item.mediaType === 'image' && item.image ? (
                            <img src={item.image} alt={item.title} className="w-full h-44 object-cover rounded-xl" />
                          ) : item.mediaType === 'image' ? (
                            <div className="w-full h-44 rounded-xl bg-slate-100 flex items-center justify-center">
                              <Camera className="w-10 h-10 text-slate-300" />
                            </div>
                          ) : (
                            renderIconDisplay(item, idx, 'md')
                          )}
                        </div>
                        <h3 className="text-xl font-bold mb-2" style={{ color: pPrimary }}>{item.title}</h3>
                        <p className="text-sm leading-relaxed flex-1" style={{ color: pPrimary, opacity: 0.7 }}>{item.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {showNav && (
                <div className="flex items-center justify-center gap-4 mt-8">
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
    return (
      <section className="py-24" style={{ backgroundColor: data.backgroundColor || pAccent }}>
        <div className="max-w-7xl mx-auto px-4">

          {(data.title || isEditMode) && (
            <Reveal>
              <EditableText as="h2" contentKey="title" content={data.title}
                defaultValue="Our Story" isEditMode={isEditMode}
                onSave={(k, v) => updateContent(k, v)}
                className="text-4xl font-bold text-center mb-10" style={{ color: pPrimary }} />
            </Reveal>
          )}

          <div className="overflow-hidden rounded-3xl shadow-lg">
            <div style={trackStyle(1)}>
              {items.map((item, idx) => (
                <div key={idx} style={itemWidthStyle()}>
                  <div className="bg-white flex flex-col md:flex-row" style={{ minHeight: '420px' }}>

                    {/* Media panel */}
                    <div
                      className="md:w-5/12 flex items-center justify-center overflow-hidden"
                      style={{ minHeight: '280px', backgroundColor: `${pSecondary}10` }}
                    >
                      {item.mediaType === 'image' ? (
                        <EditableImage
                          contentKey={`carousel_${idx}_image`} imageUrl={item.image}
                          initialSettings={data[`carousel_${idx}_image__settings`]}
                          isEditMode={isEditMode && idx === current}
                          onSave={(_, v) => updateItem(idx, 'image', v)}
                          className="w-full h-80 object-cover"
                        />
                      ) : (
                        renderIconDisplay(item, idx, 'lg')
                      )}
                    </div>

                    {/* Text panel */}
                    <div className="md:w-7/12 p-8 md:p-12 flex flex-col justify-center">
                      {isEditMode && idx === current && renderMediaTypeToggle(idx)}
                      <p className="text-xs font-bold tracking-widest uppercase mb-5" style={{ color: pSecondary }}>
                        {String(idx + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
                      </p>
                      <EditableText as="h3" contentKey={`carousel_${idx}_title`} content={item.title}
                        defaultValue="Slide Title" isEditMode={isEditMode && idx === current}
                        onSave={(_, v) => updateItem(idx, 'title', v)}
                        className="text-3xl font-bold mb-4" style={{ color: pPrimary }} />
                      <EditableText as="p" contentKey={`carousel_${idx}_text`} content={item.text}
                        defaultValue="Add your description here." isEditMode={isEditMode && idx === current}
                        onSave={(_, v) => updateItem(idx, 'text', v)}
                        className="text-lg leading-relaxed" style={{ color: pPrimary, opacity: 0.7 }} />

                      {/* Navigation */}
                      <div className="flex items-center gap-3 mt-8 flex-wrap">
                        {renderArrow('prev', () => setCurrent(c => (c - 1 + items.length) % items.length))}
                        {renderArrow('next', () => setCurrent(c => (c + 1) % items.length))}
                        {renderDots(items.length, i => setCurrent(i))}
                        {isEditMode && (
                          <div className="flex gap-2 ml-auto">
                            <button
                              onClick={addItem}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg border border-dashed border-blue-300 transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add
                            </button>
                            {items.length > 1 && (
                              <button
                                onClick={() => removeItem(idx)}
                                className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg border border-dashed border-red-300 transition-colors"
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
              ))}
            </div>
          </div>
        </div>
        {pickerEl}
      </section>
    );
  }

  // ── VARIANT: minimal (default fallback) ───────────────────────────────────────

  return (
    <section className="py-24" style={{ backgroundColor: data.backgroundColor || '#ffffff' }}>
      <div className="max-w-2xl mx-auto px-4 text-center">

        {(data.title || data.subtitle || isEditMode) && (
          <div className="mb-14">
            <Reveal>
              <EditableText as="h2" contentKey="title" content={data.title}
                defaultValue="Features" isEditMode={isEditMode}
                onSave={(k, v) => updateContent(k, v)}
                className="text-4xl font-bold mb-3" style={{ color: pPrimary }} />
            </Reveal>
            {(data.subtitle || isEditMode) && (
              <Reveal>
                <EditableText as="p" contentKey="subtitle" content={data.subtitle}
                  defaultValue="Discover what makes us different" isEditMode={isEditMode}
                  onSave={(k, v) => updateContent(k, v)}
                  className="text-lg" style={{ color: pPrimary, opacity: 0.6 }} />
              </Reveal>
            )}
          </div>
        )}

        <div className="overflow-hidden">
          <div style={trackStyle(1)}>
            {items.map((item, idx) => (
              <div key={idx} style={itemWidthStyle()} className="px-4">
                <div className="flex flex-col items-center">
                  {isEditMode && idx === current && renderMediaTypeToggle(idx)}
                  <div className="mb-6 mt-2">
                    {item.mediaType === 'image' ? (
                      isEditMode && idx === current ? (
                        <EditableImage
                          contentKey={`carousel_${idx}_image`} imageUrl={item.image}
                          initialSettings={data[`carousel_${idx}_image__settings`]}
                          isEditMode={isEditMode} onSave={(_, v) => updateItem(idx, 'image', v)}
                          className="w-48 h-48 object-cover rounded-2xl mx-auto"
                        />
                      ) : item.image ? (
                        <img src={item.image} alt={item.title} className="w-48 h-48 object-cover rounded-2xl mx-auto" />
                      ) : null
                    ) : (
                      renderIconDisplay(item, idx, 'lg')
                    )}
                  </div>
                  <EditableText as="h3" contentKey={`carousel_${idx}_title`} content={item.title}
                    defaultValue={`Feature ${idx + 1}`} isEditMode={isEditMode && idx === current}
                    onSave={(_, v) => updateItem(idx, 'title', v)}
                    className="text-2xl font-bold mb-2" style={{ color: pPrimary }} />
                  <EditableText as="p" contentKey={`carousel_${idx}_text`} content={item.text}
                    defaultValue="Describe this feature here." isEditMode={isEditMode && idx === current}
                    onSave={(_, v) => updateItem(idx, 'text', v)}
                    className="text-base leading-relaxed max-w-sm mx-auto" style={{ color: pPrimary, opacity: 0.7 }} />
                  {isEditMode && idx === current && renderEditControls(idx)}
                </div>
              </div>
            ))}
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
