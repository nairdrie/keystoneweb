'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Code, Lock, Crown, Image as ImageIcon, Upload, Trash2, LayoutTemplate } from 'lucide-react';
import { useEditorContext } from '@/lib/editor-context';

interface BlockSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    blockId: string;
    blockType: string;
    blockData?: any;
    onUpdateBlockData?: (key: string, value: any) => void;
    customCss: string;
    onSaveCustomCss: (css: string) => void;
    isProUser: boolean;
}

export default function BlockSettingsModal({
    isOpen,
    onClose,
    blockId,
    blockType,
    blockData,
    onUpdateBlockData,
    customCss,
    onSaveCustomCss,
    isProUser,
}: BlockSettingsModalProps) {
    const context = useEditorContext();
    const { uploadImage } = context || {};

    const VARIANTS: Record<string, { id: string, label: string }[]> = {
        hero: [
            { id: 'split', label: 'Split (Text / Image)' },
            { id: 'centered', label: 'Centered Hero' },
            { id: 'fullImage', label: 'Full Image Background' },
            { id: 'minimal', label: 'Minimal / Clean' },
            { id: 'video', label: 'Video Background' }
        ],
        testimonials: [
            { id: 'cards', label: 'Multiple Cards' },
            { id: 'single', label: 'Single Focus' }
        ],
        team: [
            { id: 'grid', label: 'Simple Grid' },
            { id: 'cards', label: 'Detailed Cards' },
            { id: 'minimal', label: 'Minimalist' }
        ],
        stats: [
            { id: 'banner', label: 'Horizontal Banner' },
            { id: 'cards', label: 'Statistic Cards' }
        ],
        pricing: [
            { id: 'cards', label: 'Pricing Cards' },
            { id: 'comparison', label: 'Comparison Table' },
            { id: 'simple', label: 'Simple List' }
        ],
        logoCloud: [
            { id: 'inline', label: 'Inline Row' },
            { id: 'grid', label: 'Logo Grid' },
            { id: 'marquee', label: 'Scrolling Marquee' }
        ]
    };

    const hasVariantSettings = !!VARIANTS[blockType];
    const hasBackgroundSettings = blockType === 'hero';

    type TabType = 'layout' | 'background' | 'css';
    const defaultTab: TabType = hasVariantSettings ? 'layout' : (hasBackgroundSettings ? 'background' : 'css');

    const [localCss, setLocalCss] = useState(customCss);
    const [activeTab, setActiveTab] = useState<TabType>(defaultTab);
    
    // Background State
    const [bgType, setBgType] = useState<string>(blockData?.bgType || 'color');
    const [bgColor, setBgColor] = useState<string>(blockData?.backgroundColor || '');
    const [bgImage, setBgImage] = useState<string>(blockData?.bgImage || '');
    const [bgCarouselImages, setBgCarouselImages] = useState<string[]>(blockData?.bgCarouselImages || []);
    const [bgCarouselTiming, setBgCarouselTiming] = useState<number>(blockData?.bgCarouselTiming || 5);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setLocalCss(customCss);
            setActiveTab(defaultTab);
            setBgType(blockData?.bgType || 'color');
            setBgColor(blockData?.backgroundColor || '');
            setBgImage(blockData?.bgImage || '');
            setBgCarouselImages(blockData?.bgCarouselImages || []);
            setBgCarouselTiming(blockData?.bgCarouselTiming || 5);
        }
    }, [isOpen, customCss, blockType, blockData, defaultTab]);

    if (!isOpen) return null;

    const handleSave = () => {
        onSaveCustomCss(localCss);
        if (onUpdateBlockData && blockType === 'hero') {
            onUpdateBlockData('bgType', bgType);
            onUpdateBlockData('backgroundColor', bgColor);
            onUpdateBlockData('bgImage', bgImage);
            onUpdateBlockData('bgCarouselImages', bgCarouselImages);
            onUpdateBlockData('bgCarouselTiming', bgCarouselTiming);
        }
        onClose();
    };

    const handleSelectVariant = (variantId: string) => {
        if (onUpdateBlockData) {
            onUpdateBlockData('variant', variantId);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isCarousel: boolean) => {
        const file = e.target.files?.[0];
        if (!file || !uploadImage) return;

        setIsUploading(true);
        try {
            const url = await uploadImage(file, isCarousel ? 'bgCarouselImages' : 'bgImage');
            if (isCarousel) {
                setBgCarouselImages(prev => [...prev, url]);
            } else {
                setBgImage(url);
            }
        } catch (error) {
            console.error('Image upload failed:', error);
            alert('Failed to upload image. Please try again.');
        } finally {
            setIsUploading(false);
            if (e.target) e.target.value = '';
        }
    };

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
                    <h2 className="text-lg font-bold text-slate-900">Block Settings</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Tab bar */}
                <div className="flex border-b border-slate-200 px-6">
                    {hasVariantSettings && (
                        <button
                            onClick={() => setActiveTab('layout')}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === 'layout' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <LayoutTemplate className="w-4 h-4" />
                            Layout
                        </button>
                    )}
                    {hasBackgroundSettings && (
                        <button
                            onClick={() => setActiveTab('background')}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === 'background' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <ImageIcon className="w-4 h-4" />
                            Background
                        </button>
                    )}
                    <button
                        onClick={() => setActiveTab('css')}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === 'css' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <Code className="w-4 h-4" />
                        Custom CSS
                        {!isProUser && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'layout' && hasVariantSettings ? (
                        <div className="space-y-4">
                            <p className="text-sm font-medium text-slate-700 mb-4">Select a Layout Variant</p>
                            <div className="grid grid-cols-2 gap-3">
                                {VARIANTS[blockType].map((variantOption) => {
                                    const currentVariant = blockData?.variant || VARIANTS[blockType][0].id;
                                    const isSelected = currentVariant === variantOption.id;
                                    return (
                                        <button
                                            key={variantOption.id}
                                            onClick={() => handleSelectVariant(variantOption.id)}
                                            className={`p-4 border rounded-xl text-left transition-all ${
                                                isSelected 
                                                    ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600 shadow-sm' 
                                                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className="font-semibold text-sm text-slate-900">{variantOption.label}</div>
                                            <div className="text-xs text-slate-500 mt-1 capitalize font-mono text-[10px]">{variantOption.id} Variant</div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : activeTab === 'background' && hasBackgroundSettings ? (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Background Type</label>
                                <select 
                                    value={bgType}
                                    onChange={(e) => setBgType(e.target.value)}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="color">Color / Gradient</option>
                                    <option value="image">Single Image</option>
                                    <option value="carousel">Image Carousel</option>
                                </select>
                            </div>

                            {bgType === 'color' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Background Color</label>
                                    <div className="flex items-center gap-3">
                                        <input 
                                            type="color" 
                                            value={bgColor || '#000000'} 
                                            onChange={(e) => setBgColor(e.target.value)}
                                            className="w-10 h-10 rounded cursor-pointer"
                                        />
                                        <input 
                                            type="text" 
                                            value={bgColor} 
                                            onChange={(e) => setBgColor(e.target.value)}
                                            placeholder="Default (Palette Secondary)"
                                            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <button 
                                            onClick={() => setBgColor('')}
                                            className="px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                                        >
                                            Reset
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2">Leave blank to use the site's default style.</p>
                                </div>
                            )}

                            {bgType === 'image' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Background Image</label>
                                    {bgImage && (
                                        <div className="relative w-full h-40 rounded-lg overflow-hidden border border-slate-200 mb-3 group">
                                            <img src={bgImage} alt="Background" className="w-full h-full object-cover" />
                                            <button 
                                                onClick={() => setBgImage('')}
                                                className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-md hover:bg-red-50 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                    <label className="flex items-center justify-center w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 border-dashed rounded-lg p-4 cursor-pointer transition-colors">
                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, false)} disabled={isUploading} />
                                        <div className="flex items-center gap-2 text-slate-600 font-medium">
                                            {isUploading ? <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}
                                            {isUploading ? 'Uploading...' : 'Upload Image'}
                                        </div>
                                    </label>
                                </div>
                            )}

                            {bgType === 'carousel' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Carousel Images</label>
                                    <div className="grid grid-cols-3 gap-3 mb-3">
                                        {bgCarouselImages.map((img, i) => (
                                            <div key={i} className="relative aspect-video rounded-lg overflow-hidden border border-slate-200 group">
                                                <img src={img} alt={`Slide ${i}`} className="w-full h-full object-cover" />
                                                <button 
                                                    onClick={() => setBgCarouselImages(prev => prev.filter((_, idx) => idx !== i))}
                                                    className="absolute top-1 right-1 bg-white/90 p-1 rounded-md hover:bg-red-50 hover:text-red-500 opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <label className="flex items-center justify-center w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 border-dashed rounded-lg p-3 cursor-pointer transition-colors mb-6">
                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, true)} disabled={isUploading} />
                                        <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                                            {isUploading ? <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}
                                            {isUploading ? 'Uploading...' : 'Add Image'}
                                        </div>
                                    </label>

                                    <label className="block text-sm font-medium text-slate-700 mb-2">Transition Time: {bgCarouselTiming}s</label>
                                    <input 
                                        type="range" 
                                        min="2" max="15" 
                                        value={bgCarouselTiming} 
                                        onChange={(e) => setBgCarouselTiming(parseInt(e.target.value))}
                                        className="w-full accent-blue-600"
                                    />
                                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                                        <span>Faster (2s)</span>
                                        <span>Slower (15s)</span>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg transition-colors"
                                >
                                    Save Options
                                </button>
                            </div>
                        </div>
                    ) : isProUser ? (
                        <div className="space-y-4">
                            <div>
                                <p className="text-sm font-medium text-slate-700 mb-1">
                                    Custom CSS for this block
                                </p>
                                <p className="text-xs text-slate-500 mb-3">
                                    Styles are scoped to <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono">#{blockId}</code>.
                                    Use child selectors to target elements inside this block,
                                    e.g. <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono">h1 {'{'} color: red; {'}'}</code>
                                </p>
                                <p className="text-xs text-slate-500 mb-3">
                                    Block class: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono">.ks-block-{blockType}</code>
                                </p>
                            </div>
                            <textarea
                                value={localCss}
                                onChange={(e) => setLocalCss(e.target.value)}
                                placeholder={`/* Example: */\nh1 {\n  color: red;\n  font-size: 3rem;\n}\n\np {\n  line-height: 1.8;\n}`}
                                className="w-full bg-slate-950 text-green-400 font-mono text-sm p-4 min-h-[300px] outline-none border border-slate-700 rounded-lg resize-y selection:bg-green-900"
                                spellCheck={false}
                            />
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg transition-colors"
                                >
                                    Apply CSS
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Paywall for non-pro users */
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mb-4">
                                <Lock className="w-8 h-8 text-amber-500" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">
                                Custom CSS is a Pro Feature
                            </h3>
                            <p className="text-sm text-slate-500 max-w-sm mb-6">
                                Upgrade to Pro to add custom CSS to any block on your site.
                                Get full control over styling with scoped CSS that targets individual blocks.
                            </p>
                            <a
                                href="/pricing"
                                className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105"
                            >
                                <Crown className="w-5 h-5" />
                                Upgrade to Pro
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(modal, document.body);
}
