'use client';

import { useState } from 'react';
import {
    Instagram,
    Youtube,
    Facebook,
    Twitter,
    Music2,
    Plus,
    Trash2,
    Link as LinkIcon,
    ExternalLink,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { BlockData, useEditorContext } from '@/lib/editor-context';
import Reveal, { useStaggerSec } from '@/app/components/Reveal';

type Platform = 'youtube' | 'instagram' | 'facebook' | 'tiktok' | 'twitter' | 'unknown';
type InstagramProfileView = 'latestPosts' | 'profile';

interface FeedItem {
    id: string;
    url: string;
    instagramView?: InstagramProfileView;
    instagramPostCount?: number;
}

interface ResolvedEmbed {
    platform: Platform;
    embedUrl: string | null;
    aspect: 'video' | 'square' | 'portrait' | 'profile';
    kind?: 'instagramProfile';
    label?: string;
    profileUsername?: string;
}

/**
 * Detects the social platform from a user-pasted URL and produces an embeddable iframe src.
 * Returns embedUrl=null for unrecognised URLs (we render a fallback link).
 */
const INSTAGRAM_RESERVED_PATHS = new Set([
    'about',
    'accounts',
    'api',
    'developer',
    'directory',
    'explore',
    'oauth',
    'p',
    'reel',
    'stories',
    'tv',
]);
const DEFAULT_INSTAGRAM_PROFILE_POST_COUNT = 5;
const MAX_INSTAGRAM_PROFILE_POST_COUNT = 6;
const INSTAGRAM_PROFILE_GRID_CROP_TOP_PX = 156;

function resolveEmbed(rawUrl: string): ResolvedEmbed {
    const fallback: ResolvedEmbed = { platform: 'unknown', embedUrl: null, aspect: 'video' };
    if (!rawUrl) return fallback;

    let u: URL;
    try {
        u = new URL(rawUrl.trim());
    } catch {
        return fallback;
    }

    const host = u.hostname.toLowerCase().replace(/^www\./, '');

    // ---- YouTube ----
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be') {
        // Playlist
        const list = u.searchParams.get('list');
        if (list && /^[A-Za-z0-9_-]+$/.test(list)) {
            return {
                platform: 'youtube',
                embedUrl: `https://www.youtube.com/embed/videoseries?list=${list}&rel=0`,
                aspect: 'video',
            };
        }
        // Single video
        let videoId: string | null = null;
        if (host === 'youtu.be') {
            videoId = u.pathname.replace(/^\//, '').split('/')[0] || null;
        } else if (u.pathname.startsWith('/shorts/')) {
            videoId = u.pathname.split('/')[2] || null;
        } else if (u.pathname.startsWith('/embed/')) {
            videoId = u.pathname.split('/')[2] || null;
        } else {
            videoId = u.searchParams.get('v');
        }
        if (videoId && /^[A-Za-z0-9_-]+$/.test(videoId)) {
            return {
                platform: 'youtube',
                embedUrl: `https://www.youtube.com/embed/${videoId}?rel=0`,
                aspect: 'video',
            };
        }
        return { ...fallback, platform: 'youtube' };
    }

    // ---- Instagram (single post / reel / tv / public profile) ----
    if (host === 'instagram.com' || host.endsWith('.instagram.com')) {
        const m = u.pathname.match(/^\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
        if (m) {
            return {
                platform: 'instagram',
                embedUrl: `https://www.instagram.com/${m[1]}/${m[2]}/embed`,
                aspect: 'portrait',
            };
        }

        const username = getInstagramProfileUsername(u.pathname);
        if (username) {
            return {
                platform: 'instagram',
                embedUrl: `https://www.instagram.com/${username}/embed`,
                aspect: 'profile',
                kind: 'instagramProfile',
                label: 'Instagram profile embed',
                profileUsername: username,
            };
        }

        return { ...fallback, platform: 'instagram' };
    }

    // ---- TikTok (single video) ----
    if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
        const m = u.pathname.match(/\/video\/(\d+)/);
        if (m) {
            return {
                platform: 'tiktok',
                embedUrl: `https://www.tiktok.com/embed/v2/${m[1]}`,
                aspect: 'portrait',
            };
        }
        return { ...fallback, platform: 'tiktok' };
    }

    // ---- Twitter / X (single tweet) ----
    if (host === 'twitter.com' || host === 'x.com' || host.endsWith('.twitter.com') || host.endsWith('.x.com')) {
        const m = u.pathname.match(/\/status(?:es)?\/(\d+)/);
        if (m) {
            return {
                platform: 'twitter',
                embedUrl: `https://platform.twitter.com/embed/Tweet.html?id=${m[1]}&theme=light`,
                aspect: 'portrait',
            };
        }
        return { ...fallback, platform: 'twitter' };
    }

    // ---- Facebook (Page timeline / single post / video) ----
    if (host === 'facebook.com' || host.endsWith('.facebook.com') || host === 'fb.watch') {
        const encoded = encodeURIComponent(rawUrl);
        if (/\/(posts|videos|photos)\//.test(u.pathname)) {
            const isVideo = u.pathname.includes('/videos/');
            return {
                platform: 'facebook',
                embedUrl: isVideo
                    ? `https://www.facebook.com/plugins/video.php?href=${encoded}&show_text=false`
                    : `https://www.facebook.com/plugins/post.php?href=${encoded}&show_text=true`,
                aspect: isVideo ? 'video' : 'portrait',
            };
        }
        // Treat anything else as a Page URL -> Page timeline plugin
        return {
            platform: 'facebook',
            embedUrl: `https://www.facebook.com/plugins/page.php?href=${encoded}&tabs=timeline&width=500&height=600&small_header=false&adapt_container_width=true&hide_cover=false&show_facepile=true`,
            aspect: 'portrait',
        };
    }

    return fallback;
}

function getInstagramProfileUsername(pathname: string): string | null {
    const segments = pathname.split('/').filter(Boolean);
    const username = segments.length === 1
        ? segments[0]
        : segments.length === 2 && segments[1] === 'embed'
            ? segments[0]
            : null;

    if (!username) return null;
    const normalized = username.toLowerCase();
    if (INSTAGRAM_RESERVED_PATHS.has(normalized)) return null;
    return /^[A-Za-z0-9._]{1,30}$/.test(username) ? username : null;
}

function getInstagramProfileView(item: FeedItem, resolved: ResolvedEmbed): InstagramProfileView {
    if (resolved.kind !== 'instagramProfile') return 'profile';
    return item.instagramView === 'profile' ? 'profile' : 'latestPosts';
}

function normalizeInstagramPostCount(value: unknown): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return DEFAULT_INSTAGRAM_PROFILE_POST_COUNT;
    return Math.max(1, Math.min(MAX_INSTAGRAM_PROFILE_POST_COUNT, Math.round(numeric)));
}

