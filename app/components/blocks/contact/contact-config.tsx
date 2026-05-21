'use client';

import React from 'react';
import {
    AtSign,
    Building2,
    CalendarDays,
    Clock,
    Facebook,
    Github,
    Globe,
    Headphones,
    Instagram,
    Linkedin,
    Mail,
    MapPin,
    MessageCircle,
    MessageSquare,
    Music2,
    Navigation,
    Phone,
    Rss,
    Send,
    Smartphone,
    Star,
    Store,
    Twitter,
    X,
    Youtube,
} from 'lucide-react';

type IconComponent = React.ComponentType<{ className?: string }>;

function TikTokIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
        </svg>
    );
}

export function WhatsAppIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.693.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0 0 20.464 3.488" />
        </svg>
    );
}

export type ContactLinkType = 'auto' | 'none' | 'phone' | 'email' | 'address' | 'url';

export interface ContactItem {
    id: string;
    icon: string;
    label: string;
    value: string;
    linkType?: ContactLinkType;
    href?: string;
}

export interface SocialLinkItem {
    id: string;
    platform: string;
    label?: string;
    url: string;
}

export const CONTACT_ICON_OPTIONS = [
    { key: 'phone', label: 'Phone', Icon: Phone },
    { key: 'email', label: 'Email', Icon: Mail },
    { key: 'address', label: 'Address', Icon: MapPin },
    { key: 'hours', label: 'Hours', Icon: Clock },
    { key: 'website', label: 'Website', Icon: Globe },
    { key: 'message', label: 'Message', Icon: MessageCircle },
    { key: 'chat', label: 'Chat', Icon: MessageSquare },
    { key: 'mobile', label: 'Mobile', Icon: Smartphone },
    { key: 'directions', label: 'Directions', Icon: Navigation },
    { key: 'calendar', label: 'Calendar', Icon: CalendarDays },
    { key: 'support', label: 'Support', Icon: Headphones },
    { key: 'business', label: 'Business', Icon: Building2 },
    { key: 'store', label: 'Store', Icon: Store },
] as const;

export const SOCIAL_PLATFORM_OPTIONS = [
    { key: 'facebook', label: 'Facebook', Icon: Facebook, legacyKey: 'facebookUrl' },
    { key: 'instagram', label: 'Instagram', Icon: Instagram, legacyKey: 'instagramUrl' },
    { key: 'x', label: 'X / Twitter', Icon: X, legacyKey: 'xUrl' },
    { key: 'twitter', label: 'Twitter', Icon: Twitter, legacyKey: 'twitterUrl' },
    { key: 'linkedin', label: 'LinkedIn', Icon: Linkedin, legacyKey: 'linkedinUrl' },
    { key: 'youtube', label: 'YouTube', Icon: Youtube, legacyKey: 'youtubeUrl' },
    { key: 'tiktok', label: 'TikTok', Icon: TikTokIcon, legacyKey: 'tiktokUrl' },
    { key: 'threads', label: 'Threads', Icon: AtSign },
    { key: 'whatsapp', label: 'WhatsApp', Icon: WhatsAppIcon },
    { key: 'github', label: 'GitHub', Icon: Github },
    { key: 'telegram', label: 'Telegram', Icon: Send },
    { key: 'rss', label: 'RSS', Icon: Rss },
    { key: 'website', label: 'Website', Icon: Globe },
    { key: 'reviews', label: 'Reviews', Icon: Star },
    { key: 'music', label: 'Music', Icon: Music2 },
] as const;

export const DEFAULT_CONTACT_ITEMS: ContactItem[] = [
    { id: 'phone', icon: 'phone', label: 'Phone', value: '(555) 123-4567', linkType: 'phone' },
    { id: 'email', icon: 'email', label: 'Email', value: 'hello@yourbusiness.ca', linkType: 'email' },
    { id: 'address', icon: 'address', label: 'Address', value: '123 Main Street, Suite 100, Your City, ST 12345', linkType: 'address' },
    { id: 'hours', icon: 'hours', label: 'Hours', value: 'Mon-Fri: 8am-6pm | Sat: 9am-2pm', linkType: 'none' },
];

const CONTACT_ICON_MAP = Object.fromEntries(CONTACT_ICON_OPTIONS.map((option) => [option.key, option.Icon])) as Record<string, IconComponent>;
const SOCIAL_ICON_MAP = Object.fromEntries(SOCIAL_PLATFORM_OPTIONS.map((option) => [option.key, option.Icon])) as Record<string, IconComponent>;

export function getContactIcon(icon: string | undefined): IconComponent {
    return icon && CONTACT_ICON_MAP[icon] ? CONTACT_ICON_MAP[icon] : Phone;
}

export function getSocialIcon(platform: string | undefined): IconComponent {
    return platform && SOCIAL_ICON_MAP[platform] ? SOCIAL_ICON_MAP[platform] : Globe;
}

