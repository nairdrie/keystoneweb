'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Loader2, Video } from 'lucide-react';

interface PexelsVideo {
    id: number;
    image: string;
    duration: number;
    width: number;
    height: number;
    videoUrl: string;
    previewUrl: string;
    user: { name: string; url: string };
    pexelsUrl: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (videoUrl: string) => void;
    initialQuery?: string;
}

export default function PexelsVideoPickerModal({ isOpen, onClose, onSelect, initialQuery = '' }: Props) {
    const [query, setQuery] = useState(initialQuery);
    const [videos, setVideos] = useState<PexelsVideo[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [page, setPage] = useState(1);
    const [totalResults, setTotalResults] = useState(0);
    const [hoveredId, setHoveredId] = useState<number | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});

    const searchPexels = useCallback(async (q: string, p = 1, append = false) => {
        if (!q.trim()) return;
        setLoading(true);
        if (!append) setHasSearched(false);
        try {
            const res = await fetch(`/api/pexels?query=${encodeURIComponent(q)}&page=${p}&per_page=15`);
            const data = await res.json();
            if (append) {
                setVideos(prev => [...prev, ...(data.videos || [])]);
            } else {
                setVideos(data.videos || []);
            }
            setTotalResults(data.totalResults || 0);
            setPage(p);
            setHasSearched(true);
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }, []);

    // Auto-search when modal opens with initial query
    useEffect(() => {
        if (isOpen && initialQuery) {
            setQuery(initialQuery);
            searchPexels(initialQuery);
        }
    }, [isOpen, initialQuery, searchPexels]);

    const handleQueryChange = (val: string) => {
        setQuery(val);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setVideos([]);
            searchPexels(val, 1);
        }, 500);
    };

    const handleHover = (video: PexelsVideo, entering: boolean) => {
        setHoveredId(entering ? video.id : null);
        const el = videoRefs.current[video.id];
        if (!el) return;
        if (entering) {
            el.play().catch(() => {});
        } else {
            el.pause();
            el.currentTime = 0;
        }
    };

    const handleSelect = (video: PexelsVideo) => {
        onSelect(video.videoUrl);
        onClose();
    };

    const perPage = 15;
    const hasMore = videos.length < totalResults && totalResults > 0;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                        <Video className="w-5 h-5 text-slate-600" />
                        <h2 className="text-lg font-semibold text-slate-800">Search Pexels Videos</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search */}
                <div className="px-6 py-4 border-b border-slate-100">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search free high-quality videos..."
                            value={query}
                            onChange={(e) => handleQueryChange(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    if (debounceRef.current) clearTimeout(debounceRef.current);
                                    setVideos([]);
                                    searchPexels(query, 1);
                                }
                            }}
                            autoFocus
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                </div>

                {/* Results */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {loading && videos.length === 0 ? (
                        <div className="text-center py-16">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
                            <p className="text-sm text-slate-500 mt-3">Searching Pexels...</p>
                        </div>
                    ) : videos.length > 0 ? (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {videos.map(video => (
                                    <div
                                        key={video.id}
                                        onClick={() => handleSelect(video)}
                                        onMouseEnter={() => handleHover(video, true)}
                                        onMouseLeave={() => handleHover(video, false)}
                                        className="group cursor-pointer rounded-lg overflow-hidden border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all"
                                    >
                                        <div className="relative aspect-video bg-slate-900">
                                            {/* Thumbnail */}
                                            <img
                                                src={video.image}
                                                alt=""
                                                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${hoveredId === video.id ? 'opacity-0' : 'opacity-100'}`}
                                                loading="lazy"
                                            />
                                            {/* Preview video — only rendered on hover to save bandwidth */}
                                            <video
                                                ref={el => { videoRefs.current[video.id] = el; }}
                                                src={video.previewUrl}
                                                muted
                                                loop
                                                playsInline
                                                preload="none"
                                                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${hoveredId === video.id ? 'opacity-100' : 'opacity-0'}`}
                                            />
                                            {/* Duration badge */}
                                            <span className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
                                                {Math.floor(video.duration / 60)}:{String(video.duration % 60).padStart(2, '0')}
                                            </span>
                                            {/* Select overlay */}
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-bold bg-blue-600 px-3 py-1.5 rounded-full shadow-lg">
                                                    Select
                                                </span>
                                            </div>
                                        </div>
                                        {/* Attribution */}
                                        <div className="px-2 py-1.5 bg-slate-50 text-xs text-slate-500 truncate">
                                            Video by{' '}
                                            <a
                                                href={video.user.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="text-slate-700 hover:underline font-medium"
                                            >
                                                {video.user.name}
                                            </a>
                                            {' on '}
                                            <a
                                                href={video.pexelsUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="text-slate-700 hover:underline font-medium"
                                            >
                                                Pexels
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {hasMore && (
                                <button
                                    onClick={() => searchPexels(query, page + 1, true)}
                                    disabled={loading}
                                    className="mt-4 w-full py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {loading ? 'Loading...' : 'Load more'}
                                </button>
                            )}
                        </>
                    ) : hasSearched && !loading ? (
                        <div className="text-center py-16 text-slate-500">
                            <Video className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                            <p className="font-medium">No videos found</p>
                            <p className="text-sm mt-1">Try a different search term</p>
                        </div>
                    ) : (
                        <div className="text-center py-16 text-slate-500">
                            <Search className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                            <p className="font-medium">Search for videos</p>
                            <p className="text-sm mt-1">Find free high-quality videos from Pexels</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-xs text-slate-400">
                        Videos provided by{' '}
                        <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer" className="underline">
                            Pexels
                        </a>
                    </p>
                    <button
                        onClick={onClose}
                        className="text-sm text-slate-500 hover:text-slate-700 font-medium"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
