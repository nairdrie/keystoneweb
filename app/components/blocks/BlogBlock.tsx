'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useEditorContext } from '@/lib/editor-context';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Placeholder from '@tiptap/extension-placeholder';
import {
    Newspaper, Plus, Trash2, Loader2, X, Upload, ImageIcon,
    Eye, EyeOff, ArrowLeft, Edit3, LayoutGrid, List, Columns,
    Bold, Italic, Underline as UnderlineIcon, Strikethrough,
    AlignLeft, AlignCenter, AlignRight, AlignJustify,
    ListOrdered, Quote, Code, Link as LinkIcon, Undo, Redo,
    Heading1, Heading2, Heading3, Pilcrow, Minus, ExternalLink,
    Tag, Calendar, User,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BlogPost {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    content: string | null;
    cover_image: string | null;
    author: string | null;
    tags: string[];
    is_published: boolean;
    published_at: string | null;
    sort_order: number;
    created_at: string;
}

type LayoutStyle = 'grid' | 'list' | 'magazine';

interface BlogBlockProps {
    id: string;
    data: any;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: (key: string, value: any) => void;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function BlogBlock({ id, data, isEditMode, palette, updateContent }: BlogBlockProps) {
    const context = useEditorContext();
    const siteId = context?.siteId;

    if (!siteId) {
        return <div className="py-12 text-center text-slate-400">Blog block requires a saved site.</div>;
    }

    if (isEditMode) {
        return <BlogManager siteId={siteId} data={data} palette={palette} updateContent={updateContent} />;
    }

    return <BlogViewer siteId={siteId} data={data} palette={palette} />;
}

// ═══════════════════════════════════════════════════════════════════════════
// EDITOR: Blog Manager
// ═══════════════════════════════════════════════════════════════════════════

function BlogManager({ siteId, data, palette, updateContent }: {
    siteId: string;
    data: any;
    palette: Record<string, string>;
    updateContent: (key: string, value: any) => void;
}) {
    const [posts, setPosts] = useState<BlogPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
    const [showNewPost, setShowNewPost] = useState(false);

    const layout: LayoutStyle = data.layout || 'grid';
    const title = data.title ?? 'Blog';
    const subtitle = data.subtitle ?? 'Latest news & updates';

    useEffect(() => {
        fetchPosts();
    }, [siteId]);

    const fetchPosts = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/blog/posts?siteId=${siteId}`);
            if (!res.ok) throw new Error('Failed to fetch');
            const d = await res.json();
            setPosts(d.posts || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (postId: string) => {
        if (!confirm('Delete this post?')) return;
        await fetch(`/api/blog/posts?id=${postId}`, { method: 'DELETE' });
        setPosts(posts.filter(p => p.id !== postId));
    };

    const handleTogglePublish = async (post: BlogPost) => {
        const res = await fetch('/api/blog/posts', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: post.id, is_published: !post.is_published }),
        });
        const d = await res.json();
        if (d.post) setPosts(posts.map(p => p.id === post.id ? d.post : p));
    };

    if (editingPost) {
        return (
            <PostEditor
                siteId={siteId}
                post={editingPost}
                palette={palette}
                onSaved={(updated) => {
                    setPosts(posts.map(p => p.id === updated.id ? updated : p));
                    setEditingPost(null);
                }}
                onBack={() => setEditingPost(null)}
            />
        );
    }

    if (showNewPost) {
        return (
            <PostEditor
                siteId={siteId}
                post={null}
                palette={palette}
                onSaved={(created) => {
                    setPosts([...posts, created]);
                    setShowNewPost(false);
                }}
                onBack={() => setShowNewPost(false)}
            />
        );
    }

    return (
        <section className="py-12 px-4">
            <div className="max-w-3xl mx-auto space-y-6">
                {/* Header settings */}
                <div className="bg-white border-2 border-emerald-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="bg-emerald-50 px-6 py-4 border-b border-emerald-200">
                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Newspaper className="w-5 h-5 text-emerald-600" />
                            Blog / News Block
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">{posts.length} post{posts.length !== 1 ? 's' : ''}</p>
                    </div>

                    <div className="p-6 space-y-4">
                        {/* Editable title & subtitle */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-semibold text-slate-600 mb-1 block">Section Title</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => updateContent('title', e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                                    placeholder="Blog"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-600 mb-1 block">Subtitle</label>
                                <input
                                    type="text"
                                    value={subtitle}
                                    onChange={e => updateContent('subtitle', e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                                    placeholder="Latest news & updates"
                                />
                            </div>
                        </div>

                        {/* Layout picker */}
                        <div>
                            <label className="text-xs font-semibold text-slate-600 mb-2 block">List Style</label>
                            <div className="flex gap-2">
                                {([
                                    { key: 'grid', label: 'Grid', icon: LayoutGrid },
                                    { key: 'list', label: 'List', icon: List },
                                    { key: 'magazine', label: 'Magazine', icon: Columns },
                                ] as const).map(({ key, label, icon: Icon }) => (
                                    <button
                                        key={key}
                                        onClick={() => updateContent('layout', key)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                                            layout === key
                                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <Icon className="w-3.5 h-3.5" />
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Post list */}
                <div className="bg-white border-2 border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                        <h4 className="font-semibold text-slate-800 text-sm">Posts</h4>
                        <button
                            onClick={() => setShowNewPost(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors"
                        >
                            <Plus className="w-3.5 h-3.5" /> New Post
                        </button>
                    </div>

                    <div className="p-4 space-y-2">
                        {loading && (
                            <div className="py-8 text-center">
                                <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                            </div>
                        )}

                        {!loading && posts.length === 0 && (
                            <p className="text-sm text-slate-400 text-center py-6">No posts yet. Create your first post above.</p>
                        )}

                        {!loading && posts.map(post => (
                            <div key={post.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${post.is_published ? 'border-slate-200' : 'border-slate-100 bg-slate-50 opacity-70'}`}>
                                {post.cover_image ? (
                                    <img src={post.cover_image} alt={post.title} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                                ) : (
                                    <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                        <ImageIcon className="w-5 h-5 text-slate-300" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="font-semibold text-slate-900 text-sm truncate">{post.title}</p>
                                        {!post.is_published && (
                                            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full flex-shrink-0">Draft</span>
                                        )}
                                    </div>
                                    {post.excerpt && (
                                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{post.excerpt}</p>
                                    )}
                                    <div className="flex items-center gap-2 mt-1">
                                        {post.author && <span className="text-xs text-slate-400">{post.author}</span>}
                                        <span className="text-xs text-slate-400">
                                            {new Date(post.published_at || post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                        {post.tags.length > 0 && (
                                            <span className="text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">{post.tags[0]}{post.tags.length > 1 ? ` +${post.tags.length - 1}` : ''}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <button
                                        onClick={() => handleTogglePublish(post)}
                                        title={post.is_published ? 'Unpublish' : 'Publish'}
                                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
                                    >
                                        {post.is_published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                    </button>
                                    <button
                                        onClick={() => setEditingPost(post)}
                                        title="Edit post"
                                        className="p-1.5 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                                    >
                                        <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(post.id)}
                                        title="Delete post"
                                        className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// Post Editor (create or edit a single post)
// ═══════════════════════════════════════════════════════════════════════════

function PostEditor({ siteId, post, palette, onSaved, onBack }: {
    siteId: string;
    post: BlogPost | null;
    palette: Record<string, string>;
    onSaved: (post: BlogPost) => void;
    onBack: () => void;
}) {
    const [title, setTitle] = useState(post?.title || '');
    const [excerpt, setExcerpt] = useState(post?.excerpt || '');
    const [author, setAuthor] = useState(post?.author || '');
    const [tagsInput, setTagsInput] = useState(post?.tags.join(', ') || '');
    const [coverImage, setCoverImage] = useState(post?.cover_image || '');
    const [isPublished, setIsPublished] = useState(post?.is_published || false);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const isNew = !post;

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
            Underline,
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Link.configure({ openOnClick: false }),
            TextStyle,
            Color,
            Placeholder.configure({ placeholder: 'Write your post content here…' }),
        ],
        content: post?.content || '',
        editorProps: {
            attributes: {
                class: 'prose prose-slate lg:prose-lg max-w-none outline-none min-h-[300px] focus:outline-none px-4 py-4',
            },
        },
    });

    const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('siteId', siteId);
        const res = await fetch('/api/sites/upload-image', { method: 'POST', body: formData });
        const d = await res.json();
        if (d.imageUrl) setCoverImage(d.imageUrl);
        setUploading(false);
        if (fileRef.current) fileRef.current.value = '';
    };

    const handleSave = async () => {
        if (!title.trim()) return;
        setSaving(true);

        const tags = tagsInput
            .split(',')
            .map(t => t.trim())
            .filter(Boolean);

        const content = editor?.getHTML() || '';

        const payload = {
            ...(isNew ? { siteId } : { id: post!.id }),
            title: title.trim(),
            excerpt: excerpt.trim() || null,
            content: content || null,
            cover_image: coverImage || null,
            author: author.trim() || null,
            tags,
            is_published: isPublished,
        };

        const res = await fetch('/api/blog/posts', {
            method: isNew ? 'POST' : 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const d = await res.json();
        if (d.post) onSaved(d.post);
        setSaving(false);
    };

    return (
        <section className="py-8 px-4">
            <div className="max-w-3xl mx-auto space-y-4">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to posts
                    </button>
                    <span className="text-slate-300">|</span>
                    <h3 className="font-bold text-slate-800 text-sm">{isNew ? 'New Post' : 'Edit Post'}</h3>
                </div>

                {/* Cover image */}
                <div className="rounded-xl overflow-hidden border-2 border-dashed border-slate-200 bg-slate-50 relative group cursor-pointer"
                    onClick={() => fileRef.current?.click()}
                    style={{ minHeight: coverImage ? 0 : '140px' }}
                >
                    {coverImage ? (
                        <div className="relative">
                            <img src={coverImage} alt="Cover" className="w-full h-48 object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                <button
                                    onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                                    className="px-3 py-1.5 bg-white text-slate-800 text-xs font-bold rounded-lg"
                                >
                                    Change Image
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setCoverImage(''); }}
                                    className="px-3 py-1.5 bg-white text-red-600 text-xs font-bold rounded-lg"
                                >
                                    Remove
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                            {uploading ? (
                                <Loader2 className="w-7 h-7 animate-spin mb-2" />
                            ) : (
                                <>
                                    <Upload className="w-7 h-7 mb-2" />
                                    <span className="text-sm font-medium">Click to upload cover image</span>
                                </>
                            )}
                        </div>
                    )}
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUploadCover} />
                </div>

                {/* Main form */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="p-5 space-y-4">
                        {/* Title */}
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Post title *"
                            className="w-full text-xl font-bold text-slate-900 placeholder-slate-300 border-0 border-b border-slate-100 pb-3 focus:outline-none focus:border-emerald-400 bg-transparent"
                        />

                        {/* Excerpt */}
                        <textarea
                            value={excerpt}
                            onChange={e => setExcerpt(e.target.value)}
                            placeholder="Short excerpt (shown in post lists)…"
                            rows={2}
                            className="w-full px-0 py-1 text-sm text-slate-600 placeholder-slate-400 border-0 resize-none focus:outline-none bg-transparent"
                        />

                        {/* Author & tags */}
                        <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                            <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                <input
                                    type="text"
                                    value={author}
                                    onChange={e => setAuthor(e.target.value)}
                                    placeholder="Author name"
                                    className="flex-1 text-sm text-slate-700 placeholder-slate-400 border-0 focus:outline-none bg-transparent"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Tag className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                <input
                                    type="text"
                                    value={tagsInput}
                                    onChange={e => setTagsInput(e.target.value)}
                                    placeholder="Tags (comma-separated)"
                                    className="flex-1 text-sm text-slate-700 placeholder-slate-400 border-0 focus:outline-none bg-transparent"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Rich text editor */}
                    <div className="border-t border-slate-100">
                        <RichTextToolbar editor={editor} />
                        <EditorContent
                            editor={editor}
                            className="border-t border-slate-100 focus-within:ring-1 focus-within:ring-emerald-400 transition-all min-h-[300px]"
                        />
                    </div>
                </div>

                {/* Footer actions */}
                <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <div
                            onClick={() => setIsPublished(!isPublished)}
                            className={`relative w-10 h-5 rounded-full transition-colors ${isPublished ? 'bg-emerald-500' : 'bg-slate-300'}`}
                        >
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isPublished ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </div>
                        <span className="text-sm font-medium text-slate-700">{isPublished ? 'Published' : 'Draft'}</span>
                    </label>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={onBack}
                            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || !title.trim()}
                            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg disabled:opacity-40 transition-colors"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            {isNew ? 'Create Post' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}

// ─── Rich Text Toolbar ───────────────────────────────────────────────────────

function ToolbarBtn({ onClick, active, disabled, title, children }: {
    onClick: () => void; active?: boolean; disabled?: boolean; title: string; children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onClick(); }}
            title={title}
            disabled={disabled}
            className={`p-1.5 rounded transition-colors ${active ? 'bg-slate-700 text-white' : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'} disabled:opacity-30 disabled:cursor-not-allowed`}
        >
            {children}
        </button>
    );
}

function RichTextToolbar({ editor }: { editor: ReturnType<typeof useEditor> | null }) {
    const [showLink, setShowLink] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');

    if (!editor) return null;

    const applyLink = () => {
        if (!linkUrl) editor.chain().focus().unsetLink().run();
        else editor.chain().focus().setLink({ href: linkUrl }).run();
        setShowLink(false);
        setLinkUrl('');
    };

    return (
        <div className="bg-white border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-0.5 p-1.5">
                <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo"><Undo size={14} /></ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo"><Redo size={14} /></ToolbarBtn>
                <div className="w-px h-5 bg-slate-200 mx-0.5 self-center" />
                <ToolbarBtn onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive('paragraph')} title="Paragraph"><Pilcrow size={14} /></ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1"><Heading1 size={14} /></ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2"><Heading2 size={14} /></ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3"><Heading3 size={14} /></ToolbarBtn>
                <div className="w-px h-5 bg-slate-200 mx-0.5 self-center" />
                <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold"><Bold size={14} /></ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic"><Italic size={14} /></ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline"><UnderlineIcon size={14} /></ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough"><Strikethrough size={14} /></ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Inline Code"><Code size={14} /></ToolbarBtn>
                <div className="w-px h-5 bg-slate-200 mx-0.5 self-center" />
                <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align Left"><AlignLeft size={14} /></ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align Center"><AlignCenter size={14} /></ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align Right"><AlignRight size={14} /></ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Justify"><AlignJustify size={14} /></ToolbarBtn>
                <div className="w-px h-5 bg-slate-200 mx-0.5 self-center" />
                <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet List"><List size={14} /></ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered List"><ListOrdered size={14} /></ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote"><Quote size={14} /></ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule"><Minus size={14} /></ToolbarBtn>
                <div className="w-px h-5 bg-slate-200 mx-0.5 self-center" />
                <ToolbarBtn
                    onClick={() => {
                        if (editor.isActive('link')) { editor.chain().focus().unsetLink().run(); }
                        else { setLinkUrl(editor.getAttributes('link').href ?? ''); setShowLink(true); }
                    }}
                    active={editor.isActive('link')}
                    title={editor.isActive('link') ? 'Remove Link' : 'Add Link'}
                >
                    <LinkIcon size={14} />
                </ToolbarBtn>
                <label title="Text Color" className="p-1.5 rounded hover:bg-slate-200 cursor-pointer flex items-center">
                    <span className="text-xs font-bold leading-none" style={{ color: editor.getAttributes('textStyle').color || '#000000' }}>A</span>
                    <input type="color" className="sr-only" value={editor.getAttributes('textStyle').color || '#000000'} onChange={(e) => editor.chain().focus().setColor(e.target.value).run()} />
                </label>
            </div>
            {showLink && (
                <div className="flex items-center gap-2 px-2 pb-2 border-t border-slate-100 pt-1.5">
                    <input autoFocus type="url" placeholder="https://example.com" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') applyLink(); if (e.key === 'Escape') setShowLink(false); }} className="flex-1 text-xs px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    <button type="button" onClick={applyLink} className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Apply</button>
                    <button type="button" onClick={() => setShowLink(false)} className="text-xs px-2 py-1 bg-slate-200 rounded hover:bg-slate-300">Cancel</button>
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// VIEWER: Blog Post List (public-facing)
// ═══════════════════════════════════════════════════════════════════════════

function BlogViewer({ siteId, data, palette }: {
    siteId: string;
    data: any;
    palette: Record<string, string>;
}) {
    const [posts, setPosts] = useState<BlogPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [openPost, setOpenPost] = useState<BlogPost | null>(null);

    const layout: LayoutStyle = data.layout || 'grid';
    const title = data.title || 'Blog';
    const subtitle = data.subtitle || '';
    const pPrimary = palette.primary || '#0f172a';
    const pSecondary = palette.secondary || '#dc2626';
    const pAccent = palette.accent || '#f59e0b';

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/blog/posts?siteId=${siteId}`);
                if (!res.ok) throw new Error();
                const d = await res.json();
                setPosts((d.posts || []).filter((p: BlogPost) => p.is_published));
            } catch {
                // silent
            } finally {
                setLoading(false);
            }
        })();
    }, [siteId]);

    if (loading) {
        return (
            <section className="py-20 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-300" />
            </section>
        );
    }

    if (openPost) {
        return (
            <PostDetail
                post={openPost}
                onBack={() => setOpenPost(null)}
                pPrimary={pPrimary}
                pSecondary={pSecondary}
            />
        );
    }

    return (
        <section className="py-16 px-4 bg-white">
            <div className="max-w-6xl mx-auto">
                {/* Section header */}
                {(title || subtitle) && (
                    <div className="text-center mb-12">
                        {title && (
                            <h2 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: pPrimary }}>
                                {title}
                            </h2>
                        )}
                        {subtitle && (
                            <p className="text-lg text-slate-500 max-w-xl mx-auto">{subtitle}</p>
                        )}
                    </div>
                )}

                {posts.length === 0 && (
                    <div className="text-center py-16 text-slate-400">
                        <Newspaper className="w-10 h-10 mx-auto mb-3 opacity-40" />
                        <p className="font-medium">No posts published yet</p>
                    </div>
                )}

                {posts.length > 0 && layout === 'grid' && (
                    <GridLayout posts={posts} onOpen={setOpenPost} pPrimary={pPrimary} pSecondary={pSecondary} />
                )}

                {posts.length > 0 && layout === 'list' && (
                    <ListLayout posts={posts} onOpen={setOpenPost} pPrimary={pPrimary} pSecondary={pSecondary} />
                )}

                {posts.length > 0 && layout === 'magazine' && (
                    <MagazineLayout posts={posts} onOpen={setOpenPost} pPrimary={pPrimary} pSecondary={pSecondary} />
                )}
            </div>
        </section>
    );
}

// ─── Grid Layout ─────────────────────────────────────────────────────────────

function GridLayout({ posts, onOpen, pPrimary, pSecondary }: {
    posts: BlogPost[];
    onOpen: (p: BlogPost) => void;
    pPrimary: string;
    pSecondary: string;
}) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map(post => (
                <article
                    key={post.id}
                    onClick={() => onOpen(post)}
                    className="group cursor-pointer rounded-2xl border border-slate-100 overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1 bg-white"
                >
                    <div className="aspect-[16/9] bg-slate-50 overflow-hidden">
                        {post.cover_image ? (
                            <img src={post.cover_image} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <Newspaper className="w-10 h-10 text-slate-200" />
                            </div>
                        )}
                    </div>
                    <div className="p-5">
                        {post.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-3">
                                {post.tags.slice(0, 2).map(tag => (
                                    <span key={tag} className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${pSecondary}15`, color: pSecondary }}>{tag}</span>
                                ))}
                            </div>
                        )}
                        <h3 className="font-bold text-slate-900 text-base leading-snug group-hover:text-blue-700 transition-colors line-clamp-2">{post.title}</h3>
                        {post.excerpt && <p className="text-sm text-slate-500 mt-2 line-clamp-2">{post.excerpt}</p>}
                        <div className="flex items-center gap-3 mt-4 text-xs text-slate-400">
                            {post.author && <span className="flex items-center gap-1"><User className="w-3 h-3" />{post.author}</span>}
                            <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(post.published_at || post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                        </div>
                    </div>
                </article>
            ))}
        </div>
    );
}

