'use client';

import { useState } from 'react';
import { BlockData, useEditorContext } from '@/lib/editor-context';
import { Lock, Crown } from 'lucide-react';
import DOMPurify from 'isomorphic-dompurify';

export default function CustomHTMLBlock({ block, palette }: { block: BlockData, palette: Record<string, string> }) {
    const context = useEditorContext();
    const isEditMode = context?.isEditMode || false;
    const isProUser = context?.isProUser || false;

    const htmlContent = block.data.html !== undefined ? block.data.html : '<div class="p-8 text-center border-2 border-dashed border-gray-300 rounded-lg my-8"><h2 class="text-2xl font-bold mb-2">Custom HTML Block</h2><p class="text-gray-500">Edit me to inject your own HTML and CSS.</p></div>';

    const [localHtml, setLocalHtml] = useState(htmlContent);
    const [isEditing, setIsEditing] = useState(false);

    // Configure DOMPurify to allow safe layout tags but block scripts/event handlers entirely
    const safeHTML = DOMPurify.sanitize(htmlContent, {
        ADD_TAGS: ['style', 'iframe'],
        ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling']
    });

    const handleSave = () => {
        setIsEditing(false);
        context?.updateBlockData?.(block.id, 'html', localHtml);
    };

    if (!isEditMode) {
        return <div dangerouslySetInnerHTML={{ __html: safeHTML }} />;
    }

    // Paywall for non-pro users in edit mode
    if (!isProUser) {
        return (
            <div className="relative w-full">
                <div className="relative group">
                    {/* Blurred preview */}
                    <div className="opacity-30 blur-[2px] pointer-events-none" dangerouslySetInnerHTML={{ __html: safeHTML }} />
                    {/* Paywall overlay */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-sm mx-4">
                            <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
                                <Lock className="w-7 h-7 text-amber-500" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">
                                Custom HTML is a Pro Feature
                            </h3>
                            <p className="text-sm text-slate-500 mb-5">
                                Upgrade to Pro to embed custom HTML, CSS, and third-party widgets.
                            </p>
                            <a
                                href="/pricing"
                                className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 text-sm"
                            >
                                <Crown className="w-4 h-4" />
                                Upgrade to Pro
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative w-full">
            {isEditing ? (
                <div className="w-full bg-slate-900 rounded-lg shadow-inner flex flex-col overflow-hidden my-4 border border-slate-700">
                    <div className="bg-slate-800 text-slate-300 px-4 py-3 text-xs font-mono uppercase tracking-wider flex justify-between items-center border-b border-slate-700">
                        <span>Edit Custom HTML (DOMPurify Sanitized)</span>
                        <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 font-bold rounded shadow-sm transition-colors">Save</button>
                    </div>
                    <textarea
                        value={localHtml}
                        onChange={(e) => setLocalHtml(e.target.value)}
                        className="w-full bg-slate-950 text-green-400 font-mono text-sm p-6 min-h-[400px] outline-none border-none resize-y selection:bg-green-900"
                        spellCheck={false}
                    />
                </div>
            ) : (
                <div
                    className="relative group cursor-pointer"
                    onClick={() => setIsEditing(true)}
                >
                    <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center justify-center border-2 border-blue-500 rounded ring-4 ring-blue-500/20">
                        <span className="bg-blue-600 text-white px-6 py-3 font-semibold shadow-xl rounded-full tracking-wide">Click to Edit HTML</span>
                    </div>
                    {/* We strictly sanitize what renders in the editor too to prevent self-XSS */}
                    <div className="opacity-100 group-hover:opacity-30 transition-opacity duration-300" dangerouslySetInnerHTML={{ __html: safeHTML }} />
                </div>
            )}
        </div>
    );
}
