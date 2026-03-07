'use client';

import { useState, useRef, useEffect } from 'react';
import { BlockData, useEditorContext } from '@/lib/editor-context';

export default function TextBlock({ block, palette }: { block: BlockData, palette: Record<string, string> }) {
    const context = useEditorContext();
    const isEditMode = context?.isEditMode || false;
    const editorRef = useRef<HTMLDivElement>(null);
    const [isFocused, setIsFocused] = useState(false);

    const updateData = (key: string, value: string) => {
        context?.updateBlockData?.(block.id, key, value);
    };

    const defaultHtml = `<h2>Rich Text Block</h2><p>Click to edit this rich text content. You can use <strong>bold</strong>, <em>italics</em>, and more.</p>`;
    const html = block.data.html !== undefined ? block.data.html : defaultHtml;

    // Sync content from props when not focused (e.g. undo/redo)
    useEffect(() => {
        if (!isFocused && editorRef.current && isEditMode) {
            editorRef.current.innerHTML = html;
        }
    }, [html, isFocused, isEditMode]);

    const handleBlur = () => {
        setIsFocused(false);
        if (editorRef.current) {
            const newHtml = editorRef.current.innerHTML;
            if (newHtml !== html) {
                updateData('html', newHtml);
            }
        }
    };

    // View mode: render HTML directly
    if (!isEditMode) {
        return (
            <section className="py-16 bg-white">
                <div
                    className="max-w-4xl mx-auto px-4 prose prose-slate lg:prose-lg max-w-none"
                    dangerouslySetInnerHTML={{ __html: html }}
                />
            </section>
        );
    }

    // Edit mode: contentEditable div with formatting toolbar
    return (
        <section className="py-16 bg-white">
            <div className="max-w-4xl mx-auto px-4">
                {/* Mini formatting toolbar */}
                {isFocused && (
                    <div className="flex items-center gap-1 mb-2 p-1.5 bg-slate-100 border border-slate-200 rounded-lg shadow-sm">
                        <button
                            onMouseDown={(e) => { e.preventDefault(); document.execCommand('bold'); }}
                            className="px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200 rounded transition-colors"
                            title="Bold"
                        >B</button>
                        <button
                            onMouseDown={(e) => { e.preventDefault(); document.execCommand('italic'); }}
                            className="px-2.5 py-1 text-xs italic text-slate-700 hover:bg-slate-200 rounded transition-colors"
                            title="Italic"
                        >I</button>
                        <button
                            onMouseDown={(e) => { e.preventDefault(); document.execCommand('underline'); }}
                            className="px-2.5 py-1 text-xs underline text-slate-700 hover:bg-slate-200 rounded transition-colors"
                            title="Underline"
                        >U</button>
                        <div className="w-px h-5 bg-slate-300 mx-1" />
                        <button
                            onMouseDown={(e) => { e.preventDefault(); document.execCommand('formatBlock', false, 'h2'); }}
                            className="px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200 rounded transition-colors"
                            title="Heading"
                        >H2</button>
                        <button
                            onMouseDown={(e) => { e.preventDefault(); document.execCommand('formatBlock', false, 'p'); }}
                            className="px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-200 rounded transition-colors"
                            title="Paragraph"
                        >¶</button>
                        <div className="w-px h-5 bg-slate-300 mx-1" />
                        <button
                            onMouseDown={(e) => { e.preventDefault(); document.execCommand('insertUnorderedList'); }}
                            className="px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-200 rounded transition-colors"
                            title="Bullet List"
                        >• List</button>
                    </div>
                )}
                <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onFocus={() => setIsFocused(true)}
                    onBlur={handleBlur}
                    className={`prose prose-slate lg:prose-lg max-w-none outline-none rounded-lg transition-all min-h-[80px] ${isFocused
                        ? 'ring-2 ring-blue-400 bg-blue-50/30 p-4'
                        : 'hover:ring-1 hover:ring-blue-300 cursor-text bg-blue-50/10 p-4 ring-1 ring-blue-200/50'
                        }`}
                    dangerouslySetInnerHTML={{ __html: html }}
                />
            </div>
        </section>
    );
}
