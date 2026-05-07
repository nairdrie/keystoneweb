'use client';

import type { ComponentType } from 'react';
import dynamic from 'next/dynamic';
import { CalendarDays, ExternalLink, Inbox, Newspaper, Package, Settings, UtensilsCrossed } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { EditorContextType } from '@/lib/editor-context';

export interface BlockPanelProps {
    blockId: string;
    blockType?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    blockData: Record<string, any> | undefined;
    palette: Record<string, string>;
    isProUser: boolean;
    customCss: string;
    onClose: () => void;
    onDraftBlockDataChange?: (data: Record<string, unknown> | null) => void;
}

export interface PanelSecondaryAction {
    id: string;
    label: string;
    icon: LucideIcon;
    suffixIcon?: LucideIcon;
    /**
     * Resolve a navigation target from the editor context. Return a path to
     * push (or `null` to do nothing — e.g. when context isn't ready).
     * BlockWrapperEditor owns the actual navigation so it can use the
     * Next.js router and respect `requestNavigation` for unsaved-change prompts.
     */
    getHref?: (ctx: EditorContextType | null, blockId: string) => string | null;
}

export interface PanelEntry {
    /** Title shown in the panel header. */
    title: string;
    /** The block-specific panel component. Lazy-loaded. */
    component: ComponentType<BlockPanelProps>;
    /** Optional override for the cog button — controls label + icon. */
    primaryButton?: { label: string; icon: LucideIcon; tourId?: string };
    /** Hide the settings opener when a block owns its own in-canvas configuration UI. */
    hideSettingsButton?: boolean;
    /** Extra buttons rendered alongside the cog (e.g. Menu's "Manage Items"). */
    secondaryActions?: PanelSecondaryAction[];
}

const MenuSettingsPanel = dynamic(() => import('./menu/MenuSettingsPanel'), { ssr: false });
const HeroSettingsPanel = dynamic(() => import('./hero/HeroSettingsPanel'), { ssr: false });
const ProductSettingsPanel = dynamic(() => import('./product/ProductSettingsPanel'), { ssr: false });
const GenericBlockSettingsPanel = dynamic(() => import('./generic/GenericBlockSettingsPanel'), { ssr: false });
const ContactSettingsPanel = dynamic(() => import('./contact/ContactSettingsPanel'), { ssr: false });
const RepeatableItemsSettingsPanel = dynamic(() => import('./RepeatableItemsSettingsPanel'), { ssr: false });

const GENERIC_BLOCK_TITLES: Record<string, string> = {
    text: 'Rich Text Paragraph Settings',
    image: 'Image Section Settings',
    map: 'Google Map Settings',
    custom_html: 'Custom HTML / Embed Settings',
    servicesGrid: 'Services Grid Settings',
    featuresList: 'Features / Why Us Settings',
    aboutImageText: 'About (Image + Text) Settings',
    cta: 'Call to Action Settings',
    testimonials: 'Testimonials Settings',
    stats: 'Stats / Numbers Settings',
    gallery: 'Image Gallery Settings',
    contact: 'Contact Info Settings',
    faq: 'FAQ Accordion Settings',
    booking: 'Booking / Appointments Settings',
    contact_form: 'Contact Form Settings',
    logoCloud: 'Logo Cloud / Partners Settings',
    pricing: 'Pricing Table Settings',
    team: 'Team Members Settings',
    blog: 'Blog / News Settings',
    events: 'Events Settings',
    pdf: 'PDF Viewer Settings',
    resources: 'Resources Settings',
    deliveryLinks: 'Delivery App Links Settings',
    featuredQuote: 'Featured Quote Settings',
    carousel: 'Content Carousel Settings',
    chatSupport: 'Chat Support Settings',
    video: 'Video Embed Settings',
    socialFeed: 'Social Media Embeds Settings',
    tabBar: 'Tab Bar / Menu Bar Settings',
    userProfile: 'User Profile Settings',
};

function makeGenericPanelEntries(): Record<string, PanelEntry> {
    return Object.fromEntries(
        Object.entries(GENERIC_BLOCK_TITLES).map(([type, title]) => [
            type,
            {
                title,
                component: GenericBlockSettingsPanel,
            } satisfies PanelEntry,
        ]),
    );
}

