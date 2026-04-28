// Lightweight CMS / site-builder fingerprinter.
// Fetches the URL, inspects HTTP headers + the HTML <head> for known signals.
// Uses cheerio (already a dep) — avoids paid services like Wappalyzer.

import * as cheerio from 'cheerio';

export type Cms =
  | 'wix'
  | 'squarespace'
  | 'weebly'
  | 'godaddy'
  | 'wordpress'
  | 'shopify'
  | 'webflow'
  | 'joomla'
  | 'drupal'
  | 'duda'
  | 'unknown';

export interface CmsResult {
  cms: Cms;
  confidence: 'high' | 'medium' | 'low';
  signals: string[];      // human-readable list of what tipped us off
  finalUrl: string;       // post-redirect URL
}

export class CmsSniffError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CmsSniffError';
  }
}

export async function sniffCms(url: string, timeoutMs = 12_000): Promise<CmsResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        // A real-looking UA cuts down on 403s from sites that block obvious bots.
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
  } catch (err) {
    throw new CmsSniffError(err instanceof Error ? err.message : String(err));
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new CmsSniffError(`HTTP ${response.status}`);
  }

  const finalUrl = response.url;
  const headers = response.headers;
  const html = await response.text();
  const $ = cheerio.load(html);

  const signals: string[] = [];
  const candidates: Array<{ cms: Cms; confidence: CmsResult['confidence']; reason: string }> = [];

  // --- Header signals (high confidence) ---
  const xPoweredBy = headers.get('x-powered-by') ?? '';
  const server = headers.get('server') ?? '';
  const xPlatform = headers.get('x-shopify-stage') || headers.get('x-shopid') || '';
  const xWix = headers.get('x-wix-request-id') || headers.get('x-seen-by') || '';

  if (xPlatform || /shopify/i.test(headers.get('x-served-by') ?? '')) {
    candidates.push({ cms: 'shopify', confidence: 'high', reason: 'Shopify response header' });
  }
  if (xWix) {
    candidates.push({ cms: 'wix', confidence: 'high', reason: 'Wix response header' });
  }
  if (/joomla/i.test(xPoweredBy) || /joomla/i.test(server)) {
    candidates.push({ cms: 'joomla', confidence: 'high', reason: 'Joomla in server header' });
  }
  if (/drupal/i.test(headers.get('x-generator') ?? '') || /drupal/i.test(xPoweredBy)) {
    candidates.push({ cms: 'drupal', confidence: 'high', reason: 'Drupal in server header' });
  }

  // --- <meta name="generator"> (high confidence) ---
  const generator = ($('meta[name="generator"]').attr('content') ?? '').toLowerCase();
  if (generator) {
    signals.push(`generator: "${generator}"`);
    if (generator.includes('wix')) candidates.push({ cms: 'wix', confidence: 'high', reason: 'meta generator' });
    if (generator.includes('squarespace')) candidates.push({ cms: 'squarespace', confidence: 'high', reason: 'meta generator' });
    if (generator.includes('weebly')) candidates.push({ cms: 'weebly', confidence: 'high', reason: 'meta generator' });
    if (generator.includes('godaddy')) candidates.push({ cms: 'godaddy', confidence: 'high', reason: 'meta generator' });
    if (generator.includes('wordpress')) candidates.push({ cms: 'wordpress', confidence: 'high', reason: 'meta generator' });
    if (generator.includes('webflow')) candidates.push({ cms: 'webflow', confidence: 'high', reason: 'meta generator' });
    if (generator.includes('joomla')) candidates.push({ cms: 'joomla', confidence: 'high', reason: 'meta generator' });
    if (generator.includes('drupal')) candidates.push({ cms: 'drupal', confidence: 'high', reason: 'meta generator' });
    if (generator.includes('duda')) candidates.push({ cms: 'duda', confidence: 'high', reason: 'meta generator' });
  }

  // --- Asset / link / inline-script heuristics (medium confidence) ---
  const headHtml = $('head').html() ?? '';
  const bodyHtml = html.slice(0, 80_000); // bound the search

  const hostHits: Array<[Cms, RegExp, string]> = [
    ['wix', /static\.wixstatic\.com|wix\.com\/_partials/i, 'wixstatic.com asset'],
    ['squarespace', /static\d?\.squarespace\.com|squarespace-cdn\.com/i, 'squarespace asset'],
    ['shopify', /cdn\.shopify\.com|shopify\.com\/s\/files/i, 'shopify CDN asset'],
    ['wordpress', /\/wp-content\/|\/wp-includes\//i, 'wp-content/wp-includes path'],
    ['webflow', /webflow\.com|assets\.website-files\.com/i, 'webflow asset'],
    ['weebly', /editmysite\.com|weebly\.com\/editor/i, 'weebly asset'],
    ['godaddy', /img1\.wsimg\.com|websitebuilder\.online\.godaddy/i, 'godaddy websitebuilder asset'],
    ['duda', /lirp\.cdn-website\.com|du1\.dudaone\.com/i, 'duda asset'],
    ['joomla', /\/components\/com_|\/templates\/system\//i, 'joomla path'],
    ['drupal', /\/sites\/default\/files\/|drupal-settings/i, 'drupal path/setting'],
  ];

  for (const [cms, re, label] of hostHits) {
    if (re.test(headHtml) || re.test(bodyHtml)) {
      candidates.push({ cms, confidence: 'medium', reason: label });
    }
  }

  // --- Inline JS globals (low/medium confidence) ---
  if (/window\.Squarespace/i.test(bodyHtml)) {
    candidates.push({ cms: 'squarespace', confidence: 'medium', reason: 'window.Squarespace global' });
  }
  if (/Shopify\.shop|ShopifyAnalytics/i.test(bodyHtml)) {
    candidates.push({ cms: 'shopify', confidence: 'medium', reason: 'Shopify JS global' });
  }
  if (/\bwixBiSession\b|\bwixPerformanceMeasurements\b/i.test(bodyHtml)) {
    candidates.push({ cms: 'wix', confidence: 'medium', reason: 'Wix JS global' });
  }

  // Pick the highest-confidence candidate, breaking ties by frequency.
  if (candidates.length === 0) {
    return { cms: 'unknown', confidence: 'low', signals, finalUrl };
  }

  const counts = new Map<Cms, { high: number; medium: number; low: number; reasons: string[] }>();
  for (const c of candidates) {
    const bucket = counts.get(c.cms) ?? { high: 0, medium: 0, low: 0, reasons: [] };
    bucket[c.confidence] += 1;
    bucket.reasons.push(c.reason);
    counts.set(c.cms, bucket);
  }

  // Rank: any high beats any medium; among same tier, more votes win.
  const ranked = [...counts.entries()].sort((a, b) => {
    if (a[1].high !== b[1].high) return b[1].high - a[1].high;
    if (a[1].medium !== b[1].medium) return b[1].medium - a[1].medium;
    return b[1].low - a[1].low;
  });

  const [winner, info] = ranked[0];
  const confidence: CmsResult['confidence'] =
    info.high > 0 ? 'high' : info.medium > 0 ? 'medium' : 'low';

  return {
    cms: winner,
    confidence,
    signals: [...signals, ...info.reasons],
    finalUrl,
  };
}
