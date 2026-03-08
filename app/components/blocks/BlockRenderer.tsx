'use client';

import { useState } from 'react';
import { useEditorContext, BlockData } from '@/lib/editor-context';
import BlockWrapper from './BlockWrapper';
import { Plus } from 'lucide-react';
import HeroBlock from './HeroBlock';
import TextBlock from './TextBlock';
import CustomHTMLBlock from './CustomHTMLBlock';
import ImageBlock from './ImageBlock';
import MapBlock from './MapBlock';
import ServicesGridBlock from './ServicesGridBlock';
import FeaturesListBlock from './FeaturesListBlock';
import AboutImageTextBlock from './AboutImageTextBlock';
import CtaBlock from './CtaBlock';
import TestimonialsBlock from './TestimonialsBlock';
import StatsBlock from './StatsBlock';
import GalleryBlock from './GalleryBlock';
import ContactBlock from './ContactBlock';
import FAQBlock from './FAQBlock';
import BookingBlock from './BookingBlock';
import ProductGridBlock from './ProductGridBlock';

// We loosen the component type to accommodate both the simpler original blocks and the advanced blocks
const BLOCK_COMPONENTS: Record<string, React.ComponentType<any>> = {
    hero: HeroBlock,
    text: TextBlock,
    image: ImageBlock,
    map: MapBlock,
    custom_html: CustomHTMLBlock,
    servicesGrid: ServicesGridBlock,
    featuresList: FeaturesListBlock,
    aboutImageText: AboutImageTextBlock,
    cta: CtaBlock,
    testimonials: TestimonialsBlock,
    stats: StatsBlock,
    gallery: GalleryBlock,
    contact: ContactBlock,
    faq: FAQBlock,
    booking: BookingBlock,
    productGrid: ProductGridBlock,
};

const AVAILABLE_BLOCKS = [
    { type: 'hero', label: 'Hero Section' },
    { type: 'text', label: 'Rich Text Paragraph' },
    { type: 'image', label: 'Image Section' },
    { type: 'servicesGrid', label: 'Services Grid' },
    { type: 'featuresList', label: 'Features / Why Us' },
    { type: 'aboutImageText', label: 'About (Image + Text)' },
    { type: 'testimonials', label: 'Testimonials' },
    { type: 'stats', label: 'Stats / Numbers' },
    { type: 'gallery', label: 'Image Gallery' },
    { type: 'contact', label: 'Contact Info' },
    { type: 'faq', label: 'FAQ Accordion' },
    { type: 'cta', label: 'Call to Action' },
    { type: 'booking', label: '📅 Booking / Appointments' },
    { type: 'productGrid', label: '🛍️ Product Catalog' },
    { type: 'map', label: 'Google Map' },
    { type: 'custom_html', label: 'Custom HTML / Embed' },
];

export default function BlockRenderer({ palette }: { palette: Record<string, string> }) {
    const context = useEditorContext();
    const blocks = context?.blocks || [];
    const isEditMode = context?.isEditMode || false;

    const AddBlockMenu = ({ index }: { index: number }) => {
        const [isOpen, setIsOpen] = useState(false);

        if (!isEditMode) return null;

        return (
            <div className="relative w-full flex justify-center my-2 group">
                <div className="absolute inset-0 flex items-center px-4">
                    <div className="w-full border-t border-transparent group-hover:border-slate-200 transition-colors" />
                </div>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="relative rounded-full p-1.5 bg-white border border-transparent z-10 text-slate-400 group-hover:text-slate-600 group-hover:border-slate-300 hover:bg-slate-50 hover:scale-110 transition-all shadow-sm group-hover:shadow"
                >
                    <Plus className="w-4 h-4" />
                </button>

                {isOpen && (
                    <div className="absolute top-8 z-50 bg-white shadow-xl border border-slate-200 rounded-lg p-2 w-56 animate-in fade-in zoom-in duration-200">
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">Add Block</h4>
                        {AVAILABLE_BLOCKS.map(b => (
                            <button
                                key={b.type}
                                className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors"
                                onClick={() => {
                                    context?.addBlock?.(b.type, index);
                                    setIsOpen(false);
                                }}
                            >
                                {b.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    if (!blocks || blocks.length === 0) {
        if (!isEditMode) return <div className="py-24 text-center text-gray-400">This page has no content yet.</div>;
        return (
            <div className="py-24 flex flex-col items-center justify-center">
                <p className="text-slate-500 mb-6">Start building your page by adding a block.</p>
                <AddBlockMenu index={0} />
            </div>
        );
    }

    return (
        <div className="w-full relative flex flex-col">
            {blocks.map((block, i) => {
                const Component = BLOCK_COMPONENTS[block.type];
                if (!Component) return null;

                return (
                    <div key={block.id} className="w-full">
                        <AddBlockMenu index={i} />
                        <BlockWrapper id={block.id} type={block.type}>
                            <Component
                                id={block.id}
                                data={block.data || {}}
                                isEditMode={isEditMode}
                                palette={palette}
                                updateContent={(key: string, value: any) => context?.updateBlockData?.(block.id, key, value)}
                                // We also pass the whole block object down for the simpler legacy blocks
                                block={block}
                            />
                        </BlockWrapper>
                    </div>
                );
            })}
            {/* Menu at the very bottom */}
            <AddBlockMenu index={blocks.length} />
        </div>
    );
}
