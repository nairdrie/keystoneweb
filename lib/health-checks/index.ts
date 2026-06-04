// Health-check / "Doctor" diagnostic functions.
//
// Pure functions; safe to import from server, client, or tests.
// Surfaces: design-tab DoctorPanel, ops launch detail page, /admin/health.

export type Severity = 'error' | 'warning' | 'pass';

export interface DiagnosticResult {
  id: string;
  category: string;
  label: string;
  severity: Severity;
  message: string;
  page?: string;
  blockType?: string;
  link?: string;
}

export interface TranslationsConfig {
  enabled: boolean;
  defaultLanguage: string;
  languages: { code: string; name: string; autoTranslate: boolean }[];
}

export interface DiagnosticSite {
  id: string;
  design_data: any;
  is_published: boolean;
  stripe_account_id?: string;
  translations_config?: TranslationsConfig | null;
  translations?: Record<string, any> | null;
  favicon_url?: string | null;
  pending_custom_domain?: string | null;
  custom_domain?: string | null;
  analytics_provider?: string | null;
  analytics_id?: string | null;
}

export interface DiagnosticData {
  site: DiagnosticSite;
  pages: any[];
  bookingSettings: any;
  bookingServices: any[];
  ecommerceSettings: any;
  products: any[];
  domainPurchase?: {
    transfer_status?: string | null;
    status?: string | null;
  } | null;
  externalLinkResults?: Record<string, { ok: boolean; status?: number }>;
  imageReachabilityResults?: Record<string, { ok: boolean; status?: number }>;
}

export type CheckContext = 'designer' | 'owner' | 'ops';

// ─────────────────────────────────────────────────────────────────────────
// Existing checks (extracted from DoctorPanel.tsx; behavior preserved)
// ─────────────────────────────────────────────────────────────────────────

