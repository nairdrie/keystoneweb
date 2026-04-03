import { load } from 'cheerio';
import {
  buildCsv,
  buildShortDescription,
  cleanTagList,
  extractJsonLdObjects,
  extractMetaContent,
  fetchHtml,
  fetchJson,
  firstNonEmpty,
  isProductLikeJsonLd,
  looksLikePaginationUrl,
  looksLikeProductUrl,
  mapWithConcurrency,
  minorUnitsToDecimal,
  normalizeAvailability,
  normalizeWhitespace,
  safeUrl,
  sameOrigin,
  slugify,
  stripHtml,
  toDecimalString,
  truncate,
  uniqueStrings,
} from './shared';
import type {
  ScrapedProduct,
  ScrapedProductOption,
  ScrapedProductVariant,
  ScraperProvider,
  ScraperResult,
} from './types';

const PRODUCT_CSV_HEADERS = [
  'product_name',
  'product_url',
  'short_description',
  'full_description',
  'price',
  'compare_at_price',
  'currency',
  'sku',
  'brand',
  'category',
  'tags',
  'main_image_url',
  'additional_image_urls',
  'availability',
  'variant_group_id',
  'variant_name',
  'variant_option_1_name',
  'variant_option_1_value',
  'variant_option_2_name',
  'variant_option_2_value',
  'variant_option_3_name',
  'variant_option_3_value',
];

const PROVIDER_LABELS: Record<ScraperProvider, string> = {
  shopify: 'Shopify',
  woocommerce: 'WooCommerce / WordPress',
  squarespace: 'Squarespace Commerce',
  wix: 'Wix Stores',
  bigcommerce: 'BigCommerce',
  webflow: 'Webflow Ecommerce',
  generic: 'Generic storefront',
};

const MAX_PRODUCTS = 250;
const MAX_PAGINATION_PAGES = 4;
const MAX_SITEMAP_LINKS = 50;

interface ProductScrapeOutcome {
  provider: ScraperProvider;
  strategy: string;
  products: ScrapedProduct[];
  discoveredPages: number;
  failedPages: number;
  capped: boolean;
  warnings: string[];
}

interface JsonRecord {
  [key: string]: unknown;
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function toStringList(value: unknown) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((entry) => toStringList(entry));
  }
  if (typeof value === 'string') return [value];
  const record = asRecord(value);
  if (!record) return [];
  return toStringList(record.url ?? record.name ?? record.src ?? record.contentUrl);
}

function getOfferList(value: unknown): JsonRecord[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((entry) => asRecord(entry)).filter((entry): entry is JsonRecord => Boolean(entry));
  }
  const record = asRecord(value);
  return record ? [record] : [];
}

function getBrandName(value: unknown) {
  const record = asRecord(value);
  if (record) {
    return firstNonEmpty(String(record.name ?? ''), String(record.brand ?? ''));
  }
  return typeof value === 'string' ? value : '';
}

