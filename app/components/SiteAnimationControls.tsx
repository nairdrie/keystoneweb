'use client';

/**
 * Site-level animation defaults rendered inside the FloatingToolbar design panel.
 * Writes to `designData.__animation_*` keys via `onUpdateSiteContent`.
 */

import {
  DEFAULT_SITE_ANIMATION,
  EFFECT_LABELS,
  SITE_ANIMATION_KEYS,
  SPEED_LABELS,
  readSiteAnimation,
  type AnimationEffect,
  type AnimationSpeed,
} from '@/lib/animations';

interface SiteAnimationControlsProps {
  siteContent: Record<string, unknown> | undefined;
  onUpdateSiteContent: (key: string, value: unknown) => void;
}

const EFFECT_ORDER: AnimationEffect[] = ['fade-up', 'fade', 'slide', 'scale', 'none'];
const SPEED_ORDER: AnimationSpeed[] = ['subtle', 'normal', 'pronounced', 'custom'];

export default function SiteAnimationControls({ siteContent, onUpdateSiteContent }: SiteAnimationControlsProps) {
  const config = readSiteAnimation(siteContent);

  const setKey = (key: string, value: unknown) => onUpdateSiteContent(key, value);

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wide mb-2 block">Effect</label>
        <div className="grid grid-cols-2 gap-2">
          {EFFECT_ORDER.map((effect) => {
            const active = config.effect === effect;
            return (
              <button
                key={effect}
                type="button"
                onClick={() => setKey(SITE_ANIMATION_KEYS.effect, effect)}
                aria-pressed={active}
                className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  active
                    ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {EFFECT_LABELS[effect]}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wide mb-2 block">Speed</label>
        <div className="grid grid-cols-2 gap-2">
          {SPEED_ORDER.map((speed) => {
            const active = config.speed === speed;
            return (
              <button
                key={speed}
                type="button"
                onClick={() => setKey(SITE_ANIMATION_KEYS.speed, speed)}
                aria-pressed={active}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  active
                    ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {SPEED_LABELS[speed]}
              </button>
            );
          })}
        </div>
        {config.speed === 'custom' && (
          <div className="mt-3">
            <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wide mb-1 block">
              Duration: {config.customDurationMs ?? DEFAULT_SITE_ANIMATION.customDurationMs}ms
            </label>
            <input
              type="range"
              min={50}
              max={2500}
              step={50}
              value={config.customDurationMs ?? DEFAULT_SITE_ANIMATION.customDurationMs ?? 600}
              onChange={(e) => setKey(SITE_ANIMATION_KEYS.customDurationMs, Number(e.target.value))}
              className="w-full accent-blue-600"
            />
          </div>
        )}
      </div>

      <div>
        <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wide mb-1 block">
          Cascade between siblings: {config.staggerMs}ms
        </label>
        <input
          type="range"
          min={0}
          max={500}
          step={25}
          value={config.staggerMs}
          onChange={(e) => setKey(SITE_ANIMATION_KEYS.staggerMs, Number(e.target.value))}
          className="w-full accent-blue-600"
        />
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={config.reduceMotion}
        onClick={() => setKey(SITE_ANIMATION_KEYS.reduceMotion, !config.reduceMotion)}
        className="flex w-full items-center justify-between gap-4 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <span className="flex flex-col">
          <span className="text-sm font-medium text-slate-700">Reduce motion</span>
          <span className="text-xs text-slate-500">Disable entrance animations site-wide.</span>
        </span>
        <span className={`relative h-5 w-10 shrink-0 rounded-full transition-colors ${config.reduceMotion ? 'bg-blue-600' : 'bg-slate-200'}`}>
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${config.reduceMotion ? 'left-[22px]' : 'left-0.5'}`} />
        </span>
      </button>
    </div>
  );
}
