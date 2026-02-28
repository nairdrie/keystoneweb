'use client';

import { BlockData, useEditorContext } from '@/lib/editor-context';
import EditableText from '@/app/components/EditableText';

export default function TextBlock({ block, palette }: { block: BlockData, palette: Record<string, string> }) {
    const context = useEditorContext();
    const isEditMode = context?.isEditMode || false;

    const updateData = (key: string, value: string) => {
        context?.updateBlockData?.(block.id, key, value);
    };

    const defaultHtml = `<h2>Rich Text Block</h2><p>Double-click to edit this rich text content. You can use <strong>bold</strong>, <em>italics</em>, and more.</p>`;
    const html = block.data.html !== undefined ? block.data.html : defaultHtml;

    return (
        <section className="py-16 bg-white">
            <div className="max-w-4xl mx-auto px-4 prose prose-slate lg:prose-lg max-w-none">
                <EditableText
                    as="div"
                    contentKey="html"
                    content={html}
                    defaultValue={defaultHtml}
                    isEditMode={isEditMode}
                    onSave={(key, val) => updateData(key, val)}
                    className="w-full"
                />
            </div>
        </section>
    );
}
