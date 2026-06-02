'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Layers, Quote, Sparkles, Star } from 'lucide-react';
import {
  CARD_PRESET_RECIPES,
  CARD_STYLE_DEFINITIONS,
  buildCardSettingsForPreset,
  getUniversalCardClassName,
  getUniversalCardInlineStyle,
  getUniversalCardPaddingClass,
  getUniversalCardTextColor,
  getUniversalCardTextPaddingClass,
  getUniversalCardTextPaddingStyle,
  resolveUniversalCardSettings,
  type CardStyle,
} from '@/lib/block-style-options';
import { PRESET_TEMPLATE_DISPLAYS } from '@/lib/templates/preset-template-display';

const LAB_PALETTE = {
  primary: '#172033',
  secondary: '#d84b31',
  accent: '#f5f1e8',
};

const STYLE_DEFINITIONS = [...CARD_STYLE_DEFINITIONS];

type TemplateStyleSuggestion = {
  template: string;
  primary: CardStyle;
  alternates: CardStyle[];
  blocks: string;
};

const TEMPLATE_STYLE_SUGGESTIONS: TemplateStyleSuggestion[] = [
  { template: PRESET_TEMPLATE_DISPLAYS.atlas.name, primary: 'utility', alternates: ['outline'], blocks: 'B2B services, stats, process cards' },
  { template: PRESET_TEMPLATE_DISPLAYS.editorial.name, primary: 'editorial', alternates: ['minimal'], blocks: 'resources, testimonials, author notes' },
  { template: PRESET_TEMPLATE_DISPLAYS.booked.name, primary: 'elevated', alternates: ['glass'], blocks: 'services, appointment proof, testimonials' },
  { template: PRESET_TEMPLATE_DISPLAYS.menu.name, primary: 'poster', alternates: ['accent'], blocks: 'menu highlights, delivery links, gallery cards' },
  { template: PRESET_TEMPLATE_DISPLAYS.craft.name, primary: 'splitMedia', alternates: ['inset'], blocks: 'product stories, services, maker proof' },
  { template: PRESET_TEMPLATE_DISPLAYS.retro.name, primary: 'offset', alternates: [], blocks: 'drops, events, carousel cards' },
  { template: PRESET_TEMPLATE_DISPLAYS.proof.name, primary: 'slab', alternates: ['solid'], blocks: 'trust cards, stats, testimonials' },
  { template: PRESET_TEMPLATE_DISPLAYS.gallery.name, primary: 'clipped', alternates: ['minimal'], blocks: 'project cards, image-led carousel, services' },
  { template: PRESET_TEMPLATE_DISPLAYS.builder.name, primary: 'bordered', alternates: ['slab'], blocks: 'trades, estimates, service cards, credibility stats' },
  { template: PRESET_TEMPLATE_DISPLAYS.commerce.name, primary: 'gradient', alternates: ['splitMedia'], blocks: 'product stories, offers, carousel cards' },
  { template: PRESET_TEMPLATE_DISPLAYS.foundation.name, primary: 'inset', alternates: ['editorial'], blocks: 'mission cards, community proof, resources' },
  { template: PRESET_TEMPLATE_DISPLAYS.wellness.name, primary: 'soft', alternates: ['glass'], blocks: 'care services, testimonials, calm stats' },
  { template: PRESET_TEMPLATE_DISPLAYS.estate.name, primary: 'luxe', alternates: ['poster'], blocks: 'property cards, interiors, image-led proof' },
  { template: PRESET_TEMPLATE_DISPLAYS.studio.name, primary: 'outline', alternates: ['clipped'], blocks: 'services, project cards, agency proof' },
  { template: PRESET_TEMPLATE_DISPLAYS.learn.name, primary: 'accent', alternates: ['utility'], blocks: 'course modules, resources, stats' },
  { template: PRESET_TEMPLATE_DISPLAYS.occasion.name, primary: 'playful', alternates: ['glow'], blocks: 'events, weddings, venue highlights' },
];

