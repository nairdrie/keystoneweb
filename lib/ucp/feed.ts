/**
 * Builds the Google `native_commerce` product feed in both JSON (UCP-native)
 * and XML (Merchant Center feed style) forms. Only listings with the
 * `native_commerce` flag set to true are emitted — the docs are explicit
 * that only those can render the universal "Buy" button.
 *
 * Conversational AI attributes ride along under `<g:native_commerce_attribute>`
 * pairs so Gemini's compatibility/fit reasoning has structured data to read.
 */

import type { UcpProduct } from './types';

export function buildNativeCommerceJson(
  storeName: string,
  storeUrl: string,
  products: UcpProduct[],
) {
  return {
    feedVersion: 'native_commerce-0.1',
    store: { name: storeName, url: storeUrl },
    generatedAt: new Date().toISOString(),
    items: products
      .filter(p => p.nativeCommerce && p.availability !== 'unavailable')
      .map(p => ({
        id: p.id,
        sku: p.sku,
        gtin: p.gtin,
        mpn: p.mpn,
        title: p.title,
        description: p.description,
        link: p.url,
        imageLink: p.images[0] ?? null,
        additionalImageLinks: p.images.slice(1),
        availability: p.availability,
        price: priceString(p.price.amount, p.price.currency),
        salePrice: p.compareAtPrice ? priceString(p.price.amount, p.price.currency) : undefined,
        compareAtPrice: p.compareAtPrice ? priceString(p.compareAtPrice.amount, p.compareAtPrice.currency) : undefined,
        brand: p.brand,
        condition: p.condition,
        productCategory: p.category,
        productType: p.subcategory,
        nativeCommerce: true,
        nativeCommerceAttributes: p.aiAttributes,
        shippingWeight: p.shippingDimensions?.weightGrams
          ? `${p.shippingDimensions.weightGrams} g`
          : undefined,
      })),
  };
}

export function buildNativeCommerceXml(
  storeName: string,
  storeUrl: string,
  products: UcpProduct[],
): string {
  const escape = (s: string | null | undefined): string => {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">');
  lines.push('  <channel>');
  lines.push(`    <title>${escape(storeName)}</title>`);
  lines.push(`    <link>${escape(storeUrl)}</link>`);
  lines.push(`    <description>${escape(storeName)} — native_commerce product feed</description>`);

  for (const p of products) {
    if (!p.nativeCommerce || p.availability === 'unavailable') continue;
    lines.push('    <item>');
    lines.push(`      <g:id>${escape(p.id)}</g:id>`);
    lines.push(`      <g:title>${escape(p.title)}</g:title>`);
    if (p.description) lines.push(`      <g:description>${escape(p.description.slice(0, 5000))}</g:description>`);
    lines.push(`      <g:link>${escape(p.url)}</g:link>`);
    if (p.images[0]) lines.push(`      <g:image_link>${escape(p.images[0])}</g:image_link>`);
    for (const img of p.images.slice(1, 10)) {
      lines.push(`      <g:additional_image_link>${escape(img)}</g:additional_image_link>`);
    }
    lines.push(`      <g:availability>${escape(p.availability)}</g:availability>`);
    lines.push(`      <g:price>${escape(priceString(p.price.amount, p.price.currency))}</g:price>`);
    if (p.compareAtPrice) lines.push(`      <g:compare_at_price>${escape(priceString(p.compareAtPrice.amount, p.compareAtPrice.currency))}</g:compare_at_price>`);
    if (p.brand) lines.push(`      <g:brand>${escape(p.brand)}</g:brand>`);
    if (p.gtin) lines.push(`      <g:gtin>${escape(p.gtin)}</g:gtin>`);
    if (p.mpn) lines.push(`      <g:mpn>${escape(p.mpn)}</g:mpn>`);
    lines.push(`      <g:condition>${escape(p.condition)}</g:condition>`);
    if (p.category) lines.push(`      <g:product_type>${escape(p.category)}${p.subcategory ? ' > ' + escape(p.subcategory) : ''}</g:product_type>`);

    // The bit Google reads to decide AI Mode "Buy" eligibility:
    lines.push(`      <g:native_commerce>yes</g:native_commerce>`);
    for (const [k, v] of Object.entries(p.aiAttributes)) {
      lines.push(`      <g:native_commerce_attribute name="${escape(k)}">${escape(String(v))}</g:native_commerce_attribute>`);
    }

    if (p.shippingDimensions?.weightGrams) {
      lines.push(`      <g:shipping_weight>${p.shippingDimensions.weightGrams} g</g:shipping_weight>`);
    }
    lines.push('    </item>');
  }

  lines.push('  </channel>');
  lines.push('</rss>');
  return lines.join('\n');
}

function priceString(amountCents: number, currency: string): string {
  return `${(amountCents / 100).toFixed(2)} ${currency}`;
}
