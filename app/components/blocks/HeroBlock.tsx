'use client';

import { BlockData, useEditorContext } from '@/lib/editor-context';
import EditableText from '@/app/components/EditableText';
import EditableImage from '@/app/components/EditableImage';
import EditableButton from '@/app/components/EditableButton';
import Reveal from '@/app/components/Reveal';
import { useState, useEffect, useRef } from 'react';
import { Video } from 'lucide-react';
import PexelsVideoPickerModal from '@/app/components/PexelsVideoPickerModal';

export default function HeroBlock({ block, palette }: { block: BlockData, palette: Record<string, string> }) {
    const context = useEditorContext();
    const isEditMode = context?.isEditMode || false;

    const updateData = (key: string, value: any) => {
        context?.updateBlockData?.(block.id, key, value);
    };

    const pPrimary = palette.primary || '#1f2937';
    const pSecondary = palette.secondary || '#ef4444';
    const pAccent = palette.accent || '#f3f4f6';

    const variant = block.data.variant || 'split'; // 'split' | 'centered' | 'fullImage' | 'minimal' | 'video'
    const title = block.data.title !== undefined ? block.data.title : 'Welcome to our site';
    const subtitle = block.data.subtitle !== undefined ? block.data.subtitle : 'We offer the best services available.';
    const imageUrl = block.data.image || '';
    const buttonText = block.data.buttonText !== undefined ? block.data.buttonText : 'Get a Free Quote';
    const videoUrl = block.data.videoUrl || '';
    const [videoInputValue, setVideoInputValue] = useState(videoUrl);
    const [showVideoInput, setShowVideoInput] = useState(false);
    const [showPexelsPicker, setShowPexelsPicker] = useState(false);
    const videoInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { setVideoInputValue(videoUrl); }, [videoUrl]);
    useEffect(() => { if (showVideoInput) videoInputRef.current?.focus(); }, [showVideoInput]);

    // Advanced Background Carousel State
    const carouselImages: string[] = Array.isArray(block.data.bgCarouselImages) ? block.data.bgCarouselImages : [];
    const carouselInterval = (block.data.bgCarouselTiming || 5) * 1000;
    const carouselTransition: 'fade' | 'swipe' | 'scroll' = block.data.bgCarouselTransition || 'fade';
    const [currentSlide, setCurrentSlide] = useState(0);

    useEffect(() => {
        // Smooth scroll mode uses CSS animation, no JS interval needed
        if (block.data.bgType !== 'carousel' || carouselImages.length <= 1 || carouselTransition === 'scroll') return;
        const interval = setInterval(() => {
            setCurrentSlide(s => (s + 1) % carouselImages.length);
        }, carouselInterval);
        return () => clearInterval(interval);
    }, [block.data.bgType, carouselImages.length, carouselInterval, carouselTransition]);

    // Pick the LCP image URL for this hero so we can hint the browser to
    // start fetching it during HTML parse. React 19 hoists <link> into <head>.
    const lcpImageUrl: string | null = isEditMode
        ? null
        : variant === 'centered'
            ? (block.data.bgType === 'image' && block.data.bgImage)
                ? block.data.bgImage
                : (block.data.bgType === 'carousel' && carouselImages[0])
                    ? carouselImages[0]
                    : null
            : variant === 'video'
                ? (videoUrl ? null : imageUrl || null)
                : (variant === 'fullImage' || variant === 'split')
                    ? imageUrl || null
                    : null;

    // Minimal variant — large typography, no image, clean background
    if (variant === 'minimal') {
        const showButton = block.data.showButton !== false;
        return (
            <section className="py-40 relative" style={{ backgroundColor: pAccent }}>
                <div className="max-w-5xl mx-auto px-4">
                    <Reveal>
                        <EditableText
                            as="h1"
                            contentKey="title"
                            styleData={block.data['title__styles']}
                            content={title}
                            defaultValue="Welcome to our site"
                            isEditMode={isEditMode}
                            onSave={(key, val) => updateData(key, val)}
                            className="text-6xl md:text-8xl font-black mb-8 leading-[0.95] tracking-tight"
                            style={{ color: pPrimary }}
                        />
                    </Reveal>
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
                        <Reveal className="max-w-xl">
                            <EditableText
                                as="p"
                                contentKey="subtitle"
                                styleData={block.data['subtitle__styles']}
                                content={subtitle}
                                defaultValue="We offer the best services available."
                                isEditMode={isEditMode}
                                onSave={(key, val) => updateData(key, val)}
                                className="text-xl md:text-2xl text-gray-500"
                            />
                        </Reveal>
                        {showButton && (
                            <Reveal>
                                <EditableButton
                                    contentKey="buttonText"
                                    label={buttonText}
                                    linkData={block.data.buttonTextLink}
                                    iconData={block.data.buttonTextIcon}
                                    defaultLabel="Get Started"
                                    isEditMode={isEditMode}
                                    onSave={(key, val) => updateData(key, val)}
                                    className="px-10 py-4 text-lg font-bold rounded-full shadow-lg hover:scale-105 transition-transform text-white inline-block flex-shrink-0"
                                    style={{ backgroundColor: pSecondary }}
                                />
                            </Reveal>
                        )}
                    </div>
                </div>
            </section>
        );
    }

    // Video variant — video background with text overlay
    if (variant === 'video') {
        return (
            <section className="relative min-h-[80vh] flex items-center overflow-hidden">
                {videoUrl ? (
                    <video
                        autoPlay
                        muted
                        loop
                        playsInline
                        className="absolute inset-0 w-full h-full object-cover"
                    >
                        <source src={videoUrl} type="video/mp4" />
                    </video>
                ) : imageUrl ? (
                    <img src={imageUrl} alt={block.data.image__settings?.altText || ''} role={block.data.image__settings?.altText ? undefined : 'presentation'} className="absolute inset-0 w-full h-full object-cover" loading="eager" fetchPriority="high" decoding="sync" />
                ) : (
                    <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${pPrimary}, ${pSecondary})` }} />
                )}
                {lcpImageUrl && <link rel="preload" as="image" href={lcpImageUrl} fetchPriority="high" />}
                <div className="absolute inset-0 bg-black/60" />
                {isEditMode && (
                    <>
                    <PexelsVideoPickerModal
                        isOpen={showPexelsPicker}
                        onClose={() => setShowPexelsPicker(false)}
                        onSelect={(url) => { updateData('videoUrl', url); setVideoInputValue(url); }}
                    />
                    <div className="absolute top-4 right-4 z-20 flex items-start gap-2">
                        {showVideoInput ? (
                            <div className="flex items-center gap-1.5 bg-black/80 backdrop-blur-sm rounded-lg px-2 py-1.5 shadow-xl">
                                <Video className="w-3.5 h-3.5 text-white/60 shrink-0" />
                                <input
                                    ref={videoInputRef}
                                    type="url"
                                    value={videoInputValue}
                                    onChange={(e) => setVideoInputValue(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') { updateData('videoUrl', videoInputValue); setShowVideoInput(false); }
                                        if (e.key === 'Escape') { setVideoInputValue(videoUrl); setShowVideoInput(false); }
                                    }}
                                    placeholder="https://example.com/video.mp4"
                                    className="w-64 bg-transparent text-white text-xs outline-none placeholder:text-white/40"
                                />
                                <button
                                    onClick={() => { updateData('videoUrl', videoInputValue); setShowVideoInput(false); }}
                                    className="text-xs font-bold text-emerald-400 hover:text-emerald-300 ml-1"
                                >Set</button>
                                <button
                                    onClick={() => { setVideoInputValue(videoUrl); setShowVideoInput(false); }}
                                    className="text-xs text-white/50 hover:text-white ml-0.5"
                                >✕</button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => setShowPexelsPicker(true)}
                                    className="flex items-center gap-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg transition-colors"
                                >
                                    <Video className="w-3.5 h-3.5" />
                                    Search Pexels
                                </button>
                                <button
                                    onClick={() => setShowVideoInput(true)}
                                    className="flex items-center gap-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg transition-colors"
                                >
                                    {videoUrl ? 'Change URL' : 'Paste URL'}
                                </button>
                            </div>
                        )}
                        <EditableImage
                            contentKey="image"
                            imageUrl={imageUrl}
                            isEditMode={isEditMode}
                            onSave={(key, val) => updateData(key, val)}
                            onUpload={context?.uploadImage}
                            initialSettings={block.data.image__settings}
                            className="w-28 h-16 object-cover rounded-lg shadow-lg border-2 border-white/50"
                            placeholder="Fallback img"
                        />
                    </div>
                    </>
                )}
                <div className="max-w-5xl mx-auto px-4 py-24 relative z-10 text-center">
                    <Reveal>
                        <EditableText
                            as="h1"
                            contentKey="title"
                            styleData={block.data['title__styles']}
                            content={title}
                            defaultValue="Welcome to our site"
                            isEditMode={isEditMode}
                            onSave={(key, val) => updateData(key, val)}
                            className="text-5xl md:text-7xl font-black mb-6 leading-tight text-white drop-shadow-lg"
                        />
                    </Reveal>
                    <Reveal className="max-w-2xl mx-auto">
                        <EditableText
                            as="p"
                            contentKey="subtitle"
                            styleData={block.data['subtitle__styles']}
                            content={subtitle}
                            defaultValue="We offer the best services available."
                            isEditMode={isEditMode}
                            onSave={(key, val) => updateData(key, val)}
                            className="text-xl md:text-2xl text-white/85 mb-10"
                        />
                    </Reveal>
                    <Reveal>
                        <EditableButton
                            contentKey="buttonText"
                            label={buttonText}
                            linkData={block.data.buttonTextLink}
                            iconData={block.data.buttonTextIcon}
                            defaultLabel="Get a Free Quote"
                            isEditMode={isEditMode}
                            onSave={(key, val) => updateData(key, val)}
                            className="px-10 py-4 text-lg font-bold rounded-full shadow-xl hover:scale-105 transition-transform text-white inline-block"
                            style={{ backgroundColor: pSecondary }}
                        />
                    </Reveal>
                </div>
            </section>
        );
    }

    // Centered variant — text-centered, no image, gradient background
    if (variant === 'centered') {
        const bgType = block.data.bgType || 'color';
        let customBgStyle: any = undefined;
        let hasCustomMedia = false;
        
        if (bgType === 'color' && block.data.backgroundColor) {
             customBgStyle = { backgroundColor: block.data.backgroundColor };
        } else if (bgType === 'color') {
             customBgStyle = { background: `linear-gradient(135deg, ${pPrimary} 0%, ${pSecondary} 100%)` };
        } else {
             customBgStyle = { backgroundColor: '#000' };
             hasCustomMedia = true;
        }

        return (
            <section
                className="py-32 text-center relative overflow-hidden"
                style={customBgStyle}
            >
                {lcpImageUrl && <link rel="preload" as="image" href={lcpImageUrl} fetchPriority="high" />}
                {/* Media Backgrounds */}
                {bgType === 'image' && block.data.bgImage && (
                    <>
                        <div className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${block.data.bgImage})` }} />
                        <div className="absolute inset-0 z-0 bg-black/60" />
                    </>
                )}
                {bgType === 'carousel' && carouselImages.length > 0 && (
                    <>
                        {carouselTransition === 'fade' && carouselImages.map((img, i) => (
                            <div key={i} className={`absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000 ${i === currentSlide ? 'opacity-100' : 'opacity-0'}`} style={{ backgroundImage: `url(${img})` }} />
                        ))}
                        {carouselTransition === 'swipe' && (
                            <div className="absolute inset-0 z-0 overflow-hidden">
                                <div className="flex h-full transition-transform duration-700 ease-in-out" style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
                                    {carouselImages.map((img, i) => (
                                        <div key={i} className="w-full h-full flex-shrink-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${img})` }} />
                                    ))}
                                </div>
                            </div>
                        )}
                        {carouselTransition === 'scroll' && (
                            <div className="absolute inset-0 z-0 overflow-hidden">
                                <style>{`@keyframes heroCarouselScroll { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
                                <div className="flex h-full" style={{ width: `${carouselImages.length * 200}%`, animation: `heroCarouselScroll ${carouselImages.length * (block.data.bgCarouselTiming || 5)}s linear infinite` }}>
                                    {[...carouselImages, ...carouselImages].map((img, i) => (
                                        <div key={i} className="h-full flex-shrink-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${img})`, width: `${100 / (carouselImages.length * 2)}%` }} />
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="absolute inset-0 z-0 bg-black/60" />
                    </>
                )}

                {!hasCustomMedia && <div className="absolute inset-0 opacity-10 z-0" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, white 0%, transparent 60%)' }} />}
                <div className="max-w-4xl mx-auto px-4 relative z-10">
                    <Reveal>
                        <EditableText
                            as="h1"
                            contentKey="title"
                            styleData={block.data['title__styles']}
                            content={title}
                            defaultValue="Welcome to our site"
                            isEditMode={isEditMode}
                            onSave={(key, val) => updateData(key, val)}
                            className="text-5xl md:text-6xl font-black mb-6 leading-tight text-white"
                        />
                    </Reveal>
                    <Reveal className="max-w-2xl mx-auto">
                        <EditableText
                            as="p"
                            contentKey="subtitle"
                            styleData={block.data['subtitle__styles']}
                            content={subtitle}
                            defaultValue="We offer the best services available."
                            isEditMode={isEditMode}
                            onSave={(key, val) => updateData(key, val)}
                            className="text-xl md:text-2xl text-white/85 mb-10"
                        />
                    </Reveal>
                    <Reveal>
                        <EditableButton
                            contentKey="buttonText"
                            label={buttonText}
                            linkData={block.data.buttonTextLink}
                            iconData={block.data.buttonTextIcon}
                            defaultLabel="Get a Free Quote"
                            isEditMode={isEditMode}
                            onSave={(key, val) => updateData(key, val)}
                            className="px-10 py-4 text-lg font-bold rounded-full shadow-xl hover:scale-105 transition-transform inline-block"
                            style={{ backgroundColor: '#ffffff', color: pPrimary }}
                        />
                    </Reveal>
                </div>
            </section>
        );
    }

    // Full-image variant — text overlaid on image
    if (variant === 'fullImage') {
        return (
            <section className="relative min-h-[70vh] flex items-center overflow-hidden">
                {imageUrl ? (
                    <img src={imageUrl} alt={block.data.image__settings?.altText || ''} role={block.data.image__settings?.altText ? undefined : 'presentation'} className="absolute inset-0 w-full h-full object-cover" loading="eager" fetchPriority="high" decoding="sync" />
                ) : (
                    <div className="absolute inset-0" style={{ backgroundColor: pPrimary }} />
                )}
                {lcpImageUrl && <link rel="preload" as="image" href={lcpImageUrl} fetchPriority="high" />}
                <div className="absolute inset-0 bg-black/50" />
                {isEditMode && (
                    <div className="absolute top-4 right-4 z-20">
                        <EditableImage
                            contentKey="image"
                            imageUrl={imageUrl}
                            isEditMode={isEditMode}
                            onSave={(key, val) => updateData(key, val)}
                            onUpload={context?.uploadImage}
                            initialSettings={block.data.image__settings}
                            className="w-32 h-20 object-cover rounded-lg shadow-lg border-2 border-white/50"
                            placeholder="Set bg image"
                        />
                    </div>
                )}
                <div className="max-w-5xl mx-auto px-4 py-24 relative z-10 text-center">
                    <Reveal>
                        <EditableText
                            as="h1"
                            contentKey="title"
                            styleData={block.data['title__styles']}
                            content={title}
                            defaultValue="Welcome to our site"
                            isEditMode={isEditMode}
                            onSave={(key, val) => updateData(key, val)}
                            className="text-5xl md:text-7xl font-black mb-6 leading-tight text-white"
                        />
                    </Reveal>
                    <Reveal className="max-w-2xl mx-auto">
                        <EditableText
                            as="p"
                            contentKey="subtitle"
                            styleData={block.data['subtitle__styles']}
                            content={subtitle}
                            defaultValue="We offer the best services available."
                            isEditMode={isEditMode}
                            onSave={(key, val) => updateData(key, val)}
                            className="text-xl md:text-2xl text-white/80 mb-10"
                        />
                    </Reveal>
                    <Reveal>
                        <EditableButton
                            contentKey="buttonText"
                            label={buttonText}
                            linkData={block.data.buttonTextLink}
                            iconData={block.data.buttonTextIcon}
                            defaultLabel="Get a Free Quote"
                            isEditMode={isEditMode}
                            onSave={(key, val) => updateData(key, val)}
                            className="px-10 py-4 text-lg font-bold rounded-full shadow-xl hover:scale-105 transition-transform text-white inline-block"
                            style={{ backgroundColor: pSecondary }}
                        />
                    </Reveal>
                </div>
            </section>
        );
    }

    // Split variant (default) — text left, image right
    return (
        <section className="py-24" style={{ backgroundColor: pAccent }}>
            <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-2 gap-12 items-center">
                <div>
                    <Reveal>
                        <EditableText
                            as="h1"
                            contentKey="title"
                            styleData={block.data['title__styles']}
                            content={title}
                            defaultValue="Welcome to our site"
                            isEditMode={isEditMode}
                            onSave={(key, val) => updateData(key, val)}
                            className="text-5xl font-extrabold mb-6 leading-tight text-gray-900"
                        />
                    </Reveal>
                    <Reveal>
                        <EditableText
                            as="p"
                            contentKey="subtitle"
                            styleData={block.data['subtitle__styles']}
                            content={subtitle}
                            defaultValue="We offer the best services available."
                            isEditMode={isEditMode}
                            onSave={(key, val) => updateData(key, val)}
                            className="text-xl text-gray-600 mb-8"
                        />
                    </Reveal>
                    <Reveal>
                        <EditableButton
                            contentKey="buttonText"
                            label={buttonText}
                            linkData={block.data.buttonTextLink}
                            iconData={block.data.buttonTextIcon}
                            defaultLabel="Get a Free Quote"
                            isEditMode={isEditMode}
                            onSave={(key, val) => updateData(key, val)}
                            className="px-8 py-4 text-white font-bold rounded-lg shadow-lg hover:opacity-90 transition-opacity inline-block"
                            style={{ backgroundColor: pSecondary }}
                        />
                    </Reveal>
                </div>
                <Reveal>
                    {lcpImageUrl && <link rel="preload" as="image" href={lcpImageUrl} fetchPriority="high" />}
                    <EditableImage
                        contentKey="image"
                        initialSettings={block.data.image__settings}
                        imageUrl={imageUrl}
                        isEditMode={isEditMode}
                        onSave={(key, val) => updateData(key, val)}
                        onUpload={context?.uploadImage}
                        className="w-full h-96 object-cover rounded-2xl shadow-xl"
                        placeholder="Click to upload hero image"
                        priority
                    />
                </Reveal>
            </div>
        </section>
    );
}
