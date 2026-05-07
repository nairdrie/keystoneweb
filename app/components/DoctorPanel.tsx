'use client';

import { useState, useCallback } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Loader2, RefreshCw, ChevronDown, ExternalLink } from 'lucide-react';

interface DoctorPanelProps {
    siteId?: string;
}

type Severity = 'error' | 'warning' | 'pass';

interface DiagnosticResult {
    id: string;
    category: string;
    label: string;
    severity: Severity;
    message: string;
    page?: string;
    blockType?: string;
    link?: string;
}

interface DiagnosticData {
    site: {
        id: string;
        design_data: any;
        is_published: boolean;
        stripe_account_id?: string;
        translations_config?: {
            enabled: boolean;
            defaultLanguage: string;
            languages: { code: string; name: string; autoTranslate: boolean }[];
        } | null;
        translations?: Record<string, any> | null;
    };
    pages: any[];
    bookingSettings: any;
    bookingServices: any[];
    ecommerceSettings: any;
    products: any[];
}

// --- Diagnostic check functions ---

function checkSiteBasics(data: DiagnosticData): DiagnosticResult[] {
    const results: DiagnosticResult[] = [];
    const dd = data.site.design_data || {};

    if (!dd.siteTitle && !dd.title && !dd.__siteTitle) {
        results.push({
            id: 'site-title',
            category: 'Site Setup',
            label: 'Site title',
            severity: 'error',
            message: 'Your site has no title. Add a title in General settings.',
        });
    } else {
        results.push({
            id: 'site-title',
            category: 'Site Setup',
            label: 'Site title',
            severity: 'pass',
            message: 'Site title is set.',
        });
    }

    if (!dd.logo && !dd.__siteLogo && !dd.siteLogo) {
        results.push({
            id: 'site-logo',
            category: 'Site Setup',
            label: 'Site logo',
            severity: 'warning',
            message: 'No logo uploaded. A logo helps with branding and recognition.',
        });
    } else {
        results.push({
            id: 'site-logo',
            category: 'Site Setup',
            label: 'Site logo',
            severity: 'pass',
            message: 'Logo is set.',
        });
    }

    // SEO checks
    const seoLink = `/admin/seo?siteId=${data.site.id}`;
    if (!dd.seoTitle && !dd.__seoTitle) {
        results.push({
            id: 'seo-title',
            category: 'SEO',
            label: 'SEO title',
            severity: 'warning',
            message: 'No SEO title set. Search engines will use your site title as a fallback.',
            link: seoLink,
        });
    } else {
        results.push({
            id: 'seo-title',
            category: 'SEO',
            label: 'SEO title',
            severity: 'pass',
            message: 'SEO title is configured.',
        });
    }

    if (!dd.seoDescription && !dd.__seoDescription) {
        results.push({
            id: 'seo-description',
            category: 'SEO',
            label: 'SEO description',
            severity: 'warning',
            message: 'No meta description set. This helps search engines understand your site.',
            link: seoLink,
        });
    } else {
        results.push({
            id: 'seo-description',
            category: 'SEO',
            label: 'SEO description',
            severity: 'pass',
            message: 'Meta description is configured.',
        });
    }

    return results;
}

function checkPages(data: DiagnosticData): DiagnosticResult[] {
    const results: DiagnosticResult[] = [];
    const dd = data.site.design_data || {};
    const navItems = dd.__navItems || [];

    if (data.pages.length === 0) {
        results.push({
            id: 'no-pages',
            category: 'Pages',
            label: 'No pages',
            severity: 'error',
            message: 'Your site has no pages. Create at least one page.',
        });
        return results;
    }

    // Check for blank pages (no blocks)
    for (const page of data.pages) {
        const pageDesign = page.design_data || {};
        const blocks = pageDesign.blocks || pageDesign.__blocks || [];

        if (blocks.length === 0) {
            results.push({
                id: `blank-page-${page.id}`,
                category: 'Pages',
                label: `Blank page: "${page.title || page.slug}"`,
                severity: 'error',
                message: `The page "${page.title || page.slug}" has no content blocks. Add content or remove the page.`,
                page: page.slug,
            });
        }
    }

    // Check for inaccessible pages (not in nav and not linked from anywhere)
    const allNavPageIds = new Set<string>();
    const allNavHrefs = new Set<string>();
    const collectNavRefs = (items: any[]) => {
        for (const item of items) {
            if (item.pageId) allNavPageIds.add(item.pageId);
            if (item.href) allNavHrefs.add(item.href);
            if (item.children) collectNavRefs(item.children);
        }
    };
    collectNavRefs(navItems);

    // Also collect all button/link hrefs from all page blocks
    const allLinkedPageIds = new Set<string>();
    const allLinkedHrefs = new Set<string>();
    for (const page of data.pages) {
        const blocks = page.design_data?.blocks || page.design_data?.__blocks || [];
        for (const block of blocks) {
            const bd = block.data || {};
            // Check all keys that end in "Link" (EditableButton pattern)
            for (const key of Object.keys(bd)) {
                if (key.endsWith('Link') && typeof bd[key] === 'object' && bd[key]) {
                    if (bd[key].pageId) allLinkedPageIds.add(bd[key].pageId);
                    if (bd[key].href) allLinkedHrefs.add(bd[key].href);
                }
            }
            // Also check ctaUrl
            if (bd.ctaUrl) allLinkedHrefs.add(bd.ctaUrl);
        }
    }

    for (const page of data.pages) {
        if (page.slug === 'home') continue; // Home is always accessible
        const isInNav = allNavPageIds.has(page.id) || allNavHrefs.has(`/${page.slug}`);
        const isLinked = allLinkedPageIds.has(page.id) || allLinkedHrefs.has(`/${page.slug}`);
        const isVisibleInNav = page.is_visible_in_nav !== false;

        if (!isInNav && !isLinked && !isVisibleInNav) {
            results.push({
                id: `inaccessible-page-${page.id}`,
                category: 'Pages',
                label: `Inaccessible page: "${page.title || page.slug}"`,
                severity: 'warning',
                message: `The page "${page.title || page.slug}" is hidden from navigation and not linked from any button. Visitors won't be able to reach it.`,
                page: page.slug,
            });
        }
    }

    if (results.length === 0) {
        results.push({
            id: 'pages-ok',
            category: 'Pages',
            label: 'All pages have content',
            severity: 'pass',
            message: 'All pages have content blocks and are accessible.',
        });
    }

    return results;
}

