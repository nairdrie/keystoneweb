'use client';

import dynamic from 'next/dynamic';
import { BlockData, useEditorContext } from '@/lib/editor-context';
import { useLangPrefix, prefixInternalLinks } from '@/lib/hooks/useLangPrefix';
import { sanitizeRichHtml } from '@/lib/html-sanitize';

const defaultHtml = `<h2>Rich Text Block</h2><p>Click to edit this rich text content. You can use <strong>bold</strong>, <em>italics</em>, and more.</p>`;

const TextBlockEditor = dynamic(() => import('./TextBlockEditor'), { ssr: false });

export default function TextBlock({ block, palette }: { block: BlockData; palette: Record<string, string> }) {
    const context = useEditorContext();
    const isEditMode = context?.isEditMode || false;
    const langPrefix = useLangPrefix();

    const rawHtml = block.data.html !== undefined ? block.data.html : defaultHtml;
    const html = isEditMode ? rawHtml : sanitizeRichHtml(prefixInternalLinks(rawHtml, langPrefix));

    if (!isEditMode) {
        return (
            <section className="py-16 bg-white">
                <div
                    className="max-w-7xl mx-auto px-4 prose"
                    dangerouslySetInnerHTML={{ __html: html }}
                />
            </section>
        );
    }

    return <TextBlockEditor block={block} palette={palette} html={html} />;
}
