import { load } from 'cheerio';
import { BLOCK_SCHEMAS } from '@/lib/ai/builder-schema';
import { VALID_BUILDER_BLOCK_TYPES, isValidBuilderBlockType } from '@/lib/ai/builder-blocks';
import { BROWSER_UA, extractJsonLdObjects, extractMetaContent, firstNonEmpty, normalizeWhitespace, safeUrl, slugify, uniqueStrings } from './shared';
import { makeContentHash, readCache, writeCache } from './content-cache';
import { renderUrlInBrowser } from './browser';
import { isSupportedContentNormalizationModel } from './models';
import { buildZip } from './zip';
import type {
  BuilderCompatibilityStatus,
  ContentNormalizationModel,
  ContentBuilderImportPayload,
  ContentCompatibilityPageReport,
  ContentCompatibilityReport,
  ContentExportFileMeta,
  ContentPagePreview,
  ContentScraperPreview,
  ScraperMode,
  ScraperResult,
} from './types';

type BusinessType = 'services' | 'products' | 'both';

interface ContentScraperOptions {
  mode?: ScraperMode;
  includeBlog?: boolean;
  llmModel?: ContentNormalizationModel;
  aiOnly?: boolean;
}

interface ModeConfig {
  maxPages: number;
  maxDepth: number;
  concurrency: number;
  maxBrowserPages: number;
  allowLlm: boolean;
  allowFallbackLlm: boolean;
  maxLlmPages: number;
  tokenBudget: number;
}

interface RobotsRules {
  sitemaps: string[];
  disallowPrefixes: string[];
}

interface CrawlCandidate {
  url: string;
  depth: number;
  source: string;
  isBlog: boolean;
}

interface FetchPageResult {
  requestedUrl: string;
  url: string;
  html: string;
  contentType: string;
  $: ReturnType<typeof load>;
  contentHash: string;
  textLength: number;
  isLikelyJsRendered: boolean;
  renderMode: 'static' | 'browser';
  browserFallbackUsed: boolean;
  fromCache: boolean;
}

interface ActionLink {
  label: string;
  url: string;
  external: boolean;
}

interface MediaRef {
  url: string;
  alt: string;
}

interface StatItem {
  value: string;
  label: string;
}

interface FaqItem {
  question: string;
  answer: string;
}

interface TestimonialItem {
  name: string;
  role: string;
  quote: string;
  rating: number;
}

interface TeamMember {
  name: string;
  role: string;
  bio: string;
  image: string;
}

interface PricingTier {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  highlighted: boolean;
}

interface FormFieldShape {
  label: string;
  type: string;
  required: boolean;
}

interface FormShape {
  fields: FormFieldShape[];
}

interface SectionCandidate {
  id: string;
  heading: string;
  text: string;
  paragraphs: string[];
  bullets: string[];
  ctas: ActionLink[];
  links: ActionLink[];
  images: MediaRef[];
  videoUrls: string[];
  downloads: ActionLink[];
  stats: StatItem[];
  faqs: FaqItem[];
  testimonials: TestimonialItem[];
  team: TeamMember[];
  pricing: PricingTier[];
  logos: string[];
  forms: FormShape[];
  candidateBlockTypes: string[];
  repeated: boolean;
  warnings: string[];
}

interface ExtractedPage {
  sourceUrl: string;
  finalUrl: string;
  slug: string;
  title: string;
  displayName: string;
  titleTag: string;
  metaDescription: string;
  canonical: string;
  robots: string;
  h1: string;
  inferredType: string;
  breadcrumbs: string[];
  og: Record<string, string>;
  twitter: Record<string, string>;
  schema: unknown[];
  navLinks: ActionLink[];
  footerLinks: ActionLink[];
  pageLinks: ActionLink[];
  ctas: ActionLink[];
  images: MediaRef[];
  videoUrls: string[];
  downloads: ActionLink[];
  contact: {
    phone: string;
    email: string;
    address: string;
    hours: string;
  };
  socialLinks: Record<string, string>;
  sections: SectionCandidate[];
  contentHash: string;
  fromCache: boolean;
  jsWarning: boolean;
  renderMode: 'static' | 'browser';
}

interface BuilderBlockExport {
  id: string;
  type: string;
  data: Record<string, unknown>;
  compatibility: 'supported' | 'approximated';
  compatibilityNotes: string[];
  sourceSectionIds: string[];
}

interface MappedPageExport {
  title: string;
  url: string;
  slug: string;
  inferredType: string;
  confidence: number;
  compatibilityStatus: BuilderCompatibilityStatus;
  builderBlocks: BuilderBlockExport[];
  warnings: string[];
  compatibilityNotes: string[];
  supportedSections: number;
  approximatedSections: number;
  unsupportedSections: number;
  manualFollowUpRequired: boolean;
  pageRecord: Record<string, unknown>;
  mediaReferences: Array<{ type: string; url: string; alt?: string; sourceSectionId?: string }>;
}

interface NormalizationDecision {
  pageType?: string;
  blocks?: Array<{
    type: string;
    data?: Record<string, unknown>;
    sourceSectionIds?: string[];
    compatibility?: 'supported' | 'approximated';
    compatibilityNotes?: string[];
  }>;
  warnings?: string[];
  confidenceNote?: string;
}

interface BudgetState {
  estimatedTokensUsed: number;
  llmPagesUsed: number;
  llmFallbackPages: number;
  exhausted: boolean;
}

interface CacheState {
  pageHits: number;
  pageMisses: number;
  normalizationHits: number;
  jobHit: boolean;
}

interface BrowserRenderState {
  pagesRendered: number;
  unavailable: boolean;
}

interface NormalizationEligibility {
  allowed: boolean;
  reason: string;
}

interface ContentScraperLogger {
  traceId: string;
  verbose: boolean;
  info(event: string, details?: Record<string, unknown>): void;
  warn(event: string, details?: Record<string, unknown>): void;
  debug(event: string, details?: Record<string, unknown>): void;
}

interface ResolvedNormalizationConfig {
  provider: 'anthropic' | 'openai';
  lightModel: string;
  fallbackModel: string;
  modelSource: 'ui' | 'env' | 'default';
}

const SUPPORTED_BLOCK_TYPES = VALID_BUILDER_BLOCK_TYPES;
const CONTENT_MAPPING_VERSION = 'full-html-builder-blocks-v2';

