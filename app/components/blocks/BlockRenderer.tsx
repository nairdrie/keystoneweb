'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useEditorContext, BlockData } from '@/lib/editor-context';
import BlockWrapper from './BlockWrapper';
import { Plus, Crown } from 'lucide-react';
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
import ContactFormBlock from './ContactFormBlock';
import LogoCloudBlock from './LogoCloudBlock';
import PricingBlock from './PricingBlock';
import TeamBlock from './TeamBlock';
import BlogBlock from './BlogBlock';

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
    contact_form: ContactFormBlock,
    logoCloud: LogoCloudBlock,
    pricing: PricingBlock,
    team: TeamBlock,
    blog: BlogBlock,
};

const AVAILABLE_BLOCKS: Array<{ type: string; label: string; proOnly?: boolean }> = [
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
    { type: 'contact_form', label: 'Contact Form' },
    { type: 'logoCloud', label: 'Logo Cloud / Partners' },
    { type: 'pricing', label: 'Pricing Table' },
    { type: 'team', label: 'Team Members' },
    { type: 'map', label: 'Google Map' },
    { type: 'blog', label: '📝 Blog / News' },
    { type: 'custom_html', label: 'Custom HTML / Embed', proOnly: true },
];

export default function BlockRenderer({ palette, headerOffset }: { palette: Record<string, string>; headerOffset?: number }) {
    const context = useEditorContext();
    const blocks = context?.blocks || [];
    const isEditMode = context?.isEditMode || false;
    const isProUser = context?.isProUser || false;

    const AddBlockMenu = ({ index }: { index: number }) => {
        const [isOpen, setIsOpen] = useState(false);
        const [searchQuery, setSearchQuery] = useState('');
        const menuRef = React.useRef<HTMLDivElement>(null);

        // Auto-focus search input when menu opens
        const inputRef = React.useRef<HTMLInputElement>(null);
        useEffect(() => {
            if (isOpen && inputRef.current) {
                inputRef.current.focus();
            }
        }, [isOpen]);

        if (!isEditMode) return null;

        const filteredBlocks = AVAILABLE_BLOCKS.filter(b =>
            b.label.toLowerCase().includes(searchQuery.toLowerCase())
        );

        return (
            <div className="relative w-full flex justify-center my-2 group">
                <div className="absolute inset-0 flex items-center px-4">
                    <div className="w-full border-t border-transparent group-hover:border-slate-200 transition-colors" />
                </div>
                <button
                    onClick={(e) => {
                        const nextState = !isOpen;
                        setIsOpen(nextState);
                        setSearchQuery('');

                        // Scroll menu into view if opening
                        if (nextState) {
                            setTimeout(() => {
                                if (menuRef.current) {
                                    menuRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                }
                            }, 50);
                        }
                    }}
                    className="relative rounded-full p-1.5 bg-white border border-transparent z-10 text-slate-400 group-hover:text-slate-600 group-hover:border-slate-300 hover:bg-slate-50 hover:scale-110 transition-all shadow-sm group-hover:shadow"
                >
                    <Plus className="w-4 h-4" />
                </button>

                {isOpen && (
                    <div ref={menuRef} className="absolute top-8 z-50 bg-white shadow-xl border border-slate-200 rounded-lg p-2 w-56 animate-in fade-in zoom-in duration-200 max-h-[300px] flex flex-col">
                        <h4 className="flex-shrink-0 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">Add Block</h4>
                        <div className="flex-shrink-0 px-2 mb-2">
                            <input
                                ref={inputRef}
                                type="search"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search blocks..."
                                className="w-full bg-slate-50 border border-slate-200 text-sm px-2 py-1.5 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        <div className="overflow-y-auto flex-1 space-y-0.5 px-0.5">
                            {filteredBlocks.length > 0 ? (
                                filteredBlocks.map(b => (
                                    <button
                                        key={b.type}
                                        className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors flex items-center justify-between"
                                        onClick={() => {
                                            if (b.proOnly && !isProUser) {
                                                window.location.href = '/pricing';
                                                return;
                                            }
                                            context?.addBlock?.(b.type, index);
                                            setIsOpen(false);
                                            setSearchQuery('');
                                        }}
                                    >
                                        <span>{b.label}</span>
                                        {b.proOnly && !isProUser && (
                                            <span className="flex items-center gap-1 text-[10px] font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white px-1.5 py-0.5 rounded-full">
                                                <Crown className="w-3 h-3" />
                                                PRO
                                            </span>
                                        )}
                                    </button>
                                ))
                            ) : (
                                <p className="text-xs text-slate-500 text-center py-4">No blocks found.</p>
                            )}
                        </div>
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

                const isFirst = i === 0 && !!headerOffset;
                return (
                    <div
                        key={block.id}
                        className={`w-full${isFirst ? ' first-block-offset' : ''}`}
                        style={isFirst ? { '--header-offset': `${headerOffset}px` } as React.CSSProperties : undefined}
                    >
                        <AddBlockMenu index={i} />
                        <BlockWrapper
                            id={block.id}
                            type={block.type}
                            customCss={block.data?.__customCss || ''}
                            onUpdateCustomCss={(css) => context?.updateBlockData?.(block.id, '__customCss', css)}
                        >
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
