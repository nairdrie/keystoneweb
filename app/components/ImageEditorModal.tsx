'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Search, Image as ImageIcon, Loader2, Settings, Camera } from 'lucide-react';

interface UnsplashPhoto {
    id: string;
    urls: { small: string; regular: string; full: string };
    alt: string;
    width: number;
    height: number;
    photographer: {
        name: string;
        username: string;
        profileUrl: string;
    };
    unsplashUrl: string;
    downloadEndpoint: string;
}

export interface ImageSettings {
    objectFit?: 'cover' | 'contain' | 'fill';
    borderRadius?: number;
}

export interface UnsplashAttribution {
    photographerName: string;
    photographerUrl: string;
    unsplashUrl: string;
}

interface ImageEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentImageUrl?: string;
    siteCategory?: string;
    siteId: string;
    onSave: (imageUrl: string, settings: ImageSettings, attribution?: UnsplashAttribution) => void;
    onUpload: (file: File, contentKey: string) => Promise<string>;
    contentKey: string;
    currentSettings?: ImageSettings;
    allowUnsplash?: boolean;
}

type Tab = 'upload' | 'unsplash' | 'settings';

export default function ImageEditorModal({
    isOpen,
    onClose,
    currentImageUrl,
    siteCategory,
    siteId,
    onSave,
    onUpload,
    contentKey,
    currentSettings,
    allowUnsplash = true,
}: ImageEditorModalProps) {
    const [activeTab, setActiveTab] = useState<Tab>('upload');
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Unsplash state
    const [searchQuery, setSearchQuery] = useState('');
    const [photos, setPhotos] = useState<UnsplashPhoto[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [hasSearched, setHasSearched] = useState(false);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Settings state
    const [settings, setSettings] = useState<ImageSettings>(
        currentSettings || { objectFit: 'cover', borderRadius: 0 }
    );

    // Selected image preview
    const [previewUrl, setPreviewUrl] = useState<string | undefined>(currentImageUrl);
    const [pendingAttribution, setPendingAttribution] = useState<UnsplashAttribution | undefined>();

    // Reset state when opening
    useEffect(() => {
        if (isOpen) {
            setActiveTab(currentImageUrl ? 'settings' : 'upload');
            setPreviewUrl(currentImageUrl);
            setSettings(currentSettings || { objectFit: 'cover', borderRadius: 0 });
            setError(null);
            setPendingAttribution(undefined);
            setPhotos([]);
            setHasSearched(false);
            setSearchQuery('');
        }
    }, [isOpen, currentImageUrl, currentSettings]);

    // Auto-search Unsplash when switching to that tab
    useEffect(() => {
        if (activeTab === 'unsplash' && !hasSearched && siteCategory) {
            searchUnsplash(siteCategory, 1);
            setSearchQuery(siteCategory);
        }
    }, [activeTab, hasSearched, siteCategory]);

    const searchUnsplash = useCallback(async (query: string, pageNum: number) => {
        if (!query.trim()) return;

        try {
            setSearchLoading(true);
            setError(null);

            const res = await fetch(`/api/unsplash?query=${encodeURIComponent(query)}&page=${pageNum}&per_page=20`);
            if (!res.ok) throw new Error('Failed to search Unsplash');

            const data = await res.json();
            if (pageNum === 1) {
                setPhotos(data.photos);
            } else {
                setPhotos(prev => {
                    const existingIds = new Set(prev.map(p => p.id));
                    const newPhotos = data.photos.filter((p: UnsplashPhoto) => !existingIds.has(p.id));
                    return [...prev, ...newPhotos];
                });
            }
            setTotalPages(data.totalPages);
            setPage(pageNum);
            setHasSearched(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Search failed');
        } finally {
            setSearchLoading(false);
        }
    }, []);

    // Debounced search
    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(() => {
            if (value.trim()) {
                searchUnsplash(value, 1);
            }
        }, 500);
    };

    // Handle file upload
    const handleFileUpload = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            setError('Please select an image file');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setError('Image must be less than 10MB');
            return;
        }

        try {
            setIsUploading(true);
            setError(null);
            const uploadedUrl = await onUpload(file, contentKey);
            setPreviewUrl(uploadedUrl);
            setPendingAttribution(undefined);
            // Auto-save on upload
            onSave(uploadedUrl, settings, undefined);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setIsUploading(false);
        }
    };

    // Handle Unsplash selection
    const handleUnsplashSelect = async (photo: UnsplashPhoto) => {
        try {
            setIsUploading(true);
            setError(null);

            // 1. Trigger download tracking (best-effort)
            fetch('/api/unsplash/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ downloadEndpoint: photo.downloadEndpoint }),
            }).catch(() => { }); // Best effort

            // 2. Re-upload to Supabase via URL
            const formData = new FormData();
            formData.append('imageUrl', photo.urls.regular);
            formData.append('siteId', siteId);

            const res = await fetch('/api/sites/upload-image', {
                method: 'POST',
                body: formData,
                credentials: 'include',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to upload image');
            }

            const { imageUrl } = await res.json();

            const attribution: UnsplashAttribution = {
                photographerName: photo.photographer.name,
                photographerUrl: photo.photographer.profileUrl,
                unsplashUrl: photo.unsplashUrl,
            };

            setPreviewUrl(imageUrl);
            setPendingAttribution(attribution);
            onSave(imageUrl, settings, attribution);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to use image');
        } finally {
            setIsUploading(false);
        }
    };

    // Drag & drop handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };
    const handleDragLeave = () => setIsDragging(false);
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFileUpload(file);
    };

    if (!isOpen) return null;

    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: 'upload', label: 'Upload', icon: <Upload className="w-4 h-4" /> },
        ...(allowUnsplash ? [{ id: 'unsplash' as Tab, label: 'Unsplash', icon: <Camera className="w-4 h-4" /> }] : []),
        ...(previewUrl ? [{ id: 'settings' as Tab, label: 'Settings', icon: <Settings className="w-4 h-4" /> }] : []),
    ];

    const modal = (
        <div
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                    <h2 className="text-lg font-bold text-slate-900">Image Editor</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 px-6">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Error */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    {/* Loading overlay */}
                    {isUploading && (
                        <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center rounded-2xl">
                            <div className="flex items-center gap-3 text-slate-700">
                                <Loader2 className="w-6 h-6 animate-spin" />
                                <span className="font-medium">Processing image...</span>
                            </div>
                        </div>
                    )}

                    {/* Upload Tab */}
                    {activeTab === 'upload' && (
                        <div>
                            <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${isDragging
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                                    }`}
                            >
                                <Upload className="w-10 h-10 mx-auto text-slate-400 mb-3" />
                                <p className="text-base font-semibold text-slate-700">
                                    Drop an image here or click to browse
                                </p>
                                <p className="text-sm text-slate-500 mt-1">
                                    PNG, JPG, GIF, WebP — up to 10MB
                                </p>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFileUpload(file);
                                }}
                                className="hidden"
                            />

                            {/* Current image preview */}
                            {previewUrl && (
                                <div className="mt-6">
                                    <p className="text-sm font-medium text-slate-600 mb-2">Current image</p>
                                    <img
                                        src={previewUrl}
                                        alt="Current"
                                        className="w-full h-48 object-cover rounded-lg border border-slate-200"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Unsplash Tab */}
                    {activeTab === 'unsplash' && (
                        <div>
                            {/* Search bar */}
                            <div className="relative mb-4">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search free high-resolution photos..."
                                    value={searchQuery}
                                    onChange={(e) => handleSearchChange(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>

                            {/* Results grid */}
                            {photos.length > 0 ? (
                                <>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {photos.map(photo => (
                                            <div
                                                key={photo.id}
                                                onClick={() => handleUnsplashSelect(photo)}
                                                className="group cursor-pointer rounded-lg overflow-hidden border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all"
                                            >
                                                {/* Hotlink the image directly from Unsplash CDN (required by API guidelines) */}
                                                <div className="relative aspect-[4/3]">
                                                    <img
                                                        src={photo.urls.small}
                                                        alt={photo.alt}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                        loading="lazy"
                                                    />
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                        <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-bold bg-blue-600 px-3 py-1.5 rounded-full">
                                                            Select
                                                        </span>
                                                    </div>
                                                </div>
                                                {/* Attribution (required by Unsplash API) */}
                                                <div className="px-2 py-1.5 bg-slate-50 text-xs text-slate-500 truncate">
                                                    Photo by{' '}
                                                    <a
                                                        href={photo.photographer.profileUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="text-slate-700 hover:underline font-medium"
                                                    >
                                                        {photo.photographer.name}
                                                    </a>
                                                    {' on '}
                                                    <a
                                                        href={photo.unsplashUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="text-slate-700 hover:underline font-medium"
                                                    >
                                                        Unsplash
                                                    </a>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Load more */}
                                    {page < totalPages && (
                                        <button
                                            onClick={() => searchUnsplash(searchQuery, page + 1)}
                                            disabled={searchLoading}
                                            className="mt-4 w-full py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            {searchLoading ? 'Loading...' : 'Load more'}
                                        </button>
                                    )}
                                </>
                            ) : hasSearched && !searchLoading ? (
                                <div className="text-center py-12 text-slate-500">
                                    <ImageIcon className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                                    <p className="font-medium">No photos found</p>
                                    <p className="text-sm mt-1">Try a different search term</p>
                                </div>
                            ) : searchLoading ? (
                                <div className="text-center py-12">
                                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
                                    <p className="text-sm text-slate-500 mt-3">Searching Unsplash...</p>
                                </div>
                            ) : (
                                <div className="text-center py-12 text-slate-500">
                                    <Search className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                                    <p className="font-medium">Search for images</p>
                                    <p className="text-sm mt-1">Find free high-resolution photos from Unsplash</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Settings Tab */}
                    {activeTab === 'settings' && previewUrl && (
                        <div className="space-y-6">
                            {/* Preview */}
                            <div>
                                <p className="text-sm font-medium text-slate-600 mb-2">Preview</p>
                                <div
                                    className="border border-slate-200 rounded-lg overflow-hidden bg-slate-100"
                                    style={{ borderRadius: settings.borderRadius ? `${settings.borderRadius}px` : undefined }}
                                >
                                    <img
                                        src={previewUrl}
                                        alt="Preview"
                                        className="w-full h-48"
                                        style={{ objectFit: settings.objectFit || 'cover' }}
                                    />
                                </div>
                            </div>

                            {/* Object Fit */}
                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-2 block">Image Fit</label>
                                <div className="flex gap-2">
                                    {(['cover', 'contain', 'fill'] as const).map(fit => (
                                        <button
                                            key={fit}
                                            onClick={() => setSettings(prev => ({ ...prev, objectFit: fit }))}
                                            className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg border transition-colors capitalize ${settings.objectFit === fit
                                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                                                }`}
                                        >
                                            {fit}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-slate-400 mt-1">
                                    {settings.objectFit === 'cover' && 'Fills the area, may crop edges'}
                                    {settings.objectFit === 'contain' && 'Shows entire image, may have padding'}
                                    {settings.objectFit === 'fill' && 'Stretches to fill, may distort'}
                                </p>
                            </div>

                            {/* Border Radius */}
                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-2 block">
                                    Rounded Corners: {settings.borderRadius || 0}px
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="32"
                                    value={settings.borderRadius || 0}
                                    onChange={(e) => setSettings(prev => ({ ...prev, borderRadius: parseInt(e.target.value) }))}
                                    className="w-full accent-blue-600"
                                />
                            </div>

                            {/* Apply button */}
                            <button
                                onClick={() => {
                                    onSave(previewUrl!, settings, pendingAttribution);
                                    onClose();
                                }}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors"
                            >
                                Apply Settings
                            </button>

                            {/* Remove image */}
                            <button
                                onClick={() => {
                                    onSave('', settings, undefined);
                                    onClose();
                                }}
                                className="w-full py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                                Remove Image
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(modal, document.body);
}