function createContentScraperLogger(inputUrl: string, mode: ScraperMode, includeBlog: boolean): ContentScraperLogger {
  const traceId = `content-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const verbose = process.env.CONTENT_SCRAPER_VERBOSE === '1' || process.env.NODE_ENV !== 'production';

  function write(level: 'info' | 'warn' | 'debug', event: string, details?: Record<string, unknown>) {
    if (level === 'debug' && !verbose) return;
    const prefix = `[ops scraper][content][${traceId}] ${event}`;
    if (details && Object.keys(details).length > 0) {
      const payload = JSON.stringify(details);
      if (level === 'warn') console.warn(prefix, payload);
      else console.log(prefix, payload);
      return;
    }
    if (level === 'warn') console.warn(prefix);
    else console.log(prefix);
  }

  write('info', 'job.start', { inputUrl, mode, includeBlog });

  return {
    traceId,
    verbose,
    info: (event, details) => write('info', event, details),
    warn: (event, details) => write('warn', event, details),
    debug: (event, details) => write('debug', event, details),
  };
}

function resolveModeConfig(mode: ScraperMode, aiOnly: boolean) {
  const baseConfig = MODE_CONFIG[mode];
  if (!aiOnly) return baseConfig;

  return {
    ...baseConfig,
    allowLlm: true,
    allowFallbackLlm: mode === 'deep',
    maxLlmPages: Math.max(baseConfig.maxLlmPages, baseConfig.maxPages),
    tokenBudget: Math.max(baseConfig.tokenBudget, baseConfig.maxPages * (mode === 'fast' ? 2200 : mode === 'standard' ? 3200 : 4000)),
  } satisfies ModeConfig;
}

function resolveNormalizationConfig(requestedModel: ContentNormalizationModel | undefined, logger: ContentScraperLogger): ResolvedNormalizationConfig {
  const envProvider = process.env.AI_BUILDER_PROVIDER === 'openai' ? 'openai' : 'anthropic';

  if (requestedModel && requestedModel !== 'auto') {
    return {
      provider: 'anthropic',
      lightModel: requestedModel,
      fallbackModel: requestedModel,
      modelSource: 'ui',
    };
  }

  if (envProvider === 'openai') {
    return {
      provider: 'openai',
      lightModel: process.env.CONTENT_SCRAPER_LIGHT_MODEL || 'gpt-4o-mini',
      fallbackModel: process.env.AI_BUILDER_MODEL || 'gpt-4o',
      modelSource: process.env.CONTENT_SCRAPER_LIGHT_MODEL || process.env.AI_BUILDER_MODEL ? 'env' : 'default',
    };
  }

  const envLightModel = process.env.CONTENT_SCRAPER_LIGHT_MODEL;
  const envFallbackModel = process.env.AI_BUILDER_MODEL;

  if (envLightModel && !isSupportedContentNormalizationModel(envLightModel)) {
    logger.warn('job.model_config_invalid', {
      source: 'CONTENT_SCRAPER_LIGHT_MODEL',
      value: envLightModel,
      fallback: 'claude-haiku-4-5-20251001',
    });
  }

  if (envFallbackModel && !isSupportedContentNormalizationModel(envFallbackModel)) {
    logger.warn('job.model_config_invalid', {
      source: 'AI_BUILDER_MODEL',
      value: envFallbackModel,
      fallback: 'claude-sonnet-4-6',
    });
  }

  return {
    provider: 'anthropic',
    lightModel: envLightModel && isSupportedContentNormalizationModel(envLightModel) ? envLightModel : 'claude-haiku-4-5-20251001',
    fallbackModel: envFallbackModel && isSupportedContentNormalizationModel(envFallbackModel) ? envFallbackModel : 'claude-sonnet-4-6',
    modelSource: envLightModel || envFallbackModel ? 'env' : 'default',
  };
}

const MODE_CONFIG: Record<ScraperMode, ModeConfig> = {
  fast: {
    maxPages: 15,
    maxDepth: 1,
    concurrency: 3,
    maxBrowserPages: 2,
    allowLlm: false,
    allowFallbackLlm: false,
    maxLlmPages: 0,
    tokenBudget: 0,
  },
  standard: {
    maxPages: 25,
    maxDepth: 2,
    concurrency: 4,
    maxBrowserPages: 5,
    allowLlm: true,
    allowFallbackLlm: false,
    maxLlmPages: 6,
    tokenBudget: 7000,
  },
  deep: {
    maxPages: 50,
    maxDepth: 3,
    concurrency: 4,
    maxBrowserPages: 10,
    allowLlm: true,
    allowFallbackLlm: true,
    maxLlmPages: 12,
    tokenBudget: 16000,
  },
};

const LOW_VALUE_PATH_RE = /\/(?:wp-admin|admin|dashboard|account|accounts|cart|checkout|login|log-in|register|sign-in|signin|app)(?:\/|$)/i;
const SEARCH_PATH_RE = /\/search(?:\/|$)/i;
const FILTER_NOISE_RE = /\/(?:tag|tags|category|categories|archive|archives|author)(?:\/|$)/i;
const BLOG_LIKE_RE = /\/(?:blog|blogs|news|articles?|posts?)(?:\/|$)/i;
const LEGAL_LIKE_RE = /\/(?:privacy|terms|policy|policies|legal|accessibility)(?:\/|$)/i;
const ABOUT_LIKE_RE = /\/(?:about|company|story|our-story|our-company)(?:\/|$)/i;
const SERVICES_LIKE_RE = /\/(?:service|services|solutions|offerings)(?:\/|$)/i;
const CONTACT_LIKE_RE = /\/(?:contact|book|booking|appointments?|schedule)(?:\/|$)/i;
const TEAM_LIKE_RE = /\/(?:team|staff|people|leadership)(?:\/|$)/i;
const FAQ_LIKE_RE = /\/(?:faq|faqs|questions)(?:\/|$)/i;
const PRICING_LIKE_RE = /\/(?:pricing|prices|plans|packages)(?:\/|$)/i;
const LOCATION_LIKE_RE = /\/(?:locations?|areas-served|service-area)(?:\/|$)/i;
const CASE_STUDY_LIKE_RE = /\/(?:portfolio|case-studies|case-study|projects|work)(?:\/|$)/i;

function stripLeadingWww(hostname: string) {
  return hostname.replace(/^www\./i, '').toLowerCase();
}

function normalizeUrl(url: string, base?: string) {
  const resolved = safeUrl(url, base);
  if (!resolved) return null;

  const parsed = new URL(resolved);
  parsed.hash = '';

  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'msclkid'].forEach((key) => {
    parsed.searchParams.delete(key);
  });

  if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }

  parsed.searchParams.sort();
  return parsed.toString();
}

function isSameSite(url: string, originUrl: string) {
  try {
    const left = new URL(url);
    const right = new URL(originUrl);
    return stripLeadingWww(left.hostname) === stripLeadingWww(right.hostname);
  } catch {
    return false;
  }
}

function isBlogLikeUrl(url: string) {
  try {
    const parsed = new URL(url);
    return BLOG_LIKE_RE.test(parsed.pathname);
  } catch {
    return false;
  }
}

function isNoiseUrl(url: string) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();
    if (LOW_VALUE_PATH_RE.test(path) || SEARCH_PATH_RE.test(path) || FILTER_NOISE_RE.test(path)) return true;
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
    if (parsed.searchParams.has('s') || parsed.searchParams.has('search') || parsed.searchParams.has('q')) return true;
    return false;
  } catch {
    return true;
  }
}

function makeDisplayName(slug: string, title: string) {
  if (title) return title;
  if (!slug || slug === 'home') return 'Home';
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toRichTextHtml(heading: string, paragraphs: string[], bullets: string[]) {
  const pieces: string[] = [];
  if (heading) pieces.push(`<h2>${escapeHtml(heading)}</h2>`);
  for (const paragraph of paragraphs.slice(0, 4)) {
    if (!paragraph) continue;
    pieces.push(`<p>${escapeHtml(paragraph)}</p>`);
  }
  if (bullets.length > 0) {
    pieces.push(
      `<ul>${bullets
        .slice(0, 6)
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join('')}</ul>`
    );
  }
  return pieces.join('');
}

function dedupeByText<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const key = normalizeWhitespace(getKey(item)).toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

async function fetchTextResource(url: string, timeoutMs = 15000) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': BROWSER_UA,
      Accept: 'text/plain,text/xml,application/xml,text/html;q=0.8,*/*;q=0.5',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'identity',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return {
    url: response.url || url,
    text: await response.text(),
    contentType: response.headers.get('content-type') || '',
  };
}

function buildFetchPageResult(requestedUrl: string, resolvedUrl: string, contentType: string, html: string, renderMode: 'static' | 'browser', browserFallbackUsed: boolean, fromCache: boolean) {
  const $ = load(html);
  const bodyText = normalizeWhitespace(
    $('body')
      .clone()
      .find('script, style, noscript, template, svg')
      .remove()
      .end()
      .text()
  );
  const mainText = normalizeWhitespace(
    $('main, article, body')
      .first()
      .clone()
      .find('script, style, noscript, template')
      .remove()
      .end()
      .text()
  );

  const lowerHtml = html.toLowerCase();
  const looksLikeShell =
    /you need to enable javascript to run this app/i.test(html) ||
    /<div[^>]+id=["'](?:root|__next|app)["'][^>]*>\s*<\/div>/i.test(html) ||
    /<body>\s*<noscript/i.test(lowerHtml);

  return {
    requestedUrl,
    url: normalizeUrl(resolvedUrl || requestedUrl) ?? requestedUrl,
    html,
    contentType,
    $,
    contentHash: makeContentHash(mainText),
    textLength: bodyText.length,
    isLikelyJsRendered:
      bodyText.length < 300 &&
      (looksLikeShell || (($('script').length >= 8 && $('main, article').text().trim().length < 120) || /__next|webpack/i.test(lowerHtml))),
    renderMode,
    browserFallbackUsed,
    fromCache,
  } satisfies FetchPageResult;
}

async function fetchHtmlPage(url: string, cacheState: CacheState, modeConfig: ModeConfig, browserState: BrowserRenderState, logger: ContentScraperLogger) {
  const normalizedUrl = normalizeUrl(url) ?? url;
  const cached = await readCache<Omit<FetchPageResult, '$'>>('page-fetch-static', [normalizedUrl]);
  let result: FetchPageResult;
  if (cached) {
    cacheState.pageHits += 1;
    result = {
      ...cached,
      $: load(cached.html),
      fromCache: true,
    } satisfies FetchPageResult;
  } else {
    const response = await fetch(normalizedUrl, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!/html|xhtml/i.test(contentType)) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }

    const html = await response.text();
    result = buildFetchPageResult(normalizedUrl, response.url || normalizedUrl, contentType, html, 'static', false, false);

    cacheState.pageMisses += 1;
    await writeCache('page-fetch-static', [normalizedUrl], {
      ...result,
      $: undefined,
    });
  }

  if (!result.isLikelyJsRendered) {
    return result;
  }

  if (browserState.pagesRendered >= modeConfig.maxBrowserPages) {
    logger.warn('page.browser_skip', {
      url: normalizedUrl,
      reason: 'browser_page_budget_reached',
      maxBrowserPages: modeConfig.maxBrowserPages,
      pagesRendered: browserState.pagesRendered,
    });
    return result;
  }

  const browserCached = await readCache<Omit<FetchPageResult, '$'>>('page-fetch-browser', [normalizedUrl]);
  if (browserCached) {
    cacheState.pageHits += 1;
    browserState.pagesRendered += 1;
    logger.info('page.browser_cache_hit', { url: normalizedUrl, textLength: browserCached.textLength });
    return {
      ...browserCached,
      $: load(browserCached.html),
      fromCache: true,
    } satisfies FetchPageResult;
  }

  const browserRendered = await renderUrlInBrowser(normalizedUrl, logger);
  if (!browserRendered) {
    browserState.unavailable = true;
    return result;
  }

  const browserResult = buildFetchPageResult(normalizedUrl, browserRendered.url, browserRendered.contentType, browserRendered.html, 'browser', true, false);
  browserState.pagesRendered += 1;

  logger.info('page.browser_rendered', {
    url: normalizedUrl,
    staticTextLength: result.textLength,
    browserTextLength: browserResult.textLength,
    staticJsRendered: result.isLikelyJsRendered,
    browserJsRendered: browserResult.isLikelyJsRendered,
  });

  if (browserResult.textLength <= result.textLength + 120) {
    logger.warn('page.browser_skip', {
      url: normalizedUrl,
      reason: 'browser_render_not_significantly_better',
      staticTextLength: result.textLength,
      browserTextLength: browserResult.textLength,
    });
    return result;
  }

  await writeCache('page-fetch-browser', [normalizedUrl], {
    ...browserResult,
    $: undefined,
  });
  return browserResult;
}

async function discoverRobotsRules(rootUrl: string, warnings: string[]) {
  const robotsUrl = new URL('/robots.txt', rootUrl).toString();
  try {
    const { text } = await fetchTextResource(robotsUrl, 8000);
    const lines = text.split(/\r?\n/);
    const sitemaps: string[] = [];
    const disallowPrefixes: string[] = [];
    let applies = false;

    for (const line of lines) {
      const trimmed = line.split('#')[0].trim();
      if (!trimmed) continue;
      const [rawKey, ...rawValue] = trimmed.split(':');
      const key = rawKey.trim().toLowerCase();
      const value = rawValue.join(':').trim();

      if (key === 'user-agent') {
        applies = value === '*' || value.toLowerCase().includes('mozilla');
        continue;
      }

      if (key === 'sitemap' && value) {
        const normalized = normalizeUrl(value, rootUrl);
        if (normalized) sitemaps.push(normalized);
      }

      if (applies && key === 'disallow' && value && value !== '/') {
        disallowPrefixes.push(value.trim());
      }
    }

    return {
      sitemaps: uniqueStrings(sitemaps),
      disallowPrefixes: uniqueStrings(disallowPrefixes),
    } satisfies RobotsRules;
  } catch {
    warnings.push('robots.txt could not be fetched; continuing with sitemap and internal link discovery.');
    return { sitemaps: [], disallowPrefixes: [] } satisfies RobotsRules;
  }
}

function isDisallowedByRobots(url: string, rules: RobotsRules) {
  try {
    const parsed = new URL(url);
    return rules.disallowPrefixes.some((prefix) => prefix && parsed.pathname.startsWith(prefix));
  } catch {
    return false;
  }
}

async function discoverSitemapUrls(rootUrl: string, robotsRules: RobotsRules, warnings: string[]) {
  const queue = uniqueStrings([...robotsRules.sitemaps, new URL('/sitemap.xml', rootUrl).toString()]).slice(0, 8);
  const seen = new Set<string>();
  const pageUrls: string[] = [];

  while (queue.length > 0 && seen.size < 12 && pageUrls.length < 400) {
    const sitemapUrl = queue.shift();
    if (!sitemapUrl || seen.has(sitemapUrl)) continue;
    seen.add(sitemapUrl);

    try {
      const { text } = await fetchTextResource(sitemapUrl, 12000);
      const $ = load(text, { xmlMode: true });

      $('sitemap > loc').each((_, element) => {
        const nested = normalizeUrl($(element).text(), rootUrl);
        if (nested && !seen.has(nested)) queue.push(nested);
      });

      $('url > loc').each((_, element) => {
        const pageUrl = normalizeUrl($(element).text(), rootUrl);
        if (!pageUrl) return;
        if (!isSameSite(pageUrl, rootUrl) || isNoiseUrl(pageUrl)) return;
        pageUrls.push(pageUrl);
      });
    } catch (error) {
      warnings.push(`Sitemap fetch failed for ${sitemapUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return uniqueStrings(pageUrls);
}

function extractLinkList($scope: ReturnType<typeof load>, rootUrl: string) {
  const links: ActionLink[] = [];

  $scope('a[href]').each((_, element) => {
    const href = $scope(element).attr('href') || '';
    if (!href || /^mailto:|^tel:|^javascript:/i.test(href)) return;
    const normalized = normalizeUrl(href, rootUrl);
    if (!normalized) return;
    const label = normalizeWhitespace($scope(element).text());
    links.push({
      label,
      url: normalized,
      external: !isSameSite(normalized, rootUrl),
    });
  });

  return dedupeByText(links, (link) => `${link.label}|${link.url}`);
}

function extractPrimaryNavLinks($: ReturnType<typeof load>, rootUrl: string) {
  const navLists = $('header nav, nav[aria-label*="primary" i], nav[aria-label*="main" i], nav').slice(0, 3);
  const links: ActionLink[] = [];

  navLists.each((_, nav) => {
    links.push(...extractLinkList(load($(nav).html() || ''), rootUrl));
  });

  return dedupeByText(
    links.filter((link) => !link.external && !isNoiseUrl(link.url)),
    (link) => `${link.label}|${link.url}`
  );
}

function extractFooterLinks($: ReturnType<typeof load>, rootUrl: string) {
  const footer = $('footer').first();
  if (!footer.length) return [] as ActionLink[];
  const links = extractLinkList(load(footer.html() || ''), rootUrl);
  return dedupeByText(links.filter((link) => !isNoiseUrl(link.url)), (link) => `${link.label}|${link.url}`);
}

function findMainHtml($: ReturnType<typeof load>) {
  const main = $('main, [role="main"], article').first();
  if (main.length) return main.html() || '';
  return $('body').html() || '';
}

function extractPhone(text: string) {
  const match = text.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/);
  return normalizeWhitespace(match?.[0] || '');
}

function extractEmail(text: string) {
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return normalizeWhitespace(match?.[0] || '');
}

