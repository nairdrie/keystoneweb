'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Code, Lock, Crown, LayoutTemplate, Palette } from 'lucide-react';
import { useEditorContext } from '@/lib/editor-context';
import { AVAILABLE_BLOCKS } from './block-registry';
import { getPanelEntry } from './block-panel-registry';

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
    palette?: Record<string, string>;
    onDraftBlockDataChange?: (data: Record<string, unknown> | null) => void;
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
    palette = {},
    onDraftBlockDataChange,
}: BlockSettingsModalProps) {
    const mouseDownOnBackdrop = useRef(false);
    const context = useEditorContext();

    const VARIANTS: Record<string, { id: string, label: string }[]> = {
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
        ],
        aboutImageText: [
            { id: 'landscape', label: 'Landscape Image (4:3)' },
            { id: 'square', label: 'Square Image (1:1)' },
            { id: 'tall', label: 'Tall Image (3:4)' }
        ],
        featuredQuote: [
            { id: 'centered', label: 'Centered' },
            { id: 'split', label: 'Split (Photo + Quote)' },
            { id: 'minimal', label: 'Minimal / Pull Quote' },
            { id: 'essay', label: 'Essay / Longform' },
            { id: 'multiGrid', label: 'Multi-Person Grid' }
        ],
        carousel: [
            { id: 'cards', label: 'Scrolling Cards' },
            { id: 'slides', label: 'Split Slides' },
            { id: 'minimal', label: 'Minimal / Centered' },
        ],
        video: [
            { id: 'contained', label: 'Contained (Centered)' },
            { id: 'fullWidth', label: 'Full Width' },
        ],
        estimateForm: [
            { id: 'simple', label: 'Inquiry Form' },
            { id: 'calculator', label: 'Estimate Calculator' },
        ],
    };

    const hasVariantSettings = !!VARIANTS[blockType];
    const hasGallerySettings = blockType === 'gallery';

    type TabType = 'layout' | 'gallery' | 'css';
    const defaultTab: TabType = hasVariantSettings
        ? 'layout'
        : hasGallerySettings
            ? 'gallery'
            : 'css';

    const [localCss, setLocalCss] = useState(customCss);
    const [activeTab, setActiveTab] = useState<TabType>(defaultTab);

    // Team Style State
    const [teamShowBio, setTeamShowBio] = useState<boolean>(blockData?.showBio !== false);

    // Carousel State
    const [carouselAutoPlay, setCarouselAutoPlay] = useState<boolean>(blockData?.autoPlay !== false);
    const [carouselInterval, setCarouselInterval] = useState<number>(blockData?.interval || 5);

    // Gallery State
    const [galleryColumns, setGalleryColumns] = useState<number>(blockData?.columns || 3);
    const [galleryShowLightboxNav, setGalleryShowLightboxNav] = useState<boolean>(blockData?.showLightboxNav !== false);
    const [galleryShowLightboxThumbs, setGalleryShowLightboxThumbs] = useState<boolean>(blockData?.showLightboxThumbs !== false);
    const [galleryShowSeeMore, setGalleryShowSeeMore] = useState<boolean>(blockData?.showSeeMore === true);
    const [galleryAutoScroll, setGalleryAutoScroll] = useState<boolean>(blockData?.autoScroll === true);
    const [galleryAutoScrollRows, setGalleryAutoScrollRows] = useState<number>(blockData?.autoScrollRows || 2);

    useEffect(() => {
        if (isOpen) {
            setLocalCss(customCss);
            setActiveTab(defaultTab);
            setTeamShowBio(blockData?.showBio !== false);
            setCarouselAutoPlay(blockData?.autoPlay !== false);
            setCarouselInterval(blockData?.interval || 5);
            setGalleryColumns(blockData?.columns || 3);
            setGalleryShowLightboxNav(blockData?.showLightboxNav !== false);
            setGalleryShowLightboxThumbs(blockData?.showLightboxThumbs !== false);
            setGalleryShowSeeMore(blockData?.showSeeMore === true);
            setGalleryAutoScroll(blockData?.autoScroll === true);
            setGalleryAutoScrollRows(blockData?.autoScrollRows || 2);
        }
    }, [isOpen, customCss, blockType, blockData, defaultTab]);

    if (!isOpen) return null;

    // Route blocks with a registered settings panel to the right-sidebar UX.
    const panelEntry = getPanelEntry(blockType);
    if (panelEntry) {
        const PanelComponent = panelEntry.component;
        return (
            <PanelComponent
                blockId={blockId}
                blockData={blockData}
                palette={palette}
                isProUser={isProUser}
                customCss={customCss}
                onClose={onClose}
                onDraftBlockDataChange={onDraftBlockDataChange}
            />
        );
    }

    const handleSave = () => {
        const updates: Record<string, unknown> = {};

        if (localCss !== customCss) {
            updates['__customCss'] = localCss;
        }

        if (blockType === 'team') {
            updates['showBio'] = teamShowBio;
        }

        if (blockType === 'carousel') {
            updates['autoPlay'] = carouselAutoPlay;
            updates['interval'] = carouselInterval;
        }

        if (blockType === 'gallery') {
            updates['columns'] = galleryColumns;
            updates['showLightboxNav'] = galleryShowLightboxNav;
            updates['showLightboxThumbs'] = galleryShowLightboxThumbs;
            updates['showSeeMore'] = galleryShowSeeMore;
            updates['autoScroll'] = galleryAutoScroll;
            updates['autoScrollRows'] = galleryAutoScrollRows;
        }

        if (Object.keys(updates).length > 0 && context?.updateBlockDataBatch) {
            context.updateBlockDataBatch(blockId, updates);
        } else if (localCss !== customCss) {
            onSaveCustomCss(localCss);
        }
        onClose();
    };

    const handleSelectVariant = (variantId: string) => {
        if (onUpdateBlockData) {
            onUpdateBlockData('variant', variantId);
        }
    };

    const modal = (
        <div
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onMouseDown={(e) => { mouseDownOnBackdrop.current = e.target === e.currentTarget; }}
                onClick={() => { if (mouseDownOnBackdrop.current) onClose(); }}
            />

            {/* Modal */}
            <div data-tour="block-settings-modal" className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                    <h2 className="text-lg font-bold text-slate-900">
                        {(() => {
                            const blockLabel = AVAILABLE_BLOCKS.find(b => b.type === blockType)?.label;
                            return blockLabel ? `${blockLabel} Settings` : 'Block Settings';
                        })()}
                    </h2>
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
                    {hasGallerySettings && (
                        <button
                            onClick={() => setActiveTab('gallery')}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === 'gallery' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <Palette className="w-4 h-4" />
                            Style
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
                        <div className="space-y-6">
                            <div>
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
                            {blockType === 'aboutImageText' && (
                                <div>
                                    <p className="text-sm font-medium text-slate-700 mb-3">Image Position</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { value: 'left', label: 'Image Left, Text Right' },
                                            { value: 'right', label: 'Text Left, Image Right' },
                                        ].map(opt => {
                                            const current = blockData?.imagePosition || 'left';
                                            const isSelected = current === opt.value;
                                            return (
                                                <button
                                                    key={opt.value}
                                                    onClick={() => onUpdateBlockData && onUpdateBlockData('imagePosition', opt.value)}
                                                    className={`p-4 border rounded-xl text-left transition-all ${
                                                        isSelected
                                                            ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600 shadow-sm'
                                                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2 mb-2">
                                                        {opt.value === 'left' ? (
                                                            <>
                                                                <span className="inline-block h-5 w-7 rounded bg-slate-300" />
                                                                <span className="inline-flex flex-col gap-0.5">
                                                                    <span className="inline-block h-1 w-8 rounded bg-slate-400" />
                                                                    <span className="inline-block h-1 w-6 rounded bg-slate-300" />
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span className="inline-flex flex-col gap-0.5">
                                                                    <span className="inline-block h-1 w-8 rounded bg-slate-400" />
                                                                    <span className="inline-block h-1 w-6 rounded bg-slate-300" />
                                                                </span>
                                                                <span className="inline-block h-5 w-7 rounded bg-slate-300" />
                                                            </>
                                                        )}
                                                    </div>
                                                    <div className="font-semibold text-sm text-slate-900">{opt.label}</div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {blockType === 'team' && (
                                <div>
                                    <p className="text-sm font-medium text-slate-700 mb-3">Columns</p>
                                    <div className="grid grid-cols-4 gap-2">
                                        {[
                                            { value: 0, label: 'Auto' },
                                            { value: 2, label: '2' },
                                            { value: 3, label: '3' },
                                            { value: 4, label: '4' },
                                        ].map(opt => {
                                            const current = blockData?.columns || 0;
                                            const isSelected = current === opt.value;
                                            return (
                                                <button
                                                    key={opt.value}
                                                    onClick={() => onUpdateBlockData && onUpdateBlockData('columns', opt.value)}
                                                    className={`p-3 border rounded-xl text-center text-sm font-medium transition-all ${
                                                        isSelected
                                                            ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                                                            : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2">Auto adjusts columns based on member count.</p>
                                </div>
                            )}

                            {blockType === 'team' && (
                                <div className="pt-4 border-t border-slate-100">
                                    <p className="text-sm font-medium text-slate-700 mb-3">Content Options</p>
                                    <label className="flex items-center justify-between cursor-pointer group">
                                        <div className="flex flex-col">
                                            <span className="text-sm text-slate-700 group-hover:text-slate-900 font-medium">Show Descriptions (Bio)</span>
                                            <span className="text-xs text-slate-500">Toggle the detailed biography text for each member</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setTeamShowBio(!teamShowBio)}
                                            className={`relative w-10 h-5 rounded-full transition-colors ${teamShowBio ? 'bg-blue-600' : 'bg-slate-200'}`}
                                        >
                                            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${teamShowBio ? 'left-[22px]' : 'left-0.5'}`} />
                                        </button>
                                    </label>

                                    <div className="flex justify-end pt-8">
                                        <button
                                            onClick={handleSave}
                                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg transition-colors"
                                        >
                                            Save Settings
                                        </button>
                                    </div>
                                </div>
                            )}

                            {blockType === 'carousel' && (
                                <div className="pt-4 border-t border-slate-100 space-y-5">
                                    <p className="text-sm font-medium text-slate-700">Auto-Scroll</p>
                                    <label className="flex items-center justify-between cursor-pointer group">
                                        <div className="flex flex-col">
                                            <span className="text-sm text-slate-700 group-hover:text-slate-900 font-medium">Auto-scroll slides</span>
                                            <span className="text-xs text-slate-500">Automatically advance to the next slide</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setCarouselAutoPlay(!carouselAutoPlay)}
                                            className={`relative w-10 h-5 rounded-full transition-colors ${carouselAutoPlay ? 'bg-blue-600' : 'bg-slate-200'}`}
                                        >
                                            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${carouselAutoPlay ? 'left-[22px]' : 'left-0.5'}`} />
                                        </button>
                                    </label>

                                    {carouselAutoPlay && (
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                Scroll interval: {carouselInterval}s
                                            </label>
                                            <input
                                                type="range" min="2" max="15"
                                                value={carouselInterval}
                                                onChange={e => setCarouselInterval(parseInt(e.target.value))}
                                                className="w-full accent-blue-600"
                                            />
                                            <div className="flex justify-between text-xs text-slate-500 mt-1">
                                                <span>Faster (2s)</span>
                                                <span>Slower (15s)</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-end pt-2">
                                        <button
                                            onClick={handleSave}
                                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg transition-colors"
                                        >
                                            Save Settings
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : activeTab === 'gallery' && hasGallerySettings ? (
                        <div className="space-y-6">
                            {/* Columns */}
                            <div>
                                <p className="text-sm font-medium text-slate-700 mb-3">Columns</p>
                                <div className="grid grid-cols-3 gap-2">
                                    {[2, 3, 4].map(n => (
                                        <button
                                            key={n}
                                            onClick={() => setGalleryColumns(n)}
                                            className={`p-3 border rounded-xl text-center text-sm font-medium transition-all ${
                                                galleryColumns === n
                                                    ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                                                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                            }`}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Lightbox options */}
                            <div className="pt-4 border-t border-slate-100">
                                <p className="text-sm font-medium text-slate-700 mb-3">Expanded Image (Lightbox)</p>
                                <div className="space-y-3">
                                    {[
                                        { label: 'Show prev / next nav buttons', desc: 'Click arrows to step through images', value: galleryShowLightboxNav, setter: setGalleryShowLightboxNav },
                                        { label: 'Show thumbnail strip', desc: 'Click thumbnails along the bottom to jump', value: galleryShowLightboxThumbs, setter: setGalleryShowLightboxThumbs },
                                    ].map(({ label, desc, value, setter }) => (
                                        <label key={label} className="flex items-center justify-between cursor-pointer group">
                                            <div className="flex flex-col">
                                                <span className="text-sm text-slate-700 group-hover:text-slate-900 font-medium">{label}</span>
                                                <span className="text-xs text-slate-500">{desc}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setter(!value)}
                                                className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${value ? 'bg-blue-600' : 'bg-slate-200'}`}
                                            >
                                                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${value ? 'left-[22px]' : 'left-0.5'}`} />
                                            </button>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* See More button */}
                            <div className="pt-4 border-t border-slate-100">
                                <p className="text-sm font-medium text-slate-700 mb-3">See More Button</p>
                                <label className="flex items-center justify-between cursor-pointer group">
                                    <div className="flex flex-col">
                                        <span className="text-sm text-slate-700 group-hover:text-slate-900 font-medium">Show "See More" button</span>
                                        <span className="text-xs text-slate-500">Click the button on the page to customize text and link</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setGalleryShowSeeMore(!galleryShowSeeMore)}
                                        className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${galleryShowSeeMore ? 'bg-blue-600' : 'bg-slate-200'}`}
                                    >
                                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${galleryShowSeeMore ? 'left-[22px]' : 'left-0.5'}`} />
                                    </button>
                                </label>
                            </div>

                            {/* Auto-scroll */}
                            <div className="pt-4 border-t border-slate-100 space-y-4">
                                <p className="text-sm font-medium text-slate-700">Auto-Scroll</p>
                                <label className="flex items-center justify-between cursor-pointer group">
                                    <div className="flex flex-col">
                                        <span className="text-sm text-slate-700 group-hover:text-slate-900 font-medium">Auto-scroll images</span>
                                        <span className="text-xs text-slate-500">Continuously scroll through images horizontally</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setGalleryAutoScroll(!galleryAutoScroll)}
                                        className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${galleryAutoScroll ? 'bg-blue-600' : 'bg-slate-200'}`}
                                    >
                                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${galleryAutoScroll ? 'left-[22px]' : 'left-0.5'}`} />
                                    </button>
                                </label>

                                {galleryAutoScroll && (
                                    <div>
                                        <p className="text-sm font-medium text-slate-700 mb-2">Rows: {galleryAutoScrollRows}</p>
                                        <div className="grid grid-cols-4 gap-2">
                                            {[1, 2, 3, 4].map(n => (
                                                <button
                                                    key={n}
                                                    onClick={() => setGalleryAutoScrollRows(n)}
                                                    className={`p-2 border rounded-lg text-center text-sm font-medium transition-all ${
                                                        galleryAutoScrollRows === n
                                                            ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600'
                                                            : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    {n}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                                <button onClick={handleSave} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg transition-colors">Save Style</button>
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
