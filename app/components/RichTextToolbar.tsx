'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    Bold, Italic, Underline, Strikethrough,
    Type, ALargeSmall, Weight, Palette, AlignLeft, AlignCenter, AlignRight, AlignJustify,
    Sparkles, Check, X, Search, Eraser, MoveHorizontal,
} from 'lucide-react';
import {
    DEFAULT_TEXT_SHADOW,
    type TextShadowSettings,
    type TextStyles,
    type TextAlignValue,
    POPULAR_FONTS,
    NEUTRAL_SWATCHES,
    textShadowToCss,
    FONT_SIZE_SLIDER,
    FONT_WEIGHT_SLIDER,
    LETTER_SPACING_SLIDER,
    LINE_HEIGHT_SLIDER,
    parseLengthPx,
    parseUnitless,
} from '@/lib/text-styles';

export type InlineCommand =
    | { kind: 'bold' }
    | { kind: 'italic' }
    | { kind: 'underline' }
    | { kind: 'strike' }
    | { kind: 'clear' }
    | { kind: 'color'; value: string }
    | { kind: 'fontFamily'; value: string }
    | { kind: 'fontSize'; value: string }
    | { kind: 'fontWeight'; value: string }
    | { kind: 'letterSpacing'; value: string }
    | { kind: 'lineHeight'; value: string };

interface RichTextToolbarProps {
    targetEl: HTMLElement | null;
    blockStyles: TextStyles;
    onBlockStylesChange: (next: TextStyles) => void;
    runCommand: (cmd: InlineCommand) => void;
    onSave: () => void;
    onCancel: () => void;
    palette?: { primary?: string; secondary?: string; accent?: string };
    previewText?: string;
}

type PopoverKey = 'font' | 'size' | 'weight' | 'color' | 'spacing' | 'shadow' | null;

