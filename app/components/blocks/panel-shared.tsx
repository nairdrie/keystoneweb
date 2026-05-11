'use client';

import { useCallback, useState } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { resolvePaletteColor } from '@/lib/palette-colors';
import { useEditorContext } from '@/lib/editor-context';

export const BLOCK_INSPECTOR_STATE_EVENT = 'ks:block-inspector-state';

// ─── Pretext (block label) shared config ─────────────────────────────────────
// Block types that render <BlockPretext /> above their primary heading.
// Adding a block here enables the Label section in its settings panel.
export const PRETEXT_BLOCKS = new Set<string>([
    'aboutImageText',
    'cta',
    'featuresList',
    'servicesGrid',
    'stats',
    'testimonials',
    'faq',
    'gallery',
    'team',
    'pricing',
    'carousel',
    'resources',
    'contact',
    'deliveryLinks',
    'timeline',
]);

export const PRETEXT_DEFAULTS = {
    pretextEnabled: false,
    pretextStyle: 'text',
    pretextColor: 'palette:secondary',
    pretextAlignment: 'left',
} as const;

export const PRETEXT_DRAFT_KEYS = ['pretextEnabled', 'pretextStyle', 'pretextColor', 'pretextAlignment'] as const;

const PRETEXT_STYLE_OPTIONS: Array<{ value: string; label: string; description?: string }> = [
    { value: 'text', label: 'Text', description: 'Tracked uppercase eyebrow.' },
    { value: 'pill', label: 'Pill', description: 'Filled rounded badge.' },
    { value: 'outline', label: 'Outline', description: 'Bordered pill.' },
    { value: 'underline', label: 'Underline', description: 'Underlined text.' },
];

const PRETEXT_ALIGN_OPTIONS: Array<{ value: string; label: string }> = [
    { value: 'left', label: 'Left' },
    { value: 'center', label: 'Center' },
];

const PRETEXT_COLOR_TOKENS: Array<{ value: string; label: string; paletteKey: string; title: string }> = [
    { value: 'palette:primary', label: 'P', paletteKey: 'primary', title: 'Use palette primary' },
    { value: 'palette:secondary', label: 'S', paletteKey: 'secondary', title: 'Use palette secondary' },
    { value: 'palette:accent', label: 'A', paletteKey: 'accent', title: 'Use palette accent' },
];

export type PretextDraftValues = {
    pretextEnabled?: boolean | string | number;
    pretextStyle?: string;
    pretextColor?: string;
    pretextAlignment?: string;
};

export function readPretextFromBlockData(blockData: Record<string, unknown> | undefined): {
    pretextEnabled: boolean;
    pretextStyle: string;
    pretextColor: string;
    pretextAlignment: string;
} {
    const data = blockData || {};
    return {
        pretextEnabled: data.pretextEnabled === undefined || data.pretextEnabled === null
            ? PRETEXT_DEFAULTS.pretextEnabled
            : Boolean(data.pretextEnabled),
        pretextStyle: typeof data.pretextStyle === 'string' && data.pretextStyle ? data.pretextStyle : PRETEXT_DEFAULTS.pretextStyle,
        pretextColor: typeof data.pretextColor === 'string' && data.pretextColor ? data.pretextColor : PRETEXT_DEFAULTS.pretextColor,
        pretextAlignment: typeof data.pretextAlignment === 'string' && data.pretextAlignment ? data.pretextAlignment : PRETEXT_DEFAULTS.pretextAlignment,
    };
}

