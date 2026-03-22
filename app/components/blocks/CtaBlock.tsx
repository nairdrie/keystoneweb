import React, { useState, useEffect } from 'react';
import EditableText from '../EditableText';
import EditableButton from '../EditableButton';
import Reveal from '@/app/components/Reveal';

interface CtaBlockProps {
    id: string;
    data: any;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: (key: string, value: any) => void;
}

export default function CtaBlock({ id, data, isEditMode, palette, updateContent }: CtaBlockProps) {
    const pPrimary = palette.primary || '#1f2937';
    const pSecondary = palette.secondary || '#dc2626';

    const bgType = data.bgType || 'color';
    // Allow overriding background color, default to secondary for high impact
    const bgColor = data.backgroundColor || pSecondary;
    const hasMediaBg = bgType !== 'color' && ((bgType === 'image' && data.bgImage) || (bgType === 'carousel' && data.bgCarouselImages?.length > 0));

    // Auto-detect text color based on background if we were doing true contrast checking,
    // but for now we'll assume dark background means white text, light background means primary text
    // If we have an image/carousel background, we always use white text because we apply a dark overlay.
    const isDarkBg = hasMediaBg || bgColor === pSecondary || bgColor === pPrimary;
    const textColor = isDarkBg ? '#ffffff' : pPrimary;
    const buttonBgColor = isDarkBg ? '#ffffff' : pSecondary;
    const buttonTextColor = isDarkBg ? pSecondary : '#ffffff';

    // Carousel state
    const carouselImages: string[] = Array.isArray(data.bgCarouselImages) ? data.bgCarouselImages : [];
    const carouselInterval = (data.bgCarouselTiming || 5) * 1000;
    const [currentSlide, setCurrentSlide] = useState(0);

    useEffect(() => {
        if (bgType !== 'carousel' || carouselImages.length <= 1) return;
        const interval = setInterval(() => {
            setCurrentSlide(s => (s + 1) % carouselImages.length);
        }, carouselInterval);
        return () => clearInterval(interval);
    }, [bgType, carouselImages.length, carouselInterval]);

    return (
        <section className="py-20 text-center relative overflow-hidden" style={{ backgroundColor: hasMediaBg ? '#000' : bgColor, color: textColor }}>
            {/* Background Media */}
            {bgType === 'image' && data.bgImage && (
                <>
                    <div 
                        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat" 
                        style={{ backgroundImage: `url(${data.bgImage})` }} 
                    />
                    <div className="absolute inset-0 z-0 bg-black/60" />
                </>
            )}
            {bgType === 'carousel' && carouselImages.length > 0 && (
                <>
                    {carouselImages.map((img, i) => (
                        <div 
                            key={i}
                            className={`absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000 ${i === currentSlide ? 'opacity-100' : 'opacity-0'}`} 
                            style={{ backgroundImage: `url(${img})` }} 
                        />
                    ))}
                    <div className="absolute inset-0 z-0 bg-black/60" />
                </>
            )}

            {data.showPattern && !hasMediaBg && (
                <div className="absolute inset-0 opacity-10 z-0" style={{ backgroundImage: 'radial-gradient(circle at top right, white, transparent 70%)' }}></div>
            )}
            <div className="max-w-4xl mx-auto px-4 relative z-10">
                <Reveal>
                    <EditableText
                        as="h2"
                        contentKey="title"
                        content={data.title}
                        defaultValue="Ready to start your project?"
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="text-4xl md:text-5xl font-bold mb-6"
                    />
                </Reveal>
                <Reveal className="max-w-2xl mx-auto">
                    <EditableText
                        as="p"
                        contentKey="subtitle"
                        content={data.subtitle}
                        defaultValue="Contact our professional team today for a free, no-obligation estimate."
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="text-xl md:text-2xl mb-10 opacity-90"
                    />
                </Reveal>
                <Reveal>
                    <EditableButton
                        contentKey="buttonText"
                        label={data.buttonText}
                        linkData={data.buttonTextLink}
                        iconData={data.buttonTextIcon}
                        defaultLabel="Call Us Now"
                        isEditMode={isEditMode}
                        onSave={(key, value) => updateContent(key, value)}
                        className="px-10 py-5 font-bold rounded-full shadow-lg hover:scale-105 transition-transform text-lg inline-block"
                        style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
                    />
                </Reveal>
            </div>
        </section>
    );
}
