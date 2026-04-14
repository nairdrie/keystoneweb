'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useEditorContext } from '@/lib/editor-context';
import EditableText from '../EditableText';
import Reveal from '@/app/components/Reveal';
import { Plus, Trash2, ExternalLink } from 'lucide-react';
import UELogo from '@/assets/UE_logo.png';
import DDLogo from '@/assets/DD_logo.png';
import SKLogo from '@/assets/SK_logo.png';

// ─── Types ────────────────────────────────────────────────────────────────────

type PlatformId = 'ubereats' | 'doordash' | 'skipthedishes' | 'custom';

interface DeliveryLink {
  id: string;
  platform: PlatformId;
  label: string;
  url: string;
  enabled: boolean;
}

interface DeliveryLinksBlockProps {
  id: string;
  data: any;
  isEditMode: boolean;
  palette: Record<string, string>;
  updateContent: (key: string, value: any) => void;
}

// ─── Platform Config ──────────────────────────────────────────────────────────

const PLATFORM_CONFIG: Record<PlatformId, { name: string; color: string; bg: string; textColor: string; logoImage: any | null }> = {
  ubereats: {
    name: 'Uber Eats',
    color: '#06C167',
    bg: '#06C167',
    textColor: '#ffffff',
    logoImage: UELogo,
  },
  doordash: {
    name: 'DoorDash',
    color: '#FF3008',
    bg: '#ffffff',
    textColor: '#1f2937',
    logoImage: DDLogo,
  },
  skipthedishes: {
    name: 'Skip the Dishes',
    color: 'rgb(255, 129, 0)',
    bg: 'rgb(255, 129, 0)',
    textColor: '#ffffff',
    logoImage: SKLogo,
  },
  custom: {
    name: 'Custom Link',
    color: '#6366f1',
    bg: '#6366f1',
    textColor: '#ffffff',
    logoImage: null,
  },
};

const KNOWN_PLATFORMS: Exclude<PlatformId, 'custom'>[] = ['ubereats', 'doordash', 'skipthedishes'];

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function buildDefaultLinks(): DeliveryLink[] {
  return KNOWN_PLATFORMS.map((platform) => ({
    id: generateId(),
    platform,
    label: PLATFORM_CONFIG[platform].name,
    url: '',
    enabled: false,
  }));
}

// ─── Delivery Card (view) ─────────────────────────────────────────────────────

