'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useState } from 'react';
import {
    Bold, Italic, Underline as UnderlineIcon, Strikethrough,
    List, ListOrdered, Link as LinkIcon, Undo, Redo,
    Heading2, Heading3, Pilcrow,
} from 'lucide-react';

function ToolbarBtn({
    onClick, active, disabled, title, children,
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

interface Props {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
}

export default function ProductDescriptionEditor({ value, onChange, placeholder }: Props) {
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({ heading: { levels: [2, 3] } }),
            Underline,
            Link.configure({ openOnClick: false, autolink: true }),
            Placeholder.configure({ placeholder: placeholder ?? 'Product description' }),
        ],
        content: value || '',
        editable: true,
        onUpdate({ editor }) {
            const html = editor.getHTML();
            onChange(editor.isEmpty ? '' : html);
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm prose-slate max-w-none outline-none min-h-[120px] focus:outline-none px-3 py-2.5',
            },
        },
    });

    // Sync external value changes when not focused (e.g., switching products)
    useEffect(() => {
        if (!editor || editor.isFocused) return;
        const current = editor.getHTML();
        const incoming = value || '';
        if (current !== incoming && !(editor.isEmpty && incoming === '')) {
            editor.commands.setContent(incoming, { emitUpdate: false });
        }
    }, [value, editor]);

    if (!editor) {
        return (
            <div className="w-full text-sm border border-slate-300 rounded-lg bg-white min-h-[160px]" />
        );
    }

    const applyLink = () => {
        if (!linkUrl) {
            editor.chain().focus().unsetLink().run();
        } else {
            editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
        }
        setShowLinkInput(false);
        setLinkUrl('');
    };

    return (
        <div className="w-full text-sm border border-slate-300 rounded-lg bg-white focus-within:ring-2 focus-within:ring-blue-500 overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50">
                <div className="flex flex-wrap items-center gap-0.5 p-1.5">
                    <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
                        <Undo size={14} />
                    </ToolbarBtn>
                    <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
                        <Redo size={14} />
                    </ToolbarBtn>

                    <Divider />

                    <ToolbarBtn onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive('paragraph')} title="Paragraph">
                        <Pilcrow size={14} />
                    </ToolbarBtn>
                    <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading">
                        <Heading2 size={14} />
                    </ToolbarBtn>
                    <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Subheading">
                        <Heading3 size={14} />
                    </ToolbarBtn>

                    <Divider />

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

                    <Divider />

                    <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet List">
                        <List size={14} />
                    </ToolbarBtn>
                    <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered List">
                        <ListOrdered size={14} />
                    </ToolbarBtn>

                    <Divider />

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
                </div>
                {showLinkInput && (
                    <div className="flex items-center gap-2 px-2 pb-2 border-t border-slate-200 pt-1.5">
                        <input
                            autoFocus
                            type="url"
                            placeholder="https://example.com"
                            value={linkUrl}
                            onChange={(e) => setLinkUrl(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } if (e.key === 'Escape') setShowLinkInput(false); }}
                            className="flex-1 text-xs px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                        <button type="button" onClick={applyLink} className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Apply</button>
                        <button type="button" onClick={() => setShowLinkInput(false)} className="text-xs px-2 py-1 bg-slate-200 rounded hover:bg-slate-300">Cancel</button>
                    </div>
                )}
            </div>
            <EditorContent editor={editor} />
        </div>
    );
}
