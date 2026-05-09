'use client';

import { useCallback, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { resolvePaletteColor } from '@/lib/palette-colors';

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
}: {
    values: PretextDraftValues;
    palette: Record<string, string>;
    onChange: (key: string, value: string | boolean) => void;
}) {
    const enabled = Boolean(values.pretextEnabled);
    const style = String(values.pretextStyle ?? PRETEXT_DEFAULTS.pretextStyle);
    const color = String(values.pretextColor ?? PRETEXT_DEFAULTS.pretextColor);
    const align = String(values.pretextAlignment ?? PRETEXT_DEFAULTS.pretextAlignment);

    return (
        <div className="space-y-4">
            <InspectorToggle
                label="Show label"
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

export function getColorInputValue(value: string, palette: Record<string, string>, fallback: string): string {
    const resolved = resolvePaletteColor(value, palette, fallback);
    return /^#[0-9a-f]{6}$/i.test(resolved) ? resolved : fallback;
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
