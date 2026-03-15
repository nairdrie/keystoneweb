'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useState } from 'react';
import { BlockData, useEditorContext } from '@/lib/editor-context';
import {
    Bold, Italic, Underline as UnderlineIcon, Strikethrough,
    AlignLeft, AlignCenter, AlignRight, AlignJustify,
    List, ListOrdered, Quote, Code, Link as LinkIcon, Undo, Redo,
    Heading1, Heading2, Heading3, Pilcrow, Minus,
} from 'lucide-react';

const defaultHtml = `<h2>Rich Text Block</h2><p>Click to edit this rich text content. You can use <strong>bold</strong>, <em>italics</em>, and more.</p>`;

// ─── Toolbar ────────────────────────────────────────────────────────────────

function ToolbarBtn({
    onClick,
    active,
    disabled,
    title,
    children,
}: {
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onClick(); }}
            title={title}
            disabled={disabled}
            className={`p-1.5 rounded transition-colors ${active
                ? 'bg-slate-700 text-white'
                : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                } disabled:opacity-30 disabled:cursor-not-allowed`}
        >
            {children}
        </button>
    );
}

function Divider() {
    return <div className="w-px h-5 bg-slate-300 mx-0.5 self-center" />;
}

function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');

    if (!editor) return null;

    const applyLink = () => {
        if (!linkUrl) {
            editor.chain().focus().unsetLink().run();
        } else {
            editor.chain().focus().setLink({ href: linkUrl }).run();
        }
        setShowLinkInput(false);
        setLinkUrl('');
    };

    return (
        <div className="border border-slate-200 rounded-t-lg bg-white shadow-sm">
            <div className="flex flex-wrap items-center gap-0.5 p-1.5">
                {/* History */}
                <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
                    <Undo size={14} />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
                    <Redo size={14} />
                </ToolbarBtn>

                <Divider />

                {/* Block type */}
                <ToolbarBtn onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive('paragraph')} title="Paragraph">
                    <Pilcrow size={14} />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">
                    <Heading1 size={14} />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
                    <Heading2 size={14} />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">
                    <Heading3 size={14} />
                </ToolbarBtn>

                <Divider />

                {/* Inline marks */}
                <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
                    <Bold size={14} />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
                    <Italic size={14} />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline">
                    <UnderlineIcon size={14} />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
                    <Strikethrough size={14} />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Inline Code">
                    <Code size={14} />
                </ToolbarBtn>

                <Divider />

                {/* Alignment */}
                <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align Left">
                    <AlignLeft size={14} />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align Center">
                    <AlignCenter size={14} />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align Right">
                    <AlignRight size={14} />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Justify">
                    <AlignJustify size={14} />
                </ToolbarBtn>

                <Divider />

                {/* Lists & blocks */}
                <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet List">
                    <List size={14} />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered List">
                    <ListOrdered size={14} />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">
                    <Quote size={14} />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule">
                    <Minus size={14} />
                </ToolbarBtn>

                <Divider />

                {/* Link */}
                <ToolbarBtn
                    onClick={() => {
                        if (editor.isActive('link')) {
                            editor.chain().focus().unsetLink().run();
                        } else {
                            setLinkUrl(editor.getAttributes('link').href ?? '');
                            setShowLinkInput(true);
                        }
                    }}
                    active={editor.isActive('link')}
                    title={editor.isActive('link') ? 'Remove Link' : 'Add Link'}
                >
                    <LinkIcon size={14} />
                </ToolbarBtn>

                {/* Color picker */}
                <label title="Text Color" className="p-1.5 rounded hover:bg-slate-200 cursor-pointer flex items-center">
                    <span className="text-xs font-bold leading-none" style={{ color: editor.getAttributes('textStyle').color || '#000000' }}>A</span>
                    <input
                        type="color"
                        className="sr-only"
                        value={editor.getAttributes('textStyle').color || '#000000'}
                        onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
                    />
                </label>
            </div>

            {/* Link input row */}
            {showLinkInput && (
                <div className="flex items-center gap-2 px-2 pb-2 border-t border-slate-100 pt-1.5">
                    <input
                        autoFocus
                        type="url"
                        placeholder="https://example.com"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') applyLink(); if (e.key === 'Escape') setShowLinkInput(false); }}
                        className="flex-1 text-xs px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    <button type="button" onClick={applyLink} className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Apply</button>
                    <button type="button" onClick={() => setShowLinkInput(false)} className="text-xs px-2 py-1 bg-slate-200 rounded hover:bg-slate-300">Cancel</button>
                </div>
            )}
        </div>
    );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function TextBlock({ block, palette }: { block: BlockData; palette: Record<string, string> }) {
    const context = useEditorContext();
    const isEditMode = context?.isEditMode || false;

    const html = block.data.html !== undefined ? block.data.html : defaultHtml;

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
            }),
            Underline,
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Link.configure({ openOnClick: false }),
            TextStyle,
            Color,
            Placeholder.configure({ placeholder: 'Start writing…' }),
        ],
        content: html,
        editable: isEditMode,
        onUpdate({ editor }) {
            context?.updateBlockData?.(block.id, 'html', editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'prose prose-slate lg:prose-lg max-w-none outline-none min-h-[80px] focus:outline-none',
            },
        },
    });

    // Keep editability in sync with mode changes
    useEffect(() => {
        editor?.setEditable(isEditMode);
    }, [editor, isEditMode]);

    // Sync content on undo/redo (external html change while not focused)
    useEffect(() => {
        if (!editor || editor.isFocused) return;
        const current = editor.getHTML();
        if (current !== html) {
            editor.commands.setContent(html, { emitUpdate: false });
        }
    }, [html, editor]);

    if (!isEditMode) {
        return (
            <section className="py-16 bg-white">
                <div
                    className="max-w-4xl mx-auto px-4 prose"
                    dangerouslySetInnerHTML={{ __html: html }}
                />
            </section>
        );
    }

    return (
        <section className="py-16 bg-white">
            <div className="max-w-4xl mx-auto px-4">
                <Toolbar editor={editor} />
                <EditorContent
                    editor={editor}
                    className="border border-t-0 border-slate-200 rounded-b-lg px-4 py-3 bg-white hover:border-blue-300 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400 transition-all"
                />
            </div>
        </section>
    );
}
