'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useEditorContext } from '@/lib/editor-context';
import { useLangPrefix, prefixInternalLinks } from '@/lib/hooks/useLangPrefix';
import { sanitizeRichHtml } from '@/lib/html-sanitize';
import Reveal, { useStaggerSec } from '@/app/components/Reveal';
import {
    Newspaper, Loader2, ArrowLeft,
    Calendar, User,
} from 'lucide-react';

// Editor (BlogEditorPanel + post manager + tiptap rich-text) lazy-loads only
// when the user is editing. The public bundle therefore avoids @tiptap/* and
// the post-management UI entirely.
const BlogBlockEditor = dynamic(() => import('./BlogBlockEditor'), { ssr: false });

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
    is_featured: boolean;
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

export default function BlogBlock(props: BlogBlockProps) {
    const context = useEditorContext();
    const siteId = context?.siteId;

    if (!siteId) {
        return <div className="py-12 text-center text-slate-400">Blog block requires a saved site.</div>;
    }

    if (props.isEditMode) {
        return <BlogBlockEditor {...props} />;
    }

    return <BlogViewer siteId={siteId} data={props.data} palette={props.palette} />;
}

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
    const showAuthor = data.showAuthor !== false;
    const showDate = data.showDate !== false;
    const showTags = data.showTags !== false;
    const showExcerpt = data.showExcerpt !== false;
    const postsPerPage = data.postsPerPage || 9;
    const fallbackPosts: BlogPost[] = useMemo(() => Array.isArray(data.fallbackPosts)
        ? data.fallbackPosts.map((post: Partial<BlogPost>, index: number) => ({
            id: post.id || `fallback-${index}`,
            title: post.title || `Sample post ${index + 1}`,
            slug: post.slug || `sample-post-${index + 1}`,
            excerpt: post.excerpt || null,
            content: post.content || null,
            cover_image: post.cover_image || null,
            author: post.author || null,
            tags: Array.isArray(post.tags) ? post.tags : [],
            is_published: post.is_published !== false,
            is_featured: post.is_featured === true,
            published_at: post.published_at || null,
            sort_order: post.sort_order || index,
            created_at: post.created_at || new Date().toISOString(),
        }))
        : [], [data.fallbackPosts]);
    const pPrimary = palette.primary || '#0f172a';
    const pSecondary = palette.secondary || '#dc2626';

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/blog/posts?siteId=${siteId}`);
                if (!res.ok) throw new Error();
                const d = await res.json();
                const publishedPosts = (d.posts || []).filter((p: BlogPost) => p.is_published);
                setPosts((publishedPosts.length ? publishedPosts : fallbackPosts).slice(0, postsPerPage));
            } catch {
                setPosts(fallbackPosts.slice(0, postsPerPage));
            } finally {
                setLoading(false);
            }
        })();
    }, [siteId, postsPerPage, fallbackPosts]);

    if (loading) {
        return (
            <section className="py-20 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-300" />
            </section>
        );
    }

    if (openPost) {
        return <PostDetail post={openPost} onBack={() => setOpenPost(null)} pPrimary={pPrimary} pSecondary={pSecondary} />;
    }

    const opts = { showAuthor, showDate, showTags, showExcerpt };

    return (
        <section className="py-16 px-4 bg-white">
            <div className="max-w-6xl mx-auto">
                {(title || subtitle) && (
                    <div className="text-center mb-12">
                        {title && <h2 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: pPrimary }}>{title}</h2>}
                        {subtitle && <p className="text-lg text-slate-500 max-w-xl mx-auto">{subtitle}</p>}
                    </div>
                )}
                {posts.length === 0 && (
                    <div className="text-center py-16 text-slate-400">
                        <Newspaper className="w-10 h-10 mx-auto mb-3 opacity-40" />
                        <p className="font-medium">No posts published yet</p>
                    </div>
                )}
                {posts.length > 0 && layout === 'grid' && <GridLayout posts={posts} onOpen={setOpenPost} pSecondary={pSecondary} opts={opts} />}
                {posts.length > 0 && layout === 'list' && <ListLayout posts={posts} onOpen={setOpenPost} pSecondary={pSecondary} opts={opts} />}
                {posts.length > 0 && layout === 'magazine' && <MagazineLayout posts={posts} onOpen={setOpenPost} pSecondary={pSecondary} opts={opts} />}
            </div>
        </section>
    );
}

interface DisplayOpts { showAuthor: boolean; showDate: boolean; showTags: boolean; showExcerpt: boolean; }

function PostMeta({ post, opts, className = '' }: { post: BlogPost; opts: DisplayOpts; className?: string }) {
    return (
        <div className={`flex items-center gap-3 text-xs text-slate-400 ${className}`}>
            {opts.showAuthor && post.author && <span className="flex items-center gap-1"><User className="w-3 h-3" />{post.author}</span>}
            {opts.showDate && (
                <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(post.published_at || post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
            )}
        </div>
    );
}

function GridLayout({ posts, onOpen, pSecondary, opts }: { posts: BlogPost[]; onOpen: (p: BlogPost) => void; pSecondary: string; opts: DisplayOpts }) {
    const staggerSec = useStaggerSec();
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post, index) => (
                <Reveal key={post.id} delay={index * staggerSec}>
                <a href={`/blog/${post.slug}`} onClick={(e) => { e.preventDefault(); onOpen(post); }} className="group cursor-pointer rounded-2xl border border-slate-100 overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1 bg-white block">
                    <div className="aspect-[16/9] bg-slate-50 overflow-hidden">
                        {post.cover_image ? (
                            <img src={post.cover_image} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center"><Newspaper className="w-10 h-10 text-slate-200" /></div>
                        )}
                    </div>
                    <div className="p-5">
                        {opts.showTags && post.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-3">
                                {post.tags.slice(0, 2).map(tag => (
                                    <span key={tag} className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${pSecondary}15`, color: pSecondary }}>{tag}</span>
                                ))}
                            </div>
                        )}
                        <h3 className="font-bold text-slate-900 text-base leading-snug group-hover:text-blue-700 transition-colors line-clamp-2">{post.title}</h3>
                        {opts.showExcerpt && post.excerpt && <p className="text-sm text-slate-500 mt-2 line-clamp-2">{post.excerpt}</p>}
                        <PostMeta post={post} opts={opts} className="mt-4" />
                    </div>
                </a>
                </Reveal>
            ))}
        </div>
    );
}