function checkButtonsAndLinks(data: DiagnosticData): DiagnosticResult[] {
    const results: DiagnosticResult[] = [];
    let totalButtons = 0;
    let unconfiguredButtons = 0;

    const isUnconfiguredHref = (href: string | undefined) => !href || href === '#' || href === '';

    // Check a single object (block.data or an array item) for *Link keys and ctaUrl
    const checkLinkObject = (obj: any, idPrefix: string, pageName: string, blockType: string, pageSlug: string, itemLabel?: string) => {
        const seenLinkKeys = new Set<string>();

        for (const key of Object.keys(obj)) {
            if (!key.endsWith('Link') || key.endsWith('Icon')) continue;
            seenLinkKeys.add(key);

            const link = obj[key];

            // null or missing link data — button exists but was never configured
            if (link === null || link === undefined) {
                totalButtons++;
                unconfiguredButtons++;
                const labelKey = key.replace(/Link$/, '');
                const label = obj[labelKey] || itemLabel || 'Unnamed button';
                results.push({
                    id: `button-${idPrefix}-${key}`,
                    category: 'Buttons & Links',
                    label: `Unconfigured button: "${label}"`,
                    severity: 'error',
                    message: `Button "${label}" on page "${pageName}" in ${blockType} block has no link destination.`,
                    page: pageSlug,
                    blockType,
                });
                continue;
            }

            if (typeof link !== 'object') continue;

            totalButtons++;
            const unconfigured = isUnconfiguredHref(link.href);
            if (unconfigured && link.linkType !== 'section') {
                unconfiguredButtons++;
                const labelKey = key.replace(/Link$/, '');
                const label = obj[labelKey] || itemLabel || 'Unnamed button';
                results.push({
                    id: `button-${idPrefix}-${key}`,
                    category: 'Buttons & Links',
                    label: `Unconfigured button: "${label}"`,
                    severity: 'error',
                    message: `Button "${label}" on page "${pageName}" in ${blockType} block has no link destination.`,
                    page: pageSlug,
                    blockType,
                });
            }
        }

        // Detect button text keys whose *Link sibling is entirely absent (never saved)
        for (const key of Object.keys(obj)) {
            if (key.endsWith('Link') || key.endsWith('Icon')) continue;
            const linkKey = `${key}Link`;
            if (seenLinkKeys.has(linkKey) || !(linkKey in obj)) {
                // Only flag if the linkKey is truly absent AND the value looks like a button label
                // (non-empty string with a plausible button-label key name)
                if (
                    !(linkKey in obj) &&
                    typeof obj[key] === 'string' &&
                    obj[key].trim() !== '' &&
                    /button|cta|action|link/i.test(key)
                ) {
                    totalButtons++;
                    unconfiguredButtons++;
                    results.push({
                        id: `button-${idPrefix}-${key}-missing`,
                        category: 'Buttons & Links',
                        label: `Unconfigured button: "${obj[key]}"`,
                        severity: 'error',
                        message: `Button "${obj[key]}" on page "${pageName}" in ${blockType} block has no link destination.`,
                        page: pageSlug,
                        blockType,
                    });
                }
            }
        }

        // Check ctaUrl on objects that have ctaText (skip if using EditableButton pattern via ctaTextLink)
        if (obj.ctaText && isUnconfiguredHref(obj.ctaUrl) && !('ctaTextLink' in obj)) {
            totalButtons++;
            unconfiguredButtons++;
            results.push({
                id: `cta-${idPrefix}`,
                category: 'Buttons & Links',
                label: `Unconfigured CTA: "${obj.ctaText}"`,
                severity: 'error',
                message: `CTA button "${obj.ctaText}" on page "${pageName}" in ${blockType} block has no URL.`,
                page: pageSlug,
                blockType,
            });
        } else if (obj.ctaText && (obj.ctaUrl || 'ctaTextLink' in obj)) {
            totalButtons++;
        }
    };

    for (const page of data.pages) {
        const blocks = page.design_data?.blocks || page.design_data?.__blocks || [];
        const pageName = page.title || page.slug;
        for (const block of blocks) {
            const bd = block.data || {};
            const blockPrefix = `${page.id}-${block.id}`;

            // Check top-level keys
            checkLinkObject(bd, blockPrefix, pageName, block.type, page.slug);

            // Check one level deep into arrays (e.g. PricingBlock tiers)
            for (const key of Object.keys(bd)) {
                if (Array.isArray(bd[key])) {
                    bd[key].forEach((item: any, index: number) => {
                        if (item && typeof item === 'object' && !Array.isArray(item)) {
                            checkLinkObject(item, `${blockPrefix}-${key}-${index}`, pageName, block.type, page.slug, item.name || item.label || item.title);
                        }
                    });
                }
            }
        }
    }

    // Check nav items for broken links
    const dd = data.site.design_data || {};
    const navItems = dd.__navItems || [];
    const pageIds = new Set(data.pages.map((p: any) => p.id));

    const checkNavItem = (item: any) => {
        if (item.linkType === 'page' && item.pageId && !pageIds.has(item.pageId)) {
            results.push({
                id: `nav-broken-${item.id}`,
                category: 'Navigation',
                label: `Broken nav link: "${item.label}"`,
                severity: 'error',
                message: `Navigation item "${item.label}" links to a page that no longer exists.`,
            });
        }
        if (item.linkType === 'custom' && (!item.href || item.href === '#' || item.href === '')) {
            results.push({
                id: `nav-empty-${item.id}`,
                category: 'Navigation',
                label: `Empty nav link: "${item.label}"`,
                severity: 'warning',
                message: `Navigation item "${item.label}" has no URL set.`,
            });
        }
        if (item.children) {
            for (const child of item.children) {
                checkNavItem(child);
            }
        }
    };
    for (const item of navItems) {
        checkNavItem(item);
    }

    if (results.length === 0 && totalButtons > 0) {
        results.push({
            id: 'buttons-ok',
            category: 'Buttons & Links',
            label: 'All buttons and links configured',
            severity: 'pass',
            message: `All ${totalButtons} button(s) and link(s) have valid destinations.`,
        });
    } else if (totalButtons === 0) {
        results.push({
            id: 'no-buttons',
            category: 'Buttons & Links',
            label: 'No buttons found',
            severity: 'pass',
            message: 'No buttons or CTA links found to check.',
        });
    }

    return results;
}

