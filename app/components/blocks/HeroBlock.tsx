'use client';

import { BlockData, useEditorContext } from '@/lib/editor-context';
import EditableText from '@/app/components/EditableText';
import EditableImage from '@/app/components/EditableImage';
import EditableButton from '@/app/components/EditableButton';
import Reveal from '@/app/components/Reveal';
import { useState, useEffect } from 'react';

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

    // Advanced Background Carousel State
    const carouselImages: string[] = Array.isArray(block.data.bgCarouselImages) ? block.data.bgCarouselImages : [];
    const carouselInterval = (block.data.bgCarouselTiming || 5) * 1000;
    const [currentSlide, setCurrentSlide] = useState(0);

    useEffect(() => {
        if (block.data.bgType !== 'carousel' || carouselImages.length <= 1) return;
        const interval = setInterval(() => {
            setCurrentSlide(s => (s + 1) % carouselImages.length);
        }, carouselInterval);
        return () => clearInterval(interval);
    }, [block.data.bgType, carouselImages.length, carouselInterval]);

    // Minimal variant — large typography, no image, clean background
    if (variant === 'minimal') {
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
                    <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                    <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${pPrimary}, ${pSecondary})` }} />
                )}
                <div className="absolute inset-0 bg-black/60" />
                {isEditMode && (
                    <div className="absolute top-4 right-4 z-20 flex gap-2">
                        <EditableImage
                            contentKey="image"
                            imageUrl={imageUrl}
                            isEditMode={isEditMode}
                            onSave={(key, val) => updateData(key, val)}
                            onUpload={context?.uploadImage}
                            className="w-28 h-16 object-cover rounded-lg shadow-lg border-2 border-white/50"
                            placeholder="Fallback img"
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
                {/* Media Backgrounds */}
                {bgType === 'image' && block.data.bgImage && (
                    <>
                        <div className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${block.data.bgImage})` }} />
                        <div className="absolute inset-0 z-0 bg-black/60" />
                    </>
                )}
                {bgType === 'carousel' && carouselImages.length > 0 && (
                    <>
                        {carouselImages.map((img, i) => (
                            <div key={i} className={`absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000 ${i === currentSlide ? 'opacity-100' : 'opacity-0'}`} style={{ backgroundImage: `url(${img})` }} />
                        ))}
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
                    <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                    <div className="absolute inset-0" style={{ backgroundColor: pPrimary }} />
                )}
                <div className="absolute inset-0 bg-black/50" />
                {isEditMode && (
                    <div className="absolute top-4 right-4 z-20">
                        <EditableImage
                            contentKey="image"
                            imageUrl={imageUrl}
                            isEditMode={isEditMode}
                            onSave={(key, val) => updateData(key, val)}
                            onUpload={context?.uploadImage}
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
                    <EditableImage
                        contentKey="image"
                        imageUrl={imageUrl}
                        isEditMode={isEditMode}
                        onSave={(key, val) => updateData(key, val)}
                        onUpload={context?.uploadImage}
                        className="w-full h-96 object-cover rounded-2xl shadow-xl"
                        placeholder="Click to upload hero image"
                    />
                </Reveal>
            </div>
        </section>
    );
}
