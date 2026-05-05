'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Type, Search, Sparkles } from 'lucide-react';
import { createPortal } from 'react-dom';

export interface TextShadowSettings {
    enabled: boolean;
    x: number;
    y: number;
    blur: number;
    color: string;
}

export const DEFAULT_TEXT_SHADOW: TextShadowSettings = {
    enabled: true,
    x: 0,
    y: 2,
    blur: 8,
    color: 'rgba(0,0,0,0.35)',
};

export function textShadowToCss(s?: TextShadowSettings | null): string | undefined {
    if (!s || !s.enabled) return undefined;
    return `${s.x}px ${s.y}px ${s.blur}px ${s.color}`;
}

const POPULAR_FONTS = [
    // Modern sans-serifs
    'Inter', 'Roboto', 'Poppins', 'Montserrat', 'Raleway',
    'Nunito', 'DM Sans', 'Plus Jakarta Sans', 'Space Grotesk', 'Barlow',
    // Bold & condensed display
    'Oswald', 'Bebas Neue', 'Anton', 'Fjalla One', 'Teko',
    'Righteous', 'Russo One', 'Exo 2', 'Alfa Slab One', 'Ultra',
    // Serif & editorial
    'Abril Fatface', 'Playfair Display', 'Merriweather', 'Lora', 'Cormorant Garamond',
    'Libre Baskerville', 'Bitter', 'EB Garamond', 'Spectral', 'Crimson Text',
    // Playful & expressive
    'Pacifico', 'Fredoka One', 'Baloo 2', 'Comfortaa', 'Lilita One',
    'Permanent Marker', 'Caveat', 'Patrick Hand', 'Varela Round', 'Boogaloo',
    // Script & flowing
    'Dancing Script', 'Lobster', 'Sacramento', 'Great Vibes', 'Satisfy',
    'Cookie', 'Yellowtail', 'Allura', 'Alex Brush', 'Parisienne',
];

interface TextStyles {
    fontFamily?: string;
    fontSize?: string; // e.g. '16px', '1.5rem', 'text-sm'
    color?: string;    // hex or 'red-500'
    fontWeight?: string; // e.g. '400', '700'
    textShadow?: TextShadowSettings;
}

interface TextSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (styles: TextStyles) => void;
    initialStyles?: TextStyles;
    title?: string;
    previewText?: string;
}

