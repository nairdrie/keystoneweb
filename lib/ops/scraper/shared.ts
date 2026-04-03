import { load } from 'cheerio';
import type { CheerioAPI } from 'cheerio';

export const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const DEFAULT_TIMEOUT_MS = 15000;

export interface FetchHtmlResult {
  url: string;
  html: string;
  $: CheerioAPI;
}

export function safeUrl(value: string, base?: string): string | null {
  try {
    return new URL(value, base).toString();
  } catch {
    return null;
  }
}

export function uniqueStrings(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

export function normalizeWhitespace(value: string | null | undefined) {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

export function stripHtml(html: string | null | undefined) {
  if (!html) return '';
  const $ = load(html);
  return normalizeWhitespace($.root().text());
}

export function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

export function buildShortDescription(fullDescription: string) {
  const cleaned = normalizeWhitespace(fullDescription);
  if (!cleaned) return '';

  const sentenceMatch = cleaned.match(/^(.{20,220}?[.!?])(?:\s|$)/);
  if (sentenceMatch?.[1]) {
    return sentenceMatch[1].trim();
  }

  return truncate(cleaned, 180);
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function toDecimalString(value: unknown, minorUnit = 2): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toFixed(minorUnit);
  }

  const text = String(value).trim();
  if (!text) return '';

  const cleaned = text.replace(/[^0-9.,-]/g, '');
  if (!cleaned) return '';

  const commaCount = (cleaned.match(/,/g) || []).length;
  const dotCount = (cleaned.match(/\./g) || []).length;

  let normalized = cleaned;
  if (commaCount > 0 && dotCount === 0) {
    normalized = cleaned.replace(',', '.');
  } else {
    normalized = cleaned.replace(/,/g, '');
  }

  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return '';
  return parsed.toFixed(minorUnit);
}

export function minorUnitsToDecimal(value: unknown, minorUnit = 2): string {
  if (value === null || value === undefined || value === '') return '';
  const parsed = Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) return '';
  return (parsed / Math.pow(10, minorUnit)).toFixed(minorUnit);
}

export function normalizeAvailability(value: unknown) {
  const text = String(value ?? '').toLowerCase();

  if (!text) return '';
  if (text.includes('instock') || text.includes('in stock') || text === 'true' || text === '1') return 'in_stock';
  if (text.includes('preorder') || text.includes('pre-order')) return 'preorder';
  if (text.includes('outofstock') || text.includes('out of stock') || text.includes('sold out') || text === 'false' || text === '0') {
    return 'out_of_stock';
  }

  return normalizeWhitespace(text.replace(/https?:\/\/schema\.org\//g, '').replace(/_/g, ' ')).replace(/\s+/g, '_');
}

export function escapeCsvValue(value: string) {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildCsv(headers: string[], rows: string[][]) {
  return [headers.join(','), ...rows.map((row) => row.map((value) => escapeCsvValue(value ?? '')).join(','))].join('\n');
}

export function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

export async function fetchHtml(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<FetchHtmlResult> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': BROWSER_UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'identity',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await response.text();
  return { url: response.url || url, html, $: load(html) };
}

export async function fetchJson<T>(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': BROWSER_UA,
      Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'identity',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

function flattenJsonLdValue(value: unknown, result: unknown[]) {
  if (!value) return;

  if (Array.isArray(value)) {
    for (const entry of value) flattenJsonLdValue(entry, result);
    return;
  }

  if (typeof value !== 'object') return;

  const record = value as Record<string, unknown>;
  if (Array.isArray(record['@graph'])) {
    flattenJsonLdValue(record['@graph'], result);
  }

  result.push(record);
}

export function extractJsonLdObjects($: CheerioAPI) {
  const result: unknown[] = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).html();
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      flattenJsonLdValue(parsed, result);
    } catch {
      // Ignore invalid JSON-LD blocks and continue.
    }
  });

  return result;
}

export function getTypeList(value: unknown) {
  if (!value || typeof value !== 'object') return [];

  const typeValue = (value as Record<string, unknown>)['@type'];
  if (Array.isArray(typeValue)) {
    return typeValue.map((entry) => String(entry));
  }

  if (typeof typeValue === 'string') {
    return [typeValue];
  }

  return [];
}

export function isProductLikeJsonLd(value: unknown) {
  const types = getTypeList(value).map((entry) => entry.toLowerCase());
  return types.includes('product') || types.includes('productgroup');
}

export function extractMetaContent($: CheerioAPI, selectors: string[]) {
  for (const selector of selectors) {
    const content = normalizeWhitespace($(selector).attr('content') || $(selector).attr('value') || $(selector).text());
    if (content) return content;
  }

  return '';
}

export function sameOrigin(urlA: string, urlB: string) {
  try {
    return new URL(urlA).origin === new URL(urlB).origin;
  } catch {
    return false;
  }
}

export function looksLikeProductUrl(url: string) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();

    if (/(\/products?\/[^/]+)|(\/item\/[^/]+)|(\/shop\/[^/]+)|(\/store\/[^/]+)/.test(path)) return true;
    if (/\/collections\//.test(path) || /\/category\//.test(path) || /\/cart/.test(path) || /\/checkout/.test(path)) return false;

    const segments = path.split('/').filter(Boolean);
    return segments.length >= 2 && segments.some((segment) => ['product', 'products', 'item', 'shop', 'store'].includes(segment));
  } catch {
    return false;
  }
}

export function looksLikePaginationUrl(url: string, baseOrigin: string) {
  try {
    const parsed = new URL(url);
    if (parsed.origin !== baseOrigin) return false;
    return parsed.searchParams.has('page') || /\/page\/\d+/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

export function firstNonEmpty(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = normalizeWhitespace(value);
    if (normalized) return normalized;
  }

  return '';
}

export function cleanTagList(values: Array<string | null | undefined>) {
  return uniqueStrings(
    values.flatMap((value) =>
      String(value ?? '')
        .split(/[|,>]/)
        .map((entry) => normalizeWhitespace(entry))
        .filter(Boolean)
    )
  );
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
) {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, () => worker()));
  return results;
}
