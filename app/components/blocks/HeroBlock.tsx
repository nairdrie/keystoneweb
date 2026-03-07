'use client';

import { BlockData, useEditorContext } from '@/lib/editor-context';
import EditableText from '@/app/components/EditableText';
import EditableImage from '@/app/components/EditableImage';
import EditableButton from '@/app/components/EditableButton';

export default function HeroBlock({ block, palette }: { block: BlockData, palette: Record<string, string> }) {
    const context = useEditorContext();
    const isEditMode = context?.isEditMode || false;

    const updateData = (key: string, value: any) => {
        context?.updateBlockData?.(block.id, key, value);
    };

    const pPrimary = palette.primary || '#1f2937';
    const pSecondary = palette.secondary || '#ef4444';
    const pAccent = palette.accent || '#f3f4f6';

    const variant = block.data.variant || 'split'; // 'split' | 'centered' | 'fullImage'
    const title = block.data.title !== undefined ? block.data.title : 'Welcome to our site';
    const subtitle = block.data.subtitle !== undefined ? block.data.subtitle : 'We offer the best services available.';
    const imageUrl = block.data.image || '';
    const buttonText = block.data.buttonText !== undefined ? block.data.buttonText : 'Get a Free Quote';

    // Centered variant — text-centered, no image, gradient background
    if (variant === 'centered') {
        return (
            <section
                className="py-32 text-center relative overflow-hidden"
                style={{
                    background: `linear-gradient(135deg, ${pPrimary} 0%, ${pSecondary} 100%)`,
                }}
            >
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, white 0%, transparent 60%)' }} />
                <div className="max-w-4xl mx-auto px-4 relative z-10">
                    <EditableText
                        as="h1"
                        contentKey="title"
                        content={title}
                        defaultValue="Welcome to our site"
                        isEditMode={isEditMode}
                        onSave={(key, val) => updateData(key, val)}
                        className="text-5xl md:text-6xl font-black mb-6 leading-tight text-white"
                    />
                    <EditableText
                        as="p"
                        contentKey="subtitle"
                        content={subtitle}
                        defaultValue="We offer the best services available."
                        isEditMode={isEditMode}
                        onSave={(key, val) => updateData(key, val)}
                        className="text-xl md:text-2xl text-white/85 mb-10 max-w-2xl mx-auto"
                    />
                    <EditableButton
                        contentKey="buttonText"
                        label={buttonText}
                        linkData={block.data.buttonTextLink}
                        defaultLabel="Get a Free Quote"
                        isEditMode={isEditMode}
                        onSave={(key, val) => updateData(key, val)}
                        className="px-10 py-4 text-lg font-bold rounded-full shadow-xl hover:scale-105 transition-transform inline-block"
                        style={{ backgroundColor: '#ffffff', color: pPrimary }}
                    />
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
                    <EditableText
                        as="h1"
                        contentKey="title"
                        content={title}
                        defaultValue="Welcome to our site"
                        isEditMode={isEditMode}
                        onSave={(key, val) => updateData(key, val)}
                        className="text-5xl md:text-7xl font-black mb-6 leading-tight text-white"
                    />
                    <EditableText
                        as="p"
                        contentKey="subtitle"
                        content={subtitle}
                        defaultValue="We offer the best services available."
                        isEditMode={isEditMode}
                        onSave={(key, val) => updateData(key, val)}
                        className="text-xl md:text-2xl text-white/80 mb-10 max-w-2xl mx-auto"
                    />
                    <EditableButton
                        contentKey="buttonText"
                        label={buttonText}
                        linkData={block.data.buttonTextLink}
                        defaultLabel="Get a Free Quote"
                        isEditMode={isEditMode}
                        onSave={(key, val) => updateData(key, val)}
                        className="px-10 py-4 text-lg font-bold rounded-full shadow-xl hover:scale-105 transition-transform text-white inline-block"
                        style={{ backgroundColor: pSecondary }}
                    />
                </div>
            </section>
        );
    }

    // Split variant (default) — text left, image right
    return (
        <section className="py-24" style={{ backgroundColor: pAccent }}>
            <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-2 gap-12 items-center">
                <div>
                    <EditableText
                        as="h1"
                        contentKey="title"
                        content={title}
                        defaultValue="Welcome to our site"
                        isEditMode={isEditMode}
                        onSave={(key, val) => updateData(key, val)}
                        className="text-5xl font-extrabold mb-6 leading-tight text-gray-900"
                    />
                    <EditableText
                        as="p"
                        contentKey="subtitle"
                        content={subtitle}
                        defaultValue="We offer the best services available."
                        isEditMode={isEditMode}
                        onSave={(key, val) => updateData(key, val)}
                        className="text-xl text-gray-600 mb-8"
                    />
                    <EditableButton
                        contentKey="buttonText"
                        label={buttonText}
                        linkData={block.data.buttonTextLink}
                        defaultLabel="Get a Free Quote"
                        isEditMode={isEditMode}
                        onSave={(key, val) => updateData(key, val)}
                        className="px-8 py-4 text-white font-bold rounded-lg shadow-lg hover:opacity-90 transition-opacity inline-block"
                        style={{ backgroundColor: pSecondary }}
                    />
                </div>
                <EditableImage
                    contentKey="image"
                    imageUrl={imageUrl}
                    isEditMode={isEditMode}
                    onSave={(key, val) => updateData(key, val)}
                    onUpload={context?.uploadImage}
                    className="w-full h-96 object-cover rounded-2xl shadow-xl"
                    placeholder="Click to upload hero image"
                />
            </div>
        </section>
    );
}