function uniqueOptionPairs(options: ScrapedProductOption[]) {
  const seen = new Set<string>();
  const result: ScrapedProductOption[] = [];

  for (const option of options) {
    const key = `${option.name.toLowerCase()}::${option.value.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(option);
  }

  return result;
}

function getAdditionalPropertyOptions(value: unknown) {
  if (!Array.isArray(value)) return [] as ScrapedProductOption[];

  return value
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) return null;
      const name = firstNonEmpty(String(record.name ?? ''), String(record.propertyID ?? ''));
      const propertyValue = firstNonEmpty(String(record.value ?? ''), String(record.valueReference ?? ''));
      if (!name || !propertyValue) return null;
      return { name, value: propertyValue };
    })
    .filter((entry): entry is ScrapedProductOption => Boolean(entry));
}

function getVariantOptionsFromRecord(record: JsonRecord) {
  const options: ScrapedProductOption[] = [];

  const color = normalizeWhitespace(String(record.color ?? ''));
  if (color) options.push({ name: 'Color', value: color });

  const size = normalizeWhitespace(String(record.size ?? ''));
  if (size) options.push({ name: 'Size', value: size });

  const material = normalizeWhitespace(String(record.material ?? ''));
  if (material) options.push({ name: 'Material', value: material });

  options.push(...getAdditionalPropertyOptions(record.additionalProperty));

  return uniqueOptionPairs(options);
}

function buildVariantName(options: ScrapedProductOption[]) {
  return options.map((option) => option.value).filter(Boolean).join(' / ');
}

function parseJsonLdProductNode(node: JsonRecord, baseUrl: string): ScrapedProduct | null {
  const offers = getOfferList(node.offers);
  const firstOffer = offers[0] ?? {};
  const variantsFromGroup = Array.isArray(node.hasVariant)
    ? node.hasVariant
        .map((entry) => asRecord(entry))
        .filter((entry): entry is JsonRecord => Boolean(entry))
        .map((variant) => {
          const variantOffers = getOfferList(variant.offers);
          const variantOffer = variantOffers[0] ?? {};
          const options = getVariantOptionsFromRecord(variant);
          return {
            id: firstNonEmpty(String(variant.sku ?? ''), `${slugify(String(node.name ?? 'product'))}-${buildVariantName(options) || 'variant'}`),
            name: firstNonEmpty(String(variant.name ?? ''), buildVariantName(options)),
            sku: normalizeWhitespace(String(variant.sku ?? '')),
            price: firstNonEmpty(toDecimalString(variantOffer.price), toDecimalString(variant.price)),
            compareAtPrice: '',
            availability: normalizeAvailability(variantOffer.availability ?? variant.availability),
            options,
          } satisfies ScrapedProductVariant;
        })
        .filter((variant) => variant.name || variant.sku || variant.options.length > 0)
    : [];

  const images = uniqueStrings(
    toStringList(node.image).map((entry) => safeUrl(entry, baseUrl)).filter((entry): entry is string => Boolean(entry))
  );
  const canonicalUrl = firstNonEmpty(
    safeUrl(String(node.url ?? ''), baseUrl) ?? '',
    safeUrl(String(firstOffer.url ?? ''), baseUrl) ?? '',
    baseUrl
  );
  const fullDescription = stripHtml(String(node.description ?? ''));
  const category = firstNonEmpty(String(node.category ?? ''), String(node.productType ?? ''));

  return {
    sourceUrl: baseUrl,
    canonicalUrl,
    productName: normalizeWhitespace(String(node.name ?? '')),
    shortDescription: buildShortDescription(fullDescription),
    fullDescription,
    price: firstNonEmpty(toDecimalString(firstOffer.price), toDecimalString(node.price)),
    compareAtPrice: '',
    currency: firstNonEmpty(String(firstOffer.priceCurrency ?? ''), String(node.priceCurrency ?? '')).toUpperCase(),
    sku: normalizeWhitespace(String(node.sku ?? node.mpn ?? '')),
    brand: getBrandName(node.brand),
    category,
    tags: [],
    mainImageUrl: images[0] ?? '',
    additionalImageUrls: images.slice(1),
    availability: normalizeAvailability(firstOffer.availability ?? node.availability),
    variants: variantsFromGroup,
  };
}

function detectProvider(startUrl: string, html: string) {
  const lowerHtml = html.toLowerCase();
  const hostname = new URL(startUrl).hostname.toLowerCase();

  if (
    hostname.endsWith('.myshopify.com') ||
    lowerHtml.includes('cdn.shopify.com') ||
    lowerHtml.includes('shopify.theme') ||
    lowerHtml.includes('shopify-section')
  ) {
    return 'shopify' satisfies ScraperProvider;
  }

  if (
    lowerHtml.includes('woocommerce') ||
    lowerHtml.includes('/wp-content/plugins/woocommerce') ||
    lowerHtml.includes('wp-json/wc/')
  ) {
    return 'woocommerce' satisfies ScraperProvider;
  }

  if (lowerHtml.includes('squarespace') || lowerHtml.includes('sqs-commerce')) {
    return 'squarespace' satisfies ScraperProvider;
  }

  if (lowerHtml.includes('wixstores') || lowerHtml.includes('wix.com')) {
    return 'wix' satisfies ScraperProvider;
  }

  if (lowerHtml.includes('bigcommerce') || lowerHtml.includes('cdn11.bigcommerce.com')) {
    return 'bigcommerce' satisfies ScraperProvider;
  }

  if (lowerHtml.includes('webflow') || lowerHtml.includes('w-commerce')) {
    return 'webflow' satisfies ScraperProvider;
  }

  return 'generic' satisfies ScraperProvider;
}

function inferCurrencyHint(html: string) {
  const currencyMatch = html.match(/priceCurrency["']?\s*[:=]\s*["']([A-Z]{3})["']/i)
    || html.match(/Shopify\.currency[^A-Z]*["']([A-Z]{3})["']/i)
    || html.match(/["']currency["']\s*:\s*["']([A-Z]{3})["']/i);

  return currencyMatch?.[1]?.toUpperCase() ?? '';
}

function normalizeProduct(product: ScrapedProduct): ScrapedProduct {
  const fullDescription = firstNonEmpty(product.fullDescription, product.shortDescription);
  const shortDescription = firstNonEmpty(product.shortDescription, buildShortDescription(fullDescription));
  const tags = cleanTagList(product.tags);
  const additionalImages = uniqueStrings(product.additionalImageUrls).filter((url) => url !== product.mainImageUrl);
  const variants = product.variants
    .map((variant) => ({
      ...variant,
      id: normalizeWhitespace(variant.id) || `${slugify(product.productName || 'product')}-variant`,
      name: normalizeWhitespace(variant.name),
      sku: normalizeWhitespace(variant.sku),
      price: firstNonEmpty(toDecimalString(variant.price), product.price),
      compareAtPrice: firstNonEmpty(toDecimalString(variant.compareAtPrice), product.compareAtPrice),
      availability: normalizeAvailability(variant.availability || product.availability),
      options: uniqueOptionPairs(
        (variant.options || [])
          .map((option) => ({
            name: normalizeWhitespace(option.name),
            value: normalizeWhitespace(option.value),
          }))
          .filter((option) => option.name && option.value)
      ),
    }))
    .filter((variant) => variant.name || variant.sku || variant.options.length > 0);

  return {
    ...product,
    canonicalUrl: normalizeWhitespace(product.canonicalUrl) || normalizeWhitespace(product.sourceUrl),
    productName: normalizeWhitespace(product.productName),
    shortDescription,
    fullDescription: normalizeWhitespace(fullDescription),
    price: toDecimalString(product.price),
    compareAtPrice: toDecimalString(product.compareAtPrice),
    currency: normalizeWhitespace(product.currency).toUpperCase(),
    sku: normalizeWhitespace(product.sku),
    brand: normalizeWhitespace(product.brand),
    category: normalizeWhitespace(product.category),
    tags,
    mainImageUrl: normalizeWhitespace(product.mainImageUrl),
    additionalImageUrls: additionalImages,
    availability: normalizeAvailability(product.availability),
    variants,
  };
}

function dedupeProducts(products: ScrapedProduct[]) {
  const byKey = new Map<string, ScrapedProduct>();

  for (const product of products) {
    const normalized = normalizeProduct(product);
    if (!normalized.productName) continue;

    const key = normalized.canonicalUrl
      || (normalized.sku ? `sku:${normalized.sku.toLowerCase()}` : '')
      || `name:${normalized.productName.toLowerCase()}`;

    if (!key) continue;

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, normalized);
      continue;
    }

    byKey.set(key, {
      ...existing,
      shortDescription: existing.shortDescription || normalized.shortDescription,
      fullDescription: existing.fullDescription || normalized.fullDescription,
      price: existing.price || normalized.price,
      compareAtPrice: existing.compareAtPrice || normalized.compareAtPrice,
      currency: existing.currency || normalized.currency,
      sku: existing.sku || normalized.sku,
      brand: existing.brand || normalized.brand,
      category: existing.category || normalized.category,
      tags: cleanTagList([...existing.tags, ...normalized.tags]),
      mainImageUrl: existing.mainImageUrl || normalized.mainImageUrl,
      additionalImageUrls: uniqueStrings([...existing.additionalImageUrls, ...normalized.additionalImageUrls]),
      availability: existing.availability || normalized.availability,
      variants: existing.variants.length > 0 ? existing.variants : normalized.variants,
    });
  }

  return [...byKey.values()];
}

function buildRows(products: ScrapedProduct[]) {
  const rows: string[][] = [];

  for (const product of products) {
    const variantGroupId = slugify(`${product.productName}-${product.sku || product.canonicalUrl}`) || slugify(product.productName) || 'product';
    const baseFields = [
      product.productName,
      product.canonicalUrl || product.sourceUrl,
      product.shortDescription,
      product.fullDescription,
      product.price,
      product.compareAtPrice,
      product.currency,
      product.sku,
      product.brand,
      product.category,
      product.tags.join('|'),
      product.mainImageUrl,
      product.additionalImageUrls.join('|'),
      product.availability,
    ];

    if (product.variants.length === 0) {
      rows.push([...baseFields, variantGroupId, '', '', '', '', '', '', '']);
      continue;
    }

    for (const variant of product.variants) {
      const option1 = variant.options[0];
      const option2 = variant.options[1];
      const option3 = variant.options[2];

      rows.push([
        ...baseFields.slice(0, 4),
        variant.price || product.price,
        variant.compareAtPrice || product.compareAtPrice,
        ...baseFields.slice(6, 7),
        variant.sku || product.sku,
        ...baseFields.slice(8),
        variantGroupId,
        variant.name || buildVariantName(variant.options),
        option1?.name ?? '',
        option1?.value ?? '',
        option2?.name ?? '',
        option2?.value ?? '',
        option3?.name ?? '',
        option3?.value ?? '',
      ]);
    }
  }

  return rows;
}

function extractStructuredProductsFromHtml(pageUrl: string, html: string) {
  const $ = load(html);
  const jsonLdObjects = extractJsonLdObjects($);
  return jsonLdObjects
    .filter((entry) => isProductLikeJsonLd(entry))
    .map((entry) => parseJsonLdProductNode(entry as JsonRecord, pageUrl))
    .filter((entry): entry is ScrapedProduct => Boolean(entry?.productName));
}

function extractProductLinks(pageUrl: string, html: string) {
  const $ = load(html);
  const links: string[] = [];

  $('a[href]').each((_, element) => {
    const href = safeUrl($(element).attr('href') || '', pageUrl);
    if (!href || !sameOrigin(pageUrl, href)) return;

    const parentContext = `${$(element).attr('class') || ''} ${$(element).parent().attr('class') || ''}`.toLowerCase();
    if (looksLikeProductUrl(href) || parentContext.includes('product')) {
      links.push(href);
    }
  });

  return uniqueStrings(links).slice(0, MAX_PRODUCTS);
}

function extractPaginationLinks(pageUrl: string, html: string) {
  const $ = load(html);
  const origin = new URL(pageUrl).origin;
  const links: string[] = [];

  $('a[href]').each((_, element) => {
    const href = safeUrl($(element).attr('href') || '', pageUrl);
    if (!href) return;
    if (looksLikePaginationUrl(href, origin)) {
      links.push(href);
    }
  });

  return uniqueStrings(links).slice(0, MAX_PAGINATION_PAGES);
}

function extractFallbackProduct(pageUrl: string, html: string, currencyHint: string) {
  const $ = load(html);
  const fullDescription = firstNonEmpty(
    stripHtml($('.woocommerce-product-details__short-description').html()),
    stripHtml($('.product__description, .product-description, [itemprop="description"]').first().html()),
    stripHtml($('main article').first().html()),
    extractMetaContent($, ['meta[name="description"]', 'meta[property="og:description"]'])
  );

  const images = uniqueStrings([
    safeUrl(extractMetaContent($, ['meta[property="og:image"]']), pageUrl),
    ...$('img')
      .slice(0, 20)
      .map((_, element) => safeUrl($(element).attr('src') || $(element).attr('data-src') || '', pageUrl))
      .get(),
  ]);

  const price = firstNonEmpty(
    toDecimalString(extractMetaContent($, ['meta[property="product:price:amount"]', 'meta[itemprop="price"]'])),
    toDecimalString($('[itemprop="price"]').first().attr('content')),
    toDecimalString($('.price .amount, .price-item--regular, [data-product-price]').first().text())
  );

  const options: ScrapedProductOption[] = [];
  $('form select').each((_, element) => {
    const name = firstNonEmpty(
      $(element).attr('aria-label') || '',
      $(element).attr('name') || '',
      $(`label[for="${$(element).attr('id') || ''}"]`).text()
    ).replace(/\[\]$/, '');

    const values = $(element)
      .find('option')
      .map((__, option) => normalizeWhitespace($(option).text() || $(option).attr('value') || ''))
      .get()
      .filter((value) => value && !/choose|select/i.test(value));

    if (name && values.length === 1) {
      options.push({ name, value: values[0] });
    }
  });

  const title = firstNonEmpty(
    $('h1').first().text(),
    $('[itemprop="name"]').first().text(),
    extractMetaContent($, ['meta[property="og:title"]'])
  );

  if (!title || !price) return null;

  return normalizeProduct({
    sourceUrl: pageUrl,
    canonicalUrl: safeUrl($('link[rel="canonical"]').attr('href') || '', pageUrl) ?? pageUrl,
    productName: title,
    shortDescription: buildShortDescription(fullDescription),
    fullDescription,
    price,
    compareAtPrice: '',
    currency: firstNonEmpty(
      extractMetaContent($, ['meta[property="product:price:currency"]', 'meta[itemprop="priceCurrency"]']),
      currencyHint
    ),
    sku: firstNonEmpty($('[itemprop="sku"]').first().text(), $('.sku').first().text(), $('[data-product-sku]').attr('data-product-sku')),
    brand: firstNonEmpty(
      $('[itemprop="brand"]').first().text(),
      $('[data-brand]').attr('data-brand'),
      extractMetaContent($, ['meta[property="product:brand"]'])
    ),
    category: firstNonEmpty(
      $('.product_meta .posted_in a').first().text(),
      $('.breadcrumbs a').eq(-2).text()
    ),
    tags: cleanTagList($('.product_meta .tagged_as a').map((_, element) => $(element).text()).get()),
    mainImageUrl: images[0] ?? '',
    additionalImageUrls: images.slice(1),
    availability: normalizeAvailability(
      $('[itemprop="availability"]').attr('href')
      || $('[itemprop="availability"]').attr('content')
      || ($('button[name="add"]').first().text().toLowerCase().includes('sold out') ? 'out_of_stock' : '')
    ),
    variants: options.length > 0
      ? [
          {
            id: `${slugify(title)}-default`,
            name: buildVariantName(options),
            sku: '',
            price,
            compareAtPrice: '',
            availability: '',
            options,
          },
        ]
      : [],
  });
}

function mapShopifyProduct(product: JsonRecord, origin: string, currencyHint: string): ScrapedProduct | null {
  const title = normalizeWhitespace(String(product.title ?? ''));
  if (!title) return null;

  const images = uniqueStrings([
    ...toStringList(product.image).map((entry) => safeUrl(entry, origin)),
    ...toStringList(product.images).map((entry) => safeUrl(entry, origin)),
  ]);
  const variantsRaw = Array.isArray(product.variants) ? product.variants : [];
  const optionNames = Array.isArray(product.options)
    ? product.options
        .map((entry) => asRecord(entry))
        .filter((entry): entry is JsonRecord => Boolean(entry))
        .map((entry) => normalizeWhitespace(String(entry.name ?? '')))
    : [];

  const variants = variantsRaw
    .map((entry) => asRecord(entry))
    .filter((entry): entry is JsonRecord => Boolean(entry))
    .map((variant) => {
      const options: ScrapedProductOption[] = [];
      for (let index = 0; index < 3; index += 1) {
        const optionValue = normalizeWhitespace(String(variant[`option${index + 1}`] ?? ''));
        const optionName = optionNames[index] ?? `Option ${index + 1}`;
        if (optionValue && optionValue.toLowerCase() !== 'default title') {
          options.push({ name: optionName, value: optionValue });
        }
      }

      return {
        id: normalizeWhitespace(String(variant.id ?? '')) || `${slugify(title)}-${buildVariantName(options) || 'variant'}`,
        name: firstNonEmpty(
          normalizeWhitespace(String(variant.title ?? '')),
          buildVariantName(options)
        ).replace(/^default title$/i, ''),
        sku: normalizeWhitespace(String(variant.sku ?? '')),
        price: toDecimalString(variant.price),
        compareAtPrice: toDecimalString(variant.compare_at_price),
        availability: normalizeAvailability(Boolean(variant.available) ? 'in_stock' : 'out_of_stock'),
        options,
      } satisfies ScrapedProductVariant;
    })
    .filter((variant) => variant.price || variant.sku || variant.options.length > 0);

  const fullDescription = stripHtml(String(product.body_html ?? ''));
  const firstVariant = variants[0];

  return normalizeProduct({
    sourceUrl: origin,
    canonicalUrl: safeUrl(`/products/${String(product.handle ?? '')}`, origin) ?? origin,
    productName: title,
    shortDescription: buildShortDescription(fullDescription),
    fullDescription,
    price: firstVariant?.price || '',
    compareAtPrice: firstVariant?.compareAtPrice || '',
    currency: currencyHint,
    sku: firstVariant?.sku || '',
    brand: normalizeWhitespace(String(product.vendor ?? '')),
    category: normalizeWhitespace(String(product.product_type ?? '')),
    tags: cleanTagList([String(product.tags ?? '')]),
    mainImageUrl: images[0] ?? '',
    additionalImageUrls: images.slice(1),
    availability: variants.some((variant) => variant.availability === 'in_stock') ? 'in_stock' : '',
    variants,
  });
}

async function scrapeShopifyProducts(startUrl: URL, currencyHint: string): Promise<ProductScrapeOutcome> {
  const warnings: string[] = [];
  const endpoints = uniqueStrings([
    startUrl.pathname.includes('/collections/') ? safeUrl(`${startUrl.pathname.replace(/\/$/, '')}/products.json`, startUrl.origin) : null,
    safeUrl('/products.json', startUrl.origin),
  ]);

  for (const endpoint of endpoints) {
    try {
      const items: JsonRecord[] = [];

      for (let page = 1; page <= 6; page += 1) {
        const pagedUrl = new URL(endpoint);
        pagedUrl.searchParams.set('limit', '250');
        pagedUrl.searchParams.set('page', String(page));

        const json = await fetchJson<{ products?: unknown[] }>(pagedUrl.toString());
        const products = Array.isArray(json.products) ? json.products : [];
        if (products.length === 0) break;

        for (const product of products) {
          const record = asRecord(product);
          if (record) items.push(record);
        }

        if (products.length < 250 || items.length >= MAX_PRODUCTS) break;
      }

      const mapped = dedupeProducts(items.map((product) => mapShopifyProduct(product, startUrl.origin, currencyHint)).filter((product): product is ScrapedProduct => Boolean(product))).slice(0, MAX_PRODUCTS);
      if (mapped.length > 0) {
        return {
          provider: 'shopify',
          strategy: `Shopify product JSON endpoint (${new URL(endpoint).pathname})`,
          products: mapped,
          discoveredPages: mapped.length,
          failedPages: 0,
          capped: items.length >= MAX_PRODUCTS,
          warnings,
        };
      }
    } catch (error) {
      warnings.push(`Shopify endpoint fallback failed for ${endpoint}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return {
    provider: 'shopify',
    strategy: 'Shopify detection fallback',
    products: [],
    discoveredPages: 0,
    failedPages: 0,
    capped: false,
    warnings,
  };
}

function mapWooProduct(product: JsonRecord): ScrapedProduct | null {
  const title = normalizeWhitespace(String(product.name ?? ''));
  if (!title) return null;

  const prices = asRecord(product.prices) ?? {};
  const minorUnit = Number(prices.currency_minor_unit ?? 2);
  const images = uniqueStrings(
    (Array.isArray(product.images) ? product.images : [])
      .map((entry) => asRecord(entry))
      .filter((entry): entry is JsonRecord => Boolean(entry))
      .map((entry) => safeUrl(String(entry.src ?? entry.thumbnail ?? ''), String(product.permalink ?? '')))
  );

  return normalizeProduct({
    sourceUrl: String(product.permalink ?? ''),
    canonicalUrl: String(product.permalink ?? ''),
    productName: title,
    shortDescription: stripHtml(String(product.short_description ?? '')),
    fullDescription: stripHtml(String(product.description ?? '')),
    price: firstNonEmpty(
      minorUnitsToDecimal(prices.price, minorUnit),
      minorUnitsToDecimal(prices.sale_price, minorUnit)
    ),
    compareAtPrice: minorUnitsToDecimal(prices.regular_price, minorUnit),
    currency: normalizeWhitespace(String(prices.currency_code ?? '')).toUpperCase(),
    sku: normalizeWhitespace(String(product.sku ?? '')),
    brand: '',
    category: normalizeWhitespace(
      String(
        Array.isArray(product.categories) && product.categories[0] && asRecord(product.categories[0])?.name
          ? asRecord(product.categories[0])?.name
          : ''
      )
    ),
    tags: cleanTagList(
      Array.isArray(product.tags)
        ? product.tags.map((entry) => String(asRecord(entry)?.name ?? ''))
        : []
    ),
    mainImageUrl: images[0] ?? '',
    additionalImageUrls: images.slice(1),
    availability: normalizeAvailability(product.stock_status ?? product.is_in_stock),
    variants: [],
  });
}

async function scrapeWooProducts(startUrl: URL): Promise<ProductScrapeOutcome> {
  const warnings: string[] = [];
  const items: JsonRecord[] = [];

  for (let page = 1; page <= 6; page += 1) {
    try {
      const endpoint = new URL('/wp-json/wc/store/v1/products', startUrl.origin);
      endpoint.searchParams.set('page', String(page));
      endpoint.searchParams.set('per_page', '100');

      const json = await fetchJson<unknown[]>(endpoint.toString());
      if (!Array.isArray(json) || json.length === 0) break;

      for (const product of json) {
        const record = asRecord(product);
        if (record) items.push(record);
      }

      if (json.length < 100 || items.length >= MAX_PRODUCTS) break;
    } catch (error) {
      warnings.push(`WooCommerce Store API page ${page} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      break;
    }
  }

  return {
    provider: 'woocommerce',
    strategy: items.length > 0 ? 'WooCommerce Store API' : 'WooCommerce detection fallback',
    products: dedupeProducts(items.map((product) => mapWooProduct(product)).filter((product): product is ScrapedProduct => Boolean(product))).slice(0, MAX_PRODUCTS),
    discoveredPages: items.length,
    failedPages: warnings.length,
    capped: items.length >= MAX_PRODUCTS,
    warnings,
  };
}

async function extractSitemapProductLinks(origin: string) {
  try {
    const response = await fetch(`${origin.replace(/\/$/, '')}/sitemap.xml`, {
      headers: { Accept: 'application/xml,text/xml;q=0.9,*/*;q=0.8' },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return [] as string[];
    const xml = await response.text();
    const matches = [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)];
    const links = matches
      .map((match) => safeUrl(match[1], origin))
      .filter((link): link is string => Boolean(link))
      .filter((link) => sameOrigin(origin, link) && looksLikeProductUrl(link));

    return uniqueStrings(links).slice(0, MAX_SITEMAP_LINKS);
  } catch {
    return [] as string[];
  }
}

async function scrapeGenericProducts(startUrl: URL, startHtml: string, provider: ScraperProvider, currencyHint: string): Promise<ProductScrapeOutcome> {
  const warnings: string[] = [];
  const pageLevelProducts = extractStructuredProductsFromHtml(startUrl.toString(), startHtml);
  const paginationLinks = extractPaginationLinks(startUrl.toString(), startHtml);
  const candidateLinks = new Set<string>(extractProductLinks(startUrl.toString(), startHtml));
  let failedPages = 0;
  let capped = false;

  for (const paginationLink of paginationLinks) {
    try {
      const page = await fetchHtml(paginationLink);
      for (const product of extractStructuredProductsFromHtml(page.url, page.html)) {
        pageLevelProducts.push(product);
      }
      for (const link of extractProductLinks(page.url, page.html)) {
        candidateLinks.add(link);
      }
    } catch (error) {
      failedPages += 1;
      warnings.push(`Pagination fetch failed for ${paginationLink}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  if (candidateLinks.size < 3) {
    for (const link of await extractSitemapProductLinks(startUrl.origin)) {
      candidateLinks.add(link);
      if (candidateLinks.size >= MAX_PRODUCTS) {
        capped = true;
        break;
      }
    }
  }

  if (candidateLinks.size > MAX_PRODUCTS) {
    capped = true;
  }

  const discoveredUrls = [...candidateLinks].filter((link) => link !== startUrl.toString()).slice(0, MAX_PRODUCTS);

  const fetchedPages = await mapWithConcurrency(discoveredUrls, 4, async (productUrl) => {
    try {
      const page = await fetchHtml(productUrl);
      const structured = extractStructuredProductsFromHtml(page.url, page.html);
      if (structured.length > 0) return structured[0];

      return extractFallbackProduct(page.url, page.html, currencyHint);
    } catch (error) {
      failedPages += 1;
      warnings.push(`Product fetch failed for ${productUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  });

  const products = dedupeProducts([...pageLevelProducts, ...fetchedPages.filter((entry): entry is ScrapedProduct => Boolean(entry))]).slice(0, MAX_PRODUCTS);

  return {
    provider,
    strategy: provider === 'generic' ? 'Structured data + crawler fallback' : `${PROVIDER_LABELS[provider]} heuristic fallback`,
    products,
    discoveredPages: discoveredUrls.length + pageLevelProducts.length,
    failedPages,
    capped,
    warnings,
  };
}

async function normalizeProductsWithAi(products: ScrapedProduct[]) {
  const apiKey = process.env.AI_BUILDER_API_KEY;
  if (!apiKey || products.length === 0) {
    return { products, warnings: [] as string[] };
  }

  const warnings: string[] = [];
  const normalizedProducts: ScrapedProduct[] = [];
  const chunkSize = 12;

  for (let index = 0; index < products.length; index += chunkSize) {
    const chunk = products.slice(index, index + chunkSize);
    const prompt = `You are normalizing scraped ecommerce product records for CSV export.

Rules:
- Return ONLY a JSON array with the same number of entries as the input.
- Do not invent or change prices, URLs, SKUs, image URLs, brand names, or variant option values.
- You may only clean formatting, shorten "shortDescription", clean "fullDescription", standardize "category", normalize "tags" into simple strings, and standardize "availability" to "in_stock", "out_of_stock", "preorder", or "".
- If a field is unavailable, return an empty string or empty array instead of guessing.

Input:
${JSON.stringify(chunk, null, 2)}

Return objects with exactly these keys:
shortDescription, fullDescription, category, tags, availability`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: process.env.AI_BUILDER_MODEL || 'claude-haiku-4-5-20251001',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        warnings.push(`AI normalization skipped for chunk ${index / chunkSize + 1}.`);
        normalizedProducts.push(...chunk);
        continue;
      }

      const data = await response.json();
      const text = String(data.content?.[0]?.text || '');
      const match = text.match(/\[[\s\S]*\]/);
      const parsed = match ? JSON.parse(match[0]) : null;

      if (!Array.isArray(parsed) || parsed.length !== chunk.length) {
        warnings.push(`AI normalization returned an unexpected shape for chunk ${index / chunkSize + 1}.`);
        normalizedProducts.push(...chunk);
        continue;
      }

      for (let chunkIndex = 0; chunkIndex < chunk.length; chunkIndex += 1) {
        const original = chunk[chunkIndex];
        const aiEntry = asRecord(parsed[chunkIndex]) ?? {};
        normalizedProducts.push({
          ...original,
          shortDescription: firstNonEmpty(
            truncate(normalizeWhitespace(String(aiEntry.shortDescription ?? '')), 220),
            original.shortDescription,
            buildShortDescription(original.fullDescription)
          ),
          fullDescription: firstNonEmpty(
            normalizeWhitespace(String(aiEntry.fullDescription ?? '')),
            original.fullDescription
          ),
          category: firstNonEmpty(normalizeWhitespace(String(aiEntry.category ?? '')), original.category),
          tags: Array.isArray(aiEntry.tags) ? cleanTagList(aiEntry.tags.map((tag) => String(tag))) : original.tags,
          availability: firstNonEmpty(normalizeAvailability(aiEntry.availability), original.availability),
        });
      }
    } catch {
      warnings.push(`AI normalization failed for chunk ${index / chunkSize + 1}.`);
      normalizedProducts.push(...chunk);
    }
  }

  return { products: normalizedProducts, warnings };
}

export async function runProductScraper(inputUrl: string): Promise<ScraperResult> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(inputUrl);
  } catch {
    throw new Error('Invalid URL.');
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Invalid URL.');
  }

  const startPage = await fetchHtml(parsedUrl.toString());
  const detectedProvider = detectProvider(startPage.url, startPage.html);
  const currencyHint = inferCurrencyHint(startPage.html);

  let outcome: ProductScrapeOutcome;
  if (detectedProvider === 'shopify') {
    outcome = await scrapeShopifyProducts(new URL(startPage.url), currencyHint);
  } else if (detectedProvider === 'woocommerce') {
    outcome = await scrapeWooProducts(new URL(startPage.url));
  } else {
    outcome = {
      provider: detectedProvider,
      strategy: `${PROVIDER_LABELS[detectedProvider]} heuristic fallback`,
      products: [],
      discoveredPages: 0,
      failedPages: 0,
      capped: false,
      warnings: [],
    };
  }

  if (outcome.products.length === 0) {
    const fallbackOutcome = await scrapeGenericProducts(new URL(startPage.url), startPage.html, detectedProvider, currencyHint);
    outcome = {
      provider: outcome.provider,
      strategy: outcome.products.length > 0 ? outcome.strategy : fallbackOutcome.strategy,
      products: outcome.products.length > 0 ? outcome.products : fallbackOutcome.products,
      discoveredPages: Math.max(outcome.discoveredPages, fallbackOutcome.discoveredPages),
      failedPages: outcome.failedPages + fallbackOutcome.failedPages,
      capped: outcome.capped || fallbackOutcome.capped,
      warnings: [...outcome.warnings, ...fallbackOutcome.warnings],
    };
  }

  const dedupedProducts = dedupeProducts(outcome.products).slice(0, MAX_PRODUCTS);
  if (dedupedProducts.length === 0) {
    throw new Error('No product pages could be detected from this URL.');
  }

  const { products: normalizedProducts, warnings: aiWarnings } = await normalizeProductsWithAi(dedupedProducts);
  const rows = buildRows(normalizedProducts);
  const csv = buildCsv(PRODUCT_CSV_HEADERS, rows);
  const previewRows = [PRODUCT_CSV_HEADERS, ...rows.slice(0, 10)];
  const warnings = uniqueStrings([
    ...outcome.warnings,
    ...aiWarnings,
    outcome.failedPages > 0 ? `${outcome.failedPages} page fetch${outcome.failedPages === 1 ? '' : 'es'} failed during scraping.` : '',
    outcome.capped ? `Results were capped at ${MAX_PRODUCTS} products for this run.` : '',
  ]);

  console.log('[ops scraper] products raw extracted:', dedupedProducts.length);
  console.log('[ops scraper] products normalized:', normalizedProducts.length);
  console.log('[ops scraper] provider:', outcome.provider, 'strategy:', outcome.strategy);

  return {
    preset: 'products',
    provider: outcome.provider,
    providerLabel: PROVIDER_LABELS[outcome.provider],
    csv,
    filename: `keystone-products-${Date.now()}.csv`,
    rawJson: JSON.stringify(
      {
        sourceUrl: startPage.url,
        provider: outcome.provider,
        strategy: outcome.strategy,
        warnings,
        products: normalizedProducts,
      },
      null,
      2
    ),
    warnings,
    summary: {
      discoveredPages: outcome.discoveredPages,
      productsExtracted: normalizedProducts.length,
      csvRows: rows.length,
      failedPages: outcome.failedPages,
      skippedProducts: Math.max(0, outcome.discoveredPages - normalizedProducts.length),
    },
    previewRows,
    metadata: {
      sourceUrl: startPage.url,
      strategy: outcome.strategy,
    },
  };
}
