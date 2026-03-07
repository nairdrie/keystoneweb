'use client';

import { BlockData, useEditorContext } from '@/lib/editor-context';
import EditableText from '@/app/components/EditableText';
import EditableImage from '@/app/components/EditableImage';

export default function HeroBlock({ block, palette }: { block: BlockData, palette: Record<string, string> }) {
    const context = useEditorContext();
    const isEditMode = context?.isEditMode || false;

    const updateData = (key: string, value: string) => {
        context?.updateBlockData?.(block.id, key, value);
    };

    const pAccent = palette.accent || '#f3f4f6';
    const pSecondary = palette.secondary || '#ef4444';

    const title = block.data.title !== undefined ? block.data.title : 'Welcome to our site';
    const subtitle = block.data.subtitle !== undefined ? block.data.subtitle : 'We offer the best services available.';
    const imageUrl = block.data.image || '';
    const buttonText = block.data.buttonText !== undefined ? block.data.buttonText : 'Get a Free Quote';

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
                    <button
                        className="px-8 py-4 text-white font-bold rounded shadow-lg hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: pSecondary }}
                    >
                        <EditableText
                            contentKey="buttonText"
                            content={buttonText}
                            defaultValue="Get a Free Quote"
                            isEditMode={isEditMode}
                            onSave={(key, val) => updateData(key, val)}
                            className="inline"
                        />
                    </button>
                </div>
                <EditableImage
                    contentKey="image"
                    imageUrl={imageUrl}
                    isEditMode={isEditMode}
                    onSave={(key, val) => updateData(key, val)}
                    onUpload={context?.uploadImage}
                    className="w-full h-96 object-cover rounded-lg shadow-xl"
                    placeholder="Click to upload hero image"
                />
            </div>
        </section>
    );
}
