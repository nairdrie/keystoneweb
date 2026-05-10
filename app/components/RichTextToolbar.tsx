'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    Bold, Italic, Underline, Strikethrough,
    Type, ALargeSmall, Weight, Palette, AlignLeft, AlignCenter, AlignRight, AlignJustify,
    Sparkles, Check, X, Search, Eraser, Wand2,
} from 'lucide-react';
import {
    DEFAULT_TEXT_SHADOW,
    type TextShadowSettings,
    type TextStyles,
    type TextAlignValue,
    POPULAR_FONTS,
    FONT_SIZE_PRESETS,
    FONT_WEIGHT_PRESETS,
    NEUTRAL_SWATCHES,
    textShadowToCss,
} from '@/lib/text-styles';
import {
    DEFAULT_TEXT_REVEAL,
    TEXT_REVEAL_LABELS,
    type TextRevealConfig,
    type TextRevealEffect,
} from '@/lib/animations';

export type InlineCommand =
    | { kind: 'bold' }
    | { kind: 'italic' }
    | { kind: 'underline' }
    | { kind: 'strike' }
    | { kind: 'clear' }
    | { kind: 'color'; value: string }
    | { kind: 'fontFamily'; value: string }
    | { kind: 'fontSize'; value: string }
    | { kind: 'fontWeight'; value: string };

interface RichTextToolbarProps {
    targetEl: HTMLElement | null;
    blockStyles: TextStyles;
    onBlockStylesChange: (next: TextStyles) => void;
    runCommand: (cmd: InlineCommand) => void;
    onSave: () => void;
    onCancel: () => void;
    palette?: { primary?: string; secondary?: string; accent?: string };
    previewText?: string;
    /** Optional per-text reveal animation config + setter. When omitted, the Reveal button is hidden. */
    textReveal?: TextRevealConfig | null;
    onTextRevealChange?: (next: TextRevealConfig | null) => void;
}

type PopoverKey = 'font' | 'size' | 'weight' | 'color' | 'shadow' | 'reveal' | null;