function ListLayout({ posts, onOpen, pSecondary, opts }: { posts: BlogPost[]; onOpen: (p: BlogPost) => void; pSecondary: string; opts: DisplayOpts }) {
    const staggerSec = useStaggerSec();
    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            {posts.map((post, index) => (
                <Reveal key={post.id} delay={index * staggerSec}>
                <a href={`/blog/${post.slug}`} onClick={(e) => { e.preventDefault(); onOpen(post); }} className="group cursor-pointer flex gap-5 rounded-2xl border border-slate-100 overflow-hidden hover:shadow-lg transition-all bg-white p-4 block">
                    {post.cover_image && (
                        <div className="w-36 h-28 flex-shrink-0 rounded-xl overflow-hidden bg-slate-50">
                            <img src={post.cover_image} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                        </div>
                    )}
                    <div className="flex-1 min-w-0 py-1">
                        {opts.showTags && post.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {post.tags.slice(0, 3).map(tag => (
                                    <span key={tag} className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${pSecondary}15`, color: pSecondary }}>{tag}</span>
                                ))}
                            </div>
                        )}
                        <h3 className="font-bold text-slate-900 text-lg leading-snug group-hover:text-blue-700 transition-colors">{post.title}</h3>
                        {opts.showExcerpt && post.excerpt && <p className="text-sm text-slate-500 mt-1.5 line-clamp-2">{post.excerpt}</p>}
                        <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                            <PostMeta post={post} opts={opts} />
                            <span className="ml-auto text-xs font-medium" style={{ color: pSecondary }}>Read more →</span>
                        </div>
                    </div>
                </a>
                </Reveal>
            ))}
        </div>
    );
}

function MagazineLayout({ posts, onOpen, pSecondary, opts }: { posts: BlogPost[]; onOpen: (p: BlogPost) => void; pSecondary: string; opts: DisplayOpts }) {
    const featured = posts.find(post => post.is_featured) || posts[0];
    const rest = posts.filter(post => post.id !== featured?.id);
    const staggerSec = useStaggerSec();
    return (
        <div className="space-y-6">
            {featured && (
                <Reveal>
                <a href={`/blog/${featured.slug}`} onClick={(e) => { e.preventDefault(); onOpen(featured); }} className="group cursor-pointer grid md:grid-cols-2 gap-0 rounded-2xl overflow-hidden border border-slate-100 hover:shadow-xl transition-all bg-white block">
                    <div className="aspect-[4/3] md:aspect-auto bg-slate-50 overflow-hidden">
                        {featured.cover_image ? (
                            <img src={featured.cover_image} alt={featured.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center min-h-[240px]"><Newspaper className="w-14 h-14 text-slate-200" /></div>
                        )}
                    </div>
                    <div className="p-8 flex flex-col justify-center">
                        {opts.showTags && featured.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-4">
                                {featured.tags.slice(0, 2).map(tag => (
                                    <span key={tag} className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: `${pSecondary}15`, color: pSecondary }}>{tag}</span>
                                ))}
                            </div>
                        )}
                        <span className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: pSecondary }}>Featured</span>
                        <h2 className="text-2xl font-bold text-slate-900 leading-tight group-hover:text-blue-700 transition-colors">{featured.title}</h2>
                        {opts.showExcerpt && featured.excerpt && <p className="text-slate-500 mt-3 line-clamp-3">{featured.excerpt}</p>}
                        <PostMeta post={featured} opts={opts} className="mt-6 text-sm" />
                    </div>
                </a>
                </Reveal>
            )}
            {rest.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {rest.map((post, index) => (
                        <Reveal key={post.id} delay={(index + 1) * staggerSec}>
                        <a href={`/blog/${post.slug}`} onClick={(e) => { e.preventDefault(); onOpen(post); }} className="group cursor-pointer rounded-2xl border border-slate-100 overflow-hidden hover:shadow-lg transition-all bg-white block">
                            <div className="aspect-[16/9] bg-slate-50 overflow-hidden">
                                {post.cover_image ? (
                                    <img src={post.cover_image} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center"><Newspaper className="w-8 h-8 text-slate-200" /></div>
                                )}
                            </div>
                            <div className="p-4">
                                {opts.showTags && post.tags.length > 0 && (
                                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full mb-2 inline-block" style={{ backgroundColor: `${pSecondary}15`, color: pSecondary }}>{post.tags[0]}</span>
                                )}
                                <h3 className="font-bold text-slate-900 leading-snug group-hover:text-blue-700 transition-colors line-clamp-2">{post.title}</h3>
                                <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                                    {opts.showAuthor && post.author && <span>{post.author}</span>}
                                    {opts.showDate && <span className="ml-auto">{new Date(post.published_at || post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                                </div>
                            </div>
                        </a>
                        </Reveal>
                    ))}
                </div>
            )}
        </div>
    );
}

function PostDetail({ post, onBack, pPrimary, pSecondary }: { post: BlogPost; onBack: () => void; pPrimary: string; pSecondary: string }) {
    const langPrefix = useLangPrefix();
    return (
        <section className="py-12 px-4 bg-white">
            <div className="max-w-3xl mx-auto">
                <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-8 transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back to all posts
                </button>
                {post.cover_image && (
                    <div className="w-full aspect-[21/9] rounded-2xl overflow-hidden mb-10">
                        <img src={post.cover_image} alt={post.title} className="w-full h-full object-cover" loading="eager" fetchPriority="high" />
                    </div>
                )}
                {post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                        {post.tags.map(tag => (
                            <span key={tag} className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: `${pSecondary}15`, color: pSecondary }}>{tag}</span>
                        ))}
                    </div>
                )}
                <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-4" style={{ color: pPrimary }}>{post.title}</h1>
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
                    <div className="prose prose-slate lg:prose-lg max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(prefixInternalLinks(post.content, langPrefix)) }} />
                ) : (
                    <p className="text-slate-400 italic">This post has no content yet.</p>
                )}
            </div>
        </section>
    );
}