export function checkSiteBasics(data: DiagnosticData): DiagnosticResult[] {
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

export function checkPages(data: DiagnosticData): DiagnosticResult[] {
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

  const allLinkedPageIds = new Set<string>();
  const allLinkedHrefs = new Set<string>();
  for (const page of data.pages) {
    const blocks = page.design_data?.blocks || page.design_data?.__blocks || [];
    for (const block of blocks) {
      const bd = block.data || {};
      for (const key of Object.keys(bd)) {
        if (key.endsWith('Link') && typeof bd[key] === 'object' && bd[key]) {
          if (bd[key].pageId) allLinkedPageIds.add(bd[key].pageId);
          if (bd[key].href) allLinkedHrefs.add(bd[key].href);
        }
      }
      if (bd.ctaUrl) allLinkedHrefs.add(bd.ctaUrl);
    }
  }

  for (const page of data.pages) {
    if (page.slug === 'home') continue;
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

export function checkButtonsAndLinks(data: DiagnosticData): DiagnosticResult[] {
  const results: DiagnosticResult[] = [];
  let totalButtons = 0;
  let unconfiguredButtons = 0;

  const isUnconfiguredHref = (href: string | undefined) => !href || href === '#' || href === '';

  const checkLinkObject = (
    obj: any,
    idPrefix: string,
    pageName: string,
    blockType: string,
    pageSlug: string,
    itemLabel?: string,
  ) => {
    const seenLinkKeys = new Set<string>();

    for (const key of Object.keys(obj)) {
      if (!key.endsWith('Link') || key.endsWith('Icon')) continue;
      seenLinkKeys.add(key);

      const link = obj[key];

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

    for (const key of Object.keys(obj)) {
      if (key.endsWith('Link') || key.endsWith('Icon') || key === 'linkType') continue;
      const linkKey = `${key}Link`;
      if (seenLinkKeys.has(linkKey) || !(linkKey in obj)) {
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

      checkLinkObject(bd, blockPrefix, pageName, block.type, page.slug);

      for (const key of Object.keys(bd)) {
        if (Array.isArray(bd[key])) {
          bd[key].forEach((item: any, index: number) => {
            if (item && typeof item === 'object' && !Array.isArray(item)) {
              checkLinkObject(
                item,
                `${blockPrefix}-${key}-${index}`,
                pageName,
                block.type,
                page.slug,
                item.name || item.label || item.title,
              );
            }
          });
        }
      }
    }
  }

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

export function checkBooking(data: DiagnosticData): DiagnosticResult[] {
  const results: DiagnosticResult[] = [];
  const hasBookingBlock = data.pages.some((page) => {
    const blocks = page.design_data?.blocks || page.design_data?.__blocks || [];
    return blocks.some((b: any) => b.type === 'booking');
  });
  if (!hasBookingBlock) return [];

  if (!data.bookingSettings) {
    results.push({
      id: 'booking-no-settings',
      category: 'Booking',
      label: 'Booking not configured',
      severity: 'error',
      message:
        'You have a booking block but no booking settings. Configure your booking settings to accept appointments.',
    });
    return results;
  }

  if (!data.bookingSettings.notification_email) {
    results.push({
      id: 'booking-no-email',
      category: 'Booking',
      label: 'No booking notification email',
      severity: 'error',
      message:
        "Booking notifications won't be sent — no notification email is set. Add one in your booking block settings.",
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
      message:
        "No active services for booking. Customers won't have anything to book. Add at least one service.",
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
      message:
        "Booking payment is set to Stripe but Stripe is not connected. Customers won't be able to pay.",
    });
  }

  return results;
}

export function checkEcommerce(data: DiagnosticData): DiagnosticResult[] {
  const results: DiagnosticResult[] = [];
  const hasProductBlock = data.pages.some((page) => {
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
      message:
        'You have a product catalog block but no active products. Add products to your store.',
    });
  } else {
    results.push({
      id: 'ecomm-products-ok',
      category: 'E-Commerce',
      label: 'Products',
      severity: 'pass',
      message: `${data.products.length} active product(s) in your store.`,
    });

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
      message:
        'E-commerce settings are not configured. Set up your store settings including delivery and payment options.',
    });
  } else {
    if (!data.ecommerceSettings.notification_email) {
      results.push({
        id: 'ecomm-no-email',
        category: 'E-Commerce',
        label: 'No order notification email',
        severity: 'error',
        message:
          "No order notification email set. You won't receive order alerts. Add one in your store settings.",
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
        message:
          "Store payment is set to Stripe but Stripe is not connected. Customers won't be able to pay.",
      });
    }
  }

  return results;
}

export function checkContactForm(data: DiagnosticData): DiagnosticResult[] {
  const results: DiagnosticResult[] = [];
  const hasContactForm = data.pages.some((page) => {
    const blocks = page.design_data?.blocks || page.design_data?.__blocks || [];
    return blocks.some((b: any) => b.type === 'contact_form');
  });
  if (!hasContactForm) return [];

  if (!data.bookingSettings?.notification_email) {
    results.push({
      id: 'contact-no-email',
      category: 'Contact Form',
      label: 'No notification email',
      severity: 'warning',
      message:
        'Contact form submissions will go to your account email. Set a business notification email in your contact form or booking settings for a dedicated inbox.',
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

export function checkContactBlock(data: DiagnosticData): DiagnosticResult[] {
  const results: DiagnosticResult[] = [];

  for (const page of data.pages) {
    const blocks = page.design_data?.blocks || page.design_data?.__blocks || [];
    for (const block of blocks) {
      if (block.type !== 'contact') continue;
      const bd = block.data || {};
      const contactItems = Array.isArray(bd.contactItems) ? bd.contactItems : [];
      const hasCardValue = contactItems.some(
        (item: any) => typeof item?.value === 'string' && item.value.trim(),
      );
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

export function checkTranslations(data: DiagnosticData): DiagnosticResult[] {
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

// ─────────────────────────────────────────────────────────────────────────
// Accessibility helpers
// ─────────────────────────────────────────────────────────────────────────

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

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

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

export function checkImageAltText(data: DiagnosticData): DiagnosticResult[] {
  const results: DiagnosticResult[] = [];
  let totalImages = 0;
  let missingAlt = 0;

  const editableImageKeys = ['image', 'bgImage', 'featureImage', 'authorImage', 'quoteImage'];

  for (const page of data.pages) {
    const blocks = page.design_data?.blocks || page.design_data?.__blocks || [];
    const pageName = page.title || page.slug;

    for (const block of blocks) {
      const bd = block.data || {};

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
              message: `Image in "${block.type}" block on "${pageName}" has no alt text. Screen readers cannot describe this image to visually impaired users. To fix: open the page in the editor, click the image, and fill in the "Alt Text (Accessibility)" field in the image editor.`,
              page: page.slug,
              blockType: block.type,
            });
          }
        }
      }

      for (const key of Object.keys(bd)) {
        if (
          key.endsWith('__settings') ||
          key.endsWith('__attribution') ||
          editableImageKeys.includes(key)
        )
          continue;
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
              message: `Image (${key}) in "${block.type}" block on "${pageName}" has no alt text. To fix: open the page in the editor, click the image, and fill in the "Alt Text (Accessibility)" field in the image editor.`,
              page: page.slug,
              blockType: block.type,
            });
          }
        }
      }

      for (const key of Object.keys(bd)) {
        if (!Array.isArray(bd[key])) continue;
        bd[key].forEach((item: any, index: number) => {
          if (!item || typeof item !== 'object') return;
          const imgUrl = item.image || item.image_url || item.coverImage;
          if (imgUrl && typeof imgUrl === 'string' && imgUrl.startsWith('http')) {
            totalImages++;
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
        message:
          'Your site logo uses the site title as alt text, but no site title is set. Set a site title so the logo is accessible.',
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

export function checkColorContrast(data: DiagnosticData): DiagnosticResult[] {
  const results: DiagnosticResult[] = [];
  const dd = data.site.design_data || {};

  const customPrimary = dd.__customPalette_primary;
  const customSecondary = dd.__customPalette_secondary;
  const customAccent = dd.__customPalette_accent;

  const primary = customPrimary || dd.palette?.primary || '#1f2937';
  const secondary = customSecondary || dd.palette?.secondary || '#ef4444';
  const accent = customAccent || dd.palette?.accent || '#f3f4f6';

  const WHITE = '#ffffff';

  const pairings: { fg: string; bg: string; label: string; usage: string }[] = [
    { fg: primary, bg: WHITE, label: 'Primary on White', usage: 'Headings and body text on white sections' },
    { fg: WHITE, bg: primary, label: 'White on Primary', usage: 'Text on primary-coloured hero banners and sections' },
    { fg: WHITE, bg: secondary, label: 'White on Secondary', usage: 'Text on secondary-coloured accents (pricing badges, highlighted tier buttons, active tabs, "Featured" badges)' },
    { fg: primary, bg: accent, label: 'Primary on Accent', usage: 'Text on accent-coloured background sections' },
    { fg: secondary, bg: WHITE, label: 'Secondary on White', usage: 'Outline button text/borders, checkmark icons, and accent glyphs on white backgrounds' },
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

export function checkAccessibilityStructure(data: DiagnosticData): DiagnosticResult[] {
  const results: DiagnosticResult[] = [];
  const dd = data.site.design_data || {};

  const transConfig = data.site.translations_config;
  if (transConfig?.enabled && !transConfig.defaultLanguage) {
    results.push({
      id: 'a11y-lang-missing',
      category: 'Accessibility',
      label: 'Default language not set',
      severity: 'warning',
      message:
        'Translations are enabled but no default language is specified. Screen readers rely on the language attribute to pronounce text correctly. Set a default language in the Translations panel.',
    });
  }

  for (const page of data.pages) {
    const blocks = page.design_data?.blocks || page.design_data?.__blocks || [];
    const pageName = page.title || page.slug;
    if (blocks.length === 0) continue;

    const hasHeading = blocks.some((block: any) => {
      const bd = block.data || {};
      return (
        block.type === 'hero' ||
        bd.title ||
        bd.heading ||
        bd.headline ||
        bd.sectionTitle ||
        bd.sectionHeading
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

  const hasContactForm = data.pages.some((page) => {
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

  const navItems = dd.__navItems || [];
  if (data.pages.length > 1 && navItems.length === 0) {
    results.push({
      id: 'a11y-nav-missing',
      category: 'Accessibility',
      label: 'No navigation menu',
      severity: 'warning',
      message:
        'Your site has multiple pages but no navigation menu. Users (including those using assistive technology) need a way to navigate between pages (WCAG 2.4.5).',
    });
  }

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

// ─────────────────────────────────────────────────────────────────────────
// Pre-launch checks (new — see 082_launch_service_pipeline rollout)
// ─────────────────────────────────────────────────────────────────────────

export function checkPerPageSeo(data: DiagnosticData): DiagnosticResult[] {
  const results: DiagnosticResult[] = [];
  if (data.pages.length === 0) return results;

  let missingCount = 0;
  for (const page of data.pages) {
    const dd = page.design_data || {};
    const meta = dd.meta || dd.__meta || {};
    const seoTitle = dd.seoTitle || meta.seoTitle || meta.title || page.title;
    const seoDescription = dd.seoDescription || meta.seoDescription || meta.description;

    if (!seoTitle || !seoDescription) {
      missingCount++;
      results.push({
        id: `per-page-seo-${page.id}`,
        category: 'SEO',
        label: `Per-page SEO: "${page.title || page.slug}"`,
        severity: 'warning',
        message: `Page "${page.title || page.slug}" is missing ${[
          !seoTitle && 'SEO title',
          !seoDescription && 'meta description',
        ]
          .filter(Boolean)
          .join(' and ')}. Each page should have its own SEO metadata for best search performance.`,
        page: page.slug,
      });
    }
  }

  if (missingCount === 0) {
    results.push({
      id: 'per-page-seo-ok',
      category: 'SEO',
      label: 'Per-page SEO',
      severity: 'pass',
      message: `All ${data.pages.length} page(s) have SEO metadata.`,
    });
  }

  return results;
}

export function checkExternalLinks(data: DiagnosticData): DiagnosticResult[] {
  const results: DiagnosticResult[] = [];
  const reachability = data.externalLinkResults;
  if (!reachability) return results;

  const broken = Object.entries(reachability).filter(([, r]) => !r.ok);
  if (broken.length === 0) {
    if (Object.keys(reachability).length > 0) {
      results.push({
        id: 'external-links-ok',
        category: 'Buttons & Links',
        label: 'External links',
        severity: 'pass',
        message: `All ${Object.keys(reachability).length} external link(s) are reachable.`,
      });
    }
    return results;
  }

  for (const [url, result] of broken) {
    results.push({
      id: `external-link-broken-${encodeURIComponent(url)}`,
      category: 'Buttons & Links',
      label: 'Broken external link',
      severity: 'warning',
      message: `External link returns ${result.status ?? 'no response'}: ${url}`,
      link: url,
    });
  }

  return results;
}

export function checkImageReachability(data: DiagnosticData): DiagnosticResult[] {
  const results: DiagnosticResult[] = [];
  const reachability = data.imageReachabilityResults;
  if (!reachability) return results;

  const broken = Object.entries(reachability).filter(([, r]) => !r.ok);
  if (broken.length === 0) return results;

  for (const [url, result] of broken) {
    results.push({
      id: `image-broken-${encodeURIComponent(url)}`,
      category: 'Images',
      label: 'Broken image',
      severity: 'error',
      message: `Image returns ${result.status ?? 'no response'}: ${url}`,
      link: url,
    });
  }

  return results;
}

export function checkFavicon(data: DiagnosticData): DiagnosticResult[] {
  const dd = data.site.design_data || {};
  const favicon =
    dd.faviconLogo ||
    dd.siteLogo ||
    dd.__siteLogo ||
    dd.logo ||
    data.site.favicon_url ||
    dd.favicon ||
    dd.__favicon;
  if (!favicon) {
    return [
      {
        id: 'favicon-missing',
        category: 'Site Setup',
        label: 'Favicon',
        severity: 'warning',
        message:
          'No favicon set. A favicon is the small icon shown in browser tabs and bookmarks; visitors expect to see one.',
      },
    ];
  }
  return [
    {
      id: 'favicon-ok',
      category: 'Site Setup',
      label: 'Favicon',
      severity: 'pass',
      message: 'Favicon is set.',
    },
  ];
}

export function checkOgImage(data: DiagnosticData): DiagnosticResult[] {
  const dd = data.site.design_data || {};
  const siteOg = dd.ogImage || dd.__ogImage || dd.seoImage;
  if (data.pages.length === 0) return [];

  const missing: any[] = [];
  for (const page of data.pages) {
    const pdd = page.design_data || {};
    const meta = pdd.meta || pdd.__meta || {};
    const pageOg = pdd.ogImage || pdd.seoImage || meta.ogImage || meta.seoImage;
    if (!pageOg && !siteOg) missing.push(page);
  }

  if (missing.length === 0) {
    return [
      {
        id: 'og-image-ok',
        category: 'SEO',
        label: 'Social share image',
        severity: 'pass',
        message: 'Pages have a social-share (Open Graph) image.',
      },
    ];
  }

  return [
    {
      id: 'og-image-missing',
      category: 'SEO',
      label: 'Social share image',
      severity: 'warning',
      message: `No Open Graph image set ${siteOg ? '' : '(site-level or per-page)'}. When your site is shared on Facebook, LinkedIn, or in messages, a generic image (or none) will appear instead of your branding.`,
    },
  ];
}

export function checkAnalytics(data: DiagnosticData): DiagnosticResult[] {
  if (!data.site.is_published) {
    return [
      {
        id: 'analytics-unpublished',
        category: 'Site Setup',
        label: 'Analytics',
        severity: 'pass',
        message:
          "Built-in analytics will start collecting visitor data automatically once your site is published. View it under the Analytics tab.",
      },
    ];
  }

  return [
    {
      id: 'analytics-ok',
      category: 'Site Setup',
      label: 'Analytics',
      severity: 'pass',
      message: 'Built-in analytics is collecting visitor data. View it under the Analytics tab.',
    },
  ];
}

export function checkMobileHidden(data: DiagnosticData): DiagnosticResult[] {
  const results: DiagnosticResult[] = [];

  for (const page of data.pages) {
    const blocks = page.design_data?.blocks || page.design_data?.__blocks || [];
    if (blocks.length === 0) continue;

    const totalBlocks = blocks.length;
    const hiddenOnMobile = blocks.filter((b: any) => b?.data?.hideOnMobile === true || b?.hideOnMobile === true).length;

    if (hiddenOnMobile > 0 && hiddenOnMobile === totalBlocks) {
      results.push({
        id: `mobile-all-hidden-${page.id}`,
        category: 'Mobile',
        label: `All blocks hidden on mobile: "${page.title || page.slug}"`,
        severity: 'error',
        message: `Every block on "${page.title || page.slug}" is hidden on mobile. Mobile visitors will see an empty page.`,
        page: page.slug,
      });
    } else if (hiddenOnMobile > 0) {
      results.push({
        id: `mobile-some-hidden-${page.id}`,
        category: 'Mobile',
        label: `${hiddenOnMobile} block(s) hidden on mobile: "${page.title || page.slug}"`,
        severity: 'warning',
        message: `${hiddenOnMobile} of ${totalBlocks} blocks are hidden on mobile. Double-check that mobile visitors still see what they need.`,
        page: page.slug,
      });
    }
  }

  return results;
}

export function checkCustomDomainReadiness(data: DiagnosticData): DiagnosticResult[] {
  const pending = data.site.pending_custom_domain;
  if (!pending) return [];

  const purchase = data.domainPurchase;
  const transferStatus = purchase?.transfer_status;
  const purchaseStatus = purchase?.status;

  if (transferStatus === 'completed' || purchaseStatus === 'completed') {
    return [
      {
        id: 'custom-domain-ready',
        category: 'Domain',
        label: `Custom domain ready: ${pending}`,
        severity: 'pass',
        message: `DNS verified — ${pending} is ready to be promoted to the live custom domain on publish.`,
      },
    ];
  }

  return [
    {
      id: 'custom-domain-pending',
      category: 'Domain',
      label: `DNS pending: ${pending}`,
      severity: 'warning',
      message: `Custom domain ${pending} is queued but not yet verified (status: ${transferStatus ?? purchaseStatus ?? 'unknown'}). The site can still launch on the platform subdomain, but visitors to the custom domain will not reach it until DNS verifies.`,
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────
// Public runner
// ─────────────────────────────────────────────────────────────────────────

export function runAllChecks(
  data: DiagnosticData,
  context: CheckContext = 'designer',
): DiagnosticResult[] {
  const all: DiagnosticResult[] = [
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
    ...checkPerPageSeo(data),
    ...checkExternalLinks(data),
    ...checkImageReachability(data),
    ...checkFavicon(data),
    ...checkOgImage(data),
    ...checkAnalytics(data),
    ...checkMobileHidden(data),
    ...checkCustomDomainReadiness(data),
  ];

  if (context === 'designer' || context === 'owner') {
    return all.filter((r) => r.category !== 'Domain');
  }

  return all;
}
