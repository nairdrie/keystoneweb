'use client';

import {
    MapPin,
    Phone,
    Mail,
    Clock,
    Type as TypeIcon,
    Share2,
    Facebook,
    Instagram,
    Twitter,
    Linkedin,
    Youtube,
    type LucideIcon,
} from 'lucide-react';
import { WhatsAppIcon } from '@/app/components/blocks/contact/contact-config';

// ─── Banner item model ───────────────────────────────────────────────────────
// The announcement banner is a structured list of items. Each item lives in one
// of three slots (left / center / right) and renders inline. This replaces the
// old hard-coded "phone + hours" / "single text" banner with something the user
// can fully compose from the header settings panel.

export type BannerItemType = 'location' | 'phone' | 'email' | 'hours' | 'text' | 'social';
export type BannerSlot = 'left' | 'center' | 'right';

export interface BannerItem {
    id: string;
    type: BannerItemType;
    slot: BannerSlot;
    /** Free text for text-bearing items (location/phone/email/hours/text). */
    text?: string;
    /** Whether to show the leading icon (icon-capable types only). */
    showIcon?: boolean;
}

export interface BannerItemMeta {
    label: string;
    icon: LucideIcon | null;
    /** Whether this item type carries editable text. */
    hasText: boolean;
    /** Whether this item type can show a leading icon. */
    hasIcon: boolean;
    defaultText: string;
    placeholder: string;
    /** Optional input type hint for the settings field. */
    inputType?: 'text' | 'tel' | 'email';
}

export const BANNER_ITEM_META: Record<BannerItemType, BannerItemMeta> = {
    location: { label: 'Location', icon: MapPin, hasText: true, hasIcon: true, defaultText: '123 Main St, City, ST', placeholder: 'Address', inputType: 'text' },
    phone:    { label: 'Phone', icon: Phone, hasText: true, hasIcon: true, defaultText: '(555) 123-4567', placeholder: 'Phone number', inputType: 'tel' },
    email:    { label: 'Email', icon: Mail, hasText: true, hasIcon: true, defaultText: 'hello@example.com', placeholder: 'Email address', inputType: 'email' },
    hours:    { label: 'Hours', icon: Clock, hasText: true, hasIcon: true, defaultText: 'Mon–Fri 8am–6pm', placeholder: 'Business hours', inputType: 'text' },
    text:     { label: 'Custom Text', icon: TypeIcon, hasText: true, hasIcon: false, defaultText: '🎉 Special offer — limited time!', placeholder: 'Custom text', inputType: 'text' },
    social:   { label: 'Social Links', icon: Share2, hasText: false, hasIcon: false, defaultText: '', placeholder: '' },
};

export const BANNER_ITEM_TYPES: BannerItemType[] = ['location', 'phone', 'email', 'hours', 'text', 'social'];
export const BANNER_SLOTS: BannerSlot[] = ['left', 'center', 'right'];

export const BANNER_SLOT_LABELS: Record<BannerSlot, string> = {
    left: 'Left',
    center: 'Center',
    right: 'Right',
};

export function makeBannerItemId(): string {
    return `bi_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}

export function createBannerItem(type: BannerItemType, slot: BannerSlot = 'left'): BannerItem {
    const meta = BANNER_ITEM_META[type];
    return {
        id: makeBannerItemId(),
        type,
        slot,
        ...(meta.hasText ? { text: meta.defaultText } : {}),
        ...(meta.hasIcon ? { showIcon: true } : {}),
    };
}

function isBannerItem(value: unknown): value is BannerItem {
    if (!value || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    return (
        typeof v.id === 'string' &&
        typeof v.type === 'string' &&
        (BANNER_ITEM_TYPES as string[]).includes(v.type) &&
        typeof v.slot === 'string' &&
        (BANNER_SLOTS as string[]).includes(v.slot)
    );
}

// ─── Resolution (with legacy fallback) ───────────────────────────────────────
// Existing sites stored the banner as `bannerPhone` / `bannerHours` (classic) or
// `headerBannerText` (generic). When no structured `headerBannerItems` array is
// present, synthesise an equivalent list so those sites keep rendering. The
// first edit in the panel persists a real `headerBannerItems` array which then
// takes over.

export function resolveBannerItems(
    siteContent: Record<string, unknown>,
    opts: { isBannerClassic?: boolean } = {},
): BannerItem[] {
    const raw = siteContent.headerBannerItems;
    if (Array.isArray(raw)) {
        const valid = raw.filter(isBannerItem);
        if (valid.length > 0 || raw.length === 0) return valid;
    }

    // Legacy synthesis
    const str = (v: unknown, fallback: string): string => (typeof v === 'string' && v.trim() ? v : fallback);
    if (opts.isBannerClassic) {
        return [
            { id: 'legacy_phone', type: 'phone', slot: 'left', text: str(siteContent.bannerPhone, 'Call us: (555) 123-4567'), showIcon: true },
            { id: 'legacy_hours', type: 'hours', slot: 'right', text: str(siteContent.bannerHours, 'Mon-Fri 8am - 6pm'), showIcon: false },
        ];
    }
    return [
        { id: 'legacy_text', type: 'text', slot: 'center', text: str(siteContent.headerBannerText, '🎉 Special offer — Limited time only!') },
    ];
}

// ─── Social links ────────────────────────────────────────────────────────────
// Shared so the banner (and the existing right-side social cluster) read the
// same configured URLs.

export interface HeaderSocialLink {
    key: string;
    url: string;
    Icon: LucideIcon | typeof WhatsAppIcon;
}

export function getHeaderSocialLinks(siteContent: Record<string, unknown>): HeaderSocialLink[] {
    const url = (v: unknown): string => (typeof v === 'string' ? v : '');
    return [
        { key: 'facebook',  url: url(siteContent.headerSocialFacebook),  Icon: Facebook },
        { key: 'instagram', url: url(siteContent.headerSocialInstagram), Icon: Instagram },
        { key: 'x',         url: url(siteContent.headerSocialX),         Icon: Twitter },
        { key: 'linkedin',  url: url(siteContent.headerSocialLinkedin),  Icon: Linkedin },
        { key: 'youtube',   url: url(siteContent.headerSocialYoutube),   Icon: Youtube },
        { key: 'whatsapp',  url: url(siteContent.headerSocialWhatsapp),  Icon: WhatsAppIcon },
    ].filter((s) => s.url);
}