function extractAddress(text: string) {
  const lines = text
    .split(/[\n|]/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  const address = lines.find((line) => /\d{1,5}\s+[A-Za-z0-9.'# -]+(?:street|st|road|rd|avenue|ave|boulevard|blvd|drive|dr|lane|ln|suite|unit|court|ct)\b/i.test(line));
  return address || '';
}

function extractHours(text: string) {
  const match = text.match(/\b(?:mon|monday|tue|tuesday|wed|wednesday|thu|thursday|fri|friday|sat|saturday|sun|sunday)[^.!?]{0,120}/i);
  return normalizeWhitespace(match?.[0] || '');
}

function extractSocialLinks($: ReturnType<typeof load>, rootUrl: string) {
  const socials: Record<string, string> = {};
  const mapping: Array<{ key: string; pattern: RegExp }> = [
    { key: 'facebook', pattern: /facebook\.com/i },
    { key: 'instagram', pattern: /instagram\.com/i },
    { key: 'twitter', pattern: /twitter\.com|x\.com/i },
    { key: 'linkedin', pattern: /linkedin\.com/i },
    { key: 'youtube', pattern: /youtube\.com|youtu\.be/i },
  ];

  $('a[href]').each((_, element) => {
    const href = normalizeUrl($(element).attr('href') || '', rootUrl);
    if (!href) return;
    for (const entry of mapping) {
      if (!socials[entry.key] && entry.pattern.test(href)) {
        socials[entry.key] = href;
      }
    }
  });

  return socials;
}

function extractBreadcrumbs($: ReturnType<typeof load>) {
  const crumbs: string[] = [];
  $('nav[aria-label*="breadcrumb" i] a, .breadcrumb a, [class*="breadcrumb" i] a, ol li a').each((_, element) => {
    const text = normalizeWhitespace($(element).text());
    if (text) crumbs.push(text);
  });
  return uniqueStrings(crumbs).slice(0, 8);
}

function extractImagesFromScope($scope: ReturnType<typeof load>, rootUrl: string) {
  const images: MediaRef[] = [];
  $scope('img[src]').each((_, element) => {
    const url = normalizeUrl($scope(element).attr('src') || '', rootUrl);
    if (!url) return;
    images.push({
      url,
      alt: normalizeWhitespace($scope(element).attr('alt') || ''),
    });
  });
  return dedupeByText(images, (image) => image.url);
}

function extractVideoUrls($scope: ReturnType<typeof load>, rootUrl: string) {
  const videos: string[] = [];
  $scope('iframe[src], video[src], source[src]').each((_, element) => {
    const url = normalizeUrl($scope(element).attr('src') || '', rootUrl);
    if (!url) return;
    if (/youtube|youtu\.be|vimeo|\.mp4($|\?)/i.test(url)) videos.push(url);
  });
  return uniqueStrings(videos);
}

function extractDownloads($scope: ReturnType<typeof load>, rootUrl: string) {
  const downloads: ActionLink[] = [];
  $scope('a[href]').each((_, element) => {
    const href = normalizeUrl($scope(element).attr('href') || '', rootUrl);
    if (!href) return;
    if (!/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip)(?:$|\?)/i.test(href)) return;
    downloads.push({
      label: normalizeWhitespace($scope(element).text()) || href.split('/').pop() || 'Download',
      url: href,
      external: !isSameSite(href, rootUrl),
    });
  });
  return dedupeByText(downloads, (item) => `${item.label}|${item.url}`);
}

function collectImmediateCards($scope: ReturnType<typeof load>, rootUrl: string) {
  const containerChildren = $scope.root().children('div, article, section, li');
  const items: Array<{ title: string; description: string; image: string }> = [];
  if (containerChildren.length < 2 || containerChildren.length > 8) return items;

  containerChildren.each((_, child) => {
    const node = $scope(child);
    const title = normalizeWhitespace(node.find('h2, h3, h4, strong').first().text());
    const description = normalizeWhitespace(
      node
        .find('p')
        .map((__, p) => normalizeWhitespace($scope(p).text()))
        .get()
        .join(' ')
    );
    const image = normalizeUrl(node.find('img[src]').first().attr('src') || '', rootUrl) || '';
    if (title || description) {
      items.push({ title, description, image });
    }
  });

  return items.filter((item) => item.title || item.description);
}

function extractStatItems($scope: ReturnType<typeof load>) {
  const cards = collectImmediateCards($scope, 'https://example.com');
  const stats = cards
    .map((card) => {
      const numeric = normalizeWhitespace(card.title).match(/^([$€£]?\d[\d+.,%xX/-]*)\s*(.*)$/);
      if (numeric) {
        return {
          value: numeric[1],
          label: firstNonEmpty(numeric[2], card.description),
        };
      }
      const altNumeric = normalizeWhitespace(card.description).match(/^([$€£]?\d[\d+.,%xX/-]*)\s*(.*)$/);
      if (altNumeric) {
        return {
          value: altNumeric[1],
          label: firstNonEmpty(card.title, altNumeric[2]),
        };
      }
      return null;
    })
    .filter((item): item is StatItem => Boolean(item?.value && item.label));

  return dedupeByText(stats, (item) => `${item.value}|${item.label}`).slice(0, 6);
}

function extractFaqItems($scope: ReturnType<typeof load>) {
  const faqs: FaqItem[] = [];
  const pairs = collectImmediateCards($scope, 'https://example.com');

  for (const pair of pairs) {
    if (
      pair.title.endsWith('?') ||
      /^how|^what|^when|^where|^why|^do |^does |^can |^is |^are /i.test(pair.title)
    ) {
      faqs.push({
        question: pair.title,
        answer: firstNonEmpty(pair.description, 'Answer unavailable in scrape.'),
      });
    }
  }

  return dedupeByText(faqs, (item) => `${item.question}|${item.answer}`).slice(0, 8);
}

function extractTestimonials($scope: ReturnType<typeof load>) {
  const testimonials: TestimonialItem[] = [];

  $scope('blockquote').each((_, element) => {
    const node = $scope(element);
    const quote = normalizeWhitespace(node.text());
    const name = normalizeWhitespace(
      node
        .parent()
        .find('cite, strong, h3, h4')
        .first()
        .text()
    );
    if (quote) {
      testimonials.push({
        name: name || 'Customer',
        role: '',
        quote,
        rating: 5,
      });
    }
  });

  if (testimonials.length > 0) {
    return dedupeByText(testimonials, (item) => `${item.name}|${item.quote}`).slice(0, 6);
  }

  const cards = collectImmediateCards($scope, 'https://example.com');
  for (const card of cards) {
    if (card.description.length >= 40 && /testimonial|review|client|customer/i.test($scope.root().text())) {
      testimonials.push({
        name: firstNonEmpty(card.title, 'Customer'),
        role: '',
        quote: card.description,
        rating: 5,
      });
    }
  }

  return dedupeByText(testimonials, (item) => `${item.name}|${item.quote}`).slice(0, 6);
}

function extractTeamMembers($scope: ReturnType<typeof load>, rootUrl: string) {
  const members: TeamMember[] = [];
  const cards = collectImmediateCards($scope, rootUrl);

  for (const card of cards) {
    const roleMatch = card.description.match(/^[A-Z][A-Za-z/& ,.-]{2,60}$/);
    const role = roleMatch ? roleMatch[0] : '';
    if (!card.title || (!role && card.description.length < 20)) continue;
    members.push({
      name: card.title,
      role,
      bio: role ? normalizeWhitespace(card.description.replace(role, '').replace(/^[\s,:-]+/, '')) : card.description,
      image: card.image,
    });
  }

  return dedupeByText(members, (item) => `${item.name}|${item.role}`).slice(0, 8);
}

function extractPricingTiers($scope: ReturnType<typeof load>) {
  const tiers: PricingTier[] = [];
  const cards = collectImmediateCards($scope, 'https://example.com');

  for (const card of cards) {
    const priceMatch = `${card.title} ${card.description}`.match(/([$€£]\s?\d[\d.,]*|\d[\d.,]*\s?(?:\/month|per month|monthly|\/hr|per hour))/i);
    if (!priceMatch) continue;
    tiers.push({
      name: card.title || 'Plan',
      price: normalizeWhitespace(priceMatch[0]),
      period: /month/i.test(priceMatch[0]) ? '/month' : /hour|hr/i.test(priceMatch[0]) ? '/hr' : '',
      description: truncateText(card.description.replace(priceMatch[0], '').trim(), 200),
      features: [],
      highlighted: /popular|best|recommended/i.test(card.title + card.description),
    });
  }

  return dedupeByText(tiers, (item) => `${item.name}|${item.price}`).slice(0, 4);
}

function extractForms($scope: ReturnType<typeof load>) {
  const forms: FormShape[] = [];

  $scope('form').each((_, element) => {
    const fields: FormFieldShape[] = [];
    const formNode = $scope(element);

    formNode.find('input, textarea, select').each((__, field) => {
      const name = $scope(field).attr('name') || '';
      const type = $scope(field).attr('type') || field.tagName || 'text';
      const required = $scope(field).attr('required') !== undefined;
      const label = normalizeWhitespace(
        formNode.find(`label[for="${$scope(field).attr('id') || ''}"]`).first().text()
      );
      fields.push({
        label: firstNonEmpty(label, name, type),
        type: normalizeWhitespace(type),
        required,
      });
    });

    if (fields.length > 0) forms.push({ fields });
  });

  return forms;
}

function collectServiceLikeScore(lowerHeading: string, lowerText: string, paragraphCount: number, imageCount: number, ctaCount: number) {
  let score = 0;
  if (/service|solutions|offerings|what we do|capabilities|features/i.test(lowerHeading + lowerText)) score += 2;
  if (paragraphCount >= 2) score += 1;
  if (imageCount >= 2) score += 1;
  if (ctaCount >= 1) score += 1;
  return score;
}

function classifySectionCandidates(input: {
  heading: string;
  text: string;
  paragraphs: string[];
  bullets: string[];
  images: MediaRef[];
  ctas: ActionLink[];
  stats: StatItem[];
  faqs: FaqItem[];
  testimonials: TestimonialItem[];
  team: TeamMember[];
  pricing: PricingTier[];
  downloads: ActionLink[];
  videoUrls: string[];
  forms: FormShape[];
  logos: string[];
  index: number;
}) {
  const lowerHeading = input.heading.toLowerCase();
  const lowerText = input.text.toLowerCase();
  const candidates: string[] = [];

  if (input.index === 0 && (input.heading || input.paragraphs.length > 0) && (input.ctas.length > 0 || input.images.length > 0)) {
    candidates.push('hero');
  }
  if (input.faqs.length >= 2 || FAQ_LIKE_RE.test(`/${lowerHeading.replace(/\s+/g, '-')}`)) candidates.push('faq');
  if (input.testimonials.length >= 1 || /testimonial|review|client love|what.*say/i.test(lowerHeading + lowerText)) candidates.push('testimonials');
  if (input.team.length >= 2 || /team|staff|leadership/i.test(lowerHeading)) candidates.push('team');
  if (input.pricing.length >= 1 || /pricing|plan|package|membership/i.test(lowerHeading + lowerText)) candidates.push('pricing');
  if (input.stats.length >= 2 || /stats|numbers|results|track record/i.test(lowerHeading)) candidates.push('stats');
  if (input.logos.length >= 2 || /trusted by|partners|clients/i.test(lowerHeading + lowerText)) candidates.push('logoCloud');
  if (input.videoUrls.length >= 1 && input.paragraphs.length <= 3) candidates.push('video');
  if (input.downloads.length >= 1) candidates.push('resources');
  if (input.forms.length >= 1) candidates.push('contact_form');
  if (
    input.images.length >= 4 &&
    input.logos.length < 2 &&
    input.team.length < 2 &&
    input.testimonials.length === 0
  ) {
    candidates.push('gallery');
  }
  if (input.bullets.length >= 3 && input.images.length > 0) candidates.push('aboutImageText');
  if (input.bullets.length >= 3) candidates.push('featuresList');
  if (
    collectServiceLikeScore(lowerHeading, lowerText, input.paragraphs.length, input.images.length, input.ctas.length) >= 3 ||
    (input.paragraphs.length >= 1 && input.images.length === 0 && input.bullets.length === 0 && input.index === 0)
  ) {
    candidates.push('servicesGrid');
  }
  if (/contact|get in touch|reach us|visit us/i.test(lowerHeading + lowerText)) candidates.push('contact');
  if (/map|location|find us/i.test(lowerHeading + lowerText)) candidates.push('map');
  if (input.images.length === 1 && input.paragraphs.length === 0 && input.bullets.length === 0) candidates.push('image');
  candidates.push('text');

  return uniqueStrings(candidates.filter((value) => (SUPPORTED_BLOCK_TYPES as readonly string[]).includes(value)));
}

function buildSectionCandidates(page: FetchPageResult, rootUrl: string) {
  const mainHtml = findMainHtml(page.$);
  const $main = load(mainHtml || '');

  $main('script, style, noscript, template, header, footer, nav, aside').remove();

  const directSections = $main.root().children('section, article, div');
  const sectionNodes = directSections.length >= 2
    ? directSections.toArray()
    : $main('section, article, div').filter((_, element) => normalizeWhitespace($main(element).text()).length > 80).slice(0, 24).toArray();

  const results: SectionCandidate[] = [];

  sectionNodes.forEach((element, index) => {
    const node = $main(element);
    const heading = normalizeWhitespace(node.find('h1, h2, h3').first().text());
    const paragraphs = dedupeByText(
      node
        .find('p')
        .map((_, p) => normalizeWhitespace($main(p).text()))
        .get()
        .filter((value) => value.length > 25),
      (value) => value
    ).slice(0, 5);
    const bullets = dedupeByText(
      node
        .find('li')
        .map((_, li) => normalizeWhitespace($main(li).text()))
        .get()
        .filter((value) => value.length > 2),
      (value) => value
    ).slice(0, 8);
    const images = extractImagesFromScope(load(node.html() || ''), rootUrl);
    const ctas = extractLinkList(load(node.html() || ''), rootUrl)
      .filter((link) => /contact|book|get|call|quote|learn|start|request|shop|buy|view/i.test(link.label))
      .slice(0, 4);
    const links = extractLinkList(load(node.html() || ''), rootUrl).slice(0, 8);
    const stats = extractStatItems(load(node.html() || ''));
    const faqs = extractFaqItems(load(node.html() || ''));
    const testimonials = extractTestimonials(load(node.html() || ''));
    const team = extractTeamMembers(load(node.html() || ''), rootUrl);
    const pricing = extractPricingTiers(load(node.html() || ''));
    const downloads = extractDownloads(load(node.html() || ''), rootUrl);
    const videoUrls = extractVideoUrls(load(node.html() || ''), rootUrl);
    const forms = extractForms(load(node.html() || ''));
    const logos = images
      .filter((image) => /logo|partner|client/i.test(`${image.alt} ${heading}`))
      .map((image) => image.url);
    const text = normalizeWhitespace([heading, ...paragraphs, bullets.join(' ')].join(' '));

    if (text.length < 40 && images.length === 0 && ctas.length === 0 && downloads.length === 0) {
      return;
    }

    const candidateBlockTypes = classifySectionCandidates({
      heading,
      text,
      paragraphs,
      bullets,
      images,
      ctas,
      stats,
      faqs,
      testimonials,
      team,
      pricing,
      downloads,
      videoUrls,
      forms,
      logos,
      index,
    });

    results.push({
      id: `section-${index + 1}`,
      heading,
      text,
      paragraphs,
      bullets,
      ctas,
      links,
      images,
      videoUrls,
      downloads,
      stats,
      faqs,
      testimonials,
      team,
      pricing,
      logos,
      forms,
      candidateBlockTypes,
      repeated: false,
      warnings: [],
    });
  });

  if (results.length === 0) {
    const bodyText = normalizeWhitespace($main.root().text());
    if (bodyText) {
      results.push({
        id: 'section-1',
        heading: '',
        text: bodyText,
        paragraphs: [truncateText(bodyText, 800)],
        bullets: [],
        ctas: [],
        links: [],
        images: [],
        videoUrls: [],
        downloads: [],
        stats: [],
        faqs: [],
        testimonials: [],
        team: [],
        pricing: [],
        logos: [],
        forms: [],
        candidateBlockTypes: ['text'],
        repeated: false,
        warnings: ['Page collapsed into a single text section because section boundaries were unclear.'],
      });
    }
  }

  return results.slice(0, 18);
}

function inferPageType(url: string, page: ExtractedPage) {
  const path = new URL(url).pathname.toLowerCase();
  if (path === '/' || path === '/home') return 'home';
  if (ABOUT_LIKE_RE.test(path) || /about|our story|our company/i.test(`${page.title} ${page.h1}`)) return 'about';
  if (SERVICES_LIKE_RE.test(path) || /services|solutions|offerings/i.test(`${page.title} ${page.h1}`)) return 'services';
  if (CONTACT_LIKE_RE.test(path) || /contact|book|schedule/i.test(`${page.title} ${page.h1}`)) return 'contact';
  if (FAQ_LIKE_RE.test(path) || page.sections.some((section) => section.faqs.length >= 2)) return 'faq';
  if (TEAM_LIKE_RE.test(path) || page.sections.some((section) => section.team.length >= 2)) return 'team';
  if (PRICING_LIKE_RE.test(path) || page.sections.some((section) => section.pricing.length >= 1)) return 'pricing';
  if (LOCATION_LIKE_RE.test(path)) return 'locations';
  if (CASE_STUDY_LIKE_RE.test(path)) return 'portfolio';
  if (LEGAL_LIKE_RE.test(path)) return 'legal';
  if (BLOG_LIKE_RE.test(path)) return path.split('/').filter(Boolean).length > 1 ? 'blog-post' : 'blog-index';
  return 'landing';
}

function markRepeatedSections(pages: ExtractedPage[]) {
  const counts = new Map<string, number>();
  const sectionMap = new Map<string, string>();

  for (const page of pages) {
    for (const section of page.sections) {
      const fingerprint = normalizeWhitespace(`${section.heading} ${truncateText(section.text, 180)}`).toLowerCase();
      if (!fingerprint) continue;
      sectionMap.set(`${page.slug}:${section.id}`, fingerprint);
      counts.set(fingerprint, (counts.get(fingerprint) || 0) + 1);
    }
  }

  const repeatedThreshold = Math.max(2, Math.ceil(pages.length * 0.6));
  for (const page of pages) {
    page.sections = page.sections.map((section) => {
      const fingerprint = sectionMap.get(`${page.slug}:${section.id}`) || '';
      const repeated = Boolean(fingerprint && (counts.get(fingerprint) || 0) >= repeatedThreshold && section.text.length < 320);
      return {
        ...section,
        repeated,
      };
    });
  }
}

async function extractPage(page: FetchPageResult, rootUrl: string, warnings: string[]) {
  const cached = await readCache<ExtractedPage>('page-extract', [page.url, page.contentHash]);
  if (cached) {
    return {
      ...cached,
      fromCache: true,
      jsWarning: typeof cached.jsWarning === 'boolean' ? cached.jsWarning : page.isLikelyJsRendered,
      renderMode: cached.renderMode || page.renderMode,
    };
  }

  const titleTag = normalizeWhitespace(page.$('title').first().text());
  const metaDescription = extractMetaContent(page.$, [
    'meta[name="description"]',
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
  ]);
  const canonical = normalizeUrl(page.$('link[rel="canonical"]').attr('href') || '', page.url) || page.url;
  const robots = extractMetaContent(page.$, ['meta[name="robots"]']);
  const h1 = normalizeWhitespace(page.$('h1').first().text());
  const navLinks = extractPrimaryNavLinks(page.$, page.url);
  const footerLinks = extractFooterLinks(page.$, page.url);
  const pageLinks = extractLinkList(page.$, page.url)
    .filter((link) => !link.external && !isNoiseUrl(link.url))
    .slice(0, 60);
  const ctas = extractLinkList(page.$, page.url)
    .filter((link) => /contact|book|get|call|quote|learn|start|request|shop|buy|view/i.test(link.label))
    .slice(0, 10);
  const images = extractImagesFromScope(page.$, page.url);
  const videoUrls = extractVideoUrls(page.$, page.url);
  const downloads = extractDownloads(page.$, page.url);
  const bodyText = normalizeWhitespace(page.$('body').text());
  const breadcrumbs = extractBreadcrumbs(page.$);
  const socialLinks = extractSocialLinks(page.$, page.url);
  const schema = extractJsonLdObjects(page.$);
  const og = {
    title: extractMetaContent(page.$, ['meta[property="og:title"]']),
    description: extractMetaContent(page.$, ['meta[property="og:description"]']),
    image: extractMetaContent(page.$, ['meta[property="og:image"]']),
    type: extractMetaContent(page.$, ['meta[property="og:type"]']),
  };
  const twitter = {
    title: extractMetaContent(page.$, ['meta[name="twitter:title"]']),
    description: extractMetaContent(page.$, ['meta[name="twitter:description"]']),
    image: extractMetaContent(page.$, ['meta[name="twitter:image"]']),
    card: extractMetaContent(page.$, ['meta[name="twitter:card"]']),
  };
  const sections = buildSectionCandidates(page, page.url);

  const extracted: ExtractedPage = {
    sourceUrl: page.requestedUrl,
    finalUrl: page.url,
    slug: slugify(new URL(page.url).pathname.replace(/^\/+/, '') || 'home') || 'home',
    title: firstNonEmpty(h1, titleTag, makeDisplayName(slugify(new URL(page.url).pathname.replace(/^\/+/, '') || 'home') || 'home', '')),
    displayName: '',
    titleTag,
    metaDescription,
    canonical,
    robots,
    h1,
    inferredType: 'landing',
    breadcrumbs,
    og,
    twitter,
    schema,
    navLinks,
    footerLinks,
    pageLinks,
    ctas,
    images,
    videoUrls,
    downloads,
    contact: {
      phone: extractPhone(bodyText),
      email: extractEmail(bodyText),
      address: extractAddress(bodyText),
      hours: extractHours(bodyText),
    },
    socialLinks,
    sections,
    contentHash: page.contentHash,
    fromCache: false,
    jsWarning: page.isLikelyJsRendered,
    renderMode: page.renderMode,
  };

  extracted.inferredType = inferPageType(page.url, extracted);
  extracted.displayName = makeDisplayName(extracted.slug, extracted.title);

  if (page.isLikelyJsRendered) {
    warnings.push(`Page may be JavaScript-rendered and only partially captured: ${page.url}`);
  }

  await writeCache('page-extract', [page.url, page.contentHash], extracted);
  return extracted;
}

function emptySection(): SectionCandidate {
  return {
    id: 'section-empty',
    heading: '',
    text: '',
    paragraphs: [],
    bullets: [],
    ctas: [],
    links: [],
    images: [],
    videoUrls: [],
    downloads: [],
    stats: [],
    faqs: [],
    testimonials: [],
    team: [],
    pricing: [],
    logos: [],
    forms: [],
    candidateBlockTypes: ['text'],
    repeated: false,
    warnings: [],
  };
}

function collectServiceCardItems(section: SectionCandidate) {
  if (section.paragraphs.length >= 2 && section.bullets.length === 0) {
    return section.paragraphs.slice(0, 4).map((paragraph, index) => ({
      title: index === 0 && section.heading ? section.heading : `Item ${index + 1}`,
      description: paragraph,
    }));
  }

  if (section.bullets.length > 0) {
    return section.bullets.slice(0, 6).map((item) => ({
      title: item,
      description: '',
    }));
  }

  return [
    {
      title: firstNonEmpty(section.heading, 'Details'),
      description: firstNonEmpty(section.paragraphs[0], truncateText(section.text, 200)),
    },
  ];
}

function buildHeroBlock(section: SectionCandidate, page: ExtractedPage, slug: string, index: number) {
  return {
    id: `block-${slug}-${index + 1}`,
    type: 'hero',
    data: {
      title: firstNonEmpty(page.h1, section.heading, page.title),
      subtitle: firstNonEmpty(section.paragraphs[0], page.metaDescription),
      buttonText: firstNonEmpty(section.ctas[0]?.label, 'Contact Us'),
      variant: section.images[0] ? 'split' : 'centered',
      ...(section.images[0] ? { image: section.images[0].url } : {}),
    },
    compatibility: 'supported',
    compatibilityNotes: section.images[0] ? [] : ['Hero image was not confidently identified; exported as text-first hero.'],
    sourceSectionIds: [section.id],
  } satisfies BuilderBlockExport;
}

function buildServicesGridBlock(section: SectionCandidate, slug: string, index: number) {
  const cardItems = collectServiceCardItems(section);
  return {
    id: `block-${slug}-${index + 1}`,
    type: 'servicesGrid',
    data: {
      title: firstNonEmpty(section.heading, 'Services'),
      subtitle: firstNonEmpty(section.paragraphs[0], ''),
      items: cardItems.slice(0, 6),
    },
    compatibility: cardItems.length > 0 ? 'supported' : 'approximated',
    compatibilityNotes: cardItems.length > 0 ? [] : ['Section was flattened into a simple grid because card structure was ambiguous.'],
    sourceSectionIds: [section.id],
  } satisfies BuilderBlockExport;
}

function buildFeaturesBlock(section: SectionCandidate, slug: string, index: number) {
  return {
    id: `block-${slug}-${index + 1}`,
    type: 'featuresList',
    data: {
      title: firstNonEmpty(section.heading, 'Why choose us'),
      items: section.bullets.slice(0, 8),
    },
    compatibility: 'supported',
    compatibilityNotes: [],
    sourceSectionIds: [section.id],
  } satisfies BuilderBlockExport;
}

function buildAboutBlock(section: SectionCandidate, slug: string, index: number) {
  return {
    id: `block-${slug}-${index + 1}`,
    type: 'aboutImageText',
    data: {
      title: firstNonEmpty(section.heading, 'About'),
      description: firstNonEmpty(section.paragraphs[0], ''),
      imagePosition: 'right',
      items: section.bullets.slice(0, 6),
      ...(section.images[0] ? { image: section.images[0].url } : {}),
    },
    compatibility: 'supported',
    compatibilityNotes: section.images[0] ? [] : ['No clear supporting image was found for this split section.'],
    sourceSectionIds: [section.id],
  } satisfies BuilderBlockExport;
}

function buildTestimonialsBlock(section: SectionCandidate, slug: string, index: number) {
  return {
    id: `block-${slug}-${index + 1}`,
    type: 'testimonials',
    data: {
      title: firstNonEmpty(section.heading, 'Testimonials'),
      subtitle: '',
      variant: section.testimonials.length > 1 ? 'cards' : 'single',
      items: section.testimonials.slice(0, 6).map((item) => ({
        name: firstNonEmpty(item.name, 'Customer'),
        role: item.role,
        quote: item.quote,
        rating: item.rating || 5,
      })),
    },
    compatibility: 'supported',
    compatibilityNotes: [],
    sourceSectionIds: [section.id],
  } satisfies BuilderBlockExport;
}

function buildStatsBlock(section: SectionCandidate, slug: string, index: number) {
  return {
    id: `block-${slug}-${index + 1}`,
    type: 'stats',
    data: {
      title: firstNonEmpty(section.heading, ''),
      variant: section.stats.length >= 4 ? 'cards' : 'banner',
      items: section.stats.slice(0, 6),
    },
    compatibility: 'supported',
    compatibilityNotes: [],
    sourceSectionIds: [section.id],
  } satisfies BuilderBlockExport;
}

function buildGalleryBlock(section: SectionCandidate, slug: string, index: number) {
  return {
    id: `block-${slug}-${index + 1}`,
    type: 'gallery',
    data: {
      title: firstNonEmpty(section.heading, 'Gallery'),
      subtitle: firstNonEmpty(section.paragraphs[0], ''),
      columns: section.images.length >= 6 ? 3 : 2,
      images: section.images.slice(0, 12).map((image) => image.url),
    },
    compatibility: 'supported',
    compatibilityNotes: [],
    sourceSectionIds: [section.id],
  } satisfies BuilderBlockExport;
}

function buildLogoCloudBlock(section: SectionCandidate, slug: string, index: number) {
  return {
    id: `block-${slug}-${index + 1}`,
    type: 'logoCloud',
    data: {
      title: firstNonEmpty(section.heading, 'Trusted by'),
      variant: section.logos.length >= 5 ? 'grid' : 'inline',
      logos: section.logos.slice(0, 12),
    },
    compatibility: 'supported',
    compatibilityNotes: [],
    sourceSectionIds: [section.id],
  } satisfies BuilderBlockExport;
}

function buildFaqBlock(section: SectionCandidate, slug: string, index: number) {
  return {
    id: `block-${slug}-${index + 1}`,
    type: 'faq',
    data: {
      title: firstNonEmpty(section.heading, 'Frequently asked questions'),
      subtitle: firstNonEmpty(section.paragraphs[0], ''),
      items: section.faqs.slice(0, 8),
    },
    compatibility: 'supported',
    compatibilityNotes: [],
    sourceSectionIds: [section.id],
  } satisfies BuilderBlockExport;
}

function buildTeamBlock(section: SectionCandidate, slug: string, index: number) {
  return {
    id: `block-${slug}-${index + 1}`,
    type: 'team',
    data: {
      title: firstNonEmpty(section.heading, 'Meet the team'),
      subtitle: firstNonEmpty(section.paragraphs[0], ''),
      variant: section.team.length >= 4 ? 'cards' : 'grid',
      members: section.team.slice(0, 8),
    },
    compatibility: 'supported',
    compatibilityNotes: section.team.some((member) => !member.image) ? ['Some team members were exported without profile images.'] : [],
    sourceSectionIds: [section.id],
  } satisfies BuilderBlockExport;
}

function buildPricingBlock(section: SectionCandidate, slug: string, index: number) {
  return {
    id: `block-${slug}-${index + 1}`,
    type: 'pricing',
    data: {
      title: firstNonEmpty(section.heading, 'Pricing'),
      subtitle: firstNonEmpty(section.paragraphs[0], ''),
      variant: section.pricing.length >= 3 ? 'cards' : 'simple',
      tiers: section.pricing.slice(0, 4),
    },
    compatibility: 'supported',
    compatibilityNotes: [],
    sourceSectionIds: [section.id],
  } satisfies BuilderBlockExport;
}

function buildContactBlock(section: SectionCandidate, page: ExtractedPage, slug: string, index: number) {
  return {
    id: `block-${slug}-${index + 1}`,
    type: 'contact',
    data: {
      title: firstNonEmpty(section.heading, 'Get in touch'),
      subtitle: firstNonEmpty(section.paragraphs[0], ''),
      phone: page.contact.phone,
      email: page.contact.email,
      address: page.contact.address,
      hours: page.contact.hours,
      facebookUrl: page.socialLinks.facebook || '',
      instagramUrl: page.socialLinks.instagram || '',
      twitterUrl: page.socialLinks.twitter || '',
      linkedinUrl: page.socialLinks.linkedin || '',
      youtubeUrl: page.socialLinks.youtube || '',
    },
    compatibility: 'supported',
    compatibilityNotes: [],
    sourceSectionIds: [section.id],
  } satisfies BuilderBlockExport;
}

function buildContactFormBlock(section: SectionCandidate, slug: string, index: number) {
  return {
    id: `block-${slug}-${index + 1}`,
    type: 'contact_form',
    data: {
      title: firstNonEmpty(section.heading, 'Contact us'),
      description: firstNonEmpty(section.paragraphs[0], 'Send us a message and we will get back to you soon.'),
      submitText: firstNonEmpty(section.ctas[0]?.label, 'Send Message'),
      successMessage: 'Thank you for your message! We will get back to you shortly.',
    },
    compatibility: 'supported',
    compatibilityNotes: ['Form fields were preserved as structure only; email routing must be configured in the builder.'],
    sourceSectionIds: [section.id],
  } satisfies BuilderBlockExport;
}

function buildMapBlock(page: ExtractedPage, slug: string, index: number) {
  return {
    id: `block-${slug}-${index + 1}`,
    type: 'map',
    data: {
      title: 'Find us',
      address: page.contact.address,
    },
    compatibility: 'supported',
    compatibilityNotes: [],
    sourceSectionIds: [],
  } satisfies BuilderBlockExport;
}

function buildResourcesBlock(section: SectionCandidate, slug: string, index: number) {
  return {
    id: `block-${slug}-${index + 1}`,
    type: 'resources',
    data: {
      title: firstNonEmpty(section.heading, 'Resources'),
      subtitle: firstNonEmpty(section.paragraphs[0], ''),
      variant: 'list',
      items: section.downloads.slice(0, 10).map((item, itemIndex) => ({
        id: `resource-${slug}-${index + 1}-${itemIndex + 1}`,
        type: 'link',
        title: item.label,
        description: '',
        url: item.url,
        openInNewTab: true,
      })),
    },
    compatibility: 'supported',
    compatibilityNotes: ['Downloads were exported as resource links.'],
    sourceSectionIds: [section.id],
  } satisfies BuilderBlockExport;
}

function buildVideoBlock(section: SectionCandidate, slug: string, index: number) {
  return {
    id: `block-${slug}-${index + 1}`,
    type: 'video',
    data: {
      title: firstNonEmpty(section.heading, ''),
      caption: firstNonEmpty(section.paragraphs[0], ''),
      videoUrl: section.videoUrls[0],
      variant: 'contained',
    },
    compatibility: 'supported',
    compatibilityNotes: [],
    sourceSectionIds: [section.id],
  } satisfies BuilderBlockExport;
}

function buildImageBlock(section: SectionCandidate, slug: string, index: number) {
  return {
    id: `block-${slug}-${index + 1}`,
    type: 'image',
    data: {
      image: section.images[0]?.url || '',
      caption: firstNonEmpty(section.heading, section.images[0]?.alt, ''),
    },
    compatibility: 'supported',
    compatibilityNotes: [],
    sourceSectionIds: [section.id],
  } satisfies BuilderBlockExport;
}

function buildCtaBlock(section: SectionCandidate, slug: string, index: number) {
  return {
    id: `block-${slug}-${index + 1}`,
    type: 'cta',
    data: {
      title: firstNonEmpty(section.heading, 'Ready to get started?'),
      subtitle: firstNonEmpty(section.paragraphs[0], truncateText(section.text, 180)),
      buttonText: firstNonEmpty(section.ctas[0]?.label, 'Contact Us'),
      showPattern: true,
    },
    compatibility: 'supported',
    compatibilityNotes: [],
    sourceSectionIds: [section.id],
  } satisfies BuilderBlockExport;
}

function buildTextBlock(section: SectionCandidate, slug: string, index: number, note?: string) {
  return {
    id: `block-${slug}-${index + 1}`,
    type: 'text',
    data: {
      html: toRichTextHtml(section.heading, section.paragraphs, section.bullets),
    },
    compatibility: note ? 'approximated' : 'supported',
    compatibilityNotes: note ? [note] : [],
    sourceSectionIds: [section.id],
  } satisfies BuilderBlockExport;
}

function stripUnsafeMarkup(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<script[\s>]/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
}

function deepSanitizeBlockData(value: unknown): unknown {
  if (typeof value === 'string') return stripUnsafeMarkup(value);
  if (Array.isArray(value)) return value.map((item) => deepSanitizeBlockData(item));
  if (value && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (/^on[A-Z]/.test(key)) continue;
      sanitized[key] = deepSanitizeBlockData(entry);
    }
    return sanitized;
  }
  return value;
}

function buildAiBlockId(slug: string, type: string, index: number) {
  return `block-${slug}-${index + 1}-${slugify(type) || 'section'}`;
}

function guessSourceSectionIdsForBlock(type: string, data: Record<string, unknown>, page: ExtractedPage) {
  const usefulSections = page.sections.filter((section) => !section.repeated);
  if (usefulSections.length === 0) return [] as string[];

  const titleCandidates = [
    typeof data.title === 'string' ? data.title : '',
    typeof data.subtitle === 'string' ? data.subtitle : '',
    typeof data.caption === 'string' ? data.caption : '',
    typeof data.description === 'string' ? data.description : '',
    typeof data.quote === 'string' ? data.quote : '',
    typeof data.html === 'string' ? data.html.replace(/<[^>]+>/g, ' ') : '',
  ]
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean);

  const explicitHeadingMatch = usefulSections.find((section) =>
    titleCandidates.some((candidate) => candidate && section.heading && candidate.toLowerCase().includes(section.heading.toLowerCase()))
  );
  if (explicitHeadingMatch) return [explicitHeadingMatch.id];

  const exactTypeMatch = usefulSections.find((section) => section.candidateBlockTypes.includes(type));
  if (exactTypeMatch) return [exactTypeMatch.id];

  const textMatch = usefulSections.find((section) =>
    titleCandidates.some((candidate) => candidate && section.text && section.text.toLowerCase().includes(candidate.toLowerCase().slice(0, 80)))
  );
  if (textMatch) return [textMatch.id];

  return [usefulSections[Math.min(usefulSections.length - 1, 0)].id];
}