function isInstagramLatestPostsItem(item: FeedItem): boolean {
    const resolved = resolveEmbed(item.url);
    return Boolean(
        resolved.embedUrl &&
        resolved.kind === 'instagramProfile' &&
        getInstagramProfileView(item, resolved) === 'latestPosts',
    );
}

function getInstagramLatestPostsGridClass(postCount: number): string {
    if (postCount === 1) return 'max-w-md mx-auto';
    if (postCount === 2) return 'max-w-4xl mx-auto';
    return 'max-w-6xl mx-auto';
}

function getInstagramLatestPostsDimensions(postCount: number): { columns: number; rows: number } {
    if (postCount === 1) return { columns: 1, rows: 1 };
    if (postCount === 2) return { columns: 2, rows: 1 };
    return { columns: 3, rows: Math.ceil(postCount / 3) };
}

const PLATFORM_META: Record<Exclude<Platform, 'unknown'>, { label: string; Icon: React.ComponentType<{ className?: string }>; color: string }> = {
    youtube: { label: 'YouTube', Icon: Youtube, color: '#FF0000' },
    instagram: { label: 'Instagram', Icon: Instagram, color: '#E1306C' },
    facebook: { label: 'Facebook', Icon: Facebook, color: '#1877F2' },
    tiktok: { label: 'TikTok', Icon: Music2, color: '#000000' },
    twitter: { label: 'X / Twitter', Icon: Twitter, color: '#000000' },
};