export default function RichTextToolbar({
    targetEl,
    blockStyles,
    onBlockStylesChange,
    runCommand,
    onSave,
    onCancel,
    palette,
    previewText,
    textReveal,
    onTextRevealChange,
}: RichTextToolbarProps) {
    const toolbarRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ top: number; left: number; placement: 'above' | 'below' } | null>(null);
    const [openPopover, setOpenPopover] = useState<PopoverKey>(null);
    const [fontSearch, setFontSearch] = useState('');

    // Position the toolbar relative to the target element
    useLayoutEffect(() => {
        if (!targetEl) return;
        const update = () => {
            const r = targetEl.getBoundingClientRect();
            const tb = toolbarRef.current;
            const tbHeight = tb?.offsetHeight ?? 56;
            const tbWidth = tb?.offsetWidth ?? 480;
            const gap = 8;
            const above = r.top - gap - tbHeight;
            const placement: 'above' | 'below' = above >= 8 ? 'above' : 'below';
            const top = placement === 'above' ? above : Math.min(window.innerHeight - tbHeight - 8, r.bottom + gap);
            const rawLeft = r.left + (r.width / 2) - (tbWidth / 2);
            const left = Math.max(8, Math.min(rawLeft, window.innerWidth - tbWidth - 8));
            setPos({ top, left, placement });
        };
        update();
        const handleScroll = () => update();
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', update);
        const ro = new ResizeObserver(update);
        ro.observe(targetEl);
        return () => {
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', update);
            ro.disconnect();
        };
    }, [targetEl]);

    // Close popovers when clicking outside the toolbar (but allow clicks inside the editable target)
    useEffect(() => {
        if (!openPopover) return;
        const handler = (e: MouseEvent) => {
            const t = e.target as Node;
            if (toolbarRef.current?.contains(t)) return;
            if (targetEl?.contains(t)) return;
            setOpenPopover(null);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [openPopover, targetEl]);

    // Preload Google fonts for the picker preview
    useEffect(() => {
        const linkId = 'rt-toolbar-font-preview';
        if (document.getElementById(linkId)) return;
        const families = POPULAR_FONTS.map(f => `family=${f.replace(/ /g, '+')}`).join('&');
        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
        document.head.appendChild(link);
    }, []);

    const filteredFonts = useMemo(
        () => POPULAR_FONTS.filter(f => f.toLowerCase().includes(fontSearch.toLowerCase())),
        [fontSearch]
    );

    if (typeof document === 'undefined' || !pos) return null;

    const togglePopover = (k: Exclude<PopoverKey, null>) => setOpenPopover(prev => (prev === k ? null : k));

    const setShadow = (patch: Partial<TextShadowSettings>) => {
        const current = blockStyles.textShadow ?? { ...DEFAULT_TEXT_SHADOW, enabled: false };
        onBlockStylesChange({ ...blockStyles, textShadow: { ...current, ...patch } });
    };

    const setAlign = (v: TextAlignValue | undefined) => {
        onBlockStylesChange({ ...blockStyles, textAlign: v });
    };

    // Helper that prevents focus loss from the editable while still triggering on click
    const preserveFocus = (e: React.MouseEvent) => e.preventDefault();

    const paletteSwatches: Array<{ label: string; color: string }> = [];
    if (palette?.primary) paletteSwatches.push({ label: 'Primary', color: palette.primary });
    if (palette?.secondary) paletteSwatches.push({ label: 'Secondary', color: palette.secondary });
    if (palette?.accent) paletteSwatches.push({ label: 'Accent', color: palette.accent });

    const toolbar = (
        <div
            ref={toolbarRef}
            className="fixed z-[10000] select-none"
            style={{ top: pos.top, left: pos.left }}
            onMouseDown={preserveFocus}
        >
            <div className="flex items-stretch gap-1 px-2 py-1.5 rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20">
                {/* Format toggles */}
                <ToolbarBtn title="Bold (Ctrl+B)" onClick={() => runCommand({ kind: 'bold' })}>
                    <Bold className="w-4 h-4" />
                </ToolbarBtn>
                <ToolbarBtn title="Italic (Ctrl+I)" onClick={() => runCommand({ kind: 'italic' })}>
                    <Italic className="w-4 h-4" />
                </ToolbarBtn>
                <ToolbarBtn title="Underline (Ctrl+U)" onClick={() => runCommand({ kind: 'underline' })}>
                    <Underline className="w-4 h-4" />
                </ToolbarBtn>
                <ToolbarBtn title="Strikethrough" onClick={() => runCommand({ kind: 'strike' })}>
                    <Strikethrough className="w-4 h-4" />
                </ToolbarBtn>

                <Divider />

                {/* Font Family */}
                <ToolbarBtn
                    title="Font Family"
                    active={openPopover === 'font'}
                    onClick={() => togglePopover('font')}
                >
                    <Type className="w-4 h-4" />
                </ToolbarBtn>

                {/* Font Size */}
                <ToolbarBtn
                    title="Font Size"
                    active={openPopover === 'size'}
                    onClick={() => togglePopover('size')}
                >
                    <ALargeSmall className="w-4 h-4" />
                </ToolbarBtn>

                {/* Font Weight */}
                <ToolbarBtn
                    title="Font Weight"
                    active={openPopover === 'weight'}
                    onClick={() => togglePopover('weight')}
                >
                    <Weight className="w-4 h-4" />
                </ToolbarBtn>

                {/* Color */}
                <ToolbarBtn
                    title="Text Color"
                    active={openPopover === 'color'}
                    onClick={() => togglePopover('color')}
                >
                    <span className="relative inline-flex flex-col items-center justify-center">
                        <Palette className="w-4 h-4" />
                        <span
                            className="block w-3.5 h-1 rounded-sm mt-0.5 border border-slate-300"
                            style={{ backgroundColor: blockStyles.color || '#0f172a' }}
                        />
                    </span>
                </ToolbarBtn>

                <Divider />

                {/* Alignment */}
                <ToolbarBtn
                    title="Align Left"
                    active={blockStyles.textAlign === 'left'}
                    onClick={() => setAlign(blockStyles.textAlign === 'left' ? undefined : 'left')}
                >
                    <AlignLeft className="w-4 h-4" />
                </ToolbarBtn>
                <ToolbarBtn
                    title="Align Center"
                    active={blockStyles.textAlign === 'center'}
                    onClick={() => setAlign(blockStyles.textAlign === 'center' ? undefined : 'center')}
                >
                    <AlignCenter className="w-4 h-4" />
                </ToolbarBtn>
                <ToolbarBtn
                    title="Align Right"
                    active={blockStyles.textAlign === 'right'}
                    onClick={() => setAlign(blockStyles.textAlign === 'right' ? undefined : 'right')}
                >
                    <AlignRight className="w-4 h-4" />
                </ToolbarBtn>
                <ToolbarBtn
                    title="Justify"
                    active={blockStyles.textAlign === 'justify'}
                    onClick={() => setAlign(blockStyles.textAlign === 'justify' ? undefined : 'justify')}
                >
                    <AlignJustify className="w-4 h-4" />
                </ToolbarBtn>

                {/* Shadow */}
                <ToolbarBtn
                    title="Text Shadow"
                    active={openPopover === 'shadow' || !!blockStyles.textShadow?.enabled}
                    onClick={() => togglePopover('shadow')}
                >
                    <Sparkles className="w-4 h-4" />
                </ToolbarBtn>

                {/* Reveal animation */}
                {onTextRevealChange && (
                    <ToolbarBtn
                        title="Reveal animation"
                        active={openPopover === 'reveal' || (!!textReveal && textReveal.effect !== 'none')}
                        onClick={() => togglePopover('reveal')}
                    >
                        <Wand2 className="w-4 h-4" />
                    </ToolbarBtn>
                )}

                <Divider />

                {/* Clear formatting */}
                <ToolbarBtn title="Clear Inline Formatting" onClick={() => runCommand({ kind: 'clear' })}>
                    <Eraser className="w-4 h-4" />
                </ToolbarBtn>

                <Divider />

                {/* Save / Cancel */}
                <button
                    type="button"
                    onMouseDown={preserveFocus}
                    onClick={onSave}
                    className="px-3 py-1.5 inline-flex items-center gap-1 rounded-md bg-green-600 hover:bg-green-700 text-white text-xs font-bold shadow-sm transition-colors"
                    title="Save (Ctrl+Enter)"
                >
                    <Check className="w-3.5 h-3.5" /> Save
                </button>
                <button
                    type="button"
                    onMouseDown={preserveFocus}
                    onClick={onCancel}
                    className="px-3 py-1.5 inline-flex items-center gap-1 rounded-md bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors"
                    title="Cancel (Esc)"
                >
                    <X className="w-3.5 h-3.5" /> Cancel
                </button>
            </div>

            {/* Popover panels */}
            {openPopover && (
                <div
                    className="mt-1.5 rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 p-3 max-w-[480px]"
                    onMouseDown={preserveFocus}
                >
                    {openPopover === 'font' && (
                        <div className="w-[420px] max-w-[80vw]">
                            <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-2">Font Family</p>
                            <div className="relative mb-2">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search fonts..."
                                    value={fontSearch}
                                    onChange={(e) => setFontSearch(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-red-500"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-1.5 max-h-[260px] overflow-y-auto pr-1">
                                {filteredFonts.map(font => {
                                    const preview = previewText?.trim() || font;
                                    const active = blockStyles.fontFamily === font;
                                    return (
                                        <button
                                            key={font}
                                            onMouseDown={preserveFocus}
                                            onClick={() => runCommand({ kind: 'fontFamily', value: font })}
                                            className={`text-left px-2.5 py-2 rounded-md border text-sm transition-all ${
                                                active
                                                    ? 'bg-red-50 border-red-500'
                                                    : 'bg-white border-slate-200 hover:border-slate-400'
                                            }`}
                                            style={{ fontFamily: `"${font}", sans-serif` }}
                                            title={font}
                                        >
                                            <span className="line-clamp-1">{preview}</span>
                                            <span className="block text-[9px] text-slate-400 font-sans mt-0.5">{font}</span>
                                        </button>
                                    );
                                })}
                                {filteredFonts.length === 0 && (
                                    <div className="col-span-2 py-6 text-center text-xs text-slate-500">
                                        No fonts match &ldquo;{fontSearch}&rdquo;.
                                    </div>
                                )}
                            </div>
                            <button
                                onMouseDown={preserveFocus}
                                onClick={() => runCommand({ kind: 'fontFamily', value: '' })}
                                className="mt-2 text-[11px] font-semibold text-slate-500 hover:text-red-600"
                            >
                                Reset font
                            </button>
                        </div>
                    )}

                    {openPopover === 'size' && (
                        <div className="w-[280px]">
                            <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-2">Font Size</p>
                            <div className="flex gap-1.5 mb-2">
                                <input
                                    type="text"
                                    value={blockStyles.fontSize || ''}
                                    onChange={(e) => onBlockStylesChange({ ...blockStyles, fontSize: e.target.value || undefined })}
                                    placeholder="e.g. 1.5rem, 24px"
                                    className="flex-1 px-2.5 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-red-500"
                                />
                                <button
                                    onMouseDown={preserveFocus}
                                    onClick={() => onBlockStylesChange({ ...blockStyles, fontSize: undefined })}
                                    className="px-2.5 py-1.5 text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md"
                                >
                                    Reset
                                </button>
                            </div>
                            <div className="grid grid-cols-4 gap-1.5">
                                {FONT_SIZE_PRESETS.map(p => {
                                    const isBlock = blockStyles.fontSize === p.val;
                                    return (
                                        <button
                                            key={p.val}
                                            onMouseDown={preserveFocus}
                                            onClick={() => runCommand({ kind: 'fontSize', value: p.val })}
                                            className={`px-2 py-1.5 text-xs font-bold rounded-md border transition-all ${
                                                isBlock
                                                    ? 'bg-red-50 border-red-500 text-red-900'
                                                    : 'bg-white border-slate-200 hover:border-slate-400 text-slate-700'
                                            }`}
                                            title={p.val}
                                        >
                                            {p.label}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="mt-2 text-[10px] text-slate-500">Applies to selection if any, otherwise the default size.</p>
                        </div>
                    )}

                    {openPopover === 'weight' && (
                        <div className="w-[280px]">
                            <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-2">Font Weight</p>
                            <div className="grid grid-cols-3 gap-1.5">
                                {FONT_WEIGHT_PRESETS.map(w => {
                                    const isBlock = blockStyles.fontWeight === w.value;
                                    return (
                                        <button
                                            key={w.value}
                                            onMouseDown={preserveFocus}
                                            onClick={() => runCommand({ kind: 'fontWeight', value: w.value })}
                                            className={`px-2 py-2 rounded-md border text-xs transition-all ${
                                                isBlock
                                                    ? 'bg-red-50 border-red-500 text-red-900'
                                                    : 'bg-white border-slate-200 hover:border-slate-400 text-slate-700'
                                            }`}
                                            style={{ fontWeight: w.value }}
                                            title={`${w.label} (${w.value})`}
                                        >
                                            {w.label}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="mt-2 text-[10px] text-slate-500">Applies to selection if any, otherwise the default weight.</p>
                        </div>
                    )}

                    {openPopover === 'color' && (
                        <div className="w-[300px]">
                            <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-2">Text Color</p>

                            {paletteSwatches.length > 0 && (
                                <div className="mb-3">
                                    <p className="text-[10px] font-semibold text-slate-500 mb-1.5">Site palette</p>
                                    <div className="flex gap-1.5">
                                        {paletteSwatches.map(s => (
                                            <button
                                                key={s.label}
                                                onMouseDown={preserveFocus}
                                                onClick={() => runCommand({ kind: 'color', value: s.color })}
                                                className="flex-1 h-12 rounded-md border-2 border-slate-200 hover:border-slate-400 transition-all flex items-end justify-start p-1.5"
                                                style={{ backgroundColor: s.color }}
                                                title={`${s.label} (${s.color})`}
                                            >
                                                <span className="text-[9px] font-bold text-white drop-shadow uppercase tracking-wider">
                                                    {s.label}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="mb-3">
                                <p className="text-[10px] font-semibold text-slate-500 mb-1.5">Neutrals</p>
                                <div className="flex gap-1 flex-wrap">
                                    {NEUTRAL_SWATCHES.map(c => (
                                        <button
                                            key={c}
                                            onMouseDown={preserveFocus}
                                            onClick={() => runCommand({ kind: 'color', value: c })}
                                            className="w-7 h-7 rounded-full border-2 border-slate-200 hover:border-slate-400 transition-all"
                                            style={{ backgroundColor: c }}
                                            title={c}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="mb-2">
                                <p className="text-[10px] font-semibold text-slate-500 mb-1.5">Custom</p>
                                <div className="flex gap-1.5">
                                    <input
                                        type="color"
                                        value={blockStyles.color || '#000000'}
                                        onChange={(e) => runCommand({ kind: 'color', value: e.target.value })}
                                        className="w-10 h-9 rounded-md border border-slate-300 cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={blockStyles.color || ''}
                                        onChange={(e) => onBlockStylesChange({ ...blockStyles, color: e.target.value || undefined })}
                                        placeholder="#000000"
                                        className="flex-1 px-2.5 py-1.5 text-sm border border-slate-300 rounded-md font-mono focus:outline-none focus:border-red-500"
                                    />
                                </div>
                            </div>

                            <button
                                onMouseDown={preserveFocus}
                                onClick={() => runCommand({ kind: 'color', value: '' })}
                                className="text-[11px] font-semibold text-slate-500 hover:text-red-600"
                            >
                                Reset color
                            </button>
                        </div>
                    )}

                    {openPopover === 'shadow' && (() => {
                        const shadow = blockStyles.textShadow ?? { ...DEFAULT_TEXT_SHADOW, enabled: false };
                        return (
                            <div className="w-[320px] space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Drop Shadow</p>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={shadow.enabled}
                                        onMouseDown={preserveFocus}
                                        onClick={() =>
                                            setShadow(shadow.enabled
                                                ? { enabled: false }
                                                : { ...DEFAULT_TEXT_SHADOW, enabled: true })
                                        }
                                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${shadow.enabled ? 'bg-red-500' : 'bg-slate-300'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${shadow.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                    </button>
                                </div>

                                <div
                                    className="rounded-md border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-3 text-center text-2xl font-bold text-slate-900"
                                    style={{ textShadow: textShadowToCss(shadow), opacity: shadow.enabled ? 1 : 0.4 }}
                                >
                                    {previewText?.trim()?.slice(0, 24) || 'Preview'}
                                </div>

                                <div className={`space-y-2.5 ${shadow.enabled ? '' : 'opacity-50 pointer-events-none'}`}>
                                    <ShadowSlider label="Offset X" value={shadow.x} min={-20} max={20} onChange={x => setShadow({ x })} unit="px" />
                                    <ShadowSlider label="Offset Y" value={shadow.y} min={-20} max={20} onChange={y => setShadow({ y })} unit="px" />
                                    <ShadowSlider label="Blur" value={shadow.blur} min={0} max={40} onChange={blur => setShadow({ blur })} unit="px" />
                                    <div className="flex items-center gap-2">
                                        <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider w-14 shrink-0">Color</label>
                                        <input
                                            type="color"
                                            value={(shadow.color.startsWith('#') ? shadow.color : '#000000')}
                                            onChange={(e) => setShadow({ color: e.target.value })}
                                            className="w-9 h-8 rounded border border-slate-300 cursor-pointer"
                                        />
                                        <input
                                            type="text"
                                            value={shadow.color}
                                            onChange={(e) => setShadow({ color: e.target.value })}
                                            className="flex-1 px-2 py-1 text-xs font-mono border border-slate-300 rounded focus:outline-none focus:border-red-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {openPopover === 'reveal' && onTextRevealChange && (
                        <RevealPopover
                            value={textReveal ?? null}
                            onChange={onTextRevealChange}
                        />
                    )}
                </div>
            )}
        </div>
    );

    return createPortal(toolbar, document.body);
}

function ToolbarBtn({
    children,
    onClick,
    title,
    active,
}: {
    children: React.ReactNode;
    onClick: () => void;
    title: string;
    active?: boolean;
}) {
    return (
        <button
            type="button"
            title={title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
            className={`inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
                active
                    ? 'bg-red-100 text-red-700'
                    : 'text-slate-700 hover:bg-slate-100'
            }`}
        >
            {children}
        </button>
    );
}

function Divider() {
    return <span className="self-stretch w-px bg-slate-200 mx-0.5" />;
}

function ShadowSlider({
    label, value, min, max, onChange, unit,
}: {
    label: string; value: number; min: number; max: number; onChange: (v: number) => void; unit: string;
}) {
    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">{label}</label>
                <span className="text-[10px] font-mono text-slate-600">{value}{unit}</span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={1}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full accent-red-500"
            />
        </div>
    );
}

const REVEAL_EFFECTS: TextRevealEffect[] = ['none', 'typewriter', 'word', 'letter-fade'];

const REVEAL_DEFAULT_SPEED: Record<Exclude<TextRevealEffect, 'none'>, number> = {
    typewriter: 25,
    word: 4,
    'letter-fade': 30,
};

const REVEAL_SPEED_LABEL: Record<Exclude<TextRevealEffect, 'none'>, string> = {
    typewriter: 'chars/sec',
    word: 'words/sec',
    'letter-fade': 'letters/sec',
};

function RevealPopover({
    value,
    onChange,
}: {
    value: TextRevealConfig | null;
    onChange: (next: TextRevealConfig | null) => void;
}) {
    const preserveFocus = (e: React.MouseEvent) => e.preventDefault();
    const current = value ?? { ...DEFAULT_TEXT_REVEAL };
    const effect = current.effect;
    const speed = current.speed > 0 ? current.speed : (effect !== 'none' ? REVEAL_DEFAULT_SPEED[effect] : 0);

    const setEffect = (next: TextRevealEffect) => {
        if (next === 'none') {
            onChange(null);
            return;
        }
        onChange({
            effect: next,
            speed: REVEAL_DEFAULT_SPEED[next],
            delayMs: current.delayMs,
        });
    };

    const setSpeed = (n: number) => {
        if (effect === 'none') return;
        onChange({ ...current, speed: n });
    };

    return (
        <div className="w-[300px] space-y-3">
            <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Reveal animation</p>
            <div className="grid grid-cols-2 gap-1.5">
                {REVEAL_EFFECTS.map((opt) => {
                    const active = effect === opt;
                    return (
                        <button
                            key={opt}
                            type="button"
                            onMouseDown={preserveFocus}
                            onClick={() => setEffect(opt)}
                            aria-pressed={active}
                            className={`rounded-md border px-2.5 py-2 text-left text-xs font-bold transition-all ${
                                active
                                    ? 'bg-red-50 border-red-500 text-red-900'
                                    : 'bg-white border-slate-200 hover:border-slate-400 text-slate-700'
                            }`}
                        >
                            {TEXT_REVEAL_LABELS[opt]}
                        </button>
                    );
                })}
            </div>

            {effect !== 'none' && (
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Speed</label>
                        <span className="text-[10px] font-mono text-slate-600">{Math.round(speed)} {REVEAL_SPEED_LABEL[effect]}</span>
                    </div>
                    <input
                        type="range"
                        min={effect === 'word' ? 1 : 4}
                        max={effect === 'word' ? 12 : 80}
                        step={1}
                        value={speed}
                        onChange={(e) => setSpeed(Number(e.target.value))}
                        className="w-full accent-red-500"
                    />
                </div>
            )}

            <p className="text-[10px] text-slate-500 leading-snug">
                Plays once when this text scrolls into view. Other elements can chain after it via the block&apos;s Animation settings.
            </p>
        </div>
    );
}
