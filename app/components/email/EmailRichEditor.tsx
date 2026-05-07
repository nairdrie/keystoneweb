'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useRef, useState } from 'react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Link as LinkIcon, Undo, Redo,
  Quote, Image as ImageIcon, Loader2,
} from 'lucide-react';

interface Props {
  siteId: string;
  value: string;
  /** onChange(html, plainText) */
  onChange: (html: string, plainText: string) => void;
  placeholder?: string;
  minHeight?: number;
  /** When set, the editor body scrolls internally past this height. */
  maxHeight?: number | string;
}

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
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      disabled={disabled}
      className={`p-1.5 rounded transition-colors ${
        active
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

/**
 * TipTap-based rich-text editor for the email composer / reply box.
 * Supports paste-and-upload of images: pasted/dropped images are uploaded
 * to /api/email/inline-image and the returned public URL is inserted as
 * a regular <img> node in the document.
 */
export default function EmailRichEditor({
  siteId,
  value,
  onChange,
  placeholder = 'Write your message…',
  minHeight = 220,
  maxHeight,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    editable: true,
    onUpdate({ editor }) {
      const html = editor.isEmpty ? '' : editor.getHTML();
      const text = editor.getText();
      onChange(html, text);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm prose-slate max-w-none outline-none focus:outline-none px-3 py-2.5',
        style: `min-height: ${minHeight}px;`,
      },
      // Intercept pasted/dropped images and upload them
      handlePaste(view, event) {
        const items = Array.from(event.clipboardData?.items ?? []);
        const imageItem = items.find(it => it.type.startsWith('image/'));
        if (!imageItem) return false;
        const file = imageItem.getAsFile();
        if (!file) return false;
        event.preventDefault();
        uploadAndInsert(file);
        return true;
      },
      handleDrop(view, event) {
        const file = event.dataTransfer?.files?.[0];
        if (!file || !file.type.startsWith('image/')) return false;
        event.preventDefault();
        uploadAndInsert(file);
        return true;
      },
    },
  });

  // Sync external value if not focused (used after Use AI Draft, etc.)
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const current = editor.getHTML();
    const incoming = value || '';
    if (current !== incoming && !(editor.isEmpty && incoming === '')) {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
  }, [value, editor]);

  async function uploadAndInsert(file: File) {
    if (!editor) return;
    setUploadError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('siteId', siteId);
      const res = await fetch('/api/email/inline-image', {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });
      const d = await res.json();
      if (!res.ok) {
        setUploadError(d.error ?? 'Upload failed');
        return;
      }
      editor.chain().focus().insertContent(`<img src="${d.url}" alt="${file.name.replace(/"/g, '')}" />`).run();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  if (!editor) {
    return (
      <div
        className="w-full text-sm border border-slate-300 rounded-lg bg-white"
        style={{ minHeight }}
      />
    );
  }

  function applyLink() {
    if (!linkUrl) {
      editor!.chain().focus().unsetLink().run();
    } else {
      const href = linkUrl.match(/^https?:\/\//i) ? linkUrl : `https://${linkUrl}`;
      editor!.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
    setShowLinkInput(false);
    setLinkUrl('');
  }

  return (
    <div className="w-full text-sm border border-slate-300 rounded-lg bg-white focus-within:ring-2 focus-within:ring-blue-500 overflow-hidden flex flex-col min-h-0">
      <div className="flex-none border-b border-slate-200 bg-slate-50">
        <div className="flex flex-wrap items-center gap-0.5 p-1.5">
          <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
            <Undo size={14} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
            <Redo size={14} />
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

          <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
            <List size={14} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">
            <ListOrdered size={14} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Quote">
            <Quote size={14} />
          </ToolbarBtn>

          <Divider />

          <ToolbarBtn onClick={() => setShowLinkInput(v => !v)} active={editor.isActive('link')} title="Link">
            <LinkIcon size={14} />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => fileInputRef.current?.click()} title="Insert image">
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
          </ToolbarBtn>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) uploadAndInsert(file);
              e.target.value = '';
            }}
          />
        </div>

        {showLinkInput && (
          <div className="px-2 pb-2 flex gap-1">
            <input
              autoFocus
              type="text"
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } if (e.key === 'Escape') setShowLinkInput(false); }}
              className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded"
            />
            <button onClick={applyLink} className="px-2 py-1 text-xs font-bold bg-slate-900 text-white rounded">Apply</button>
            <button onClick={() => { setShowLinkInput(false); setLinkUrl(''); editor.chain().focus().unsetLink().run(); }} className="px-2 py-1 text-xs text-slate-500 hover:text-slate-900">Remove</button>
          </div>
        )}

        {uploadError && (
          <div className="px-3 pb-2 text-xs text-red-600">{uploadError}</div>
        )}
      </div>

      <div
        className="flex-1 min-h-0 overflow-y-auto"
        style={maxHeight !== undefined ? { maxHeight } : undefined}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