export function getSocialPlatformLabel(platform: string | undefined): string {
    return SOCIAL_PLATFORM_OPTIONS.find((option) => option.key === platform)?.label || 'Social link';
}

export function normalizeContactItems(data: Record<string, any> | undefined): ContactItem[] {
    const rawItems = data?.contactItems;
    if (Array.isArray(rawItems)) {
        return rawItems.map((item, index) => normalizeContactItem(item, index)).filter(Boolean) as ContactItem[];
    }

    return DEFAULT_CONTACT_ITEMS.map((item) => ({
        ...item,
        value: typeof data?.[item.id] === 'string' && data[item.id].trim() ? data[item.id] : item.value,
    }));
}

export function normalizeSocialLinks(data: Record<string, any> | undefined): SocialLinkItem[] {
    const rawLinks = data?.socialLinks;
    if (Array.isArray(rawLinks)) {
        return rawLinks.map((link, index) => normalizeSocialLink(link, index)).filter(Boolean) as SocialLinkItem[];
    }

    return SOCIAL_PLATFORM_OPTIONS
        .map((option, index) => {
            const legacyKey = 'legacyKey' in option ? option.legacyKey : undefined;
            const legacyUrl = legacyKey ? data?.[legacyKey] : undefined;
            if (typeof legacyUrl !== 'string' || !legacyUrl.trim()) return null;
            return {
                id: `${option.key}-${index + 1}`,
                platform: option.key,
                label: option.label,
                url: legacyUrl,
            };
        })
        .filter(Boolean) as SocialLinkItem[];
}

export function createContactItem(count: number): ContactItem {
    return {
        id: `contact-${Date.now()}-${count + 1}`,
        icon: 'phone',
        label: `Contact ${count + 1}`,
        value: 'Add contact details',
        linkType: 'auto',
    };
}

export function createSocialLink(count: number, platform = 'instagram'): SocialLinkItem {
    const option = SOCIAL_PLATFORM_OPTIONS.find((item) => item.key === platform) || SOCIAL_PLATFORM_OPTIONS[0];
    return {
        id: `social-${Date.now()}-${count + 1}`,
        platform: option.key,
        label: option.label,
        url: '',
    };
}

export function getContactHref(item: ContactItem): string | undefined {
    const value = item.value.trim();
    const explicitHref = item.href?.trim();
    if (explicitHref) return normalizeHref(explicitHref);
    if (!value || item.linkType === 'none') return undefined;

    const linkType = item.linkType === 'auto' || !item.linkType ? inferLinkType(item) : item.linkType;
    if (linkType === 'phone') return `tel:${value.replace(/[^\d+]/g, '')}`;
    if (linkType === 'email') return `mailto:${value}`;
    if (linkType === 'address') return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`;
    if (linkType === 'url') return normalizeHref(value);
    return undefined;
}

export function normalizeHref(url: string): string {
    const trimmed = url.trim();
    if (!trimmed) return '';
    if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
}

function inferLinkType(item: ContactItem): ContactLinkType {
    const icon = item.icon.toLowerCase();
    const label = item.label.toLowerCase();
    const value = item.value.trim();
    if (icon === 'phone' || icon === 'mobile' || label.includes('phone') || label.includes('call')) return 'phone';
    if (icon === 'email' || label.includes('email') || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'email';
    if (icon === 'address' || icon === 'directions' || label.includes('address') || label.includes('location')) return 'address';
    if (icon === 'website' || /^https?:\/\//i.test(value) || value.includes('.')) return 'url';
    return 'none';
}

function normalizeContactItem(item: any, index: number): ContactItem | null {
    if (!item || typeof item !== 'object') return null;
    return {
        id: typeof item.id === 'string' && item.id ? item.id : `contact-${index + 1}`,
        icon: typeof item.icon === 'string' ? item.icon : 'phone',
        label: typeof item.label === 'string' && item.label.trim() ? item.label : `Contact ${index + 1}`,
        value: typeof item.value === 'string' ? item.value : '',
        linkType: isContactLinkType(item.linkType) ? item.linkType : 'auto',
        href: typeof item.href === 'string' ? item.href : '',
    };
}

function normalizeSocialLink(item: any, index: number): SocialLinkItem | null {
    if (!item || typeof item !== 'object') return null;
    const platform = typeof item.platform === 'string' ? item.platform : 'website';
    return {
        id: typeof item.id === 'string' && item.id ? item.id : `social-${index + 1}`,
        platform,
        label: getSocialPlatformLabel(platform),
        url: typeof item.url === 'string' ? item.url : '',
    };
}

function isContactLinkType(value: unknown): value is ContactLinkType {
    return value === 'auto' || value === 'none' || value === 'phone' || value === 'email' || value === 'address' || value === 'url';
}