function getBlockTypeSetupNotes(type: string) {
  switch (type) {
    case 'booking':
      return ['Booking block requires booking setup in Keystone Admin.'];
    case 'productGrid':
      return ['Product grid requires products to be added in Keystone Admin.'];
    case 'blog':
      return ['Blog block is supported, but posts still need to be created or migrated separately.'];
    case 'menu':
      return ['Menu block is supported, but menu items still need to be added in Keystone Admin.'];
    case 'events':
      return ['Events block is supported, but events still need to be added in Keystone Admin.'];
    case 'pdf':
      return ['PDF block is supported, but the PDF file still needs to be uploaded in Keystone.'];
    case 'custom_html':
      return ['Custom HTML should be reviewed manually before publishing.'];
    default:
      return [];
  }
}

function sanitizeAiBuilderBlocks(page: ExtractedPage, blocks: NormalizationDecision['blocks']) {
  if (!Array.isArray(blocks)) return [];

  const sanitizedBlocks: BuilderBlockExport[] = [];
  for (const [index, block] of blocks.entries()) {
    if (!block || typeof block !== 'object' || !isValidBuilderBlockType(block.type)) continue;
    const data = block.data && typeof block.data === 'object'
      ? deepSanitizeBlockData(block.data) as Record<string, unknown>
      : {};
    const sourceSectionIds = Array.isArray(block.sourceSectionIds)
      ? uniqueStrings(block.sourceSectionIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0))
      : [];
    const compatibility = block.compatibility === 'approximated' || block.type === 'custom_html'
      ? 'approximated'
      : 'supported';
    const notes = uniqueStrings([
      ...(Array.isArray(block.compatibilityNotes) ? block.compatibilityNotes.filter((value): value is string => typeof value === 'string') : []),
      ...getBlockTypeSetupNotes(block.type),
    ]).map((note) => note.slice(0, 280));

    sanitizedBlocks.push({
      id: buildAiBlockId(page.slug, block.type, index),
      type: block.type,
      data,
      compatibility,
      compatibilityNotes: notes,
      sourceSectionIds: sourceSectionIds.length > 0 ? sourceSectionIds : guessSourceSectionIdsForBlock(block.type, data, page),
    });
  }

  return sanitizedBlocks;
}

