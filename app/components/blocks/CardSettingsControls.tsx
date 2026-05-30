'use client';

import {
  CARD_ACCENT_SIDE_OPTIONS,
  CARD_BORDER_SIDE_OPTIONS,
  CARD_BORDER_STYLE_OPTIONS,
  CARD_CORNER_EFFECT_OPTIONS,
  CARD_MEDIA_LAYOUT_OPTIONS,
  CARD_PRESET_RECIPES,
  CARD_STYLE_DEFINITIONS,
  ICON_STYLE_OPTIONS,
  MARKER_STYLE_OPTIONS,
  MEDIA_ASPECT_OPTIONS,
  TEXT_ALIGN_OPTIONS,
  buildCardSettingsForPreset,
  getMediaRadiusPxForTreatment,
  getMediaSizeOptionForPercent,
  getMediaSizePercentForOption,
  getCardPresetLabel,
  getCardShadowDefaults,
  readCardPresetId,
  type CardShadowControlSettings,
  type CardSettings,
} from '@/lib/block-style-options';
import { DeferredColorInput, PaletteTokenButtons } from './panel-shared';

type SelectOption<T extends string> = {
  value: T;
  label: string;
};

const BORDER_STYLE_OPTIONS = toOptions(CARD_BORDER_STYLE_OPTIONS);
const BORDER_SIDE_OPTIONS = toOptions(CARD_BORDER_SIDE_OPTIONS);
const TEXT_ALIGN_OPTIONS_UI = toOptions(TEXT_ALIGN_OPTIONS);
const ACCENT_SIDE_OPTIONS = toOptions(CARD_ACCENT_SIDE_OPTIONS);
const MEDIA_LAYOUT_OPTIONS = toOptions(CARD_MEDIA_LAYOUT_OPTIONS);
const MEDIA_ASPECT_OPTIONS_UI = toOptions(MEDIA_ASPECT_OPTIONS);
const MARKER_OPTIONS = toOptions(MARKER_STYLE_OPTIONS);
const ICON_OPTIONS = toOptions(ICON_STYLE_OPTIONS);
const CORNER_OPTIONS = toOptions(CARD_CORNER_EFFECT_OPTIONS);
const CARD_SUBSECTION_HEADING_CLASS = 'mb-3 text-sm font-black uppercase tracking-wide text-slate-900';