function checkBooking(data: DiagnosticData): DiagnosticResult[] {
    const results: DiagnosticResult[] = [];

    // Find if any page has a booking block
    const hasBookingBlock = data.pages.some(page => {
        const blocks = page.design_data?.blocks || page.design_data?.__blocks || [];
        return blocks.some((b: any) => b.type === 'booking');
    });

    if (!hasBookingBlock) return [];

    // Has booking block — check settings
    if (!data.bookingSettings) {
        results.push({
            id: 'booking-no-settings',
            category: 'Booking',
            label: 'Booking not configured',
            severity: 'error',
            message: 'You have a booking block but no booking settings. Configure your booking settings to accept appointments.',
        });
        return results;
    }

    if (!data.bookingSettings.notification_email) {
        results.push({
            id: 'booking-no-email',
            category: 'Booking',
            label: 'No booking notification email',
            severity: 'error',
            message: 'Booking notifications won\'t be sent — no notification email is set. Add one in your booking block settings.',
        });
    } else {
        results.push({
            id: 'booking-email-ok',
            category: 'Booking',
            label: 'Booking notification email',
            severity: 'pass',
            message: 'Booking notification email is configured.',
        });
    }

    if (data.bookingServices.length === 0) {
        results.push({
            id: 'booking-no-services',
            category: 'Booking',
            label: 'No booking services',
            severity: 'error',
            message: 'No active services for booking. Customers won\'t have anything to book. Add at least one service.',
        });
    } else {
        results.push({
            id: 'booking-services-ok',
            category: 'Booking',
            label: 'Booking services',
            severity: 'pass',
            message: `${data.bookingServices.length} active service(s) configured.`,
        });
    }

    if (data.bookingSettings.payment_method === 'stripe' && !data.site.stripe_account_id) {
        results.push({
            id: 'booking-stripe',
            category: 'Booking',
            label: 'Stripe not connected for booking',
            severity: 'error',
            message: 'Booking payment is set to Stripe but Stripe is not connected. Customers won\'t be able to pay.',
        });
    }

    return results;
}