function blockFromType(type: string, section: SectionCandidate, page: ExtractedPage, slug: string, index: number) {
  switch (type) {
    case 'hero':
      return buildHeroBlock(section, page, slug, index);
    case 'servicesGrid':
      return buildServicesGridBlock(section, slug, index);
    case 'featuresList':
      return buildFeaturesBlock(section, slug, index);
    case 'aboutImageText':
      return buildAboutBlock(section, slug, index);
    case 'testimonials':
      return buildTestimonialsBlock(section, slug, index);
    case 'stats':
      return buildStatsBlock(section, slug, index);
    case 'gallery':
      return buildGalleryBlock(section, slug, index);
    case 'logoCloud':
      return buildLogoCloudBlock(section, slug, index);
    case 'faq':
      return buildFaqBlock(section, slug, index);
    case 'team':
      return buildTeamBlock(section, slug, index);
    case 'pricing':
      return buildPricingBlock(section, slug, index);
    case 'contact':
      return buildContactBlock(section, page, slug, index);
    case 'contact_form':
      return buildContactFormBlock(section, slug, index);
    case 'map':
      return buildMapBlock(page, slug, index);
    case 'resources':
      return buildResourcesBlock(section, slug, index);
    case 'video':
      return buildVideoBlock(section, slug, index);
    case 'image':
      return buildImageBlock(section, slug, index);
    case 'cta':
      return buildCtaBlock(section, slug, index);
    case 'text':
    default:
      return buildTextBlock(section, slug, index);
  }
}

function calculatePageConfidence(mappedBlocks: BuilderBlockExport[], supportedSections: number, approximatedSections: number, unsupportedSections: number, warningCount: number) {
  const totalSections = Math.max(1, supportedSections + approximatedSections + unsupportedSections);
  const supportRatio = supportedSections / totalSections;
  const approximationPenalty = approximatedSections * 0.04;
  const unsupportedPenalty = unsupportedSections * 0.08;
  const warningPenalty = Math.min(0.12, warningCount * 0.02);
  const blockBonus = Math.min(0.18, mappedBlocks.length * 0.02);
  const confidence = 0.46 + supportRatio * 0.28 + blockBonus - approximationPenalty - unsupportedPenalty - warningPenalty;
  return Math.max(0.18, Math.min(0.97, Number(confidence.toFixed(2))));
}

function resolveCompatibilityStatus(confidence: number, approximatedSections: number, unsupportedSections: number): BuilderCompatibilityStatus {
  if (unsupportedSections === 0 && confidence >= 0.76 && approximatedSections <= 1) return 'supported';
  if (unsupportedSections <= 2 && confidence >= 0.52) return 'approximated';
  return 'manual_cleanup';
}

function buildMappedPage(page: ExtractedPage, decisions: NormalizationDecision | null, aiOnly: boolean) {
  const warnings = new Set<string>();
  const compatibilityNotes: string[] = [];
  const usefulSections = page.sections.filter((section) => !section.repeated);
  const aiBlocks = sanitizeAiBuilderBlocks(page, decisions?.blocks);
  const builderBlocks: BuilderBlockExport[] = [];
  let supportedSections = 0;
  let approximatedSections = 0;
  let unsupportedSections = 0;

  if (aiBlocks.length > 0) {
    builderBlocks.push(...aiBlocks);

    const supportedSourceIds = new Set<string>();
    const approximatedSourceIds = new Set<string>();

    aiBlocks.forEach((block) => {
      block.compatibilityNotes.forEach((note) => warnings.add(note));
      if (block.sourceSectionIds.length > 0) {
        if (block.compatibility === 'supported') {
          block.sourceSectionIds.forEach((id) => supportedSourceIds.add(id));
        } else {
          block.sourceSectionIds.forEach((id) => {
            if (!supportedSourceIds.has(id)) approximatedSourceIds.add(id);
          });
        }
      }
    });

    if (usefulSections.length > 0) {
      supportedSections = supportedSourceIds.size;
      approximatedSections = approximatedSourceIds.size;
      unsupportedSections = Math.max(0, usefulSections.length - supportedSections - approximatedSections);
    } else {
      supportedSections = aiBlocks.filter((block) => block.compatibility === 'supported').length;
      approximatedSections = aiBlocks.filter((block) => block.compatibility === 'approximated').length;
      unsupportedSections = 0;
    }
  } else if (!aiOnly) {
    usefulSections.forEach((section, index) => {
      const resolvedType = section.candidateBlockTypes[0] || 'text';
      const block = blockFromType(resolvedType, section, page, page.slug, builderBlocks.length);
      const shouldApproximateToText =
        resolvedType === 'servicesGrid' &&
        collectServiceCardItems(section).length === 0 &&
        section.paragraphs.length <= 1 &&
        section.bullets.length <= 1;

      if (shouldApproximateToText) {
        builderBlocks.push(
          buildTextBlock(
            section,
            page.slug,
            builderBlocks.length,
            `Section "${firstNonEmpty(section.heading, `Section ${index + 1}`)}" was mapped to rich text because the layout could not be represented confidently.`
          )
        );
        warnings.add(`Section "${firstNonEmpty(section.heading, `Section ${index + 1}`)}" was approximated as a rich text block.`);
        approximatedSections += 1;
        return;
      }

      builderBlocks.push(block);
      if (block.compatibility === 'supported') {
        supportedSections += 1;
      } else {
        approximatedSections += 1;
      }
      block.compatibilityNotes.forEach((note) => warnings.add(note));
    });
  } else {
    unsupportedSections = Math.max(1, usefulSections.length || 1);
    warnings.add('AI-only mapping was enabled, but no valid builder blocks were returned for this page.');
    compatibilityNotes.push('No heuristic fallback was used because AI-only mapping is enabled for this scrape.');
  }

  if (builderBlocks.length === 0 && !aiOnly) {
    unsupportedSections += 1;
    builderBlocks.push(
      buildTextBlock(
        {
          ...emptySection(),
          id: 'section-fallback',
          heading: firstNonEmpty(page.title, page.h1, 'Page content'),
          text: firstNonEmpty(page.metaDescription, page.titleTag, 'Page content could not be segmented cleanly.'),
          paragraphs: [firstNonEmpty(page.metaDescription, page.titleTag, 'Page content could not be segmented cleanly.')],
        },
        page.slug,
        0,
        'The page was collapsed into a single rich text block because the scraper could not confidently recover the original layout.'
      )
    );
    warnings.add('Page layout was collapsed into a single rich text block.');
  }

  if (!aiOnly && (page.inferredType === 'contact' || page.contact.address || page.contact.phone || page.contact.email) && !builderBlocks.some((block) => block.type === 'contact')) {
    builderBlocks.push(buildContactBlock(page.sections[0] || usefulSections[0] || emptySection(), page, page.slug, builderBlocks.length));
    supportedSections += 1;
  }

  if (!aiOnly && page.sections.some((section) => section.forms.length > 0) && !builderBlocks.some((block) => block.type === 'contact_form')) {
    builderBlocks.push(buildContactFormBlock(page.sections.find((section) => section.forms.length > 0) || emptySection(), page.slug, builderBlocks.length));
    supportedSections += 1;
  }

  if (!aiOnly && page.contact.address && (page.inferredType === 'contact' || page.inferredType === 'locations') && !builderBlocks.some((block) => block.type === 'map')) {
    builderBlocks.push(buildMapBlock(page, page.slug, builderBlocks.length));
    supportedSections += 1;
  }

  if (usefulSections.length > builderBlocks.length + 2) {
    warnings.add('Some minor sections were omitted after normalization because they repeated site-wide boilerplate.');
  }

  if (page.jsWarning) {
    warnings.add('This page may depend on client-side rendering and could need manual review.');
  }
  if (page.inferredType === 'blog-post' || page.inferredType === 'blog-index') {
    warnings.add('Blog content is not mapped to Keystone blog records automatically; recreate posts manually if needed.');
  }
  if (decisions?.warnings) {
    decisions.warnings.forEach((warning) => warnings.add(warning));
  }
  if (decisions?.confidenceNote) {
    compatibilityNotes.push(decisions.confidenceNote);
  }
  if (!decisions?.blocks?.length && !aiOnly) {
    compatibilityNotes.push('Page block mapping fell back to heuristic extraction because AI block generation was unavailable for this page.');
  }

  const confidence = calculatePageConfidence(builderBlocks, supportedSections, approximatedSections, unsupportedSections, warnings.size);
  const compatibilityStatus = resolveCompatibilityStatus(confidence, approximatedSections, unsupportedSections);

  const mediaReferences = dedupeByText(
    [
      ...page.images.map((image) => ({ type: 'image', url: image.url, alt: image.alt })),
      ...page.videoUrls.map((url) => ({ type: 'video', url })),
      ...page.downloads.map((download) => ({ type: 'file', url: download.url, alt: download.label })),
    ],
    (item) => `${item.type}|${item.url}`
  );

  const pageRecord = {
    slug: page.slug,
    title: page.title,
    display_name: page.displayName,
    is_visible_in_nav: !['legal', 'blog-post'].includes(page.inferredType),
    nav_order: 0,
    design_data: {
      seoTitle: firstNonEmpty(page.titleTag, page.title),
      seoDescription: page.metaDescription,
      blocks: builderBlocks.map((block) => ({
        id: block.id,
        type: block.type,
        data: block.data,
      })),
    },
  };

  return {
    title: page.title,
    url: page.finalUrl,
    slug: page.slug,
    inferredType: decisions?.pageType || page.inferredType,
    confidence,
    compatibilityStatus,
    builderBlocks,
    warnings: Array.from(warnings),
    compatibilityNotes,
    supportedSections,
    approximatedSections,
    unsupportedSections,
    manualFollowUpRequired: compatibilityStatus === 'manual_cleanup',
    pageRecord,
    mediaReferences,
  } satisfies MappedPageExport;
}