export default function TextSettingsModal({
    isOpen,
    onClose,
    onSave,
    initialStyles,
    title = "Text Settings",
    previewText,
}: TextSettingsModalProps) {
    const mouseDownOnBackdrop = useRef(false);
    const [styles, setStyles] = useState<TextStyles>(initialStyles || {});
    const [activeTab, setActiveTab] = useState<'font' | 'size' | 'weight' | 'color' | 'shadow'>('font');
    const [searchQuery, setSearchQuery] = useState('');

    // Reset local state when opened with new initialStyles
    useEffect(() => {
        if (isOpen) {
            setStyles(initialStyles || {});
            setActiveTab('font');
        }
    }, [isOpen]); // Only sync when the modal opens

    // Preload all fonts when the modal opens so previews render correctly
    useEffect(() => {
        if (!isOpen) return;
        const linkId = 'font-picker-preview-styles';
        if (document.getElementById(linkId)) return;
        const families = POPULAR_FONTS.map(f => `family=${f.replace(/ /g, '+')}`).join('&');
        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
        document.head.appendChild(link);
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        // Only pass back styles that actually have values
        const cleanedStyles: TextStyles = {};
        if (styles.fontFamily) cleanedStyles.fontFamily = styles.fontFamily;
        if (styles.fontSize) cleanedStyles.fontSize = styles.fontSize;
        if (styles.color) cleanedStyles.color = styles.color;
        if (styles.fontWeight) cleanedStyles.fontWeight = styles.fontWeight;
        if (styles.textShadow && styles.textShadow.enabled) cleanedStyles.textShadow = styles.textShadow;

        onSave(cleanedStyles);
        onClose();
    };

    const filteredFonts = POPULAR_FONTS.filter(font =>
        font.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const modal = (
        <div
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onMouseDown={(e) => { mouseDownOnBackdrop.current = e.target === e.currentTarget; }}
            onClick={() => { if (mouseDownOnBackdrop.current) onClose(); }}
        >
            <div
                className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Type className="w-5 h-5 text-red-600" />
                        {title}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500 hover:text-slate-900"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex px-4 pt-2 border-b border-slate-200">
                    <button
                        className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'font' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                        onClick={() => setActiveTab('font')}
                    >
                        Font Family
                    </button>
                    <button
                        className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'size' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                        onClick={() => setActiveTab('size')}
                    >
                        Size Range
                    </button>
                    <button
                        className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'weight' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                        onClick={() => setActiveTab('weight')}
                    >
                        Weight
                    </button>
                    <button
                        className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'color' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                        onClick={() => setActiveTab('color')}
                    >
                        Color
                    </button>
                    <button
                        className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'shadow' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                        onClick={() => setActiveTab('shadow')}
                    >
                        Shadow
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto max-h-[50vh] min-h-[300px] p-4 bg-slate-50/50">

                    {/* FONT TAB */}
                    {activeTab === 'font' && (
                        <div className="flex flex-col h-full space-y-3">
                            {styles.fontFamily && (
                                <div className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-lg mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-red-800 uppercase tracking-widest">Active:</span>
                                        <span className="font-semibold text-red-900" style={{ fontFamily: `"${styles.fontFamily}", sans-serif` }}>{styles.fontFamily}</span>
                                    </div>
                                    <button
                                        onClick={() => setStyles({ ...styles, fontFamily: undefined })}
                                        className="text-xs font-bold text-red-600 hover:text-red-800 hover:underline"
                                    >
                                        Reset to Default
                                    </button>
                                </div>
                            )}

                            <div className="relative mb-2">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search 50+ fonts..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2 overflow-y-auto pr-1">
                                {filteredFonts.map((font) => {
                                    const preview = previewText?.trim() || font;
                                    return (
                                    <button
                                        key={font}
                                        onClick={() => setStyles({ ...styles, fontFamily: font })}
                                        className={`text-left px-4 py-3 rounded-lg border transition-all ${styles.fontFamily === font
                                                ? 'bg-white border-red-500 shadow-[0_0_0_2px_rgba(239,68,68,0.2)]'
                                                : 'bg-white border-slate-200 hover:border-slate-400 hover:shadow-sm'
                                            }`}
                                    >
                                        <div className="text-lg mb-1.5 text-slate-900 leading-snug line-clamp-2" style={{ fontFamily: `"${font}", sans-serif` }}>
                                            {preview}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-sans">
                                            {font}
                                        </div>
                                    </button>
                                    );
                                })}
                                {filteredFonts.length === 0 && (
                                    <div className="col-span-2 py-8 text-center text-slate-500">
                                        <Type className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                        <p>No fonts found for "{searchQuery}"</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* SIZE TAB */}
                    {activeTab === 'size' && (
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Custom Size</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={styles.fontSize || ''}
                                        onChange={(e) => setStyles({ ...styles, fontSize: e.target.value })}
                                        placeholder="e.g. 2rem, 32px, 1.5em"
                                        className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                                    />
                                    <button
                                        onClick={() => setStyles({ ...styles, fontSize: undefined })}
                                        className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition-colors text-sm"
                                    >
                                        Reset
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-500 ml-1">Leave empty to use the component's default responsive size.</p>
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Quick Presets</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { label: 'Extra Small', val: '0.75rem', tailwind: 'text-xs' },
                                        { label: 'Small', val: '0.875rem', tailwind: 'text-sm' },
                                        { label: 'Base / P', val: '1rem', tailwind: 'text-base' },
                                        { label: 'Large (H4)', val: '1.25rem', tailwind: 'text-lg' },
                                        { label: 'X-Large (H3)', val: '1.5rem', tailwind: 'text-xl' },
                                        { label: '2X-Large (H2)', val: '2rem', tailwind: 'text-2xl' },
                                        { label: '4X-Large (H1)', val: '3rem', tailwind: 'text-4xl' },
                                        { label: 'Hero (Display)', val: '5rem', tailwind: 'text-7xl' },
                                    ].map(preset => (
                                        <button
                                            key={preset.val}
                                            onClick={() => setStyles({ ...styles, fontSize: preset.val })}
                                            className={`flex flex-col text-left px-4 py-3 rounded-lg border transition-all ${styles.fontSize === preset.val
                                                    ? 'bg-red-50 border-red-500 text-red-900 shadow-[0_0_0_2px_rgba(239,68,68,0.2)]'
                                                    : 'bg-white border-slate-200 hover:border-slate-400 hover:shadow-sm text-slate-700'
                                                }`}
                                        >
                                            <span className="font-bold text-sm mb-1">{preset.label}</span>
                                            <span className="text-[10px] text-slate-500 font-mono bg-white inline-block px-1.5 py-0.5 rounded border border-slate-100">{preset.val}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* WEIGHT TAB */}
                    {activeTab === 'weight' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { label: 'Thin', value: '100' },
                                    { label: 'Extra Light', value: '200' },
                                    { label: 'Light', value: '300' },
                                    { label: 'Regular', value: '400' },
                                    { label: 'Medium', value: '500' },
                                    { label: 'Semi Bold', value: '600' },
                                    { label: 'Bold', value: '700' },
                                    { label: 'Extra Bold', value: '800' },
                                    { label: 'Black', value: '900' },
                                ].map(w => (
                                    <button
                                        key={w.value}
                                        onClick={() => setStyles({ ...styles, fontWeight: styles.fontWeight === w.value ? undefined : w.value })}
                                        className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${styles.fontWeight === w.value
                                            ? 'bg-red-50 border-red-500 text-red-900 shadow-[0_0_0_2px_rgba(239,68,68,0.2)]'
                                            : 'bg-white border-slate-200 hover:border-slate-400 hover:shadow-sm text-slate-700'
                                        }`}
                                    >
                                        <span className="text-sm" style={{ fontWeight: w.value }}>{w.label}</span>
                                        <span className="text-[10px] text-slate-400 font-mono">{w.value}</span>
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] text-slate-500">Click the active weight again to reset to default.</p>
                        </div>
                    )}

                    {/* COLOR TAB */}
                    {activeTab === 'color' && (
                        <div className="space-y-6">

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Hex Color</label>
                                <div className="flex gap-3">
                                    <div className="w-12 h-12 rounded-lg border border-slate-300 shadow-sm overflow-hidden shrink-0 relative">
                                        <input
                                            type="color"
                                            value={styles.color || '#000000'}
                                            onChange={(e) => setStyles({ ...styles, color: e.target.value })}
                                            className="absolute -inset-2 w-[150%] h-[150%] cursor-pointer border-0"
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        value={styles.color || ''}
                                        onChange={(e) => setStyles({ ...styles, color: e.target.value })}
                                        placeholder="e.g. #ff0000 or rgba(0,0,0,0.5)"
                                        className="flex-1 px-4 border border-slate-300 rounded-lg focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 font-mono text-sm"
                                    />
                                    <button
                                        onClick={() => setStyles({ ...styles, color: undefined })}
                                        className="px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition-colors text-sm"
                                    >
                                        Reset
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-500 ml-1">Overrides the template palette temporarily.</p>
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Popular Neutrals</label>
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        '#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1',
                                        '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a', '#000000'
                                    ].map(c => (
                                        <button
                                            key={c}
                                            onClick={() => setStyles({ ...styles, color: c })}
                                            className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 ${styles.color === c ? 'border-red-500 scale-110 shadow-md' : 'border-slate-200'}`}
                                            style={{ backgroundColor: c }}
                                            title={c}
                                        />
                                    ))}
                                </div>
                            </div>

                        </div>
                    )}

                    {/* SHADOW TAB */}
                    {activeTab === 'shadow' && (() => {
                        const shadow = styles.textShadow ?? { ...DEFAULT_TEXT_SHADOW, enabled: false };
                        const update = (patch: Partial<TextShadowSettings>) =>
                            setStyles({ ...styles, textShadow: { ...shadow, ...patch } });
                        const previewShadow = textShadowToCss(shadow);
                        return (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <Sparkles className="w-5 h-5 text-red-500" />
                                        <div>
                                            <p className="text-sm font-bold text-slate-900">Drop Shadow</p>
                                            <p className="text-[11px] text-slate-500">Adds depth behind the text.</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={shadow.enabled}
                                        onClick={() => update(shadow.enabled
                                            ? { enabled: false }
                                            : { ...DEFAULT_TEXT_SHADOW, enabled: true })}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${shadow.enabled ? 'bg-red-500' : 'bg-slate-300'}`}
                                    >
                                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${shadow.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                    </button>
                                </div>

                                <div
                                    className="rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 px-6 py-8 text-center"
                                    style={{ opacity: shadow.enabled ? 1 : 0.4 }}
                                >
                                    <span
                                        className="text-3xl font-bold text-slate-900"
                                        style={{ textShadow: previewShadow }}
                                    >
                                        {previewText?.trim() || 'Preview'}
                                    </span>
                                </div>

                                <div className={`space-y-5 transition-opacity ${shadow.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Offset X</label>
                                            <span className="text-[11px] font-mono text-slate-600">{shadow.x}px</span>
                                        </div>
                                        <input
                                            type="range"
                                            min={-20}
                                            max={20}
                                            step={1}
                                            value={shadow.x}
                                            onChange={(e) => update({ x: Number(e.target.value) })}
                                            className="w-full accent-red-500"
                                        />
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Offset Y</label>
                                            <span className="text-[11px] font-mono text-slate-600">{shadow.y}px</span>
                                        </div>
                                        <input
                                            type="range"
                                            min={-20}
                                            max={20}
                                            step={1}
                                            value={shadow.y}
                                            onChange={(e) => update({ y: Number(e.target.value) })}
                                            className="w-full accent-red-500"
                                        />
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Blur</label>
                                            <span className="text-[11px] font-mono text-slate-600">{shadow.blur}px</span>
                                        </div>
                                        <input
                                            type="range"
                                            min={0}
                                            max={40}
                                            step={1}
                                            value={shadow.blur}
                                            onChange={(e) => update({ blur: Number(e.target.value) })}
                                            className="w-full accent-red-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5 block">Shadow Color</label>
                                        <div className="flex gap-3">
                                            <div className="w-12 h-12 rounded-lg border border-slate-300 shadow-sm overflow-hidden shrink-0 relative">
                                                <input
                                                    type="color"
                                                    value={(shadow.color.startsWith('#') ? shadow.color : '#000000')}
                                                    onChange={(e) => update({ color: e.target.value })}
                                                    className="absolute -inset-2 w-[150%] h-[150%] cursor-pointer border-0"
                                                />
                                            </div>
                                            <input
                                                type="text"
                                                value={shadow.color}
                                                onChange={(e) => update({ color: e.target.value })}
                                                placeholder="#000000 or rgba(0,0,0,0.35)"
                                                className="flex-1 px-4 border border-slate-300 rounded-lg focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 font-mono text-sm"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Presets</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {[
                                                { label: 'Subtle', val: { x: 0, y: 2, blur: 8, color: 'rgba(0,0,0,0.35)' } },
                                                { label: 'Soft Glow', val: { x: 0, y: 0, blur: 16, color: 'rgba(0,0,0,0.45)' } },
                                                { label: 'Bold Lift', val: { x: 0, y: 6, blur: 14, color: 'rgba(0,0,0,0.5)' } },
                                                { label: 'Retro', val: { x: 3, y: 3, blur: 0, color: 'rgba(0,0,0,1)' } },
                                            ].map(preset => {
                                                const isActive = shadow.enabled
                                                    && shadow.x === preset.val.x
                                                    && shadow.y === preset.val.y
                                                    && shadow.blur === preset.val.blur
                                                    && shadow.color === preset.val.color;
                                                return (
                                                    <button
                                                        key={preset.label}
                                                        onClick={() => update({ enabled: true, ...preset.val })}
                                                        className={`flex flex-col text-left px-4 py-3 rounded-lg border transition-all ${isActive
                                                            ? 'bg-red-50 border-red-500 shadow-[0_0_0_2px_rgba(239,68,68,0.2)]'
                                                            : 'bg-white border-slate-200 hover:border-slate-400 hover:shadow-sm'
                                                        }`}
                                                    >
                                                        <span
                                                            className="text-base font-bold text-slate-900"
                                                            style={{ textShadow: textShadowToCss({ enabled: true, ...preset.val }) }}
                                                        >
                                                            {preset.label}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-md hover:shadow-lg transition-all"
                    >
                        Apply Component Styles
                    </button>
                </div>
            </div>
        </div>
    );

    if (typeof document === 'undefined') return null;
    return createPortal(modal, document.body);
}