// ─── List Layout ──────────────────────────────────────────────────────────────

function ListLayout({ posts, onOpen, pPrimary, pSecondary }: {
    posts: BlogPost[];
    onOpen: (p: BlogPost) => void;
    pPrimary: string;
    pSecondary: string;
}) {
    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            {posts.map(post => (
                <article
                    key={post.id}
                    onClick={() => onOpen(post)}
                    className="group cursor-pointer flex gap-5 rounded-2xl border border-slate-100 overflow-hidden hover:shadow-lg transition-all bg-white p-4"
                >
                    {post.cover_image && (
                        <div className="w-36 h-28 flex-shrink-0 rounded-xl overflow-hidden bg-slate-50">
                            <img src={post.cover_image} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        </div>
                    )}
                    <div className="flex-1 min-w-0 py-1">
                        {post.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {post.tags.slice(0, 3).map(tag => (
                                    <span key={tag} className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${pSecondary}15`, color: pSecondary }}>{tag}</span>
                                ))}
                            </div>
                        )}
                        <h3 className="font-bold text-slate-900 text-lg leading-snug group-hover:text-blue-700 transition-colors">{post.title}</h3>
                        {post.excerpt && <p className="text-sm text-slate-500 mt-1.5 line-clamp-2">{post.excerpt}</p>}
                        <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                            {post.author && <span className="flex items-center gap-1"><User className="w-3 h-3" />{post.author}</span>}
                            <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(post.published_at || post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            <span className="ml-auto text-xs font-medium" style={{ color: pSecondary }}>Read more →</span>
                        </div>
                    </div>
                </article>
            ))}
        </div>
    );
}

// ─── Magazine Layout ──────────────────────────────────────────────────────────

function MagazineLayout({ posts, onOpen, pPrimary, pSecondary }: {
    posts: BlogPost[];
    onOpen: (p: BlogPost) => void;
    pPrimary: string;
    pSecondary: string;
}) {
    const [featured, ...rest] = posts;

    return (
        <div className="space-y-6">
            {/* Featured post */}
            {featured && (
                <article
                    onClick={() => onOpen(featured)}
                    className="group cursor-pointer grid md:grid-cols-2 gap-0 rounded-2xl overflow-hidden border border-slate-100 hover:shadow-xl transition-all bg-white"
                >
                    <div className="aspect-[4/3] md:aspect-auto bg-slate-50 overflow-hidden">
                        {featured.cover_image ? (
                            <img src={featured.cover_image} alt={featured.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center min-h-[240px]">
                                <Newspaper className="w-14 h-14 text-slate-200" />
                            </div>
                        )}
                    </div>
                    <div className="p-8 flex flex-col justify-center">
                        {featured.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-4">
                                {featured.tags.slice(0, 2).map(tag => (
                                    <span key={tag} className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: `${pSecondary}15`, color: pSecondary }}>{tag}</span>
                                ))}
                            </div>
                        )}
                        <span className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: pSecondary }}>Featured</span>
                        <h2 className="text-2xl font-bold text-slate-900 leading-tight group-hover:text-blue-700 transition-colors">{featured.title}</h2>
                        {featured.excerpt && <p className="text-slate-500 mt-3 line-clamp-3">{featured.excerpt}</p>}
                        <div className="flex items-center gap-3 mt-6 text-sm text-slate-400">
                            {featured.author && <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{featured.author}</span>}
                            <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {new Date(featured.published_at || featured.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </span>
                        </div>
                    </div>
                </article>
            )}

            {/* Remaining posts grid */}
            {rest.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {rest.map(post => (
                        <article
                            key={post.id}
                            onClick={() => onOpen(post)}
                            className="group cursor-pointer rounded-2xl border border-slate-100 overflow-hidden hover:shadow-lg transition-all bg-white"
                        >
                            <div className="aspect-[16/9] bg-slate-50 overflow-hidden">
                                {post.cover_image ? (
                                    <img src={post.cover_image} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Newspaper className="w-8 h-8 text-slate-200" />
                                    </div>
                                )}
                            </div>
                            <div className="p-4">
                                {post.tags.length > 0 && (
                                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full mb-2 inline-block" style={{ backgroundColor: `${pSecondary}15`, color: pSecondary }}>{post.tags[0]}</span>
                                )}
                                <h3 className="font-bold text-slate-900 leading-snug group-hover:text-blue-700 transition-colors line-clamp-2">{post.title}</h3>
                                <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                                    {post.author && <span>{post.author}</span>}
                                    <span className="ml-auto">{new Date(post.published_at || post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// Post Detail (inline viewer)
// ═══════════════════════════════════════════════════════════════════════════

function PostDetail({ post, onBack, pPrimary, pSecondary }: {
    post: BlogPost;
    onBack: () => void;
    pPrimary: string;
    pSecondary: string;
}) {
    return (
        <section className="py-12 px-4 bg-white">
            <div className="max-w-3xl mx-auto">
                <button
                    onClick={onBack}
                    className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-8 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to all posts
                </button>

                {post.cover_image && (
                    <div className="w-full aspect-[21/9] rounded-2xl overflow-hidden mb-10">
                        <img src={post.cover_image} alt={post.title} className="w-full h-full object-cover" />
                    </div>
                )}

                {post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                        {post.tags.map(tag => (
                            <span key={tag} className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: `${pSecondary}15`, color: pSecondary }}>{tag}</span>
                        ))}
                    </div>
                )}

                <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-4" style={{ color: pPrimary }}>
                    {post.title}
                </h1>

                <div className="flex items-center gap-4 text-sm text-slate-500 pb-8 mb-8 border-b border-slate-100">
                    {post.author && (
                        <span className="flex items-center gap-1.5">
                            <User className="w-4 h-4" />
                            <strong className="font-semibold text-slate-700">{post.author}</strong>
                        </span>
                    )}
                    <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        {new Date(post.published_at || post.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </span>
                </div>

                {post.content ? (
                    <div
                        className="prose prose-slate lg:prose-lg max-w-none"
                        dangerouslySetInnerHTML={{ __html: post.content }}
                    />
                ) : (
                    <p className="text-slate-400 italic">This post has no content yet.</p>
                )}
            </div>
        </section>
    );
}
