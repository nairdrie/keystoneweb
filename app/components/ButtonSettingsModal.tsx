'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Settings, Search, LucideIcon } from 'lucide-react';
import * as Icons from 'lucide-react';
import { createPortal } from 'react-dom';

// A subset of useful icons to keep the picker manageable
const ICON_NAMES = [
    'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown',
    'ChevronRight', 'ChevronLeft', 'ChevronUp', 'ChevronDown',
    'Plus', 'Minus', 'Check', 'X',
    'ExternalLink', 'Link', 'Download', 'Upload',
    'Mail', 'Phone', 'MapPin', 'Calendar',
    'User', 'Users', 'Search', 'Send',
    'Share2', 'Star', 'Heart', 'ThumbsUp',
    'ShoppingCart', 'CreditCard', 'Tag', 'Gift',
    'Play', 'Pause', 'Square', 'Circle',
    'Home', 'Settings', 'Info', 'HelpCircle',
    'AlertCircle', 'Bell', 'Camera', 'Image',
    'FileText', 'File', 'Folder', 'Archive',
    'Facebook', 'Instagram', 'Twitter', 'Linkedin', 'Youtube', 'Github'
];

export type ButtonShape = 'square' | 'rounded' | 'pill';
export type ButtonFill = 'filled' | 'outline' | 'ghost';

interface ButtonSettings {
    icon?: string;
    iconPosition?: 'left' | 'right';
    shape?: ButtonShape;
    fill?: ButtonFill;
    iconOnly?: boolean;
}

interface ButtonSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (settings: ButtonSettings) => void;
    initialSettings?: ButtonSettings;
    title?: string;
    defaultShape?: ButtonShape;
    defaultFill?: ButtonFill;
}

