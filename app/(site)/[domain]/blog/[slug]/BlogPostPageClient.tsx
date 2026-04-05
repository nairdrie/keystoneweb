'use client';

import { ArrowLeft, Calendar, User, Tag } from 'lucide-react';

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
    created_at: string;
}

interface RecentPost {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    cover_image: string | null;
    author: string | null;
    tags: string[];
    published_at: string | null;
    created_at: string;
}

export default function BlogPostPageClient({
    post,
    recentPosts,
    palette,
    siteName,
}: {
    post: BlogPost;
    recentPosts: RecentPost[];
    palette: Record<string, string>;
    siteName: string;
}) {
    const pPrimary = palette.primary || '#0f172a';
    const pSecondary = palette.secondary || '#dc2626';

    return (
        <div className="min-h-screen bg-white">
            <article className="max-w-4xl mx-auto px-4 py-12 sm:py-16">
                {/* Back link */}
                <a
                    href="/"
                    className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-8 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to {siteName || 'site'}
                </a>

                {/* Cover image */}
                {post.cover_image && (
                    <div className="w-full aspect-[21/9] rounded-2xl overflow-hidden mb-10">
                        <img src={post.cover_image} alt={post.title} className="w-full h-full object-cover" />
                    </div>
                )}

                {/* Tags */}
                {post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                        {post.tags.map(tag => (
                            <span
                                key={tag}
                                className="text-xs font-semibold px-2.5 py-1 rounded-full"
                                style={{ backgroundColor: `${pSecondary}15`, color: pSecondary }}
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}

                {/* Title */}
                <h1
                    className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-6"
                    style={{ color: pPrimary }}
                >
                    {post.title}
                </h1>

                {/* Meta */}
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

                {/* Content */}
                {post.content ? (
                    <div
                        className="prose prose-slate lg:prose-lg max-w-none
                            prose-headings:font-bold prose-headings:tracking-tight
                            prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
                            prose-img:rounded-xl prose-img:shadow-md
                            prose-blockquote:border-l-4 prose-blockquote:not-italic
                        "
                        style={{
                            '--tw-prose-links': pSecondary,
                            '--tw-prose-quote-borders': pSecondary,
                        } as React.CSSProperties}
                        dangerouslySetInnerHTML={{ __html: post.content }}
                    />
                ) : (
                    <p className="text-slate-400 italic">This post has no content yet.</p>
                )}
            </article>

            {/* More posts */}
            {recentPosts.length > 0 && (
                <section className="border-t border-slate-100 bg-slate-50 py-16 px-4">
                    <div className="max-w-4xl mx-auto">
                        <h2 className="text-xl font-bold text-slate-900 mb-8">More Posts</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {recentPosts.map(rp => (
                                <a
                                    key={rp.id}
                                    href={`/blog/${rp.slug}`}
                                    className="group flex gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:shadow-lg transition-all"
                                >
                                    {rp.cover_image && (
                                        <div className="w-24 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100">
                                            <img src={rp.cover_image} alt={rp.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-slate-900 text-sm leading-snug group-hover:text-blue-700 transition-colors line-clamp-2">
                                            {rp.title}
                                        </h3>
                                        {rp.excerpt && (
                                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{rp.excerpt}</p>
                                        )}
                                        <span className="text-xs text-slate-400 mt-2 block">
                                            {new Date(rp.published_at || rp.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}
