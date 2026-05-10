'use client';

/**
 * Per-block animation override UI. Renders inside an InspectorSection.
 * The block stores its override under `block.data.animation` as a partial
 * AnimationConfig + optional trigger. Empty draft = inherit site default.
 */

import { useMemo } from 'react';
import { useEditorContext } from '@/lib/editor-context';
import {
  EFFECT_LABELS,
  SPEED_LABELS,
  blockToken,
  readSiteAnimation,
  textToken,
  type AnimationEffect,
  type AnimationSpeed,
  type AnimationTrigger,
  type PartialAnimationConfig,
} from '@/lib/animations';
import { InspectorToggle } from './panel-shared';

const EFFECT_ORDER: AnimationEffect[] = ['fade-up', 'fade', 'slide', 'scale', 'none'];
const SPEED_ORDER: AnimationSpeed[] = ['subtle', 'normal', 'pronounced', 'custom'];

interface BlockAnimationSectionProps {
  blockId: string;
  draft: PartialAnimationConfig | undefined;
  onChange: (next: PartialAnimationConfig | undefined) => void;
}

export default function BlockAnimationSection({ blockId, draft, onChange }: BlockAnimationSectionProps) {
  const context = useEditorContext();
  const siteDefaults = readSiteAnimation(context?.siteContent);
  const overrideEnabled = isOverrideActive(draft);

  const triggerTokens = useTriggerOptions(blockId);

  const triggerToken = draft?.trigger?.kind === 'after' ? draft.trigger.after : '';

  const setOverrideEnabled = (enabled: boolean) => {
    if (!enabled) {
      onChange(undefined);
      return;
    }
    onChange({
      effect: siteDefaults.effect,
      speed: siteDefaults.speed,
      customDurationMs: siteDefaults.customDurationMs,
      staggerMs: siteDefaults.staggerMs,
    });
  };

  const patch = (update: Partial<PartialAnimationConfig>) => {
    onChange({ ...(draft ?? {}), ...update });
  };

  const setTrigger = (token: string) => {
    if (!token) {
      if (!draft) return;
      const rest: PartialAnimationConfig = { ...draft };
      delete rest.trigger;
      onChange(Object.keys(rest).length > 0 ? rest : undefined);
      return;
    }
    const next: AnimationTrigger = { kind: 'after', after: token };
    onChange({ ...(draft ?? {}), trigger: next });
  };

  return (
    <div className="space-y-4">
      <InspectorToggle
        label="Override animation"
        description={overrideEnabled
          ? 'Custom values active for this block.'
          : `Inherits site default — ${EFFECT_LABELS[siteDefaults.effect].toLowerCase()}, ${SPEED_LABELS[siteDefaults.speed].toLowerCase()}.`}
        checked={overrideEnabled}
        onChange={() => setOverrideEnabled(!overrideEnabled)}
      />

      {overrideEnabled && (
        <>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Effect</p>
            <div className="grid grid-cols-2 gap-2">
              {EFFECT_ORDER.map((effect) => {
                const active = (draft?.effect ?? siteDefaults.effect) === effect;
                return (
                  <button
                    key={effect}
                    type="button"
                    onClick={() => patch({ effect })}
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
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Speed</p>
            <div className="grid grid-cols-2 gap-2">
              {SPEED_ORDER.map((speed) => {
                const active = (draft?.speed ?? siteDefaults.speed) === speed;
                return (
                  <button
                    key={speed}
                    type="button"
                    onClick={() => patch({ speed })}
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
            {(draft?.speed ?? siteDefaults.speed) === 'custom' && (
              <div className="mt-3">
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Duration: {draft?.customDurationMs ?? siteDefaults.customDurationMs ?? 600}ms
                </label>
                <input
                  type="range"
                  min={50}
                  max={2500}
                  step={50}
                  value={draft?.customDurationMs ?? siteDefaults.customDurationMs ?? 600}
                  onChange={(e) => patch({ customDurationMs: Number(e.target.value) })}
                  className="w-full accent-blue-600"
                />
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Cascade between children: {draft?.staggerMs ?? siteDefaults.staggerMs}ms
            </label>
            <input
              type="range"
              min={0}
              max={500}
              step={25}
              value={draft?.staggerMs ?? siteDefaults.staggerMs}
              onChange={(e) => patch({ staggerMs: Number(e.target.value) })}
              className="w-full accent-blue-600"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor={`${blockId}-anim-trigger`}>
              Start when
            </label>
            <select
              id={`${blockId}-anim-trigger`}
              value={triggerToken}
              onChange={(e) => setTrigger(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Block scrolls into view</option>
              {triggerTokens.length > 0 && (
                <optgroup label="After…">
                  {triggerTokens.map((opt) => (
                    <option key={opt.token} value={opt.token}>{opt.label}</option>
                  ))}
                </optgroup>
              )}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">
              Wait for an earlier block or text reveal to finish before this block animates in.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

interface TriggerOption {
  token: string;
  label: string;
}

function useTriggerOptions(currentBlockId: string): TriggerOption[] {
  const context = useEditorContext();
  const blocks = context?.blocks;

  return useMemo(() => {
    const list = blocks ?? [];
    const options: TriggerOption[] = [];
    for (const block of list) {
      if (block.id === currentBlockId) break;
      const blockLabel = describeBlock(block.type, block.data);
      options.push({
        token: blockToken(block.id),
        label: `${blockLabel} entrance`,
      });
      const textKeys = collectTextRevealKeys(block.data);
      for (const key of textKeys) {
        options.push({
          token: textToken(key),
          label: `${blockLabel} → ${humanizeKey(key)} (text)`,
        });
      }
    }
    return options;
  }, [blocks, currentBlockId]);
}

function isOverrideActive(draft: PartialAnimationConfig | undefined): boolean {
  if (!draft) return false;
  return Object.keys(draft).length > 0;
}

function collectTextRevealKeys(blockData: Record<string, unknown> | undefined): string[] {
  if (!blockData) return [];
  const out: string[] = [];
  for (const [key, value] of Object.entries(blockData)) {
    if (!key.endsWith('__textReveal')) continue;
    if (!value || typeof value !== 'object') continue;
    const effect = (value as Record<string, unknown>).effect;
    if (effect && effect !== 'none') {
      out.push(key.slice(0, -'__textReveal'.length));
    }
  }
  return out;
}

function describeBlock(type: string, data: Record<string, unknown> | undefined): string {
  const headline = data?.headline ?? data?.title ?? data?.heading;
  const text = typeof headline === 'string' ? stripTags(headline).trim() : '';
  const truncated = text ? (text.length > 28 ? `${text.slice(0, 28)}…` : text) : '';
  const typeLabel = humanizeType(type);
  return truncated ? `${typeLabel} — “${truncated}”` : typeLabel;
}

function humanizeType(type: string): string {
  return type
    .replace(/[_-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanizeKey(key: string): string {
  return key
    .replace(/[_-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2');
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}
