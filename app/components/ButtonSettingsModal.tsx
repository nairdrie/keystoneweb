'use client';

import React, { useState, useEffect } from 'react';
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

interface ButtonSettings {
    icon?: string;
    iconPosition?: 'left' | 'right';
}

interface ButtonSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (settings: ButtonSettings) => void;
    initialSettings?: ButtonSettings;
    title?: string;
}

export default function ButtonSettingsModal({
    isOpen,
    onClose,
    onSave,
    initialSettings,
    title = "Button Settings"
}: ButtonSettingsModalProps) {
    const [settings, setSettings] = useState<ButtonSettings>(initialSettings || {});
    const [activeTab, setActiveTab] = useState<'icon' | 'layout'>('icon');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (isOpen) {
            setSettings(initialSettings || {});
            setActiveTab('icon');
        }
    }, [isOpen]); // Only sync when the modal opens

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
            onClick={onClose}
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
                                        className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${settings.iconPosition === 'left' || !settings.iconPosition
                                                ? 'bg-white border-red-500 shadow-[0_0_0_2px_rgba(239,68,68,0.2)]'
                                                : 'bg-white border-slate-200 hover:border-slate-400'
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
                                        className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${settings.iconPosition === 'right'
                                                ? 'bg-white border-red-500 shadow-[0_0_0_2px_rgba(239,68,68,0.2)]'
                                                : 'bg-white border-slate-200 hover:border-slate-400'
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
                        Save Settings
                    </button>
                </div>
            </div>
        </div>
    );

    if (typeof document === 'undefined') return null;
    return createPortal(modal, document.body);
}