function getNormalizationEligibility(page: ExtractedPage, renderedHtml: string, modeConfig: ModeConfig, budget: BudgetState): NormalizationEligibility {
  if (!modeConfig.allowLlm) return { allowed: false, reason: 'mode_llm_disabled' };
  if (budget.exhausted) return { allowed: false, reason: 'budget_exhausted' };
  if (budget.llmPagesUsed >= modeConfig.maxLlmPages) return { allowed: false, reason: 'llm_page_limit_reached' };
  if (!normalizeWhitespace(renderedHtml)) {
    return { allowed: false, reason: 'empty_rendered_html' };
  }

  if (page.jsWarning && page.renderMode === 'static' && page.sections.length === 0) {
    return { allowed: false, reason: 'static_shell_without_structured_content' };
  }

  return { allowed: true, reason: 'full_html_builder_mapping' };
}

function buildAiPayload(page: ExtractedPage, renderedHtml: string) {
  return {
    page: {
      url: page.finalUrl,
      slug: page.slug,
      title: page.title,
      titleTag: page.titleTag,
      inferredType: page.inferredType,
      metaDescription: page.metaDescription,
      canonical: page.canonical,
      robots: page.robots,
      h1: page.h1,
      breadcrumbs: page.breadcrumbs,
      og: page.og,
      twitter: page.twitter,
      schema: page.schema,
      contact: page.contact,
      jsWarning: page.jsWarning,
      renderMode: page.renderMode,
    },
    renderedHtml,
    extractedContext: {
      navLinks: page.navLinks,
      footerLinks: page.footerLinks,
      pageLinks: page.pageLinks.slice(0, 80),
      ctas: page.ctas,
      images: page.images.slice(0, 40),
      downloads: page.downloads.slice(0, 20),
      videoUrls: page.videoUrls.slice(0, 12),
      sections: page.sections
        .filter((section) => !section.repeated)
        .map((section) => ({
          id: section.id,
          heading: section.heading,
          summary: truncateText(section.text, 500),
          paragraphs: section.paragraphs.slice(0, 4),
          bullets: section.bullets.slice(0, 8),
          ctas: section.ctas.slice(0, 4),
          faqCount: section.faqs.length,
          testimonialCount: section.testimonials.length,
          teamCount: section.team.length,
          pricingCount: section.pricing.length,
          statCount: section.stats.length,
          formCount: section.forms.length,
          imageCount: section.images.length,
          downloadCount: section.downloads.length,
          videoCount: section.videoUrls.length,
        })),
    },
    supportedBlockTypes: SUPPORTED_BLOCK_TYPES,
  };
}

function extractJsonObject(text: string) {
  const cleaned = text.trim();

  try {
    return JSON.parse(cleaned) as NormalizationDecision;
  } catch {
    // continue
  }

  const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/i);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim()) as NormalizationDecision;
    } catch {
      // continue
    }
  }

  const firstBrace = cleaned.indexOf('{');
  if (firstBrace === -1) return null;

  let depth = 0;
  let inString = false;
  let escaping = false;
  for (let index = firstBrace; index < cleaned.length; index += 1) {
    const char = cleaned[index];
    if (escaping) {
      escaping = false;
      continue;
    }
    if (char === '\\') {
      escaping = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) {
      try {
        return JSON.parse(cleaned.slice(firstBrace, index + 1)) as NormalizationDecision;
      } catch {
        return null;
      }
    }
  }

  return null;
}

function estimateTokens(value: unknown) {
  return Math.ceil(JSON.stringify(value).length / 4);
}

async function callOpenAi(apiKey: string, model: string, system: string, payload: unknown) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(payload) },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI returned ${response.status}`);
  }

  const data = await response.json();
  return String(data.choices?.[0]?.message?.content || '');
}

async function callAnthropic(apiKey: string, model: string, system: string, payload: unknown) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2500,
      temperature: 0,
      system,
      messages: [{ role: 'user', content: JSON.stringify(payload) }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic returned ${response.status}`);
  }

  const data = await response.json();
  return String(data.content?.[0]?.text || '');
}