function DeliveryCard({ link, palette }: { link: DeliveryLink; palette: Record<string, string> }) {
  const cfg = PLATFORM_CONFIG[link.platform];
  const bg = link.platform === 'custom' ? (palette.secondary || cfg.bg) : cfg.bg;
  const label = link.label || cfg.name;
  const hasLogo = !!cfg.logoImage;
  const isCustom = link.platform === 'custom';

  return (
    <a
      href={link.url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center rounded-2xl px-4 py-3 shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden"
      style={{ backgroundColor: bg, color: cfg.textColor }}
      aria-label={`Order on ${label}`}
    >
      {/* Left-aligned content */}
      <div className="flex flex-col items-start flex-1 min-w-0">
        {isCustom ? (
          <p className="text-sm font-bold leading-tight">{label}</p>
        ) : (
          <>
            <p className="text-[10px] font-medium opacity-80 uppercase tracking-widest mb-1">Order on</p>
            {hasLogo ? (
              <Image
                src={cfg.logoImage}
                alt={cfg.name}
                className={`${link.platform === 'skipthedishes' ? 'h-6' : 'h-7'} w-auto object-contain`}
              />
            ) : (
              <p className="text-sm font-bold leading-tight">{label}</p>
            )}
          </>
        )}
      </div>

      {/* External link icon on the right */}
      <ExternalLink className="w-4 h-4 flex-shrink-0 opacity-60 ml-2" />
    </a>
  );
}

// ─── Main Block ───────────────────────────────────────────────────────────────

export default function DeliveryLinksBlock({ id, data, isEditMode, palette, updateContent }: DeliveryLinksBlockProps) {
  const links: DeliveryLink[] = data.links && data.links.length > 0
    ? (data.links as DeliveryLink[]).filter((l) => (l.platform as string) !== 'grubhub')
    : buildDefaultLinks();
  const bgColor = data.backgroundColor || '';
  const pPrimary = palette.primary || '#1f2937';

  // Edit-mode panel state
  const [editUrl, setEditUrl] = useState<Record<string, string>>(() =>
    Object.fromEntries(links.map((l) => [l.id, l.url]))
  );
  const [editLabel, setEditLabel] = useState<Record<string, string>>(() =>
    Object.fromEntries(links.map((l) => [l.id, l.label]))
  );

  const activeLinks = links.filter((l) => l.enabled && l.url.trim());

  // ── Helpers ────────────────────────────────────────────────────────────────

  function updateLinks(updater: (prev: DeliveryLink[]) => DeliveryLink[]) {
    updateContent('links', updater(links));
  }

  function toggleLink(linkId: string) {
    updateLinks((prev) =>
      prev.map((l) => (l.id === linkId ? { ...l, enabled: !l.enabled } : l))
    );
  }

  function saveUrl(linkId: string) {
    const url = editUrl[linkId] ?? '';
    updateLinks((prev) =>
      prev.map((l) => (l.id === linkId ? { ...l, url } : l))
    );
  }

  function saveLabel(linkId: string) {
    const label = editLabel[linkId] ?? '';
    updateLinks((prev) =>
      prev.map((l) => (l.id === linkId ? { ...l, label } : l))
    );
  }

  function addCustomLink() {
    const newLink: DeliveryLink = {
      id: generateId(),
      platform: 'custom',
      label: 'Order Online',
      url: '',
      enabled: true,
    };
    updateLinks((prev) => [...prev, newLink]);
    setEditUrl((prev) => ({ ...prev, [newLink.id]: '' }));
    setEditLabel((prev) => ({ ...prev, [newLink.id]: newLink.label }));
  }

  function removeLink(linkId: string) {
    updateLinks((prev) => prev.filter((l) => l.id !== linkId));
  }

  // ── Section background ─────────────────────────────────────────────────────

  const sectionStyle: React.CSSProperties = bgColor
    ? { backgroundColor: bgColor }
    : { backgroundColor: palette.accent || '#f9fafb' };

  // ── Edit Mode ──────────────────────────────────────────────────────────────

  if (isEditMode) {
    return (
      <section className="py-16 px-4" style={sectionStyle}>
        <div className="max-w-2xl mx-auto">
          {/* Editable heading */}
          <div className="text-center mb-8">
            <EditableText
              as="h2"
              contentKey="title"
              content={data.title}
              defaultValue="Order Online"
              isEditMode={isEditMode}
              onSave={(key, value) => updateContent(key, value)}
              className="text-3xl font-bold mb-2"
              style={{ color: pPrimary }}
            />
            <EditableText
              as="p"
              contentKey="subtitle"
              content={data.subtitle}
              defaultValue="Fresh food delivered straight to your door"
              isEditMode={isEditMode}
              onSave={(key, value) => updateContent(key, value)}
              className="text-base opacity-70"
              style={{ color: pPrimary }}
            />
          </div>

          {/* Link editor list */}
          <div className="space-y-3">
            {links.map((link) => {
              const cfg = PLATFORM_CONFIG[link.platform];
              const isCustom = link.platform === 'custom';
              const badgeBg = isCustom ? (palette.secondary || cfg.bg) : cfg.bg;

              return (
                <div
                  key={link.id}
                  className={`bg-white rounded-2xl border-2 transition-all duration-200 overflow-hidden ${
                    link.enabled ? 'border-blue-500 shadow-sm' : 'border-slate-200'
                  }`}
                >
                  {/* Header row */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    {/* Platform badge */}
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-sm"
                      style={{ backgroundColor: badgeBg }}
                    >
                      {(link.label || cfg.name).slice(0, 2).toUpperCase()}
                    </div>

                    {/* Platform name / custom label */}
                    {isCustom ? (
                      <input
                        type="text"
                        className="flex-1 font-semibold text-sm text-slate-800 bg-transparent border-none outline-none"
                        value={editLabel[link.id] ?? link.label}
                        onChange={(e) => setEditLabel((prev) => ({ ...prev, [link.id]: e.target.value }))}
                        onBlur={() => saveLabel(link.id)}
                        placeholder="Button label"
                      />
                    ) : (
                      <span className="flex-1 font-semibold text-sm text-slate-800">{cfg.name}</span>
                    )}

                    {/* Toggle */}
                    <button
                      type="button"
                      onClick={() => toggleLink(link.id)}
                      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
                        link.enabled ? 'bg-blue-600' : 'bg-slate-200'
                      }`}
                      aria-label={link.enabled ? 'Disable' : 'Enable'}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                          link.enabled ? 'left-[22px]' : 'left-0.5'
                        }`}
                      />
                    </button>

                    {/* Remove (custom only) */}
                    {isCustom && (
                      <button
                        type="button"
                        onClick={() => removeLink(link.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        aria-label="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* URL input (shown when enabled) */}
                  {link.enabled && (
                    <div className="px-4 pb-3">
                      <input
                        type="url"
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                        placeholder={`https://www.${link.platform === 'custom' ? 'example.com' : cfg.name.toLowerCase().replace(/\s/g, '')}.com/your-restaurant`}
                        value={editUrl[link.id] ?? link.url}
                        onChange={(e) => setEditUrl((prev) => ({ ...prev, [link.id]: e.target.value }))}
                        onBlur={() => saveUrl(link.id)}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add custom link */}
            <button
              type="button"
              onClick={addCustomLink}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-300 rounded-2xl text-sm font-medium text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-all"
            >
              <Plus className="w-4 h-4" />
              Add custom link
            </button>
          </div>

          {/* Live preview (active links only) */}
          {activeLinks.length > 0 && (
            <div className="mt-8 pt-6 border-t border-slate-200/60">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-widest mb-4 text-center">Preview</p>
              <div className="grid grid-cols-2 gap-3">
                {activeLinks.map((link) => (
                  <DeliveryCard key={link.id} link={link} palette={palette} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    );
  }

  // ── View Mode ──────────────────────────────────────────────────────────────

  if (activeLinks.length === 0) return null;

  return (
    <section className="py-16 px-4" style={sectionStyle}>
      <div className="max-w-2xl mx-auto text-center">
        <Reveal>
          <h2
            className="text-3xl md:text-4xl font-bold mb-3"
            style={{ color: pPrimary }}
          >
            {data.title || 'Order Online'}
          </h2>
          <p className="text-base md:text-lg opacity-70 mb-10" style={{ color: pPrimary }}>
            {data.subtitle || 'Fresh food delivered straight to your door'}
          </p>
        </Reveal>

        <div className="grid grid-cols-2 gap-3">
          {activeLinks.map((link, i) => (
            <Reveal key={link.id} delay={i * 0.08}>
              <DeliveryCard link={link} palette={palette} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
