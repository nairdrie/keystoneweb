'use client';

import React, { useState, useEffect } from 'react';
import { X, Type, Search } from 'lucide-react';
import { createPortal } from 'react-dom';

const POPULAR_FONTS = [
    'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat',
    'Poppins', 'Source Sans Pro', 'Oswald', 'Raleway', 'Playfair Display',
    'Merriweather', 'Nunito', 'Rubik', 'Noto Sans', 'Work Sans',
    'Lora', 'Quicksand', 'PT Sans', 'Ubuntu', 'Mukta',
    'Nanum Gothic', 'Karla', 'Inconsolata', 'Fira Sans', 'Barlow',
    'Manrope', 'Hind', 'Cabin', 'Josefin Sans', 'Dosis'
];

interface TextStyles {
    fontFamily?: string;
    fontSize?: string; // e.g. '16px', '1.5rem', 'text-sm'
    color?: string;    // hex or 'red-500'
}

interface TextSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (styles: TextStyles) => void;
    initialStyles?: TextStyles;
    title?: string;
}

export default function TextSettingsModal({
    isOpen,
    onClose,
    onSave,
    initialStyles,
    title = "Text Settings"
}: TextSettingsModalProps) {
    const [styles, setStyles] = useState<TextStyles>(initialStyles || {});
    const [activeTab, setActiveTab] = useState<'font' | 'size' | 'color'>('font');
    const [searchQuery, setSearchQuery] = useState('');

    // Reset local state when opened with new initialStyles
    useEffect(() => {
        if (isOpen) {
            setStyles(initialStyles || {});
            setActiveTab('font');
        }
    }, [isOpen]); // Only sync when the modal opens

    if (!isOpen) return null;

    const handleSave = () => {
        // Only pass back styles that actually have values
        const cleanedStyles: TextStyles = {};
        if (styles.fontFamily) cleanedStyles.fontFamily = styles.fontFamily;
        if (styles.fontSize) cleanedStyles.fontSize = styles.fontSize;
        if (styles.color) cleanedStyles.color = styles.color;

        onSave(cleanedStyles);
        onClose();
    };

    const filteredFonts = POPULAR_FONTS.filter(font =>
        font.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const modal = (
        <div
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
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
                        className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'color' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                        onClick={() => setActiveTab('color')}
                    >
                        Color
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
                                    placeholder="Search 30+ fonts..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2 overflow-y-auto pr-1">
                                {filteredFonts.map((font) => (
                                    <button
                                        key={font}
                                        onClick={() => setStyles({ ...styles, fontFamily: font })}
                                        className={`text-left px-4 py-3 rounded-lg border transition-all ${styles.fontFamily === font
                                                ? 'bg-white border-red-500 shadow-[0_0_0_2px_rgba(239,68,68,0.2)]'
                                                : 'bg-white border-slate-200 hover:border-slate-400 hover:shadow-sm'
                                            }`}
                                    >
                                        <div className="text-xl mb-1 text-slate-900 truncate" style={{ fontFamily: `"${font}", sans-serif` }}>
                                            {font}
                                        </div>
                                        <div className="text-[10px] text-slate-500 uppercase tracking-wider font-sans">
                                            {font}
                                        </div>
                                    </button>
                                ))}
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
