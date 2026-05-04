'use client';

import type { ComponentType } from 'react';
import dynamic from 'next/dynamic';
import { ExternalLink, Package, Settings, UtensilsCrossed } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { EditorContextType } from '@/lib/editor-context';

export interface BlockPanelProps {
    blockId: string;
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
    /** Extra buttons rendered alongside the cog (e.g. Menu's "Manage Items"). */
    secondaryActions?: PanelSecondaryAction[];
}

const MenuSettingsPanel = dynamic(() => import('./menu/MenuSettingsPanel'), { ssr: false });
const HeroSettingsPanel = dynamic(() => import('./hero/HeroSettingsPanel'), { ssr: false });
const ProductSettingsPanel = dynamic(() => import('./product/ProductSettingsPanel'), { ssr: false });

export const BLOCK_PANEL_REGISTRY: Record<string, PanelEntry> = {
    menu: {
        title: 'Menu Settings',
        component: MenuSettingsPanel,
        primaryButton: { label: 'Menu Settings', icon: Settings },
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
        title: 'Hero Settings',
        component: HeroSettingsPanel,
    },
    productGrid: {
        title: 'Product Settings',
        component: ProductSettingsPanel,
        primaryButton: { label: 'Product Settings', icon: Settings },
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
};

export function hasInspectorPanel(blockType: string): boolean {
    return blockType in BLOCK_PANEL_REGISTRY;
}

export function getPanelEntry(blockType: string): PanelEntry | undefined {
    return BLOCK_PANEL_REGISTRY[blockType];
}