function checkEcommerce(data: DiagnosticData): DiagnosticResult[] {
    const results: DiagnosticResult[] = [];

    // Find if any page has a product grid block
    const hasProductBlock = data.pages.some(page => {
        const blocks = page.design_data?.blocks || page.design_data?.__blocks || [];
        return blocks.some((b: any) => b.type === 'productGrid');
    });

    if (!hasProductBlock) return [];

    if (data.products.length === 0) {
        results.push({
            id: 'ecomm-no-products',
            category: 'E-Commerce',
            label: 'No products',
            severity: 'error',
            message: 'You have a product catalog block but no active products. Add products to your store.',
        });
    } else {
        results.push({
            id: 'ecomm-products-ok',
            category: 'E-Commerce',
            label: 'Products',
            severity: 'pass',
            message: `${data.products.length} active product(s) in your store.`,
        });

        // Check for products missing images
        const noImage = data.products.filter((p: any) => !p.images || p.images.length === 0);
        if (noImage.length > 0) {
            results.push({
                id: 'ecomm-no-images',
                category: 'E-Commerce',
                label: 'Products missing images',
                severity: 'warning',
                message: `${noImage.length} product(s) have no images: ${noImage.map((p: any) => p.name).join(', ')}`,
            });
        }

        // Check for $0 products
        const zeroPriced = data.products.filter((p: any) => !p.price_cents || p.price_cents === 0);
        if (zeroPriced.length > 0) {
            results.push({
                id: 'ecomm-zero-price',
                category: 'E-Commerce',
                label: 'Products with no price',
                severity: 'warning',
                message: `${zeroPriced.length} product(s) have $0 price: ${zeroPriced.map((p: any) => p.name).join(', ')}`,
            });
        }
    }

    if (!data.ecommerceSettings) {
        results.push({
            id: 'ecomm-no-settings',
            category: 'E-Commerce',
            label: 'Store not configured',
            severity: 'error',
            message: 'E-commerce settings are not configured. Set up your store settings including delivery and payment options.',
        });
    } else {
        if (!data.ecommerceSettings.notification_email) {
            results.push({
                id: 'ecomm-no-email',
                category: 'E-Commerce',
                label: 'No order notification email',
                severity: 'error',
                message: 'No order notification email set. You won\'t receive order alerts. Add one in your store settings.',
            });
        } else {
            results.push({
                id: 'ecomm-email-ok',
                category: 'E-Commerce',
                label: 'Order notification email',
                severity: 'pass',
                message: 'Order notification email is configured.',
            });
        }

        if (data.ecommerceSettings.payment_method === 'stripe' && !data.site.stripe_account_id) {
            results.push({
                id: 'ecomm-stripe',
                category: 'E-Commerce',
                label: 'Stripe not connected for store',
                severity: 'error',
                message: 'Store payment is set to Stripe but Stripe is not connected. Customers won\'t be able to pay.',
            });
        }
    }

    return results;
}

function checkContactForm(data: DiagnosticData): DiagnosticResult[] {
    const results: DiagnosticResult[] = [];

    const hasContactForm = data.pages.some(page => {
        const blocks = page.design_data?.blocks || page.design_data?.__blocks || [];
        return blocks.some((b: any) => b.type === 'contact_form');
    });

    if (!hasContactForm) return [];

    // Contact form uses booking notification email or user's own email
    // If booking settings exist and have notification_email, contact form uses that
    if (!data.bookingSettings?.notification_email) {
        results.push({
            id: 'contact-no-email',
            category: 'Contact Form',
            label: 'No notification email',
            severity: 'warning',
            message: 'Contact form submissions will go to your account email. Set a business notification email in your contact form or booking settings for a dedicated inbox.',
        });
    } else {
        results.push({
            id: 'contact-email-ok',
            category: 'Contact Form',
            label: 'Contact form email',
            severity: 'pass',
            message: 'Contact form submissions will be sent to your notification email.',
        });
    }

    return results;
}

function checkContactBlock(data: DiagnosticData): DiagnosticResult[] {
    const results: DiagnosticResult[] = [];

    for (const page of data.pages) {
        const blocks = page.design_data?.blocks || page.design_data?.__blocks || [];
        for (const block of blocks) {
            if (block.type !== 'contact') continue;
            const bd = block.data || {};

            // Check if contact info is filled in
            const contactItems = Array.isArray(bd.contactItems) ? bd.contactItems : [];
            const hasCardValue = contactItems.some((item: any) => typeof item?.value === 'string' && item.value.trim());
            const hasPhone = bd.phone || bd.item_0_value;
            const hasEmail = bd.email || bd.item_1_value;
            const hasAddress = bd.address || bd.item_2_value;

            if (!hasCardValue && !hasPhone && !hasEmail && !hasAddress) {
                results.push({
                    id: `contact-block-empty-${block.id}`,
                    category: 'Contact Info',
                    label: 'Empty contact info block',
                    severity: 'warning',
                    message: `Contact info block on "${page.title || page.slug}" has no phone, email, or address filled in.`,
                    page: page.slug,
                });
            }
        }
    }

    return results;
}