export default function CardStyleLabPage() {
  const [selectedId, setSelectedId] = useState<CardStyle>('soft');
  const selectedIndex = Math.max(0, STYLE_DEFINITIONS.findIndex((style) => style.id === selectedId));
  const selectedStyle = STYLE_DEFINITIONS[selectedIndex] || STYLE_DEFINITIONS[0];
  const selectedTemplateSuggestions = useMemo(
    () => TEMPLATE_STYLE_SUGGESTIONS.filter((item) => item.primary === selectedStyle.id || item.alternates.includes(selectedStyle.id)),
    [selectedStyle.id],
  );

  const moveSelection = (direction: -1 | 1) => {
    const nextIndex = (selectedIndex + direction + STYLE_DEFINITIONS.length) % STYLE_DEFINITIONS.length;
    setSelectedId(STYLE_DEFINITIONS[nextIndex].id);
  };

  return (
    <main className="min-h-screen bg-[#f7f7f3] text-slate-900">
      <section className="border-b border-slate-200 bg-white px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Keystone block cards</p>
            <h1 className="text-3xl font-black tracking-normal text-slate-950 md:text-5xl">Card Style Lab</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
              Twenty test treatments for service, stats, testimonial, and carousel cards. Pick the ones worth keeping and the template fits are listed below each style.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => moveSelection(-1)}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Prev
            </button>
            <span className="min-w-16 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center text-sm font-bold text-slate-600">
              {selectedIndex + 1} / {STYLE_DEFINITIONS.length}
            </span>
            <button
              type="button"
              onClick={() => moveSelection(1)}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <section className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto pb-1">
          {STYLE_DEFINITIONS.map((style) => (
            <button
              key={style.id}
              type="button"
              onClick={() => setSelectedId(style.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                selectedId === style.id
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {selectedId === style.id && <Check className="h-3.5 w-3.5" />}
              {style.label}
            </button>
          ))}
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-8">
            <div>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Selected style</p>
                  <h2 className="text-2xl font-black text-slate-950">{selectedStyle.label}</h2>
                </div>
                <code className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700">
                  cardStyle: <span>{`'${selectedStyle.id}'`}</span>
                </code>
              </div>

              <div className="grid gap-5 lg:grid-cols-3">
                <PreviewCard styleId={selectedStyle.id} mode="service" />
                <PreviewCard styleId={selectedStyle.id} mode="testimonial" />
                <PreviewCard styleId={selectedStyle.id} mode="stat" />
              </div>
            </div>

            <div>
              <div className="mb-4 flex items-center gap-2">
                <Layers className="h-5 w-5 text-slate-600" />
                <h2 className="text-xl font-black text-slate-950">All 20 Styles</h2>
              </div>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {STYLE_DEFINITIONS.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setSelectedId(style.id)}
                    className="text-left focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <PreviewCard styleId={style.id} mode="service" compact active={style.id === selectedId} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-slate-600" />
                <h2 className="text-xl font-black text-slate-950">Template Picks</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {TEMPLATE_STYLE_SUGGESTIONS.map((item) => (
                  <div key={item.template} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-slate-950">{item.template}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{item.blocks}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedId(item.primary)}
                        className="rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-white"
                      >
                        {getStyleLabel(item.primary)}
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.alternates.map((styleId) => (
                        <button
                          key={styleId}
                          type="button"
                          onClick={() => setSelectedId(styleId)}
                          className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50"
                        >
                          {getStyleLabel(styleId)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Suggested templates</p>
              <h3 className="mt-2 text-lg font-black text-slate-950">{selectedStyle.label}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{selectedStyle.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedStyle.recommendedTemplates.map((template) => (
                  <span key={template} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold capitalize text-slate-700">
                    {template}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Also fits</p>
              <div className="mt-3 space-y-3">
                {selectedTemplateSuggestions.length > 0 ? (
                  selectedTemplateSuggestions.map((item) => (
                    <div key={item.template} className="border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
                      <p className="text-sm font-black text-slate-900">{item.template}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{item.blocks}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm leading-6 text-slate-500">No template has this as a top pick yet.</p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Advanced recipe</p>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                {Object.entries(getRecipeSummary(selectedStyle.id)).map(([key, value]) => (
                  <div key={key}>
                    <dt className="font-bold text-slate-500">{key}</dt>
                    <dd className="mt-0.5 text-slate-800">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function PreviewCard({
  styleId,
  mode,
  compact = false,
  active = false,
}: {
  styleId: CardStyle;
  mode: 'service' | 'testimonial' | 'stat';
  compact?: boolean;
  active?: boolean;
}) {
  const definition = STYLE_DEFINITIONS.find((style) => style.id === styleId) || STYLE_DEFINITIONS[0];
  const settings = resolveUniversalCardSettings({
    cardStyle: styleId,
    cardSettings: buildCardSettingsForPreset(styleId),
  })!;
  const textColor = getUniversalCardTextColor(settings, LAB_PALETTE);
  const mutedColor = settings.surface === 'primary' || settings.surface === 'secondary' ? '#ffffff' : textColor;
  const isSplitMedia = settings.mediaLayout === 'split';
  const isFullBleedMedia = settings.mediaLayout === 'fullBleed';
  const usesMedia = isSplitMedia || isFullBleedMedia;
  const shellClass = `${getUniversalCardClassName(settings)} ${getUniversalCardPaddingClass(settings)} relative flex ${compact ? 'min-h-[190px]' : 'min-h-[220px]'} flex-col justify-between transition-all ${isSplitMedia ? 'md:flex-row' : ''} ${
    active ? 'ring-2 ring-slate-900 ring-offset-2 ring-offset-[#f7f7f3]' : ''
  }`;
  const inlineStyle = getUniversalCardInlineStyle(settings, LAB_PALETTE);
  const textWrapClass = usesMedia ? `flex flex-1 flex-col ${getUniversalCardTextPaddingClass(settings)}` : '';
  const textWrapStyle = getUniversalCardTextPaddingStyle(settings);

  return (
    <article className={shellClass} style={inlineStyle}>
      {usesMedia && (
        <div
          className={`h-28 w-full ${isSplitMedia ? 'md:h-auto md:w-5/12 md:shrink-0' : ''}`}
          style={{ background: `linear-gradient(135deg, ${LAB_PALETTE.primary}, ${LAB_PALETTE.secondary})` }}
        />
      )}
      <div className={textWrapClass} style={textWrapStyle}>
        <div className="mb-5 flex items-center justify-between gap-3">
          <span className="rounded-md px-2.5 py-1 text-xs font-black uppercase tracking-wide" style={{ backgroundColor: `${LAB_PALETTE.secondary}22`, color: textColor }}>
            {definition.label}
          </span>
          {mode === 'testimonial' && <Quote className="h-5 w-5 opacity-40" style={{ color: LAB_PALETTE.secondary }} />}
          {mode === 'stat' && <Star className="h-5 w-5 opacity-60" style={{ color: LAB_PALETTE.secondary }} />}
        </div>

        {mode === 'stat' ? (
          <>
            <p className="text-4xl font-black tracking-normal" style={{ color: settings.surface === 'primary' || settings.surface === 'secondary' ? '#ffffff' : LAB_PALETTE.secondary }}>
              4.9/5
            </p>
            <p className="mt-2 text-xs font-bold uppercase tracking-wide" style={{ color: mutedColor, opacity: 0.68 }}>
              Average client rating
            </p>
          </>
        ) : mode === 'testimonial' ? (
          <>
            <p className="text-sm leading-6" style={{ color: mutedColor, opacity: 0.76 }}>
              The layout feels clear, polished, and easy to scan across the whole page.
            </p>
            <div className="mt-5 border-t pt-4" style={{ borderColor: settings.surface === 'primary' || settings.surface === 'secondary' ? 'rgba(255,255,255,0.22)' : '#e5e7eb' }}>
              <p className="text-sm font-black" style={{ color: textColor }}>Avery Stone</p>
              <p className="text-xs" style={{ color: mutedColor, opacity: 0.62 }}>Verified customer</p>
            </div>
          </>
        ) : (
          <>
            <p className="text-lg font-black tracking-normal" style={{ color: textColor }}>
              Launch-ready service card
            </p>
            <p className="mt-3 text-sm leading-6" style={{ color: mutedColor, opacity: 0.72 }}>
              A practical preview for services, carousel items, testimonials, and feature blocks.
            </p>
          </>
        )}
      </div>
    </article>
  );
}

function getStyleLabel(styleId: CardStyle): string {
  return STYLE_DEFINITIONS.find((style) => style.id === styleId)?.label || styleId;
}

function getRecipeSummary(styleId: CardStyle): Record<string, string> {
  const recipe = CARD_PRESET_RECIPES[styleId];
  return {
    Surface: `${recipe.surface} ${Math.round(recipe.surfaceOpacity * 100)}%`,
    Radius: `${recipe.radiusPx}px`,
    Border: `${recipe.borderWidthPx}px ${recipe.borderStyle} ${recipe.borderColor}`,
    Sides: recipe.borderSides,
    Shadow: recipe.shadowEnabled
      ? `${recipe.shadowInset ? 'inset ' : ''}${recipe.shadowX}px ${recipe.shadowY}px ${recipe.shadowBlur}px ${recipe.shadowColor} ${Math.round(recipe.shadowOpacity * 100)}%`
      : 'none',
    Padding: recipe.paddingDensity,
    Accent: recipe.accentSide === 'none' ? 'none' : `${recipe.accentSide} ${recipe.accentWidthPx}px ${recipe.accentColor}`,
    Media: `${recipe.mediaLayout}, ${recipe.mediaAspect}`,
    Marker: recipe.markerStyle,
    Icon: recipe.iconStyle,
    Corner: recipe.cornerEffect,
  };
}
