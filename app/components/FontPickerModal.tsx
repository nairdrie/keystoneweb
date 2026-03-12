'use client';
import React, { useState } from 'react';
import { Search, X, Type } from 'lucide-react';
import { createPortal } from 'react-dom';

const POPULAR_FONTS = [
    'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat',
    'Poppins', 'Source Sans Pro', 'Oswald', 'Raleway', 'Playfair Display',
    'Merriweather', 'Nunito', 'Rubik', 'Noto Sans', 'Work Sans',
    'Lora', 'Quicksand', 'PT Sans', 'Ubuntu', 'Mukta',
    'Nanum Gothic', 'Karla', 'Inconsolata', 'Fira Sans', 'Barlow',
    'Manrope', 'Hind', 'Cabin', 'Josefin Sans', 'Dosis'
];

interface FontPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (fontName: string) => void;
    currentFont?: string;
    title: string;
}

export default function FontPickerModal({
    isOpen,
    onClose,
    onSelect,
    currentFont,
    title
}: FontPickerModalProps) {
    const [searchQuery, setSearchQuery] = useState('');

    if (!isOpen) return null;

    const filteredFonts = POPULAR_FONTS.filter(font =>
        font.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const modal = (
        <div
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

            <div
                className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                    <h2 className="text-lg font-bold text-slate-900">{title}</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <div className="p-4 border-b border-slate-200">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search fonts..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {filteredFonts.map((font) => (
                        <button
                            key={font}
                            onClick={() => {
                                onSelect(font);
                                onClose();
                            }}
                            className={`w-full text-left px-4 py-3 rounded-lg flex flex-col mb-1 transition-colors ${currentFont === font
                                ? 'bg-red-50 text-red-900 border border-red-100'
                                : 'hover:bg-slate-100 text-slate-700 border border-transparent'
                                }`}
                        >
                            <span className="text-xl" style={{ fontFamily: `"${font}", sans-serif` }}>
                                {font}
                            </span>
                            <span className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-sans">
                                {font}
                            </span>
                        </button>
                    ))}
                    {filteredFonts.length === 0 && (
                        <div className="py-8 text-center text-slate-500">
                            <Type className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                            <p>No fonts found for "{searchQuery}"</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    if (typeof document === 'undefined') return null;
    return createPortal(modal, document.body);
}