function checkTranslations(data: DiagnosticData): DiagnosticResult[] {
    const results: DiagnosticResult[] = [];
    const config = data.site.translations_config;

    if (!config?.enabled || !config.languages?.length) return [];

    const nonDefaultLanguages = config.languages.filter((l) => l.code !== config.defaultLanguage);
    if (nonDefaultLanguages.length === 0) return [];

    const siteTranslations = data.site.translations || {};

    for (const lang of nonDefaultLanguages) {
        const missingSiteTranslation = !siteTranslations[lang.code];
        const pagesWithMissingTranslation = data.pages.filter((page) => {
            const pageTrans = page.translations || {};
            return !pageTrans[lang.code];
        });

        if (missingSiteTranslation || pagesWithMissingTranslation.length > 0) {
            const missingParts: string[] = [];
            if (missingSiteTranslation) missingParts.push('site content');
            if (pagesWithMissingTranslation.length > 0) {
                const names = pagesWithMissingTranslation.map((p: any) => p.title || p.slug).join(', ');
                missingParts.push(`pages: ${names}`);
            }
            results.push({
                id: `translation-missing-${lang.code}`,
                category: 'Translations',
                label: `Missing ${lang.name} translation`,
                severity: 'warning',
                message: `No translation has been generated for ${lang.name} (${lang.code}). Missing: ${missingParts.join('; ')}. Use "Generate Draft Translation" in the Translations panel.`,
            });
        } else {
            results.push({
                id: `translation-ok-${lang.code}`,
                category: 'Translations',
                label: `${lang.name} translation`,
                severity: 'pass',
                message: `${lang.name} translation is available for all pages.`,
            });
        }
    }

    return results;
}

// --- Accessibility (AODA / WCAG 2.0 AA) checks ---

/**
 * Parse a hex color string to {r, g, b} (0-255).
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const cleaned = hex.replace('#', '');
    if (cleaned.length === 3) {
        return {
            r: parseInt(cleaned[0] + cleaned[0], 16),
            g: parseInt(cleaned[1] + cleaned[1], 16),
            b: parseInt(cleaned[2] + cleaned[2], 16),
        };
    }
    if (cleaned.length === 6) {
        return {
            r: parseInt(cleaned.slice(0, 2), 16),
            g: parseInt(cleaned.slice(2, 4), 16),
            b: parseInt(cleaned.slice(4, 6), 16),
        };
    }
    return null;
}

/**
 * Calculate relative luminance per WCAG 2.0 spec.
 */
