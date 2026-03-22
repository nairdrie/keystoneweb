import React from 'react';
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

    // Allow overriding background color, default to secondary for high impact
    const bgColor = data.backgroundColor || pSecondary;

    // Auto-detect text color based on background if we were doing true contrast checking,
    // but for now we'll assume dark background means white text, light background means primary text
    const isDarkBg = bgColor === pSecondary || bgColor === pPrimary;
    const textColor = isDarkBg ? '#ffffff' : pPrimary;
    const buttonBgColor = isDarkBg ? '#ffffff' : pSecondary;
    const buttonTextColor = isDarkBg ? pSecondary : '#ffffff';

    return (
        <section className="py-20 text-center relative overflow-hidden" style={{ backgroundColor: bgColor, color: textColor }}>
            {data.showPattern && (
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at top right, white, transparent 70%)' }}></div>
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
