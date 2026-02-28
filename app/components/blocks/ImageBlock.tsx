'use client';

import { BlockData, useEditorContext } from '@/lib/editor-context';
import EditableImage from '@/app/components/EditableImage';

export default function ImageBlock({ block, palette }: { block: BlockData, palette: Record<string, string> }) {
    const context = useEditorContext();
    const isEditMode = context?.isEditMode || false;

    const updateData = (key: string, value: string) => {
        context?.updateBlockData?.(block.id, key, value);
    };

    const imageUrl = block.data.image || '';

    return (
        <section className="py-12 bg-white">
            <div className="max-w-5xl mx-auto px-4">
                <EditableImage
                    contentKey="image"
                    imageUrl={imageUrl}
                    isEditMode={isEditMode}
                    onSave={(key, val) => updateData(key, val)}
                    onUpload={context?.uploadImage}
                    className="w-full h-auto min-h-[300px] object-cover rounded-xl shadow-md"
                    placeholder="Click to upload a giant featured image"
                />
            </div>
        </section>
    );
}