export default function RichTextToolbar({
    targetEl,
    blockStyles,
    onBlockStylesChange,
    runCommand,
    onSave,
    onCancel,
    palette,
    previewText,
}: RichTextToolbarProps) {
    const toolbarRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ top: number; left: number; placement: 'above' | 'below' } | null>(null);
    const [openPopover, setOpenPopover] = useState<PopoverKey>(null);
    const [fontSearch, setFontSearch] = useState('');

    // Position the toolbar relative to the target element. Reserve room for
    // the popover panel above (when toolbar sits above the text) so opening
    // the popover doesn't push it under the viewport edge.
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

    // The popover should render on the OPPOSITE side of the toolbar from the
    // text, so it never sits between the user and the text they're styling.
    const popoverSide: 'top' | 'bottom' = pos.placement === 'above' ? 'top' : 'bottom';

    const fontSizePx = parseLengthPx(blockStyles.fontSize, FONT_SIZE_SLIDER.fallback);
    const fontWeightVal = clamp(
        parseUnitless(blockStyles.fontWeight, FONT_WEIGHT_SLIDER.fallback),
        FONT_WEIGHT_SLIDER.min,
        FONT_WEIGHT_SLIDER.max,
    );
    const letterSpacingPx = parseLengthPx(blockStyles.letterSpacing, LETTER_SPACING_SLIDER.fallback);
    const lineHeightVal = parseUnitless(blockStyles.lineHeight, LINE_HEIGHT_SLIDER.fallback);

    const popover = openPopover ? (
        <div
            className="rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 p-3 max-w-[min(95vw,480px)]"
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
                                    className={`text-left px-2.5 py-2 rounded-md border text-sm transition-all cursor-pointer ${
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
                        className="mt-2 text-[11px] font-semibold text-slate-500 hover:text-red-600 cursor-pointer"
                    >
                        Reset font
                    </button>
                </div>
            )}

            {openPopover === 'size' && (
                <div className="w-[280px]">
                    <StyleSlider
                        label="Font size"
                        value={fontSizePx}
                        min={FONT_SIZE_SLIDER.min}
                        max={FONT_SIZE_SLIDER.max}
                        step={FONT_SIZE_SLIDER.step}
                        display={(v) => `${roundTo(v, 0)}${FONT_SIZE_SLIDER.unit}`}
                        onChange={(v) => runCommand({ kind: 'fontSize', value: `${roundTo(v, 0)}${FONT_SIZE_SLIDER.unit}` })}
                        onReset={() => runCommand({ kind: 'fontSize', value: '' })}
                    />
                    <p className="mt-2 text-[10px] text-slate-500">
                        Drag to preview. Applies to current selection, or to the whole text when nothing is selected.
                    </p>
                </div>
            )}

            {openPopover === 'weight' && (
                <div className="w-[280px]">
                    <StyleSlider
                        label="Font weight"
                        value={fontWeightVal}
                        min={FONT_WEIGHT_SLIDER.min}
                        max={FONT_WEIGHT_SLIDER.max}
                        step={FONT_WEIGHT_SLIDER.step}
                        display={(v) => `${roundTo(v, 0)} · ${weightLabel(v)}`}
                        onChange={(v) => runCommand({ kind: 'fontWeight', value: String(roundTo(v, 0)) })}
                        onReset={() => runCommand({ kind: 'fontWeight', value: '' })}
                    />
                    <p className="mt-2 text-[10px] text-slate-500">
                        Choose any weight from Thin (100) to Black (900). For a quick standard bold use the Bold button.
                    </p>
                </div>
            )}

            {openPopover === 'spacing' && (
                <div className="w-[300px] space-y-4">
                    <StyleSlider
                        label="Letter spacing"
                        value={letterSpacingPx}
                        min={LETTER_SPACING_SLIDER.min}
                        max={LETTER_SPACING_SLIDER.max}
                        step={LETTER_SPACING_SLIDER.step}
                        display={(v) => `${roundTo(v, 1)}${LETTER_SPACING_SLIDER.unit}`}
                        onChange={(v) => runCommand({ kind: 'letterSpacing', value: `${roundTo(v, 1)}${LETTER_SPACING_SLIDER.unit}` })}
                        onReset={() => runCommand({ kind: 'letterSpacing', value: '' })}
                    />
                    <StyleSlider
                        label="Line height"
                        value={lineHeightVal}
                        min={LINE_HEIGHT_SLIDER.min}
                        max={LINE_HEIGHT_SLIDER.max}
                        step={LINE_HEIGHT_SLIDER.step}
                        display={(v) => roundTo(v, 2).toFixed(2)}
                        onChange={(v) => runCommand({ kind: 'lineHeight', value: String(roundTo(v, 2)) })}
                        onReset={() => runCommand({ kind: 'lineHeight', value: '' })}
                    />
                    <p className="text-[10px] text-slate-500">
                        Applies to current selection, or to the whole text when nothing is selected.
                    </p>
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
                                        className="flex-1 h-12 rounded-md border-2 border-slate-200 hover:border-slate-400 transition-all flex items-end justify-start p-1.5 cursor-pointer"
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
                                    className="w-7 h-7 rounded-full border-2 border-slate-200 hover:border-slate-400 transition-all cursor-pointer"
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
                        className="text-[11px] font-semibold text-slate-500 hover:text-red-600 cursor-pointer"
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
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${shadow.enabled ? 'bg-red-500' : 'bg-slate-300'}`}
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
        </div>
    ) : null;

    const toolbarBar = (
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

            {/* Font Weight (slider — extra levels beyond Bold toggle) */}
            <ToolbarBtn
                title="Custom font weight (Thin → Black)"
                active={openPopover === 'weight'}
                onClick={() => togglePopover('weight')}
            >
                <Weight className="w-4 h-4" />
            </ToolbarBtn>

            {/* Letter spacing & line height */}
            <ToolbarBtn
                title="Letter spacing & line height"
                active={openPopover === 'spacing'}
                onClick={() => togglePopover('spacing')}
            >
                <MoveHorizontal className="w-4 h-4" />
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
                className="px-3 py-1.5 inline-flex items-center gap-1 rounded-md bg-green-600 hover:bg-green-700 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
                title="Save (Ctrl+Enter)"
            >
                <Check className="w-3.5 h-3.5" /> Save
            </button>
            <button
                type="button"
                onMouseDown={preserveFocus}
                onClick={onCancel}
                className="px-3 py-1.5 inline-flex items-center gap-1 rounded-md bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                title="Cancel (Esc)"
            >
                <X className="w-3.5 h-3.5" /> Cancel
            </button>
        </div>
    );

    const toolbar = (
        <div
            ref={toolbarRef}
            className="fixed z-[10000] select-none"
            style={{ top: pos.top, left: pos.left }}
        >
            {toolbarBar}
            {popover && (
                <div
                    className={`absolute left-1/2 -translate-x-1/2 ${popoverSide === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}`}
                >
                    {popover}
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
            className={`inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors cursor-pointer ${
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
                className="w-full accent-red-500 cursor-pointer"
            />
        </div>
    );
}

// Generic slider used for the live-preview style controls (size / weight /
// letter spacing / line height). Calls onChange on every input tick so the
// underlying text updates as the user drags.
//
// Keeps internal state for the drag value: when the slider applies to a
// selection (rather than the block default) the parent `value` prop doesn't
// update mid-drag, so the thumb would otherwise snap back to the old value
// on each render.
function StyleSlider({
    label, value, min, max, step, display, onChange, onReset,
}: {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    display: (v: number) => string;
    onChange: (v: number) => void;
    onReset?: () => void;
}) {
    const [local, setLocal] = useState(value);
    useEffect(() => { setLocal(value); }, [value]);
    return (
        <div>
            <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold uppercase text-slate-600 tracking-wider">{label}</label>
                <span className="text-[11px] font-mono text-slate-700 tabular-nums">{display(local)}</span>
            </div>
            <div className="flex items-center gap-2">
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={local}
                    onChange={(e) => {
                        const v = Number(e.target.value);
                        setLocal(v);
                        onChange(v);
                    }}
                    className="flex-1 accent-red-500 cursor-pointer"
                />
                {onReset && (
                    <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={onReset}
                        className="px-2 py-1 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md cursor-pointer"
                        title={`Reset ${label.toLowerCase()}`}
                    >
                        Reset
                    </button>
                )}
            </div>
        </div>
    );
}

function clamp(n: number, lo: number, hi: number): number {
    if (n < lo) return lo;
    if (n > hi) return hi;
    return n;
}

function roundTo(n: number, decimals: number): number {
    const f = Math.pow(10, decimals);
    return Math.round(n * f) / f;
}

function weightLabel(n: number): string {
    if (n <= 150) return 'Thin';
    if (n <= 250) return 'Extra Light';
    if (n <= 350) return 'Light';
    if (n <= 450) return 'Regular';
    if (n <= 550) return 'Medium';
    if (n <= 650) return 'Semi Bold';
    if (n <= 750) return 'Bold';
    if (n <= 850) return 'Extra Bold';
    return 'Black';
}