export function PretextControls({
    values,
    palette,
    onChange,
    labelName = 'label',
}: {
    values: PretextDraftValues;
    palette: Record<string, string>;
    onChange: (key: string, value: string | boolean) => void;
    labelName?: string;
}) {
    const enabled = Boolean(values.pretextEnabled);
    const style = String(values.pretextStyle ?? PRETEXT_DEFAULTS.pretextStyle);
    const color = String(values.pretextColor ?? PRETEXT_DEFAULTS.pretextColor);
    const align = String(values.pretextAlignment ?? PRETEXT_DEFAULTS.pretextAlignment);

    return (
        <div className="space-y-4">
            <InspectorToggle
                label={`Show ${labelName}`}
                description="Small text shown above the heading."
                checked={enabled}
                onChange={() => onChange('pretextEnabled', !enabled)}
            />

            {enabled && (
                <>
                    <div>
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Style</p>
                        <div className="grid grid-cols-2 gap-2">
                            {PRETEXT_STYLE_OPTIONS.map((option) => {
                                const active = style === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => onChange('pretextStyle', option.value)}
                                        aria-pressed={active}
                                        className={`rounded-xl border px-3 py-2.5 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                            active
                                                ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                                                : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                        }`}
                                    >
                                        <span className="block text-sm font-bold">{option.label}</span>
                                        {option.description && (
                                            <span className="mt-0.5 block text-xs leading-snug text-slate-500">{option.description}</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Color</p>
                        <div className="flex items-center gap-1">
                            {PRETEXT_COLOR_TOKENS.map(({ value, label, paletteKey, title }) => {
                                const active = color === value;
                                return (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => onChange('pretextColor', value)}
                                        title={title}
                                        className={`w-8 h-8 rounded-full border text-[10px] font-bold shadow-sm transition-transform ${active ? 'border-slate-900 scale-105' : 'border-white'}`}
                                        style={{
                                            backgroundColor: palette[paletteKey] || '#ffffff',
                                            color: paletteKey === 'accent' ? (palette.primary || '#0f172a') : '#ffffff',
                                        }}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Alignment</p>
                        <div className="grid grid-cols-2 gap-2">
                            {PRETEXT_ALIGN_OPTIONS.map((option) => {
                                const active = align === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => onChange('pretextAlignment', option.value)}
                                        aria-pressed={active}
                                        className={`rounded-xl border px-3 py-2.5 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                            active
                                                ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                                                : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                        }`}
                                    >
                                        <span className="block text-sm font-bold">{option.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export type BlockInspectorStateDetail = {
    open: boolean;
    blockType?: string;
    blockId?: string;
};

export function dispatchBlockInspectorState(detail: BlockInspectorStateDetail): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent<BlockInspectorStateDetail>(BLOCK_INSPECTOR_STATE_EVENT, { detail }));
}

export function InspectorSection({
    id,
    title,
    children,
    isCollapsed,
    onToggle,
}: {
    id: string;
    title: string;
    children: React.ReactNode;
    isCollapsed: boolean;
    onToggle: () => void;
}) {
    const contentId = `${id}-inspector-content`;

    return (
        <section className="border-b border-slate-100 pb-5 last:border-b-0 last:pb-0">
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={!isCollapsed}
                aria-controls={contentId}
                className="flex w-full items-center justify-between gap-3 rounded-lg py-1 text-left transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h3>
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isCollapsed ? '-rotate-90' : 'rotate-0'}`} />
            </button>
            {!isCollapsed && (
                <div id={contentId} className="mt-3">
                    {children}
                </div>
            )}
        </section>
    );
}

export function InspectorToggle({
    label,
    description,
    checked,
    onChange,
}: {
    label: string;
    description?: string;
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
            <span className="flex flex-col">
                <span className="text-sm font-medium text-slate-700">{label}</span>
                {description && <span className="text-xs text-slate-500">{description}</span>}
            </span>
            <span className={`relative h-5 w-10 shrink-0 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-200'}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
            </span>
        </button>
    );
}

export function PaletteTokenButtons({ selected, palette, onSelect }: {
    selected: string;
    palette: Record<string, string>;
    onSelect: (token: string) => void;
}) {
    const tokens = [
        { key: 'primary', label: 'P', title: 'Use palette primary' },
        { key: 'secondary', label: 'S', title: 'Use palette secondary' },
        { key: 'accent', label: 'A', title: 'Use palette accent' },
    ];

    return (
        <div className="flex items-center gap-1">
            {tokens.map(({ key, label, title }) => {
                const token = `palette:${key}`;
                const active = selected === token;
                return (
                    <button
                        key={key}
                        type="button"
                        onClick={() => onSelect(token)}
                        className={`w-8 h-8 rounded-full border text-[10px] font-bold shadow-sm transition-transform ${active ? 'border-slate-900 scale-105' : 'border-white'}`}
                        style={{ backgroundColor: palette[key] || '#ffffff', color: key === 'accent' ? (palette.primary || '#0f172a') : '#ffffff' }}
                        title={title}
                    >
                        {label}
                    </button>
                );
            })}
        </div>
    );
}

const DEFAULT_PALETTE_COLOR_FALLBACKS: Record<string, string> = {
    primary: '#1f2937',
    secondary: '#dc2626',
    accent: '#f3f4f6',
};

export function getColorInputValue(value: string, palette: Record<string, string>, fallback: string): string {
    const safeFallback = getColorInputFallback(fallback, palette);
    const resolved = resolvePaletteColor(value, palette, safeFallback);
    return normalizeInputHexColor(resolved) || safeFallback;
}

export function SideBySideBackgroundOverrideNotice() {
    const override = useEditorContext()?.sideBySideBackgroundOverride;

    if (!override?.enabled) return null;

    return (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div className="min-w-0">
                    <p className="font-bold">Background color is being overridden</p>
                    <p className="mt-1 leading-relaxed">
                        The parent Side by Side block is replacing this inner block background.
                    </p>
                    <button
                        type="button"
                        onClick={override.disable}
                        className="mt-2 rounded-md border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                        Turn off override
                    </button>
                </div>
            </div>
        </div>
    );
}

function getColorInputFallback(fallback: string, palette: Record<string, string>): string {
    const resolved = resolvePaletteColor(fallback, palette, '');
    const normalizedResolved = normalizeInputHexColor(resolved);
    if (normalizedResolved) return normalizedResolved;

    if (fallback.startsWith('palette:')) {
        const key = fallback.slice('palette:'.length);
        return normalizeInputHexColor(palette[key] || DEFAULT_PALETTE_COLOR_FALLBACKS[key] || '') || '#ffffff';
    }

    return normalizeInputHexColor(fallback) || '#ffffff';
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

export function useInspectorSectionState(sectionIds: string[], defaultCollapsed: boolean = true) {
    const [collapsed, setCollapsed] = useState<Set<string>>(() =>
        defaultCollapsed ? new Set(sectionIds) : new Set()
    );

    const toggle = useCallback((id: string) => {
        setCollapsed((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const allCollapsed = sectionIds.every(id => collapsed.has(id));

    const setAll = useCallback((shouldCollapse: boolean) => {
        setCollapsed(shouldCollapse ? new Set(sectionIds) : new Set());
    }, [sectionIds]);

    const reset = useCallback(() => {
        setCollapsed(defaultCollapsed ? new Set(sectionIds) : new Set());
    }, [sectionIds, defaultCollapsed]);

    return { collapsed, toggle, allCollapsed, setAll, reset, isCollapsed: (id: string) => collapsed.has(id) };
}