async function maybeNormalizePageWithAi(
  page: ExtractedPage,
  renderedHtml: string,
  mode: ScraperMode,
  modeConfig: ModeConfig,
  normalizationConfig: ResolvedNormalizationConfig,
  budget: BudgetState,
  cacheState: CacheState,
  warnings: string[],
  logger: ContentScraperLogger
) {
  const eligibility = getNormalizationEligibility(page, renderedHtml, modeConfig, budget);
  if (!eligibility.allowed) {
    logger.info('page.normalize.skip', {
      url: page.finalUrl,
      reason: eligibility.reason,
      renderMode: page.renderMode,
      sectionCount: page.sections.filter((section) => !section.repeated).length,
    });
    return null;
  }

  const { provider, lightModel, fallbackModel } = normalizationConfig;
  const payload = buildAiPayload(page, renderedHtml);
  const estimatedTokens = estimateTokens(payload);
  const system = `You are mapping a scraped website page into Keystone Web builder blocks for migration.

Your job is to inspect the FULL rendered HTML and output the closest builder-ready page structure that Keystone can actually recreate.

STRICT RULES:
- Use the renderedHtml as the primary source of truth for layout and content. The extractedContext is only supplemental metadata.
- You may only use supported Keystone block types listed below.
- Do not invent new block types or new data fields.
- Prefer structured Keystone blocks over custom_html.
- Use custom_html only when no supported Keystone block can reasonably represent the section.
- If a section cannot be represented exactly, choose the nearest supported block and mark that block as "approximated" with a short compatibility note.
- It is valid to use builder-native feed/setup blocks like blog, events, menu, booking, and productGrid when the page clearly represents those concepts.
- Preserve important copy, CTA text, FAQ content, pricing content, contact info, and section ordering.
- Do not include image URLs in builder block data unless the schema explicitly calls for an external URL field like videoUrl. Media assets are handled separately.
- Return JSON only with keys: pageType, blocks, warnings, confidenceNote.
- blocks must be an ordered array of objects with keys:
  - type: one supported Keystone block type
  - data: object matching that block schema
  - sourceSectionIds: optional array of extractedContext section ids used for traceability
  - compatibility: "supported" or "approximated"
  - compatibilityNotes: optional short migration notes
- warnings must be short migration warnings for the whole page.

SUPPORTED KEYSTONE BLOCK SCHEMAS:
${BLOCK_SCHEMAS}`;
  const serializedPayload = JSON.stringify(payload, null, 2);
  logger.info('page.normalize.prompt', {
    url: page.finalUrl,
    model: lightModel,
    provider,
    systemPrompt: system,
    userPrompt: serializedPayload,
    eligibility: eligibility.reason,
  });

  const apiKey = process.env.AI_BUILDER_API_KEY;
  if (!apiKey) {
    logger.warn('page.normalize.skip', {
      url: page.finalUrl,
      reason: 'missing_ai_builder_api_key',
      eligibility: eligibility.reason,
    });
    return null;
  }

  if (budget.estimatedTokensUsed + estimatedTokens > modeConfig.tokenBudget) {
    budget.exhausted = true;
    warnings.push(`LLM budget reached while processing ${page.finalUrl}; continuing with heuristic fallback output only.`);
    logger.warn('page.normalize.skip', {
      url: page.finalUrl,
      reason: 'token_budget_exceeded',
      estimatedTokens,
      tokenBudget: modeConfig.tokenBudget,
      estimatedTokensUsed: budget.estimatedTokensUsed,
    });
    return null;
  }

  const cacheKeyParts = [CONTENT_MAPPING_VERSION, page.finalUrl, page.contentHash, mode, provider, lightModel];
  const cached = await readCache<NormalizationDecision>('page-normalization', cacheKeyParts);
  if (cached) {
    cacheState.normalizationHits += 1;
    logger.info('page.normalize.cache_hit', {
      url: page.finalUrl,
      model: lightModel,
      provider,
      estimatedTokens,
      reason: eligibility.reason,
    });
    return cached;
  }

  budget.estimatedTokensUsed += estimatedTokens;
  budget.llmPagesUsed += 1;
  logger.info('page.normalize.start', {
    url: page.finalUrl,
    model: lightModel,
    provider,
    estimatedTokens,
    reason: eligibility.reason,
    sectionCount: page.sections.filter((section) => !section.repeated).length,
    renderMode: page.renderMode,
  });


  try {
    const raw = provider === 'openai'
      ? await callOpenAi(apiKey, lightModel, system, payload)
      : await callAnthropic(apiKey, lightModel, system, payload);
    const decision = extractJsonObject(raw);
    if (!decision) {
      throw new Error('Normalization payload could not be parsed.');
    }

    await writeCache('page-normalization', cacheKeyParts, decision);
    logger.info('page.normalize.success', {
      url: page.finalUrl,
      model: lightModel,
      pageType: decision.pageType || null,
      decidedBlocks: decision.blocks?.length || 0,
      warningCount: decision.warnings?.length || 0,
    });
    return decision;
  } catch (error) {
    logger.warn('page.normalize.error', {
      url: page.finalUrl,
      model: lightModel,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    if (!modeConfig.allowFallbackLlm || mode !== 'deep' || budget.llmFallbackPages >= 2 || fallbackModel === lightModel) {
      warnings.push(`AI block mapping failed for ${page.finalUrl}; kept heuristic fallback output.`);
      return null;
    }

    const fallbackTokens = Math.ceil(estimatedTokens * 1.2);
    if (budget.estimatedTokensUsed + fallbackTokens > modeConfig.tokenBudget) {
      warnings.push(`Fallback normalization budget was exhausted for ${page.finalUrl}; kept heuristic fallback output.`);
      return null;
    }

    budget.estimatedTokensUsed += fallbackTokens;
    budget.llmFallbackPages += 1;
    logger.info('page.normalize.fallback_start', {
      url: page.finalUrl,
      model: fallbackModel,
      provider,
      estimatedTokens: fallbackTokens,
    });
    logger.info('page.normalize.fallback_prompt', {
      url: page.finalUrl,
      model: fallbackModel,
      provider,
      systemPrompt: system,
      userPrompt: serializedPayload,
    });

    try {
      const raw = provider === 'openai'
        ? await callOpenAi(apiKey, fallbackModel, system, payload)
        : await callAnthropic(apiKey, fallbackModel, system, payload);
      const decision = extractJsonObject(raw);
      if (!decision) throw new Error('Fallback normalization could not be parsed.');
      await writeCache('page-normalization', [CONTENT_MAPPING_VERSION, page.finalUrl, page.contentHash, mode, provider, fallbackModel], decision);
      logger.info('page.normalize.fallback_success', {
        url: page.finalUrl,
        model: fallbackModel,
        pageType: decision.pageType || null,
        decidedBlocks: decision.blocks?.length || 0,
        warningCount: decision.warnings?.length || 0,
      });
      return decision;
    } catch (fallbackError) {
      logger.warn('page.normalize.fallback_error', {
        url: page.finalUrl,
        model: fallbackModel,
        message: fallbackError instanceof Error ? fallbackError.message : 'Unknown error',
      });
      warnings.push(`Fallback AI block mapping failed for ${page.finalUrl}; kept heuristic fallback output.`);
      return null;
    }
  }
}

function chooseTemplateSuggestion(pages: ExtractedPage[]) {
  const typeCounts = new Map<string, number>();
  for (const page of pages) {
    typeCounts.set(page.inferredType, (typeCounts.get(page.inferredType) || 0) + 1);
  }

  const hasPricing = (typeCounts.get('pricing') || 0) > 0;
  const hasPortfolio = (typeCounts.get('portfolio') || 0) > 0;
  const hasTeam = (typeCounts.get('team') || 0) > 0;
  const servicesWeight = (typeCounts.get('services') || 0) + (typeCounts.get('contact') || 0) + (hasTeam ? 1 : 0);
  const productsWeight = (typeCounts.get('pricing') || 0) + (typeCounts.get('portfolio') || 0) + (pages.some((page) => page.downloads.length > 0) ? 1 : 0);
  const businessType: BusinessType = servicesWeight > productsWeight + 1 ? 'services' : productsWeight > servicesWeight + 1 ? 'products' : 'both';

  if (hasPortfolio) {
    return { style: 'airy', businessType, reason: 'The source site leans on showcase pages and visual sections, which fit Airy well.' };
  }
  if (hasPricing || businessType === 'products') {
    return { style: 'sleek', businessType, reason: 'The site includes plan or offer comparisons that map cleanly into Sleek product-style layouts.' };
  }
  if (hasTeam) {
    return { style: 'classic', businessType, reason: 'The source emphasizes trust, team, and structured service pages, which fit Classic best.' };
  }
  return { style: 'organic', businessType, reason: 'The content reads like a service-led brochure site and Organic provides a flexible multi-page baseline.' };
}

function buildNavigation(pages: MappedPageExport[]) {
  const importantTypes = new Set(['home', 'about', 'services', 'contact', 'faq', 'team', 'pricing', 'locations', 'portfolio']);
  return pages
    .map((page) => ({
      navOrder: 0,
      label: page.title,
      pageSlug: page.slug,
      href: page.slug === 'home' ? '/' : `/${page.slug}`,
      linkType: 'page',
      isVisibleInPrimaryNav: importantTypes.has(page.inferredType),
    }))
    .sort((left, right) => {
      if (left.pageSlug === 'home') return -1;
      if (right.pageSlug === 'home') return 1;
      return left.isVisibleInPrimaryNav === right.isVisibleInPrimaryNav
        ? left.label.localeCompare(right.label)
        : left.isVisibleInPrimaryNav ? -1 : 1;
    })
    .map((item, index) => ({ ...item, navOrder: index }));
}

function buildCompatibilityReport(mappedPages: MappedPageExport[]) {
  const pageReports: ContentCompatibilityPageReport[] = mappedPages.map((page) => ({
    title: page.title,
    url: page.url,
    slug: page.slug,
    inferredType: page.inferredType,
    confidence: page.confidence,
    compatibilityStatus: page.compatibilityStatus,
    supportedSections: page.supportedSections,
    approximatedSections: page.approximatedSections,
    unsupportedSections: page.unsupportedSections,
    manualFollowUpRequired: page.manualFollowUpRequired,
    builderBlocks: page.builderBlocks.map((block) => block.type),
    warnings: page.warnings,
  }));

  return {
    fullySupportedPages: mappedPages.filter((page) => page.compatibilityStatus === 'supported').length,
    approximatedPages: mappedPages.filter((page) => page.compatibilityStatus === 'approximated').length,
    manualCleanupPages: mappedPages.filter((page) => page.compatibilityStatus === 'manual_cleanup').length,
    supportedSections: mappedPages.reduce((sum, page) => sum + page.supportedSections, 0),
    approximatedSections: mappedPages.reduce((sum, page) => sum + page.approximatedSections, 0),
    unsupportedSections: mappedPages.reduce((sum, page) => sum + page.unsupportedSections, 0),
    manualFollowUpRequired: mappedPages.some((page) => page.manualFollowUpRequired),
    pages: pageReports,
  } satisfies ContentCompatibilityReport;
}

function collectLegalLinks(footerLinks: ActionLink[]) {
  return footerLinks.filter((link) => LEGAL_LIKE_RE.test(new URL(link.url).pathname.toLowerCase()));
}

function summarizeWarnings(warnings: string[]) {
  return uniqueStrings(warnings).slice(0, 60);
}

function buildContentPreview(
  mode: ScraperMode,
  includeBlog: boolean,
  aiOnly: boolean,
  mappedPages: MappedPageExport[],
  compatibility: ContentCompatibilityReport,
  templateSuggestion: { style: string; businessType: BusinessType; reason: string },
  navigation: Array<{ label: string; pageSlug: string; href: string; isVisibleInPrimaryNav: boolean }>,
  globals: {
    footerLinks: ActionLink[];
    contact: ExtractedPage['contact'];
    socialLinks: Record<string, string>;
    logos: string[];
    repeatedCtas: ActionLink[];
    legalLinks: ActionLink[];
  },
  exportFiles: ContentExportFileMeta[],
  budget: BudgetState,
  cacheState: CacheState,
  modeConfig: ModeConfig
) {
  const pages: ContentPagePreview[] = mappedPages.map((page) => ({
    title: page.title,
    url: page.url,
    slug: page.slug,
    inferredType: page.inferredType,
    confidence: page.confidence,
    compatibilityStatus: page.compatibilityStatus,
    warningsCount: page.warnings.length,
    warnings: page.warnings,
    builderBlocks: page.builderBlocks.map((block) => block.type),
    sourceSectionCount: page.builderBlocks.reduce((sum, block) => sum + block.sourceSectionIds.length, 0),
    builderSectionCount: page.builderBlocks.length,
  }));

  return {
    mode,
    includeBlog,
    aiOnly,
    templateSuggestion,
    pages,
    globals: {
      navigationCount: navigation.filter((item) => item.isVisibleInPrimaryNav).length,
      footerNavigationCount: globals.footerLinks.length,
      hasContactInfo: Boolean(globals.contact.phone || globals.contact.email || globals.contact.address),
      socialCount: Object.keys(globals.socialLinks).length,
      legalLinkCount: globals.legalLinks.length,
      logoCount: globals.logos.length,
      repeatedGlobalCtaCount: globals.repeatedCtas.length,
    },
    compatibility,
    exportFiles,
    budget: {
      maxPages: modeConfig.maxPages,
      maxDepth: modeConfig.maxDepth,
      tokenBudget: modeConfig.tokenBudget,
      estimatedTokensUsed: budget.estimatedTokensUsed,
      llmPagesUsed: budget.llmPagesUsed,
      llmFallbackPages: budget.llmFallbackPages,
      exhausted: budget.exhausted,
    },
    cache: cacheState,
  } satisfies ContentScraperPreview;
}

function getMappedPageSeoDescription(page?: MappedPageExport) {
  const designData = page?.pageRecord.design_data;
  if (!designData || typeof designData !== 'object') return '';
  const seoDescription = (designData as Record<string, unknown>).seoDescription;
  return typeof seoDescription === 'string' ? seoDescription : '';
}

function buildExportFiles(
  rootUrl: string,
  mode: ScraperMode,
  includeBlog: boolean,
  aiOnly: boolean,
  pages: ExtractedPage[],
  mappedPages: MappedPageExport[],
  compatibility: ContentCompatibilityReport,
  preview: ContentScraperPreview,
  globals: {
    navigation: Array<{ label: string; pageSlug: string; href: string; linkType: string; isVisibleInPrimaryNav: boolean; navOrder: number }>;
    footerLinks: ActionLink[];
    contact: ExtractedPage['contact'];
    socialLinks: Record<string, string>;
    logos: string[];
    favicon: string;
    repeatedCtas: ActionLink[];
    legalLinks: ActionLink[];
  },
  templateSuggestion: { style: string; businessType: BusinessType; reason: string },
  crawlWarnings: string[]
) {
  const builderImport = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceUrl: rootUrl,
    mode,
    includeBlog,
    aiOnly,
    templateSuggestion,
    builderSiteModel: {
      selectedTemplateStyle: templateSuggestion.style,
      businessType: templateSuggestion.businessType,
      designData: {
        siteTitle: mappedPages.find((page) => page.slug === 'home')?.title || new URL(rootUrl).hostname,
        seoTitle: mappedPages.find((page) => page.slug === 'home')?.title || '',
        seoDescription: getMappedPageSeoDescription(mappedPages.find((page) => page.slug === 'home')),
        siteLogo: globals.logos[0] || '',
        faviconLogo: globals.favicon || globals.logos[0] || '',
        socialLinks: globals.socialLinks,
      },
      navigation: globals.navigation,
      footerLinks: globals.footerLinks,
      contactInfo: globals.contact,
    },
    pages: mappedPages.map((page, index) => ({
      ...page.pageRecord,
      nav_order: index,
      migration: {
        sourceUrl: page.url,
        inferredType: page.inferredType,
        confidence: page.confidence,
        compatibilityStatus: page.compatibilityStatus,
        warnings: page.warnings,
        compatibilityNotes: page.compatibilityNotes,
      },
    })),
  } satisfies ContentBuilderImportPayload;

  const pageFiles = mappedPages.map((page) => ({
    path: `pages/${page.slug}.json`,
    content: JSON.stringify(
      {
        sourceUrl: page.url,
        title: page.title,
        slug: page.slug,
        inferredType: page.inferredType,
        confidence: page.confidence,
        compatibilityStatus: page.compatibilityStatus,
        pageRecord: page.pageRecord,
        builderBlocks: page.builderBlocks,
        mediaReferences: page.mediaReferences,
        warnings: page.warnings,
        compatibilityNotes: page.compatibilityNotes,
      },
      null,
      2
    ),
  }));

  return {
    builderImport,
    files: [
    {
      path: 'manifest.json',
      content: JSON.stringify(
        {
          schemaVersion: 1,
          generatedAt: new Date().toISOString(),
          contentMappingVersion: CONTENT_MAPPING_VERSION,
          sourceUrl: rootUrl,
          mode,
          includeBlog,
          aiOnly,
          templateSuggestion,
          supportedBlockTypes: SUPPORTED_BLOCK_TYPES,
          note: 'This is a builder-oriented migration export. Page blocks map to Keystone-supported block types, while navigation is stored as pageSlug-based draft data until page IDs exist.',
        },
        null,
        2
      ),
    },
    {
      path: 'summary.json',
      content: JSON.stringify(
        {
          discoveredPages: pages.length,
          extractedPages: mappedPages.length,
          builderCompatiblePages: compatibility.fullySupportedPages,
          approximatedPages: compatibility.approximatedPages,
          manualCleanupPages: compatibility.manualCleanupPages,
          navigationItems: globals.navigation.filter((item) => item.isVisibleInPrimaryNav).length,
          globalsFound: {
            footerLinks: globals.footerLinks.length,
            contact: globals.contact,
            socialLinks: globals.socialLinks,
            logos: globals.logos.length,
          },
        },
        null,
        2
      ),
    },
    { path: 'warnings.json', content: JSON.stringify({ warnings: crawlWarnings }, null, 2) },
    { path: 'compatibility-report.json', content: JSON.stringify(compatibility, null, 2) },
    { path: 'site/navigation.json', content: JSON.stringify(globals.navigation, null, 2) },
    {
      path: 'site/globals.json',
      content: JSON.stringify(
        {
          contactInfo: globals.contact,
          socialLinks: globals.socialLinks,
          logos: globals.logos,
          favicon: globals.favicon,
          footerLinks: globals.footerLinks,
          repeatedGlobalCtas: globals.repeatedCtas,
          legalLinks: globals.legalLinks,
        },
        null,
        2
      ),
    },
    {
      path: 'site/media-manifest.json',
      content: JSON.stringify(
        dedupeByText(
          mappedPages.flatMap((page) =>
            page.mediaReferences.map((reference) => ({
              ...reference,
              pageSlug: page.slug,
              pageUrl: page.url,
            }))
          ),
          (item) => `${item.type}|${item.url}|${item.pageSlug}`
        ),
        null,
        2
      ),
    },
    { path: 'builder-import.json', content: JSON.stringify(builderImport, null, 2) },
    {
      path: 'raw/crawl-report.json',
      content: JSON.stringify(
        {
          sourceUrl: rootUrl,
          mode,
          includeBlog,
          aiOnly,
          discoveredPages: pages.map((page) => ({
            url: page.finalUrl,
            canonical: page.canonical,
            slug: page.slug,
            inferredType: page.inferredType,
            contentHash: page.contentHash,
            fromCache: page.fromCache,
            jsWarning: page.jsWarning,
            renderMode: page.renderMode,
          })),
          warnings: crawlWarnings,
        },
        null,
        2
      ),
    },
    {
      path: 'raw/extraction-debug.json',
      content: JSON.stringify(
        {
          pages: pages.map((page) => ({
            sourceUrl: page.sourceUrl,
            finalUrl: page.finalUrl,
            title: page.title,
            slug: page.slug,
            inferredType: page.inferredType,
            navLinks: page.navLinks,
            footerLinks: page.footerLinks,
            contact: page.contact,
            socialLinks: page.socialLinks,
            sections: page.sections,
            renderMode: page.renderMode,
            jsWarning: page.jsWarning,
          })),
          preview,
        },
        null,
        2
      ),
    },
    ...pageFiles,
    ],
  };
}

export async function runContentScraper(inputUrl: string, options: ContentScraperOptions = {}): Promise<ScraperResult> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(inputUrl);
  } catch {
    throw new Error('Invalid URL.');
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Invalid URL.');
  }

  const mode = options.mode || 'standard';
  const includeBlog = Boolean(options.includeBlog);
  const aiOnly = Boolean(options.aiOnly);
  const modeConfig = resolveModeConfig(mode, aiOnly);
  const warnings: string[] = [];
  const budget: BudgetState = { estimatedTokensUsed: 0, llmPagesUsed: 0, llmFallbackPages: 0, exhausted: false };
  const cacheState: CacheState = { pageHits: 0, pageMisses: 0, normalizationHits: 0, jobHit: false };
  const browserState: BrowserRenderState = { pagesRendered: 0, unavailable: false };
  const logger = createContentScraperLogger(parsedUrl.toString(), mode, includeBlog);
  logger.info('job.mapping_config', {
    aiOnly,
    heuristicFallbackEnabled: !aiOnly,
  });
  const normalizationConfig = resolveNormalizationConfig(options.llmModel, logger);
  logger.info('job.model_config', {
    requestedModel: options.llmModel || 'auto',
    provider: normalizationConfig.provider,
    lightModel: normalizationConfig.lightModel,
    fallbackModel: normalizationConfig.fallbackModel,
    source: normalizationConfig.modelSource,
  });

  const startPage = await fetchHtmlPage(parsedUrl.toString(), cacheState, modeConfig, browserState, logger);
  const rootUrl = startPage.url;
  logger.info('job.root_fetched', {
    requestedUrl: parsedUrl.toString(),
    finalUrl: rootUrl,
    textLength: startPage.textLength,
    jsRendered: startPage.isLikelyJsRendered,
    renderMode: startPage.renderMode,
    browserFallbackUsed: startPage.browserFallbackUsed,
    fromCache: startPage.fromCache,
  });
  const robotsRules = await discoverRobotsRules(rootUrl, warnings);
  const sitemapUrls = await discoverSitemapUrls(rootUrl, robotsRules, warnings);
  const homeNavLinks = extractPrimaryNavLinks(startPage.$, rootUrl);
  const homeFooterLinks = extractFooterLinks(startPage.$, rootUrl);
  logger.info('job.discovery', {
    rootUrl,
    sitemapUrls: sitemapUrls.length,
    robotsSitemaps: robotsRules.sitemaps.length,
    robotsDisallowRules: robotsRules.disallowPrefixes.length,
    homeNavLinks: homeNavLinks.length,
    homeFooterLinks: homeFooterLinks.length,
    mode,
    includeBlog,
    maxPages: modeConfig.maxPages,
    maxDepth: modeConfig.maxDepth,
    maxBrowserPages: modeConfig.maxBrowserPages,
  });

  const queue: CrawlCandidate[] = [];
  const seen = new Set<string>();
  function enqueue(url: string, depth: number, source: string) {
    const normalized = normalizeUrl(url, rootUrl);
    if (!normalized || seen.has(normalized) || !isSameSite(normalized, rootUrl) || isNoiseUrl(normalized) || isDisallowedByRobots(normalized, robotsRules)) return;
    if (!includeBlog && isBlogLikeUrl(normalized)) return;
    seen.add(normalized);
    queue.push({ url: normalized, depth, source, isBlog: isBlogLikeUrl(normalized) });
  }

  enqueue(rootUrl, 0, 'root');
  sitemapUrls.forEach((url) => enqueue(url, 1, 'sitemap'));
  homeNavLinks.forEach((link) => enqueue(link.url, 1, 'primary-nav'));
  homeFooterLinks.forEach((link) => enqueue(link.url, 1, 'footer'));
  logger.debug('job.queue_seeded', {
    queuedPages: queue.length,
    sample: queue.slice(0, 8).map((candidate) => ({ url: candidate.url, depth: candidate.depth, source: candidate.source })),
  });

  const extractedPages: ExtractedPage[] = [];
  const pageHtmlByUrl = new Map<string, string>();
  const failedUrls: string[] = [];
  let blogPagesSkipped = sitemapUrls.filter((url) => isBlogLikeUrl(url)).length;

  while (queue.length > 0 && extractedPages.length < modeConfig.maxPages) {
    const current = queue.shift();
    if (!current) break;

    try {
      const page = current.url === rootUrl && extractedPages.length === 0 ? startPage : await fetchHtmlPage(current.url, cacheState, modeConfig, browserState, logger);
      logger.debug('page.fetch', {
        url: current.url,
        depth: current.depth,
        source: current.source,
        finalUrl: page.url,
        textLength: page.textLength,
        jsRendered: page.isLikelyJsRendered,
        renderMode: page.renderMode,
        browserFallbackUsed: page.browserFallbackUsed,
        fromCache: page.fromCache,
      });
      const canonical = normalizeUrl(page.$('link[rel="canonical"]').attr('href') || '', page.url) || page.url;
      if (!isSameSite(canonical, rootUrl)) continue;
      if (extractedPages.some((entry) => entry.finalUrl === canonical || entry.contentHash === page.contentHash)) continue;

      const extracted = await extractPage(page, rootUrl, warnings);
      pageHtmlByUrl.set(extracted.finalUrl, page.html);
      extractedPages.push(extracted);
      logger.info('page.extracted', {
        url: extracted.finalUrl,
        slug: extracted.slug,
        inferredType: extracted.inferredType,
        sections: extracted.sections.length,
        navLinks: extracted.navLinks.length,
        footerLinks: extracted.footerLinks.length,
        pageLinks: extracted.pageLinks.length,
        ctas: extracted.ctas.length,
        images: extracted.images.length,
        downloads: extracted.downloads.length,
        jsWarning: extracted.jsWarning,
        renderMode: extracted.renderMode,
        fromCache: extracted.fromCache,
      });

      if (extracted.jsWarning && extracted.renderMode === 'static' && extracted.sections.length === 0) {
        warnings.push(`Static HTML for ${extracted.finalUrl} appears to be a client-rendered app shell. Browser rendering fallback was unavailable or did not recover more content.`);
      }

      if (current.depth < modeConfig.maxDepth) {
        const internalLinks = extractLinkList(page.$, page.url).filter((link) => !link.external);
        for (const link of internalLinks) {
          if (!includeBlog && isBlogLikeUrl(link.url)) {
            blogPagesSkipped += 1;
            continue;
          }
          enqueue(link.url, current.depth + 1, 'crawl');
        }
      }
    } catch (error) {
      failedUrls.push(current.url);
      warnings.push(`Page fetch failed for ${current.url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      logger.warn('page.fetch_failed', {
        url: current.url,
        depth: current.depth,
        source: current.source,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  if (queue.length > 0) {
    warnings.push(`Crawl stopped after ${modeConfig.maxPages} pages to stay within the ${mode} mode budget.`);
  }
  if (extractedPages.length === 0) {
    throw new Error('No public pages could be extracted from this website.');
  }

  markRepeatedSections(extractedPages);
  const templateSuggestion = chooseTemplateSuggestion(extractedPages);
  const mappedPages: MappedPageExport[] = [];

  for (const page of extractedPages) {
    const renderedHtml = pageHtmlByUrl.get(page.finalUrl) || '';
    const decision = await maybeNormalizePageWithAi(page, renderedHtml, mode, modeConfig, normalizationConfig, budget, cacheState, warnings, logger);
    const finalMappedPage = buildMappedPage(page, decision, aiOnly);
    logger.info('page.mapped_final', {
      url: page.finalUrl,
      slug: page.slug,
      confidence: finalMappedPage.confidence,
      compatibilityStatus: finalMappedPage.compatibilityStatus,
      builderBlocks: finalMappedPage.builderBlocks.map((block) => block.type),
      supportedSections: finalMappedPage.supportedSections,
      approximatedSections: finalMappedPage.approximatedSections,
      unsupportedSections: finalMappedPage.unsupportedSections,
      mappingSource: decision?.blocks?.length ? 'ai' : aiOnly ? 'ai_only_unmapped' : 'heuristic_fallback',
      usedAiNormalization: Boolean(decision?.blocks?.length),
      renderMode: page.renderMode,
    });
    mappedPages.push(finalMappedPage);
  }

  const navigation = buildNavigation(mappedPages);
  const footerLinks = dedupeByText(extractedPages.flatMap((page) => page.footerLinks), (link) => `${link.label}|${link.url}`).slice(0, 20);
  const socialLinks = Object.assign({}, ...extractedPages.map((page) => page.socialLinks));
  const contact = extractedPages.find((page) => page.contact.phone || page.contact.email || page.contact.address)?.contact || { phone: '', email: '', address: '', hours: '' };
  const logos = uniqueStrings(extractedPages.flatMap((page) => page.sections.flatMap((section) => section.logos).concat(page.images.filter((image) => /logo/i.test(image.alt)).map((image) => image.url)))).slice(0, 12);
  const favicon = normalizeUrl(startPage.$('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').first().attr('href') || '', rootUrl) || '';
  const repeatedCtas = dedupeByText(
    extractedPages
      .flatMap((page) => page.ctas)
      .filter((cta) => extractedPages.filter((page) => page.ctas.some((pageCta) => pageCta.label === cta.label && pageCta.url === cta.url)).length >= 2),
    (cta) => `${cta.label}|${cta.url}`
  );
  const legalLinks = collectLegalLinks(footerLinks);
  const compatibility = buildCompatibilityReport(mappedPages);
  const normalizedWarnings = summarizeWarnings([
    ...warnings,
    failedUrls.length > 0 ? `${failedUrls.length} page fetch${failedUrls.length === 1 ? '' : 'es'} failed during crawling.` : '',
    compatibility.manualCleanupPages > 0 ? `${compatibility.manualCleanupPages} page${compatibility.manualCleanupPages === 1 ? ' needs' : 's need'} manual cleanup in the builder.` : '',
    budget.exhausted ? `LLM normalization budget was exhausted; remaining pages used ${aiOnly ? 'AI-only empty/manual-cleanup output' : 'heuristic fallback only'}.` : '',
  ]);

  const preview = buildContentPreview(
    mode,
    includeBlog,
    aiOnly,
    mappedPages,
    compatibility,
    templateSuggestion,
    navigation,
    { footerLinks, contact, socialLinks, logos, repeatedCtas, legalLinks },
    [],
    budget,
    cacheState,
    modeConfig
  );

  const exportBundle = buildExportFiles(
    rootUrl,
    mode,
    includeBlog,
    aiOnly,
    extractedPages,
    mappedPages,
    compatibility,
    preview,
    { navigation, footerLinks, contact, socialLinks, logos, favicon, repeatedCtas, legalLinks },
    templateSuggestion,
    normalizedWarnings
  );
  const exportFiles = exportBundle.files;
  const builderImport = exportBundle.builderImport;
  const exportFileMeta: ContentExportFileMeta[] = exportFiles.map((file) => ({ path: file.path, size: Buffer.byteLength(file.content, 'utf8') }));
  const previewWithFiles = { ...preview, exportFiles: exportFileMeta } satisfies ContentScraperPreview;

  const jobCacheKey = [rootUrl, mode, includeBlog, aiOnly, extractedPages.map((page) => `${page.finalUrl}:${page.contentHash}`).sort().join('|')];
  const versionedJobCacheKey = [CONTENT_MAPPING_VERSION, ...jobCacheKey];
  const cachedJob = await readCache<{ zipBase64: string; zipFilename: string }>('job-export', versionedJobCacheKey);
  let zipBase64 = cachedJob?.zipBase64 || '';
  let zipFilename = cachedJob?.zipFilename || `keystone-content-${Date.now()}.zip`;
  if (cachedJob) {
    cacheState.jobHit = true;
    logger.info('job.zip_cache_hit', { rootUrl, exportFiles: exportFiles.length });
  } else {
    const zipBuffer = buildZip(exportFiles);
    zipBase64 = zipBuffer.toString('base64');
    zipFilename = `keystone-content-${Date.now()}.zip`;
    await writeCache('job-export', versionedJobCacheKey, { zipBase64, zipFilename });
    logger.info('job.zip_built', { rootUrl, exportFiles: exportFiles.length, zipFilename });
  }

  logger.info('job.complete', {
    rootUrl,
    extractedPages: extractedPages.length,
    mappedPages: mappedPages.length,
    failedPages: failedUrls.length,
    warnings: normalizedWarnings.length,
    llmPagesUsed: budget.llmPagesUsed,
    llmFallbackPages: budget.llmFallbackPages,
    estimatedTokensUsed: budget.estimatedTokensUsed,
    browserPagesRendered: browserState.pagesRendered,
    browserUnavailable: browserState.unavailable,
    cacheState,
    compatibility: {
      fullySupportedPages: compatibility.fullySupportedPages,
      approximatedPages: compatibility.approximatedPages,
      manualCleanupPages: compatibility.manualCleanupPages,
      unsupportedSections: compatibility.unsupportedSections,
    },
  });

  return {
    preset: 'content',
    provider: 'generic',
    providerLabel: 'Keystone builder-ready content export',
    csv: '',
    filename: zipFilename,
    rawJson: JSON.stringify({
      sourceUrl: rootUrl,
      mode,
      includeBlog,
      aiOnly,
      templateSuggestion,
      preview: previewWithFiles,
      mappedPages,
      extractedPages: extractedPages.map((page) => ({
        sourceUrl: page.sourceUrl,
        finalUrl: page.finalUrl,
        slug: page.slug,
        title: page.title,
        inferredType: page.inferredType,
        renderMode: page.renderMode,
        jsWarning: page.jsWarning,
        sections: page.sections,
      })),
      warnings: normalizedWarnings,
    }, null, 2),
    zipBase64,
    zipFilename,
    warnings: normalizedWarnings,
    summary: {
      discoveredPages: extractedPages.length,
      productsExtracted: mappedPages.length,
      csvRows: exportFiles.length,
      failedPages: failedUrls.length,
      skippedProducts: Math.max(0, seen.size - extractedPages.length),
      pagesExtracted: mappedPages.length,
      builderCompatiblePages: compatibility.fullySupportedPages,
      approximatedPages: compatibility.approximatedPages,
      manualCleanupPages: compatibility.manualCleanupPages,
      navigationItems: navigation.filter((item) => item.isVisibleInPrimaryNav).length,
      globalsFound: Number(Boolean(contact.phone || contact.email || contact.address)) + Object.keys(socialLinks).length + Number(logos.length > 0),
      cachedPages: cacheState.pageHits,
      llmPages: budget.llmPagesUsed,
      blogPagesSkipped,
    },
    previewRows: [],
    contentData: previewWithFiles,
    builderImport,
    metadata: {
      sourceUrl: rootUrl,
      strategy: aiOnly
        ? 'AI-led crawl + full HTML builder block mapping with no heuristic block fallback'
        : 'Deterministic crawl + builder block mapping with optional low-cost normalization',
      mode,
      aiOnly,
      traceId: logger.traceId,
      normalizationProvider: normalizationConfig.provider,
      normalizationModel: normalizationConfig.lightModel,
      normalizationModelSource: normalizationConfig.modelSource,
    },
  } satisfies ScraperResult;
}