export default function ButtonSettingsModal({
    isOpen,
    onClose,
    onSave,
    initialSettings,
    title = "Button Settings",
    defaultShape = 'rounded',
    defaultFill = 'filled',
}: ButtonSettingsModalProps) {
    const mouseDownOnBackdrop = useRef(false);
    const [settings, setSettings] = useState<ButtonSettings>(initialSettings || {});
    const [activeTab, setActiveTab] = useState<'style' | 'icon' | 'layout'>('style');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (isOpen) {
            setSettings(initialSettings || {});
            setActiveTab('style');
        }
    }, [isOpen]); // Only sync when the modal opens

    const effectiveShape: ButtonShape = settings.shape || defaultShape;
    const effectiveFill: ButtonFill = settings.fill || defaultFill;

    if (!isOpen) return null;

    const handleSave = () => {
        onSave(settings);
        onClose();
    };

    const filteredIcons = ICON_NAMES.filter(name =>
        name.toLowerCase().includes(searchQuery.toLowerCase())
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
                        <Settings className="w-5 h-5 text-red-600" />
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
                        className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'style' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                        onClick={() => setActiveTab('style')}
                    >
                        Button Style
                    </button>
                    <button
                        className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'icon' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                        onClick={() => setActiveTab('icon')}
                    >
                        Icon Selection
                    </button>
                    <button
                        className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'layout' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                        onClick={() => setActiveTab('layout')}
                    >
                        Icon Position
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto max-h-[50vh] min-h-[350px] p-4 bg-slate-50/50">

                    {/* STYLE TAB */}
                    {activeTab === 'style' && (
                        <div className="space-y-6 py-2">
                            <div className="space-y-3">
                                <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Shape</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {([
                                        { key: 'square', label: 'Square', radiusClass: 'rounded-none' },
                                        { key: 'rounded', label: 'Rounded', radiusClass: 'rounded-lg' },
                                        { key: 'pill', label: 'Pill', radiusClass: 'rounded-full' },
                                    ] as { key: ButtonShape; label: string; radiusClass: string }[]).map(opt => {
                                        const isSelected = effectiveShape === opt.key;
                                        return (
                                            <button
                                                key={opt.key}
                                                onClick={() => setSettings({ ...settings, shape: opt.key })}
                                                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all ${isSelected
                                                        ? 'bg-white border-red-500 shadow-[0_0_0_2px_rgba(239,68,68,0.2)]'
                                                        : 'bg-white border-slate-200 hover:border-slate-400'
                                                    }`}
                                            >
                                                <div className={`w-16 h-7 bg-slate-800 ${opt.radiusClass}`} />
                                                <span className="font-semibold text-xs text-slate-700">{opt.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Fill</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {([
                                        { key: 'filled', label: 'Filled', preview: 'bg-slate-800 text-white' },
                                        { key: 'outline', label: 'Outline', preview: 'bg-transparent text-slate-800 border-2 border-slate-800' },
                                        { key: 'ghost', label: 'Ghost', preview: 'bg-transparent text-slate-800' },
                                    ] as { key: ButtonFill; label: string; preview: string }[]).map(opt => {
                                        const isSelected = effectiveFill === opt.key;
                                        const previewRadius = effectiveShape === 'pill' ? 'rounded-full' : effectiveShape === 'square' ? 'rounded-none' : 'rounded-lg';
                                        return (
                                            <button
                                                key={opt.key}
                                                onClick={() => setSettings({ ...settings, fill: opt.key })}
                                                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all ${isSelected
                                                        ? 'bg-white border-red-500 shadow-[0_0_0_2px_rgba(239,68,68,0.2)]'
                                                        : 'bg-white border-slate-200 hover:border-slate-400'
                                                    }`}
                                            >
                                                <div className={`px-4 py-1.5 text-xs font-bold ${opt.preview} ${previewRadius}`}>
                                                    Button
                                                </div>
                                                <span className="font-semibold text-xs text-slate-700">{opt.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ICON TAB */}
                    {activeTab === 'icon' && (
                        <div className="flex flex-col h-full space-y-3">
                            <div className="relative mb-2">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search icons..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                                />
                            </div>

                            <div className="grid grid-cols-4 gap-2 overflow-y-auto pr-1">
                                <button
                                    onClick={() => setSettings({ ...settings, icon: undefined })}
                                    className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${!settings.icon
                                            ? 'bg-white border-red-500 shadow-[0_0_0_2px_rgba(239,68,68,0.2)]'
                                            : 'bg-white border-slate-200 hover:border-slate-400 hover:shadow-sm'
                                        }`}
                                >
                                    <div className="w-6 h-6 border-2 border-dashed border-slate-300 rounded mb-1" />
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">None</span>
                                </button>

                                {filteredIcons.map((name) => {
                                    const IconComponent = (Icons as any)[name] as LucideIcon;
                                    return (
                                        <button
                                            key={name}
                                            onClick={() => setSettings({ ...settings, icon: name })}
                                            className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${settings.icon === name
                                                    ? 'bg-white border-red-500 shadow-[0_0_0_2px_rgba(239,68,68,0.2)]'
                                                    : 'bg-white border-slate-200 hover:border-slate-400 hover:shadow-sm'
                                                }`}
                                        >
                                            {IconComponent && <IconComponent className="w-6 h-6 mb-1 text-slate-700" />}
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight truncate w-full text-center">
                                                {name}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* LAYOUT TAB */}
                    {activeTab === 'layout' && (
                        <div className="space-y-6 py-4">
                            <div className="space-y-3">
                                <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Placement</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => setSettings({ ...settings, iconPosition: 'left' })}
                                        disabled={settings.iconOnly}
                                        className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${settings.iconOnly ? 'opacity-40 cursor-not-allowed bg-white border-slate-200' : (settings.iconPosition === 'left' || !settings.iconPosition
                                                ? 'bg-white border-red-500 shadow-[0_0_0_2px_rgba(239,68,68,0.2)]'
                                                : 'bg-white border-slate-200 hover:border-slate-400')
                                            }`}
                                    >
                                        <div className="w-10 h-6 bg-slate-100 rounded flex items-center px-1 gap-1">
                                            <div className="w-2 h-2 rounded-full bg-red-500" />
                                            <div className="w-5 h-1.5 rounded bg-slate-300" />
                                        </div>
                                        <div className="text-left">
                                            <div className="font-bold text-sm">Left Side</div>
                                            <div className="text-[10px] text-slate-500">Icon before text</div>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => setSettings({ ...settings, iconPosition: 'right' })}
                                        disabled={settings.iconOnly}
                                        className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${settings.iconOnly ? 'opacity-40 cursor-not-allowed bg-white border-slate-200' : (settings.iconPosition === 'right'
                                                ? 'bg-white border-red-500 shadow-[0_0_0_2px_rgba(239,68,68,0.2)]'
                                                : 'bg-white border-slate-200 hover:border-slate-400')
                                            }`}
                                    >
                                        <div className="w-10 h-6 bg-slate-100 rounded flex items-center px-1 gap-1 justify-end">
                                            <div className="w-5 h-1.5 rounded bg-slate-300" />
                                            <div className="w-2 h-2 rounded-full bg-red-500" />
                                        </div>
                                        <div className="text-left">
                                            <div className="font-bold text-sm">Right Side</div>
                                            <div className="text-[10px] text-slate-500">Icon after text</div>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3 pt-2 border-t border-slate-200">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <label className="text-sm font-bold text-slate-800">Icon Only</label>
                                        <p className="text-[11px] text-slate-500 mt-0.5">Hide the text label and show just the icon</p>
                                    </div>
                                    <button
                                        onClick={() => setSettings({ ...settings, iconOnly: !settings.iconOnly })}
                                        disabled={!settings.icon}
                                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${!settings.icon ? 'bg-slate-200 opacity-50 cursor-not-allowed' : settings.iconOnly ? 'bg-red-500' : 'bg-slate-200'}`}
                                    >
                                        <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${settings.iconOnly ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                                {!settings.icon && (
                                    <p className="text-[11px] text-amber-600">Choose an icon in the Icon tab first.</p>
                                )}
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
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );

    if (typeof document === 'undefined') return null;
    return createPortal(modal, document.body);
}