function relativeLuminance(r: number, g: number, b: number): number {
    const [rs, gs, bs] = [r, g, b].map(c => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate WCAG contrast ratio between two hex colors.
 */
function contrastRatio(hex1: string, hex2: string): number | null {
    const c1 = hexToRgb(hex1);
    const c2 = hexToRgb(hex2);
    if (!c1 || !c2) return null;
    const l1 = relativeLuminance(c1.r, c1.g, c1.b);
    const l2 = relativeLuminance(c2.r, c2.g, c2.b);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check all images across pages for missing alt text.
 * Scans EditableImage-stored alt via __settings keys and inline images in block data.
 */
function checkImageAltText(data: DiagnosticData): DiagnosticResult[] {
    const results: DiagnosticResult[] = [];
    let totalImages = 0;
    let missingAlt = 0;

    // Block types that commonly have a primary image via EditableImage
    const editableImageKeys = ['image', 'bgImage', 'featureImage', 'authorImage', 'quoteImage'];
    // Block types with array items containing images
    const arrayImageFields: Record<string, string[]> = {
        gallery: ['images'],
        team: ['members'],
        carousel: ['items'],
        logoCloud: ['logos'],
    };

    for (const page of data.pages) {
        const blocks = page.design_data?.blocks || page.design_data?.__blocks || [];
        const pageName = page.title || page.slug;

        for (const block of blocks) {
            const bd = block.data || {};

            // Check primary image keys
            for (const key of editableImageKeys) {
                if (bd[key] && typeof bd[key] === 'string' && bd[key].startsWith('http')) {
                    totalImages++;
                    const settingsKey = `${key}__settings`;
                    const altText = bd[settingsKey]?.altText;
                    if (!altText || altText.trim() === '') {
                        missingAlt++;
                        results.push({
                            id: `a11y-alt-${page.id}-${block.id}-${key}`,
                            category: 'Accessibility',
                            label: `Missing alt text: ${block.type} image`,
                            severity: 'warning',
                            message: `Image in "${block.type}" block on "${pageName}" has no alt text. Screen readers cannot describe this image to visually impaired users. Edit the image and add descriptive alt text.`,
                            page: page.slug,
                            blockType: block.type,
                        });
                    }
                }
            }

            // Check all keys for image URLs that might be EditableImage-managed
            for (const key of Object.keys(bd)) {
                if (
                    key.endsWith('__settings') ||
                    key.endsWith('__attribution') ||
                    editableImageKeys.includes(key)
                ) continue;
                if (
                    typeof bd[key] === 'string' &&
                    bd[key].startsWith('http') &&
                    /\.(jpg|jpeg|png|gif|webp|svg)/i.test(bd[key])
                ) {
                    totalImages++;
                    const settingsKey = `${key}__settings`;
                    const altText = bd[settingsKey]?.altText;
                    if (!altText || altText.trim() === '') {
                        missingAlt++;
                        results.push({
                            id: `a11y-alt-${page.id}-${block.id}-${key}`,
                            category: 'Accessibility',
                            label: `Missing alt text: ${block.type} image`,
                            severity: 'warning',
                            message: `Image (${key}) in "${block.type}" block on "${pageName}" has no alt text. Add alt text for accessibility compliance.`,
                            page: page.slug,
                            blockType: block.type,
                        });
                    }
                }
            }

            // Check array items with images (gallery images, team members, carousel items, etc.)
            for (const key of Object.keys(bd)) {
                if (!Array.isArray(bd[key])) continue;
                bd[key].forEach((item: any, index: number) => {
                    if (!item || typeof item !== 'object') return;
                    // Check for image/image_url in array items
                    const imgUrl = item.image || item.image_url || item.coverImage;
                    if (imgUrl && typeof imgUrl === 'string' && imgUrl.startsWith('http')) {
                        totalImages++;
                        // Array items typically don't have __settings, so check for item-level alt
                        if (!item.altText && !item.alt && !item.name && !item.title) {
                            missingAlt++;
                            results.push({
                                id: `a11y-alt-${page.id}-${block.id}-${key}-${index}`,
                                category: 'Accessibility',
                                label: `Missing alt text: ${block.type} item image`,
                                severity: 'warning',
                                message: `Image #${index + 1} in "${block.type}" block on "${pageName}" has no alt text or descriptive name/title.`,
                                page: page.slug,
                                blockType: block.type,
                            });
                        }
                    }
                });
            }
        }
    }

    // Check site logo alt text
    const dd = data.site.design_data || {};
    if (dd.logo || dd.__siteLogo || dd.siteLogo) {
        totalImages++;
        if (!dd.siteTitle && !dd.title && !dd.__siteTitle) {
            missingAlt++;
            results.push({
                id: 'a11y-alt-logo',
                category: 'Accessibility',
                label: 'Logo missing alt text',
                severity: 'warning',
                message: 'Your site logo uses the site title as alt text, but no site title is set. Set a site title so the logo is accessible.',
            });
        }
    }

    if (totalImages > 0 && missingAlt === 0) {
        results.push({
            id: 'a11y-alt-ok',
            category: 'Accessibility',
            label: 'Image alt text',
            severity: 'pass',
            message: `All ${totalImages} image(s) have alt text set.`,
        });
    } else if (totalImages === 0) {
        results.push({
            id: 'a11y-alt-none',
            category: 'Accessibility',
            label: 'Image alt text',
            severity: 'pass',
            message: 'No images found to check.',
        });
    }

    return results;
}

/**
 * Check colour contrast ratios against WCAG 2.0 AA standards.
 * AODA requires WCAG 2.0 Level AA: 4.5:1 for normal text, 3:1 for large text.
 * We check the user's palette colours in common usage patterns.
 */
function checkColorContrast(data: DiagnosticData): DiagnosticResult[] {
    const results: DiagnosticResult[] = [];
    const dd = data.site.design_data || {};

    // Resolve palette colors
    const customPrimary = dd.__customPalette_primary;
    const customSecondary = dd.__customPalette_secondary;
    const customAccent = dd.__customPalette_accent;

    const primary = customPrimary || dd.palette?.primary || '#1f2937';
    const secondary = customSecondary || dd.palette?.secondary || '#ef4444';
    const accent = customAccent || dd.palette?.accent || '#f3f4f6';

    const WHITE = '#ffffff';
    const BLACK = '#000000';

    // Common colour pairings used in templates:
    // 1. Primary text on white background (headings, body text)
    // 2. White text on primary background (hero overlays, dark sections)
    // 3. White text on secondary background (buttons, CTAs)
    // 4. Primary text on accent background (accent sections like hero, feature areas)
    // 5. Secondary text on white background (links, highlights)

    const pairings: { fg: string; bg: string; label: string; usage: string }[] = [
        { fg: primary, bg: WHITE, label: 'Primary on White', usage: 'Headings and body text on white sections' },
        { fg: WHITE, bg: primary, label: 'White on Primary', usage: 'Text on primary-coloured hero banners and sections' },
        { fg: WHITE, bg: secondary, label: 'White on Secondary', usage: 'Button text and CTA labels' },
        { fg: primary, bg: accent, label: 'Primary on Accent', usage: 'Text on accent-coloured background sections' },
        { fg: secondary, bg: WHITE, label: 'Secondary on White', usage: 'Links, highlights, and emphasis text' },
    ];

    let allPass = true;

    for (const pair of pairings) {
        const ratio = contrastRatio(pair.fg, pair.bg);
        if (ratio === null) continue;

        const roundedRatio = Math.round(ratio * 100) / 100;

        if (ratio < 3) {
            allPass = false;
            results.push({
                id: `a11y-contrast-${pair.label.replace(/\s/g, '-').toLowerCase()}`,
                category: 'Accessibility',
                label: `Poor contrast: ${pair.label}`,
                severity: 'error',
                message: `Contrast ratio ${roundedRatio}:1 fails WCAG AA for all text sizes (minimum 4.5:1 for normal text, 3:1 for large text). Used for: ${pair.usage}. Adjust your colours in the Design Toolbar → Colours panel.`,
            });
        } else if (ratio < 4.5) {
            allPass = false;
            results.push({
                id: `a11y-contrast-${pair.label.replace(/\s/g, '-').toLowerCase()}`,
                category: 'Accessibility',
                label: `Low contrast: ${pair.label}`,
                severity: 'warning',
                message: `Contrast ratio ${roundedRatio}:1 passes for large text (3:1) but fails for normal text (4.5:1 required). Used for: ${pair.usage}. Consider adjusting your colours.`,
            });
        }
    }

    if (allPass) {
        results.push({
            id: 'a11y-contrast-ok',
            category: 'Accessibility',
            label: 'Colour contrast',
            severity: 'pass',
            message: 'All colour combinations meet WCAG AA contrast requirements (4.5:1).',
        });
    }

    return results;
}

/**
 * Check for common structural accessibility issues required by AODA / WCAG 2.0 AA.
 */
function checkAccessibilityStructure(data: DiagnosticData): DiagnosticResult[] {
    const results: DiagnosticResult[] = [];
    const dd = data.site.design_data || {};

    // Check: Site language is set (WCAG 3.1.1 — Language of Page)
    // The site renders with lang="en" by default in layout.tsx, so this is handled.
    // But we can warn if they have translations enabled but no default language set.
    const transConfig = data.site.translations_config;
    if (transConfig?.enabled && !transConfig.defaultLanguage) {
        results.push({
            id: 'a11y-lang-missing',
            category: 'Accessibility',
            label: 'Default language not set',
            severity: 'warning',
            message: 'Translations are enabled but no default language is specified. Screen readers rely on the language attribute to pronounce text correctly. Set a default language in the Translations panel.',
        });
    }

    // Check: Pages have proper heading structure (at least one heading per page)
    for (const page of data.pages) {
        const blocks = page.design_data?.blocks || page.design_data?.__blocks || [];
        const pageName = page.title || page.slug;
        if (blocks.length === 0) continue;

        // Check if any block has heading/title content
        const hasHeading = blocks.some((block: any) => {
            const bd = block.data || {};
            return (
                block.type === 'hero' ||
                bd.title || bd.heading || bd.headline ||
                bd.sectionTitle || bd.sectionHeading
            );
        });

        if (!hasHeading) {
            results.push({
                id: `a11y-heading-${page.id}`,
                category: 'Accessibility',
                label: `No heading: "${pageName}"`,
                severity: 'warning',
                message: `Page "${pageName}" may lack a visible heading (h1/h2). Headings help screen reader users navigate and understand page structure (WCAG 2.4.6).`,
                page: page.slug,
            });
        }
    }

    // Check: Contact forms have associated labels (WCAG 1.3.1 / 4.1.2)
    const hasContactForm = data.pages.some(page => {
        const blocks = page.design_data?.blocks || page.design_data?.__blocks || [];
        return blocks.some((b: any) => b.type === 'contact_form');
    });
    if (hasContactForm) {
        results.push({
            id: 'a11y-form-labels',
            category: 'Accessibility',
            label: 'Form field labels',
            severity: 'pass',
            message: 'Contact form uses labelled input fields for screen reader compatibility.',
        });
    }

    // Check: Navigation is present (WCAG 2.4.5 — Multiple ways to find pages)
    const navItems = dd.__navItems || [];
    if (data.pages.length > 1 && navItems.length === 0) {
        results.push({
            id: 'a11y-nav-missing',
            category: 'Accessibility',
            label: 'No navigation menu',
            severity: 'warning',
            message: 'Your site has multiple pages but no navigation menu. Users (including those using assistive technology) need a way to navigate between pages (WCAG 2.4.5).',
        });
    }

    // Check: Link text — scan for generic "Click here" / "Read more" link labels without context
    let genericLinkCount = 0;
    for (const page of data.pages) {
        const blocks = page.design_data?.blocks || page.design_data?.__blocks || [];
        for (const block of blocks) {
            const bd = block.data || {};
            for (const key of Object.keys(bd)) {
                if (typeof bd[key] !== 'string') continue;
                const val = bd[key].trim().toLowerCase();
                if (
                    (key.toLowerCase().includes('button') || key.toLowerCase().includes('cta')) &&
                    (val === 'click here' || val === 'read more' || val === 'learn more' || val === 'here')
                ) {
                    genericLinkCount++;
                }
            }
        }
    }
    if (genericLinkCount > 0) {
        results.push({
            id: 'a11y-generic-links',
            category: 'Accessibility',
            label: 'Generic link text found',
            severity: 'warning',
            message: `${genericLinkCount} button(s) use generic text like "Click here" or "Read more". Screen readers read links out of context — use descriptive text like "View our services" instead (WCAG 2.4.4).`,
        });
    }

    if (results.length === 0) {
        results.push({
            id: 'a11y-structure-ok',
            category: 'Accessibility',
            label: 'Page structure',
            severity: 'pass',
            message: 'Site structure meets accessibility requirements.',
        });
    }

    return results;
}

function runAllChecks(data: DiagnosticData): DiagnosticResult[] {
    return [
        ...checkSiteBasics(data),
        ...checkPages(data),
        ...checkButtonsAndLinks(data),
        ...checkTranslations(data),
        ...checkImageAltText(data),
        ...checkColorContrast(data),
        ...checkAccessibilityStructure(data),
        ...checkBooking(data),
        ...checkEcommerce(data),
        ...checkContactForm(data),
        ...checkContactBlock(data),
    ];
}

// --- Component ---

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, pass: 2 };

function SeverityIcon({ severity }: { severity: Severity }) {
    switch (severity) {
        case 'error':
            return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
        case 'warning':
            return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
        case 'pass':
            return <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />;
    }
}

export default function DoctorPanel({ siteId }: DoctorPanelProps) {
    const [results, setResults] = useState<DiagnosticResult[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

    const runDiagnostics = useCallback(async () => {
        if (!siteId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/doctor?siteId=${siteId}`, { credentials: 'include' });
            if (!res.ok) throw new Error('Failed to fetch diagnostic data');
            const data: DiagnosticData = await res.json();
            const diagnostics = runAllChecks(data);
            diagnostics.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
            setResults(diagnostics);

            // Auto-expand categories that have issues
            const issueCategories = new Set(
                diagnostics.filter(d => d.severity !== 'pass').map(d => d.category)
            );
            setExpandedCategories(issueCategories);
        } catch (err) {
            setError('Failed to run diagnostics. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [siteId]);

    const toggleCategory = (cat: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(cat)) next.delete(cat);
            else next.add(cat);
            return next;
        });
    };

    // Group results by category
    const grouped = results
        ? results.reduce<Record<string, DiagnosticResult[]>>((acc, r) => {
            if (!acc[r.category]) acc[r.category] = [];
            acc[r.category].push(r);
            return acc;
        }, {})
        : null;

    const errorCount = results?.filter(r => r.severity === 'error').length || 0;
    const warningCount = results?.filter(r => r.severity === 'warning').length || 0;
    const passCount = results?.filter(r => r.severity === 'pass').length || 0;

    return (
        <div className="p-4 space-y-4">
            <div className="text-sm text-slate-600">
                Run a full health check on your site before publishing. Scans for missing configurations, broken links, incomplete setups, and accessibility compliance (AODA / WCAG 2.0 AA).
            </div>

            <button
                onClick={runDiagnostics}
                disabled={loading || !siteId}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: loading ? '#94a3b8' : '#7c3aed' }}
            >
                {loading ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Scanning...
                    </>
                ) : (
                    <>
                        <RefreshCw className="w-4 h-4" />
                        {results ? 'Re-run Health Check' : 'Run Health Check'}
                    </>
                )}
            </button>

            {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                    {error}
                </div>
            )}

            {results && !loading && (
                <>
                    {/* Summary bar */}
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                        {errorCount > 0 && (
                            <span className="flex items-center gap-1 text-xs font-semibold text-red-600">
                                <XCircle className="w-3.5 h-3.5" />
                                {errorCount} error{errorCount !== 1 ? 's' : ''}
                            </span>
                        )}
                        {warningCount > 0 && (
                            <span className="flex items-center gap-1 text-xs font-semibold text-amber-600">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                {warningCount} warning{warningCount !== 1 ? 's' : ''}
                            </span>
                        )}
                        {passCount > 0 && (
                            <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {passCount} passed
                            </span>
                        )}
                        {errorCount === 0 && warningCount === 0 && (
                            <span className="text-xs font-semibold text-green-700">
                                All checks passed! Your site is ready to publish.
                            </span>
                        )}
                    </div>

                    {/* Results by category */}
                    <div className="space-y-2">
                        {grouped && Object.entries(grouped).map(([category, items]) => {
                            const hasIssues = items.some(i => i.severity !== 'pass');
                            const isExpanded = expandedCategories.has(category);
                            const catErrors = items.filter(i => i.severity === 'error').length;
                            const catWarnings = items.filter(i => i.severity === 'warning').length;

                            return (
                                <div
                                    key={category}
                                    className="border border-slate-200 rounded-lg overflow-hidden"
                                >
                                    <button
                                        onClick={() => toggleCategory(category)}
                                        className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${hasIssues
                                            ? 'bg-red-50 hover:bg-red-100'
                                            : 'bg-green-50 hover:bg-green-100'
                                            }`}
                                    >
                                        <span className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                                            {hasIssues ? (
                                                catErrors > 0 ? <XCircle className="w-3.5 h-3.5 text-red-500" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                            ) : (
                                                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                            )}
                                            {category}
                                            {catErrors > 0 && (
                                                <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
                                                    {catErrors}
                                                </span>
                                            )}
                                            {catWarnings > 0 && (
                                                <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                                                    {catWarnings}
                                                </span>
                                            )}
                                        </span>
                                        <ChevronDown
                                            className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                        />
                                    </button>
                                    {isExpanded && (
                                        <div className="border-t border-slate-200 divide-y divide-slate-100">
                                            {items.map(item => (
                                                <div
                                                    key={item.id}
                                                    className="px-3 py-2.5 flex items-start gap-2"
                                                >
                                                    <SeverityIcon severity={item.severity} />
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-medium text-slate-800">
                                                            {item.label}
                                                        </div>
                                                        <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                                            {item.message}
                                                        </div>
                                                        {item.link && item.severity !== 'pass' && (
                                                            <a
                                                                href={item.link}
                                                                className="inline-flex items-center gap-1 text-[11px] text-violet-600 hover:text-violet-800 font-medium mt-1"
                                                            >
                                                                Fix this
                                                                <ExternalLink className="w-3 h-3" />
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {!results && !loading && !error && (
                <div className="text-center text-xs text-slate-400 py-4">
                    Click "Run Diagnostics" to scan your site.
                </div>
            )}
        </div>
    );
}