export const BLOCK_PANEL_REGISTRY: Record<string, PanelEntry> = {
    ...makeGenericPanelEntries(),
    contact: {
        title: 'Contact Info Settings',
        component: ContactSettingsPanel,
    },
    menu: {
        title: 'Menu Settings',
        component: MenuSettingsPanel,
        primaryButton: { label: 'Settings', icon: Settings },
        secondaryActions: [
            {
                id: 'manage-items',
                label: 'Manage Items',
                icon: UtensilsCrossed,
                suffixIcon: ExternalLink,
                getHref: (ctx) => ctx?.siteId ? `/admin/menu?siteId=${ctx.siteId}` : null,
            },
        ],
    },
    hero: {
        title: 'Hero Section Settings',
        component: HeroSettingsPanel,
    },
    servicesGrid: {
        title: 'Services Grid Settings',
        component: RepeatableItemsSettingsPanel,
    },
    stats: {
        title: 'Stats / Numbers Settings',
        component: RepeatableItemsSettingsPanel,
    },
    testimonials: {
        title: 'Testimonials Settings',
        component: RepeatableItemsSettingsPanel,
    },
    faq: {
        title: 'FAQ Accordion Settings',
        component: RepeatableItemsSettingsPanel,
    },
    productGrid: {
        title: 'Product Catalog Settings',
        component: ProductSettingsPanel,
        primaryButton: { label: 'Settings', icon: Settings },
        secondaryActions: [
            {
                id: 'manage-products',
                label: 'Manage Products',
                icon: Package,
                suffixIcon: ExternalLink,
                getHref: (ctx) => ctx?.siteId ? `/admin/ecommerce?siteId=${ctx.siteId}` : null,
            },
        ],
    },
    booking: {
        title: 'Booking / Appointments Settings',
        component: GenericBlockSettingsPanel,
        primaryButton: { label: 'Settings', icon: Settings },
        secondaryActions: [
            {
                id: 'manage-bookings',
                label: 'Manage Bookings',
                icon: CalendarDays,
                suffixIcon: ExternalLink,
                getHref: (ctx) => ctx?.siteId ? `/admin/booking?siteId=${ctx.siteId}` : null,
            },
        ],
    },
    blog: {
        title: 'Blog / News Settings',
        component: GenericBlockSettingsPanel,
        primaryButton: { label: 'Settings', icon: Settings },
        secondaryActions: [
            {
                id: 'manage-posts',
                label: 'Manage Posts',
                icon: Newspaper,
                suffixIcon: ExternalLink,
                getHref: (ctx) => ctx?.siteId ? `/admin/blog?siteId=${ctx.siteId}` : null,
            },
        ],
    },
    events: {
        title: 'Events Settings',
        component: GenericBlockSettingsPanel,
        primaryButton: { label: 'Settings', icon: Settings },
        secondaryActions: [
            {
                id: 'manage-events',
                label: 'Manage Events',
                icon: CalendarDays,
                suffixIcon: ExternalLink,
                getHref: (ctx) => ctx?.siteId ? `/admin/events?siteId=${ctx.siteId}` : null,
            },
        ],
    },
    contact_form: {
        title: 'Contact Form Settings',
        component: GenericBlockSettingsPanel,
        primaryButton: { label: 'Settings', icon: Settings },
        secondaryActions: [
            {
                id: 'manage-inbox',
                label: 'Manage Inbox',
                icon: Inbox,
                suffixIcon: ExternalLink,
                getHref: (ctx) => ctx?.siteId ? `/admin/inbox?siteId=${ctx.siteId}` : null,
            },
        ],
    },
    estimateForm: {
        title: 'Estimate / Quote Form Settings',
        component: GenericBlockSettingsPanel,
        hideSettingsButton: true,
        secondaryActions: [
            {
                id: 'manage-inbox',
                label: 'Manage Inbox',
                icon: Inbox,
                suffixIcon: ExternalLink,
                getHref: (ctx) => ctx?.siteId ? `/admin/inbox?siteId=${ctx.siteId}` : null,
            },
        ],
    },
};

export function hasInspectorPanel(blockType: string): boolean {
    return blockType in BLOCK_PANEL_REGISTRY;
}

export function getPanelEntry(blockType: string): PanelEntry | undefined {
    return BLOCK_PANEL_REGISTRY[blockType];
}