interface Props {
    block: BlockData;
    palette: Record<string, string>;
}

export default function SocialFeedBlock({ block, palette }: Props) {
    const context = useEditorContext();
    const isEditMode = context?.isEditMode || false;

    const title: string = block.data.title || '';
    const subtitle: string = block.data.subtitle || '';
    const variant: 'grid' | 'single' = block.data.variant || 'grid';
    const columns: 1 | 2 | 3 | 4 = block.data.columns || 3;
    const items: FeedItem[] = Array.isArray(block.data.items) ? block.data.items : [];
    const staggerSec = useStaggerSec();
    const hasInstagramLatestPosts = items.some(isInstagramLatestPostsItem);

    const [draftUrls, setDraftUrls] = useState<Record<string, string>>({});

    const updateData = (key: string, value: unknown) => {
        context?.updateBlockData?.(block.id, key, value);
    };

    const updateItems = (next: FeedItem[]) => updateData('items', next);

    const addItem = () => {
        updateItems([...items, { id: uuidv4(), url: '' }]);
    };

    const removeItem = (id: string) => {
        updateItems(items.filter((it) => it.id !== id));
    };

    const updateItem = (id: string, url: string) => {
        updateItems(items.map((it) => {
            if (it.id !== id) return it;
            const resolved = resolveEmbed(url);
            return {
                ...it,
                url,
                ...(resolved.kind === 'instagramProfile' && !it.instagramView
                    ? {
                        instagramView: 'latestPosts' as const,
                        instagramPostCount: DEFAULT_INSTAGRAM_PROFILE_POST_COUNT,
                    }
                    : {}),
            };
        }));
    };

    const updateItemOptions = (id: string, patch: Partial<FeedItem>) => {
        updateItems(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    };

    const gridColsClass =
        variant === 'single' && !hasInstagramLatestPosts
            ? 'grid-cols-1 max-w-xl mx-auto'
            : columns === 1 && !hasInstagramLatestPosts
            ? 'grid-cols-1 max-w-xl mx-auto'
            : variant === 'single' || columns === 1
            ? 'grid-cols-1'
            : columns === 2
            ? 'grid-cols-1 sm:grid-cols-2'
            : columns === 4
            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

    function EmbedFrame({ item }: { item: FeedItem }) {
        const resolved = resolveEmbed(item.url);
        const instagramProfileView = getInstagramProfileView(item, resolved);

        if (resolved.embedUrl && resolved.kind === 'instagramProfile' && instagramProfileView === 'latestPosts') {
            const postCount = normalizeInstagramPostCount(item.instagramPostCount);
            const { columns, rows } = getInstagramLatestPostsDimensions(postCount);
            const iframeWidthPercent = (3 / columns) * 100;
            const hiddenCellCount = (columns * rows) - postCount;
            const profileUsername = resolved.profileUsername;
            const profileUrl = profileUsername ? `https://www.instagram.com/${profileUsername}/` : item.url;

            return (
                <div className={`w-full ${getInstagramLatestPostsGridClass(postCount)}`}>
                    <div
                        className="relative w-full"
                        style={{ aspectRatio: `${columns} / ${rows}` }}
                    >
                        <div className="absolute inset-0 overflow-hidden bg-white">
                            <iframe
                                src={resolved.embedUrl}
                                className="absolute left-0 border-0"
                                style={{
                                    top: `-${INSTAGRAM_PROFILE_GRID_CROP_TOP_PX}px`,
                                    width: `${iframeWidthPercent}%`,
                                    height: `calc(${INSTAGRAM_PROFILE_GRID_CROP_TOP_PX}px + 100%)`,
                                }}
                                loading="lazy"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                                scrolling="no"
                                title="Instagram latest posts preview"
                            />
                            {hiddenCellCount > 0 && Array.from({ length: hiddenCellCount }, (_, index) => {
                                const cellIndex = postCount + index;
                                const col = cellIndex % columns;
                                const row = Math.floor(cellIndex / columns);
                                return (
                                    <div
                                        key={`instagram-hidden-cell-${cellIndex}`}
                                        className="absolute bg-white"
                                        style={{
                                            left: `${(col / columns) * 100}%`,
                                            top: `${(row / rows) * 100}%`,
                                            width: `${100 / columns}%`,
                                            height: `${100 / rows}%`,
                                        }}
                                    />
                                );
                            })}
                        </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm text-slate-600">
                        <Instagram className="h-4 w-4 text-pink-600" aria-hidden="true" />
                        {profileUsername && (
                            <span className="font-medium text-slate-700">@{profileUsername}</span>
                        )}
                        <a
                            href={profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-blue-600 hover:text-blue-700 hover:underline"
                        >
                            View profile
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                    </div>
                </div>
            );
        }

        const frameSizeClass =
            resolved.aspect === 'video'
                ? 'aspect-video'
                : resolved.aspect === 'square'
                ? 'aspect-square'
                : resolved.aspect === 'profile'
                ? 'h-[560px] min-h-[560px] max-h-[80vh]'
                : 'aspect-[9/16]';

        if (!item.url) {
            return (
                <div className={`relative w-full ${frameSizeClass} bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-sm`}>
                    {isEditMode ? 'Paste a social URL below' : ''}
                </div>
            );
        }

        if (!resolved.embedUrl) {
            const meta = resolved.platform !== 'unknown' ? PLATFORM_META[resolved.platform] : null;
            const PlatformIcon = meta?.Icon;
            return (
                <div className={`relative w-full ${frameSizeClass} bg-slate-50 border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-2 p-4`}>
                    {PlatformIcon ? <PlatformIcon className="w-8 h-8" /> : <ExternalLink className="w-8 h-8 text-slate-400" />}
                    <p className="text-xs text-slate-500 text-center">
                        {meta ? `Couldn't auto-embed this ${meta.label} URL.` : 'Unsupported URL'}
                    </p>
                    <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 underline truncate max-w-full"
                    >
                        Open original
                    </a>
                </div>
            );
        }

        return (
            <div className={`relative w-full ${frameSizeClass} bg-black rounded-xl overflow-hidden shadow-lg`}>
                <iframe
                    src={resolved.embedUrl}
                    className="absolute inset-0 w-full h-full"
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    scrolling={resolved.aspect === 'profile' ? 'auto' : 'no'}
                    title={resolved.label || `${resolved.platform} embed`}
                />
            </div>
        );
    }

    function ItemEditor({ item }: { item: FeedItem }) {
        const draft = draftUrls[item.id] ?? item.url;
        const resolved = resolveEmbed(item.url);
        const meta = resolved.platform !== 'unknown' ? PLATFORM_META[resolved.platform] : null;
        const PlatformIcon = meta?.Icon;
        const isInstagramProfile = resolved.kind === 'instagramProfile';
        const instagramProfileView = getInstagramProfileView(item, resolved);
        const instagramPostCount = normalizeInstagramPostCount(item.instagramPostCount);

        return (
            <div className="mt-2">
                <div className="flex items-center gap-2">
                    {PlatformIcon && meta ? (
                        <PlatformIcon className="w-4 h-4 shrink-0" />
                    ) : (
                        <LinkIcon className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <input
                        type="url"
                        value={draft}
                        onChange={(e) => setDraftUrls((d) => ({ ...d, [item.id]: e.target.value }))}
                        onBlur={() => {
                            if (draft !== item.url) updateItem(item.id, draft);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                            }
                        }}
                        placeholder="Paste a YouTube, Instagram post/profile, TikTok, X, or Facebook URL..."
                        className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                    <button
                        onClick={() => removeItem(item.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove"
                        type="button"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
                {isInstagramProfile && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-2">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Instagram view</span>
                        <button
                            type="button"
                            onClick={() => updateItemOptions(item.id, {
                                instagramView: 'latestPosts',
                                instagramPostCount,
                            })}
                            className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                                instagramProfileView === 'latestPosts'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            Latest posts
                        </button>
                        <button
                            type="button"
                            onClick={() => updateItemOptions(item.id, { instagramView: 'profile' })}
                            className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                                instagramProfileView === 'profile'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            Full profile
                        </button>
                        {instagramProfileView === 'latestPosts' && (
                            <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-slate-500">
                                Posts
                                <select
                                    value={instagramPostCount}
                                    onChange={(event) => updateItemOptions(item.id, {
                                        instagramPostCount: normalizeInstagramPostCount(event.target.value),
                                    })}
                                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {Array.from({ length: MAX_INSTAGRAM_PROFILE_POST_COUNT }, (_, index) => index + 1).map((count) => (
                                        <option key={count} value={count}>{count}</option>
                                    ))}
                                </select>
                            </label>
                        )}
                    </div>
                )}
            </div>
        );
    }

    const accent = palette?.primary || '#0ea5e9';

    return (
        <section className="py-12 bg-white">
            <div className="max-w-7xl mx-auto px-4">
                {/* Title */}
                {(title || isEditMode) && (
                    <div className="mb-3 text-center">
                        {isEditMode ? (
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => updateData('title', e.target.value)}
                                placeholder="Section title (optional)"
                                className="text-2xl md:text-3xl font-bold text-slate-900 w-full text-center bg-transparent border-b border-dashed border-slate-300 outline-none focus:border-slate-500 pb-1"
                            />
                        ) : (
                            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">{title}</h2>
                        )}
                    </div>
                )}

                {/* Subtitle */}
                {(subtitle || isEditMode) && (
                    <div className="mb-8 text-center">
                        {isEditMode ? (
                            <input
                                type="text"
                                value={subtitle}
                                onChange={(e) => updateData('subtitle', e.target.value)}
                                placeholder="Subtitle (optional)"
                                className="text-base text-slate-500 w-full text-center bg-transparent border-b border-dashed border-slate-200 outline-none focus:border-slate-400 pb-1 max-w-2xl mx-auto block"
                            />
                        ) : (
                            <p className="text-base text-slate-500 max-w-2xl mx-auto">{subtitle}</p>
                        )}
                    </div>
                )}

                {/* Empty state */}
                {items.length === 0 && (
                    isEditMode ? (
                        <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
                            <div className="flex justify-center gap-3 mb-4 text-slate-400">
                                <Instagram className="w-6 h-6" />
                                <Youtube className="w-6 h-6" />
                                <Facebook className="w-6 h-6" />
                                <Twitter className="w-6 h-6" />
                                <Music2 className="w-6 h-6" />
                            </div>
                            <p className="text-sm text-slate-500 mb-4">
                                Add social posts, videos, tweets, Instagram profiles, or your Facebook page to embed below.
                            </p>
                            <button
                                onClick={addItem}
                                type="button"
                                className="inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg shadow hover:shadow-md transition-all"
                                style={{ backgroundColor: accent }}
                            >
                                <Plus className="w-4 h-4" /> Add first embed
                            </button>
                        </div>
                    ) : null
                )}

                {/* Grid of embeds */}
                {items.length > 0 && (
                    <div className={`grid ${gridColsClass} gap-6`}>
                        {items.map((item, index) => {
                            const isLatestPostsGrid = isInstagramLatestPostsItem(item);
                            return (
                                <Reveal
                                    key={item.id}
                                    delay={index * staggerSec}
                                    className={`flex flex-col ${isLatestPostsGrid ? 'col-span-full' : ''}`}
                                >
                                    <EmbedFrame item={item} />
                                    {isEditMode && <ItemEditor item={item} />}
                                </Reveal>
                            );
                        })}
                    </div>
                )}

                {/* Add button (edit mode, when there are existing items) */}
                {isEditMode && items.length > 0 && (
                    <div className="mt-6 flex justify-center">
                        <button
                            onClick={addItem}
                            type="button"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
                        >
                            <Plus className="w-4 h-4" /> Add another
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}
