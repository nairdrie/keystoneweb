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
}

interface DiagnosticData {
    site: {
        id: string;
        design_data: any;
        is_published: boolean;
        stripe_account_id?: string;
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

    if (!dd.title && !dd.__siteTitle) {
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
    if (!dd.seoTitle && !dd.__seoTitle) {
        results.push({
            id: 'seo-title',
            category: 'SEO',
            label: 'SEO title',
            severity: 'warning',
            message: 'No SEO title set. Search engines will use your site title as a fallback.',
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

    // Check a single object (block.data or an array item) for *Link keys and ctaUrl
    const checkLinkObject = (obj: any, idPrefix: string, pageName: string, blockType: string, pageSlug: string, itemLabel?: string) => {
        for (const key of Object.keys(obj)) {
            if (key.endsWith('Link') && typeof obj[key] === 'object' && obj[key]) {
                totalButtons++;
                const link = obj[key];
                const isUnconfigured = !link.href || link.href === '#' || link.href === '';
                if (isUnconfigured && link.linkType !== 'section') {
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
        }
        // Check ctaUrl on objects that have ctaText
        if (obj.ctaText && (!obj.ctaUrl || obj.ctaUrl === '#' || obj.ctaUrl === '')) {
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
        } else if (obj.ctaText && obj.ctaUrl) {
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
    const pageSlugs = new Set(data.pages.map((p: any) => p.slug));

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
            const hasPhone = bd.phone || bd.item_0_value;
            const hasEmail = bd.email || bd.item_1_value;
            const hasAddress = bd.address || bd.item_2_value;

            if (!hasPhone && !hasEmail && !hasAddress) {
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

function runAllChecks(data: DiagnosticData): DiagnosticResult[] {
    return [
        ...checkSiteBasics(data),
        ...checkPages(data),
        ...checkButtonsAndLinks(data),
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
            return <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />;
        case 'warning':
            return <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />;
        case 'pass':
            return <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />;
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
                Run a full diagnostic check on your site before publishing. This will scan every page for missing configurations, broken links, and incomplete setups.
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
                        {results ? 'Re-run Diagnostics' : 'Run Diagnostics'}
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
