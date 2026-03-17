'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Code, Lock, Crown } from 'lucide-react';

interface BlockSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    blockId: string;
    blockType: string;
    customCss: string;
    onSaveCustomCss: (css: string) => void;
    isProUser: boolean;
}

export default function BlockSettingsModal({
    isOpen,
    onClose,
    blockId,
    blockType,
    customCss,
    onSaveCustomCss,
    isProUser,
}: BlockSettingsModalProps) {
    const [localCss, setLocalCss] = useState(customCss);

    useEffect(() => {
        if (isOpen) {
            setLocalCss(customCss);
        }
    }, [isOpen, customCss]);

    if (!isOpen) return null;

    const handleSave = () => {
        onSaveCustomCss(localCss);
        onClose();
    };

    const modal = (
        <div
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                    <h2 className="text-lg font-bold text-slate-900">Block Settings</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Tab bar */}
                <div className="flex border-b border-slate-200 px-6">
                    <button
                        className="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 border-blue-600 text-blue-600 transition-colors"
                    >
                        <Code className="w-4 h-4" />
                        Custom CSS
                        {!isProUser && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isProUser ? (
                        <div className="space-y-4">
                            <div>
                                <p className="text-sm font-medium text-slate-700 mb-1">
                                    Custom CSS for this block
                                </p>
                                <p className="text-xs text-slate-500 mb-3">
                                    Styles are scoped to <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono">#{blockId}</code>.
                                    Use child selectors to target elements inside this block,
                                    e.g. <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono">h1 {'{'} color: red; {'}'}</code>
                                </p>
                                <p className="text-xs text-slate-500 mb-3">
                                    Block class: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono">.ks-block-{blockType}</code>
                                </p>
                            </div>
                            <textarea
                                value={localCss}
                                onChange={(e) => setLocalCss(e.target.value)}
                                placeholder={`/* Example: */\nh1 {\n  color: red;\n  font-size: 3rem;\n}\n\np {\n  line-height: 1.8;\n}`}
                                className="w-full bg-slate-950 text-green-400 font-mono text-sm p-4 min-h-[300px] outline-none border border-slate-700 rounded-lg resize-y selection:bg-green-900"
                                spellCheck={false}
                            />
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg transition-colors"
                                >
                                    Apply CSS
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Paywall for non-pro users */
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mb-4">
                                <Lock className="w-8 h-8 text-amber-500" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">
                                Custom CSS is a Pro Feature
                            </h3>
                            <p className="text-sm text-slate-500 max-w-sm mb-6">
                                Upgrade to Pro to add custom CSS to any block on your site.
                                Get full control over styling with scoped CSS that targets individual blocks.
                            </p>
                            <a
                                href="/pricing"
                                className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105"
                            >
                                <Crown className="w-5 h-5" />
                                Upgrade to Pro
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(modal, document.body);
}
