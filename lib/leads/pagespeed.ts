// Google PageSpeed Insights API client. Runs Lighthouse on a remote URL
// in Google's infrastructure and returns the report. Free, ~25k/day limit.
//
// Docs: https://developers.google.com/speed/docs/insights/v5/get-started

const PSI_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

// Categories we score. We omit PWA (irrelevant for our pitch).
const CATEGORIES = ['performance', 'seo', 'best-practices', 'accessibility'];

// Lighthouse audit IDs we care about for pitch angles. Each is either
// "binary" (passes/fails) or has a numeric score we threshold against.
export const TRACKED_AUDITS = [
  'is-on-https',                      // SSL
  'viewport',                         // Mobile viewport tag
  'tap-targets',                      // Mobile tap target sizing
  'content-width',                    // Mobile width
  'render-blocking-resources',        // Perf
  'uses-optimized-images',            // Perf
  'unused-javascript',                // Perf
  'meta-description',                 // SEO
  'document-title',                   // SEO
  'image-alt',                        // SEO + a11y
  'link-text',                        // SEO
  'crawlable-anchors',                // SEO
  'hreflang',                         // SEO
  'http-status-code',                 // SEO
  'robots-txt',                       // SEO
];

export interface PageSpeedResult {
  perfScore: number | null;
  seoScore: number | null;
  bestPracticesScore: number | null;
  accessibilityScore: number | null;
  mobileLoadSeconds: number | null;
  usesHttps: boolean | null;
  failedAudits: string[];
  fetchedUrl: string | null;
}

export class PageSpeedError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'PageSpeedError';
  }
}

export async function auditUrl(url: string, timeoutMs = 50_000): Promise<PageSpeedResult> {
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;
  // PSI works without an API key but with a much lower per-IP rate limit.
  // We fall back to keyless if not configured (handy in dev).

  const params = new URLSearchParams({ url, strategy: 'mobile' });
  for (const c of CATEGORIES) params.append('category', c);
  if (apiKey) params.set('key', apiKey);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${PSI_URL}?${params.toString()}`, {
      cache: 'no-store',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new PageSpeedError(
      `PageSpeed API ${response.status}: ${body.slice(0, 300)}`,
      response.status,
    );
  }

  const data = (await response.json()) as PsiResponse;
  return parse(data);
}

function parse(data: PsiResponse): PageSpeedResult {
  const cats = data.lighthouseResult?.categories ?? {};
  const score = (k: string): number | null => {
    const raw = cats[k]?.score;
    return typeof raw === 'number' ? Math.round(raw * 100) : null;
  };

  const audits = data.lighthouseResult?.audits ?? {};
  const failedAudits: string[] = [];
  for (const id of TRACKED_AUDITS) {
    const a = audits[id];
    if (!a) continue;
    // Lighthouse audit scoring: numericValue or score (0-1, null if not applicable).
    // An audit "fails" if score < 0.9 (Lighthouse's own pass/fail threshold).
    if (typeof a.score === 'number' && a.score < 0.9) {
      failedAudits.push(id);
    }
  }

  const isOnHttps = audits['is-on-https'];
  const usesHttps = typeof isOnHttps?.score === 'number' ? isOnHttps.score >= 0.9 : null;

  // Pull a representative "load time" — Largest Contentful Paint is the closest
  // to "what does the user see"; fall back to interactive.
  const lcp = audits['largest-contentful-paint']?.numericValue;
  const tti = audits['interactive']?.numericValue;
  const ms = typeof lcp === 'number' ? lcp : typeof tti === 'number' ? tti : null;
  const mobileLoadSeconds = ms === null ? null : Math.round((ms / 1000) * 10) / 10;

  return {
    perfScore: score('performance'),
    seoScore: score('seo'),
    bestPracticesScore: score('best-practices'),
    accessibilityScore: score('accessibility'),
    mobileLoadSeconds,
    usesHttps,
    failedAudits,
    fetchedUrl: data.lighthouseResult?.finalUrl ?? data.id ?? null,
  };
}

interface PsiResponse {
  id?: string;
  lighthouseResult?: {
    finalUrl?: string;
    categories?: Record<string, { score?: number | null }>;
    audits?: Record<string, { score?: number | null; numericValue?: number }>;
  };
}
