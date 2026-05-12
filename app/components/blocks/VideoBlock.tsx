'use client';

import { useState } from 'react';
import { Play, Video, ExternalLink } from 'lucide-react';
import { BlockData, useEditorContext } from '@/lib/editor-context';
import Reveal from '@/app/components/Reveal';

/**
 * Converts a user-pasted YouTube / Vimeo / raw URL into an embeddable src.
 * Returns null if the URL can't be embedded.
 */
function toEmbedUrl(url: string): string | null {
    if (!url) return null;
    try {
        const u = new URL(url);

        // YouTube: youtube.com/watch?v=ID  or  youtu.be/ID
        const ytMatch =
            u.hostname.includes('youtube.com')
                ? u.searchParams.get('v')
                : u.hostname === 'youtu.be'
                ? u.pathname.slice(1)
                : null;
        if (ytMatch) {
            return `https://www.youtube.com/embed/${ytMatch}?rel=0`;
        }

        // Vimeo: vimeo.com/ID
        if (u.hostname.includes('vimeo.com')) {
            const id = u.pathname.replace(/^\//, '').split('/')[0];
            if (id) return `https://player.vimeo.com/video/${id}`;
        }

        // Already an embed URL — pass through
        if (url.includes('/embed/') || url.includes('player.vimeo.com')) {
            return url;
        }

        // Direct video file (.mp4, .webm, .ogg) — handled separately via <video>
        if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) {
            return url;
        }

        return null;
    } catch {
        return null;
    }
}

function isDirectVideoFile(url: string) {
    return /\.(mp4|webm|ogg)(\?|$)/i.test(url);
}

interface Props {
    block: BlockData;
    palette: Record<string, string>;
}

export default function VideoBlock({ block, palette }: Props) {
    const context = useEditorContext();
    const isEditMode = context?.isEditMode || false;

    const videoUrl: string = block.data.videoUrl || '';
    const caption: string = block.data.caption || '';
    const variant: 'contained' | 'fullWidth' = block.data.variant || 'contained';
    const title: string = block.data.title || '';

    const [editingUrl, setEditingUrl] = useState(false);
    const [draftUrl, setDraftUrl] = useState(videoUrl);

    const updateData = (key: string, value: string) => {
        context?.updateBlockData?.(block.id, key, value);
    };

    const embedUrl = toEmbedUrl(videoUrl);
    const isDirect = isDirectVideoFile(videoUrl);

    // ---- wrappers ----
    const outerClass =
        variant === 'fullWidth'
            ? 'w-full bg-black'
            : 'py-12 bg-white';

    const innerClass =
        variant === 'fullWidth'
            ? 'w-full'
            : 'max-w-4xl mx-auto px-4';

    const aspectClass = 'relative w-full aspect-video';

    // ---- video player ----
    function VideoPlayer() {
        if (!videoUrl) return null;

        if (isDirect) {
            return (
                <video
                    src={videoUrl}
                    controls
                    className="w-full h-full"
                    style={variant === 'contained' ? { borderRadius: '0.75rem' } : undefined}
                >
                    Your browser does not support the video tag.
                </video>
            );
        }

        if (embedUrl) {
            return (
                <iframe
                    src={embedUrl}
                    className="absolute inset-0 w-full h-full"
                    style={variant === 'contained' ? { borderRadius: '0.75rem' } : undefined}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={title || 'Video'}
                />
            );
        }

        // Unrecognised URL
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 rounded-xl gap-2">
                <ExternalLink className="w-8 h-8 text-slate-400" />
                <p className="text-sm text-slate-500">Unsupported video URL</p>
                <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 underline truncate max-w-xs">
                    {videoUrl}
                </a>
            </div>
        );
    }

    // ---- empty state (edit mode) ----
    function EmptyState() {
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 rounded-xl gap-3 cursor-pointer group"
                onClick={() => setEditingUrl(true)}>
                <div className="w-16 h-16 rounded-full bg-white shadow flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Play className="w-7 h-7 text-slate-400 ml-1" />
                </div>
                <p className="text-sm font-medium text-slate-500">Click to add a video URL</p>
                <p className="text-xs text-slate-400">YouTube, Vimeo, or direct .mp4 link</p>
            </div>
        );
    }

    return (
        <section className={outerClass}>
            <Reveal className={innerClass}>
                {/* Optional title */}
                {(title || isEditMode) && variant === 'contained' && (
                    <div className="mb-4 text-center">
                        {isEditMode ? (
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => updateData('title', e.target.value)}
                                placeholder="Section title (optional)"
                                className="text-xl font-bold text-slate-800 w-full text-center bg-transparent border-b border-dashed border-slate-300 outline-none focus:border-slate-500 pb-1"
                            />
                        ) : (
                            title && <h2 className="text-xl font-bold text-slate-800">{title}</h2>
                        )}
                    </div>
                )}

                {/* Video area */}
                <div className={variant === 'contained' ? `${aspectClass} rounded-xl overflow-hidden shadow-lg` : aspectClass}>
                    {!videoUrl && isEditMode ? (
                        <EmptyState />
                    ) : (
                        <VideoPlayer />
                    )}
                </div>

                {/* Caption */}
                {(caption || isEditMode) && (
                    <div className={`mt-3 ${variant === 'fullWidth' ? 'px-4' : ''}`}>
                        {isEditMode ? (
                            <input
                                type="text"
                                value={caption}
                                onChange={(e) => updateData('caption', e.target.value)}
                                placeholder="Caption (optional)"
                                className="text-sm text-slate-500 w-full bg-transparent border-b border-dashed border-slate-200 outline-none focus:border-slate-400 pb-0.5"
                            />
                        ) : (
                            caption && <p className="text-sm text-slate-500 text-center">{caption}</p>
                        )}
                    </div>
                )}

                {/* Edit-mode URL input */}
                {isEditMode && (
                    <div className="mt-4 flex gap-2 items-center">
                        <Video className="w-4 h-4 text-slate-400 shrink-0" />
                        {editingUrl ? (
                            <>
                                <input
                                    type="url"
                                    value={draftUrl}
                                    onChange={(e) => setDraftUrl(e.target.value)}
                                    placeholder="Paste YouTube, Vimeo, or direct video URL…"
                                    autoFocus
                                    className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <button
                                    onClick={() => {
                                        updateData('videoUrl', draftUrl);
                                        setEditingUrl(false);
                                    }}
                                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                                >
                                    Set
                                </button>
                                <button
                                    onClick={() => { setDraftUrl(videoUrl); setEditingUrl(false); }}
                                    className="px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => { setDraftUrl(videoUrl); setEditingUrl(true); }}
                                className="text-sm text-blue-600 hover:underline truncate max-w-xs"
                            >
                                {videoUrl ? videoUrl : 'Add video URL…'}
                            </button>
                        )}
                    </div>
                )}
            </Reveal>
        </section>
    );
}