export function CardSettingsControls({
  value,
  currentPresetId,
  supportsMedia = false,
  supportsMarker = false,
  supportsIcon = false,
  supportsTextAlign = true,
  mediaControlVisibility,
  onChange,
  palette,
}: {
  value?: CardSettings;
  currentPresetId: string;
  palette: Record<string, string>;
  supportsMedia?: boolean;
  supportsMarker?: boolean;
  supportsIcon?: boolean;
  supportsTextAlign?: boolean;
  mediaControlVisibility?: {
    layout?: boolean;
    aspect?: boolean;
    size?: boolean;
    radius?: boolean;
  };
  onChange: (value: CardSettings) => void;
}) {
  const presetId = readCardPresetId(value?.presetId === 'custom' ? currentPresetId : value?.presetId, readCardPresetId(currentPresetId, 'soft'));
  const settings = { ...CARD_PRESET_RECIPES[presetId], ...(value || {}) };
  const shadowSettings = getMergedShadowSettings(settings);
  const mediaSizePercent = typeof value?.mediaSizePercent === 'number'
    ? settings.mediaSizePercent
    : value?.mediaSize
      ? getMediaSizePercentForOption(value.mediaSize)
      : settings.mediaSizePercent;
  const mediaRadiusPx = typeof value?.mediaRadiusPx === 'number'
    ? settings.mediaRadiusPx
    : value?.mediaTreatment
      ? getMediaRadiusPxForTreatment(value.mediaTreatment)
      : settings.mediaRadiusPx;
  const displayPreset = value?.presetId === 'custom' || hasCustomSettings(value)
    ? 'Custom'
    : getCardPresetLabel(presetId);
  const mediaVisibility = {
    layout: mediaControlVisibility?.layout !== false,
    aspect: mediaControlVisibility?.aspect !== false,
    size: mediaControlVisibility?.size !== false,
    radius: mediaControlVisibility?.radius !== false,
  };
  const hasVisibleMediaControls = supportsMedia && Object.values(mediaVisibility).some(Boolean);

  const updateSettings = (patch: CardSettings) => {
    onChange({
      ...settings,
      ...shadowSettings,
      presetId: 'custom',
      ...patch,
    });
  };

  const update = <K extends keyof CardSettings>(key: K, next: CardSettings[K]) => {
    updateSettings({ [key]: next } as CardSettings);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Card preset</p>
            <p className="mt-1 text-sm font-black text-slate-900">{displayPreset}</p>
          </div>
          <button
            type="button"
            onClick={() => onChange(buildCardSettingsForPreset(presetId))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Reset
          </button>
        </div>
        <select
          value={presetId}
          onChange={(event) => onChange(buildCardSettingsForPreset(event.target.value))}
          className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
        >
          {CARD_STYLE_DEFINITIONS.map((preset) => (
            <option key={preset.id} value={preset.id}>{preset.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <CardColorControl label="Surface color" value={settings.surface} fallback={CARD_PRESET_RECIPES[presetId].surface} palette={palette} allowGradient onChange={(next) => update('surface', next)} />
        <RangeControl label="Surface opacity" value={settings.surfaceOpacity} min={0.1} max={1} step={0.05} format={(next) => `${Math.round(next * 100)}%`} onChange={(next) => update('surfaceOpacity', next)} />
        {settings.surface === 'gradient' && (
          <CardGradientControls
            settings={settings}
            palette={palette}
            onChange={(patch) => updateSettings(patch)}
          />
        )}
        <RangeControl label="Corner radius" value={settings.radiusPx} min={0} max={40} suffix="px" onChange={(next) => update('radiusPx', next)} />
        <SelectControl label="Corner effect" value={settings.cornerEffect} options={CORNER_OPTIONS} onChange={(next) => update('cornerEffect', next)} />
      </div>

      <div className="border-t border-slate-200 pt-4">
        <p className={CARD_SUBSECTION_HEADING_CLASS}>Border</p>
        <div className="grid grid-cols-1 gap-4">
          <RangeControl label="Border width" value={settings.borderWidthPx} min={0} max={8} suffix="px" onChange={(next) => update('borderWidthPx', next)} />
          <SelectControl label="Border style" value={settings.borderStyle} options={BORDER_STYLE_OPTIONS} onChange={(next) => update('borderStyle', next)} />
          <CardColorControl label="Border color" value={settings.borderColor} fallback={CARD_PRESET_RECIPES[presetId].borderColor} palette={palette} onChange={(next) => update('borderColor', next)} />
          <SelectControl label="Border sides" value={settings.borderSides} options={BORDER_SIDE_OPTIONS} onChange={(next) => update('borderSides', next)} />
        </div>
      </div>

      <div className="border-t border-slate-200 pt-4">
        <p className={CARD_SUBSECTION_HEADING_CLASS}>Shadow</p>
        <CardShadowControl
          shadowKind={settings.shadow}
          settings={shadowSettings}
          color={settings.shadowColor}
          opacity={settings.shadowOpacity}
          fallbackColor={CARD_PRESET_RECIPES[presetId].shadowColor}
          palette={palette}
          onChange={(patch) => updateSettings(patch)}
        />
      </div>

      <div className="border-t border-slate-200 pt-4">
        <p className={CARD_SUBSECTION_HEADING_CLASS}>Layout</p>
        <div className="grid grid-cols-1 gap-4">
          <NumberSliderControl label="Padding" value={settings.paddingPx} min={0} max={72} step={2} suffix="px" onChange={(next) => update('paddingPx', next)} />
          {supportsTextAlign && (
            <SelectControl label="Text alignment" value={settings.textAlign} options={TEXT_ALIGN_OPTIONS_UI} onChange={(next) => update('textAlign', next)} />
          )}
          <SelectControl label="Accent side" value={settings.accentSide} options={ACCENT_SIDE_OPTIONS} onChange={(next) => update('accentSide', next)} />
          <RangeControl label="Accent width" value={settings.accentWidthPx} min={0} max={12} suffix="px" onChange={(next) => update('accentWidthPx', next)} />
          <CardColorControl label="Accent color" value={settings.accentColor} fallback={CARD_PRESET_RECIPES[presetId].accentColor} palette={palette} onChange={(next) => update('accentColor', next)} />
        </div>
      </div>

      {hasVisibleMediaControls && (
        <div className="border-t border-slate-200 pt-4">
          <p className={CARD_SUBSECTION_HEADING_CLASS}>Media</p>
          <div className="grid grid-cols-1 gap-4">
            {mediaVisibility.layout && (
              <SelectControl label="Media layout" value={settings.mediaLayout} options={MEDIA_LAYOUT_OPTIONS} onChange={(next) => update('mediaLayout', next)} />
            )}
            {mediaVisibility.aspect && (
              <SelectControl label="Media aspect ratio" value={settings.mediaAspect} options={MEDIA_ASPECT_OPTIONS_UI} onChange={(next) => update('mediaAspect', next)} />
            )}
            {mediaVisibility.size && (
              <NumberSliderControl
                label="Media size"
                value={mediaSizePercent}
                min={35}
                max={100}
                step={5}
                suffix="%"
                onChange={(next) => updateSettings({ mediaSizePercent: next, mediaSize: getMediaSizeOptionForPercent(next) })}
              />
            )}
            {mediaVisibility.radius && (
              <NumberSliderControl
                label="Media corner radius"
                value={mediaRadiusPx}
                min={0}
                max={100}
                suffix="px"
                format={(next) => next >= 100 ? 'Circle' : `${next}px`}
                onChange={(next) => update('mediaRadiusPx', next)}
              />
            )}
          </div>
        </div>
      )}

      {(supportsMarker || supportsIcon) && (
        <div className="border-t border-slate-200 pt-4">
          <p className={CARD_SUBSECTION_HEADING_CLASS}>Markers</p>
          <div className="grid grid-cols-1 gap-4">
            {supportsMarker && (
              <SelectControl label="Marker style" value={settings.markerStyle} options={MARKER_OPTIONS} onChange={(next) => update('markerStyle', next)} />
            )}
            {supportsIcon && (
              <SelectControl label="Icon style" value={settings.iconStyle} options={ICON_OPTIONS} onChange={(next) => update('iconStyle', next)} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SelectControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function CardColorControl({
  label,
  value,
  fallback,
  palette,
  allowGradient = false,
  onChange,
}: {
  label: string;
  value: string;
  fallback: string;
  palette: Record<string, string>;
  allowGradient?: boolean;
  onChange: (value: string) => void;
}) {
  const inputValue = getCardColorInputValue(value, palette, fallback);
  const gradientActive = value.trim() === 'gradient';

  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <DeferredColorInput
          value={inputValue}
          onChange={onChange}
          className="h-10 w-10 cursor-pointer rounded border border-slate-200 bg-white"
        />
        <PaletteTokenButtons
          selected={getPaletteButtonSelection(value)}
          palette={palette}
          onSelect={onChange}
        />
        {allowGradient && (
          <button
            type="button"
            onClick={() => onChange('gradient')}
            title="Use palette gradient wash"
            aria-pressed={gradientActive}
            className={`h-8 w-8 rounded-full border text-[10px] font-bold text-slate-900 shadow-sm transition-transform ${gradientActive ? 'scale-105 border-slate-900' : 'border-white'}`}
            style={{ background: getCardGradientPreview(palette) }}
          >
            G
          </button>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Default"
          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={() => onChange(fallback)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function CardShadowControl({
  shadowKind,
  settings,
  color,
  opacity,
  fallbackColor,
  palette,
  onChange,
}: {
  shadowKind?: CardSettings['shadow'];
  settings: CardShadowControlSettings;
  color: string;
  opacity: number;
  fallbackColor: string;
  palette: Record<string, string>;
  onChange: (patch: CardSettings) => void;
}) {
  const updateShadow = (patch: CardSettings) => {
    if (patch.shadowEnabled === true && !settings.shadowEnabled && shadowKind === 'none') {
      onChange({
        ...getCardShadowDefaults('soft'),
        shadow: 'soft',
        shadowEnabled: true,
      });
      return;
    }

    onChange(patch);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-700">Drop shadow</p>
          <p className="text-xs text-slate-500">Offset, blur, color, and opacity.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settings.shadowEnabled}
          onClick={() => updateShadow({ shadowEnabled: !settings.shadowEnabled })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${settings.shadowEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${settings.shadowEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>

      <div className={`space-y-4 ${settings.shadowEnabled ? '' : 'pointer-events-none opacity-50'}`}>
        <RangeControl label="Offset X" value={settings.shadowX} min={-80} max={80} suffix="px" onChange={(next) => updateShadow({ shadowX: next })} />
        <RangeControl label="Offset Y" value={settings.shadowY} min={-80} max={80} suffix="px" onChange={(next) => updateShadow({ shadowY: next })} />
        <RangeControl label="Blur" value={settings.shadowBlur} min={0} max={120} suffix="px" onChange={(next) => updateShadow({ shadowBlur: next })} />
        <InspectorSwitch
          label="Inset shadow"
          checked={settings.shadowInset}
          onChange={() => updateShadow({ shadowInset: !settings.shadowInset })}
        />
        <CardColorControl label="Shadow color" value={color} fallback={fallbackColor} palette={palette} onChange={(next) => updateShadow({ shadowColor: next })} />
        <RangeControl label="Shadow opacity" value={opacity} min={0} max={1} step={0.05} format={(next) => `${Math.round(next * 100)}%`} onChange={(next) => updateShadow({ shadowOpacity: next })} />
      </div>
    </div>
  );
}

function CardGradientControls({
  settings,
  palette,
  onChange,
}: {
  settings: CardSettings;
  palette: Record<string, string>;
  onChange: (patch: CardSettings) => void;
}) {
  const from = settings.gradientFrom || CARD_PRESET_RECIPES.gradient.gradientFrom;
  const to = settings.gradientTo || CARD_PRESET_RECIPES.gradient.gradientTo;
  const via = typeof settings.gradientVia === 'string' ? settings.gradientVia : CARD_PRESET_RECIPES.gradient.gradientVia;
  const angle = typeof settings.gradientAngle === 'number' ? settings.gradientAngle : CARD_PRESET_RECIPES.gradient.gradientAngle;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className={CARD_SUBSECTION_HEADING_CLASS}>Gradient colors</p>
      <div className="space-y-3">
        <GradientColorStopControl
          label="From"
          value={from}
          fallback={CARD_PRESET_RECIPES.gradient.gradientFrom}
          palette={palette}
          onChange={(next) => onChange({ gradientFrom: next })}
        />
        <GradientColorStopControl
          label="To"
          value={to}
          fallback={CARD_PRESET_RECIPES.gradient.gradientTo}
          palette={palette}
          onChange={(next) => onChange({ gradientTo: next })}
        />
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Mid stop (optional)</p>
          <div className="flex items-center gap-2">
            <DeferredColorInput
              value={getCardColorInputValue(via || CARD_PRESET_RECIPES.gradient.gradientVia, palette, '#ffffff')}
              onChange={(next) => onChange({ gradientVia: next })}
              className="h-9 w-9 cursor-pointer rounded border border-slate-200 bg-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!via}
            />
            {via && (
              <PaletteTokenButtons
                selected={getPaletteButtonSelection(via)}
                palette={palette}
                onSelect={(token) => onChange({ gradientVia: token })}
              />
            )}
            <button
              type="button"
              onClick={() => onChange({ gradientVia: via ? '' : CARD_PRESET_RECIPES.gradient.gradientVia })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {via ? 'Remove' : 'Add'}
            </button>
          </div>
        </div>
        <RangeControl label="Angle" value={angle} min={0} max={360} suffix="deg" onChange={(next) => onChange({ gradientAngle: next })} />
      </div>
    </div>
  );
}

function GradientColorStopControl({
  label,
  value,
  fallback,
  palette,
  onChange,
}: {
  label: string;
  value: string;
  fallback: string;
  palette: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="flex items-center gap-2">
        <DeferredColorInput
          value={getCardColorInputValue(value, palette, fallback)}
          onChange={onChange}
          className="h-9 w-9 cursor-pointer rounded border border-slate-200 bg-white"
        />
        <PaletteTokenButtons
          selected={getPaletteButtonSelection(value)}
          palette={palette}
          onSelect={onChange}
        />
      </div>
    </div>
  );
}

function InspectorSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="flex w-full items-center justify-between gap-4 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <span className={`relative h-5 w-10 shrink-0 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-200'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const display = format ? format(value) : `${value}${suffix}`;
  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}: {display}
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-blue-600"
      />
    </div>
  );
}

function NumberSliderControl({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const clamp = (next: number) => Math.min(max, Math.max(min, Number.isFinite(next) ? next : min));
  const commit = (next: number) => onChange(clamp(next));
  const display = format ? format(value) : `${value}${suffix}`;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
          {label}: {display}
        </label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(event) => commit(Number(event.target.value))}
            className="h-8 w-16 rounded-md border border-slate-200 px-2 text-right text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
          />
          {suffix && <span className="text-xs font-semibold text-slate-500">{suffix}</span>}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => commit(Number(event.target.value))}
        className="w-full accent-blue-600"
      />
    </div>
  );
}

function toOptions<T extends string>(values: readonly T[]): SelectOption<T>[] {
  return values.map((value) => ({
    value,
    label: titleCase(value),
  }));
}

function titleCase(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[\s_-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getPaletteButtonSelection(value: string): string {
  const normalized = value.trim();
  if (normalized === 'primary' || normalized === 'secondary' || normalized === 'accent') {
    return `palette:${normalized}`;
  }
  return normalized;
}

function getMergedShadowSettings(settings: CardSettings): CardShadowControlSettings {
  const defaults = getCardShadowDefaults(settings.shadow);
  return {
    shadowEnabled: typeof settings.shadowEnabled === 'boolean' ? settings.shadowEnabled : defaults.shadowEnabled,
    shadowX: typeof settings.shadowX === 'number' ? settings.shadowX : defaults.shadowX,
    shadowY: typeof settings.shadowY === 'number' ? settings.shadowY : defaults.shadowY,
    shadowBlur: typeof settings.shadowBlur === 'number' ? settings.shadowBlur : defaults.shadowBlur,
    shadowInset: typeof settings.shadowInset === 'boolean' ? settings.shadowInset : defaults.shadowInset,
  };
}

function getCardColorInputValue(value: string, palette: Record<string, string>, fallback: string): string {
  const resolved = resolveCardControlColor(value, palette) || resolveCardControlColor(fallback, palette) || '#ffffff';
  return normalizeInputHexColor(resolved) || '#ffffff';
}

function resolveCardControlColor(value: string, palette: Record<string, string>): string {
  const normalized = value.trim();
  if (!normalized) return '';

  if (normalized.startsWith('palette:')) {
    return resolveCardControlColor(normalized.slice('palette:'.length), palette);
  }

  if (normalized === 'primary') return palette.primary || '#111827';
  if (normalized === 'secondary') return palette.secondary || '#dc2626';
  if (normalized === 'accent') return palette.accent || '#f8fafc';
  if (normalized === 'neutral') return '#e5e7eb';
  if (normalized === 'white') return '#ffffff';
  if (normalized === 'transparent') return '#ffffff';
  if (normalized === 'gradient') return palette.accent || '#f8fafc';

  return normalized;
}

function getCardGradientPreview(palette: Record<string, string>): string {
  const secondary = palette.secondary || '#dc2626';
  const accent = palette.accent || '#f8fafc';
  return `linear-gradient(135deg, ${accent}, #ffffff 55%, ${secondary}33)`;
}

function normalizeInputHexColor(value: string): string | null {
  const trimmed = value.trim();
  const short = trimmed.match(/^#([0-9a-f]{3})$/i);
  if (short) {
    return `#${short[1].split('').map((part) => part + part).join('').toLowerCase()}`;
  }

  const full = trimmed.match(/^#([0-9a-f]{6})$/i);
  return full ? `#${full[1].toLowerCase()}` : null;
}

function hasCustomSettings(value: CardSettings | undefined): boolean {
  if (!value) return false;
  if (!value.presetId || value.presetId === 'custom') {
    return Object.keys(value).some((key) => key !== 'presetId');
  }

  const recipe = CARD_PRESET_RECIPES[value.presetId];
  return Object.entries(value).some(([key, settingValue]) => {
    if (key === 'presetId') return false;
    return recipe[key as keyof typeof recipe] !== settingValue;
  });
}
