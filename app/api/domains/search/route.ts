import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
const AI_API_KEY = process.env.AI_BUILDER_API_KEY;

const VERCEL_API_BASE = 'https://api.vercel.com';

// TLDs ordered by preference — .ca first to push Canadian identity
const OTHER_TLDS = ['com', 'net', 'org', 'co', 'shop', 'store', 'io', 'xyz'];

interface VercelAvailabilityResult {
  domain: string;
  available: boolean;
}

interface VercelPriceData {
  years: number;
  purchasePrice: number | string;
  renewalPrice: number | string;
  transferPrice: number | string;
}

interface DomainResult {
  domain: string;
  available: boolean;
  price?: number;
  currency: string;
  isAlternative?: boolean;
}

/**
 * Use Claude Haiku to generate smart domain name alternatives.
 * One cheap/fast call replaces brittle programmatic string manipulation.
 */
async function generateAlternatives(query: string): Promise<string[]> {
  if (!AI_API_KEY) return [];

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': AI_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        system: `You generate domain name alternatives. Given a query, return a JSON array of 8-12 short, brandable domain name variations. Do NOT include the original query. Generate smart alternatives: abbreviations, hyphenated forms, slight respellings, dropped/added letters, compound splits, creative variations. Only lowercase alphanumeric and hyphens. No TLDs. No explanations — ONLY the JSON array.`,
        messages: [{ role: 'user', content: query }],
      }),
    });

    if (!res.ok) {
      console.error('Haiku alternatives error:', res.status);
      return [];
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '';

    // Parse the JSON array from Haiku's response
    const cleaned = text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const alternatives: string[] = JSON.parse(cleaned);

    // Sanitize: only allow valid domain labels, deduplicate, exclude original
    const seen = new Set<string>([query]);
    return alternatives
      .map(a => a.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, ''))
      .filter(a => {
        if (a.length < 2 || a.length > 63 || seen.has(a)) return false;
        seen.add(a);
        return true;
      })
      .slice(0, 12);
  } catch (err) {
    console.error('Failed to generate alternatives:', err);
    return [];
  }
}

/**
 * Bulk-check domain availability via Vercel's registrar API.
 * POST /v1/registrar/domains/availability — accepts up to 50 domains.
 */
async function checkBulkAvailability(
  domains: string[]
): Promise<{ results: VercelAvailabilityResult[]; rateLimited: boolean }> {
  if (domains.length === 0) return { results: [], rateLimited: false };

  const teamParam = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : '';

  const res = await fetch(
    `${VERCEL_API_BASE}/v1/registrar/domains/availability${teamParam}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${VERCEL_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ domains }),
    }
  );

  if (res.status === 429) {
    const errData = await res.json();
    console.warn('Vercel rate limited:', errData.retryAfter, errData.limit);
    return { results: [], rateLimited: true };
  }

  if (!res.ok) {
    console.error('Vercel availability check failed:', res.status, await res.text());
    throw new Error('Failed to check domain availability');
  }

  const data = await res.json();
  return { results: data.results || [], rateLimited: false };
}

/**
 * Fetch price for a single domain via Vercel registrar API.
 * GET /v1/registrar/domains/{domain}/price
 */
async function getDomainPrice(domain: string): Promise<number | undefined> {
  const teamParam = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : '';

  try {
    const res = await fetch(
      `${VERCEL_API_BASE}/v1/registrar/domains/${encodeURIComponent(domain)}/price${teamParam}`,
      {
        headers: { Authorization: `Bearer ${VERCEL_API_TOKEN}` },
      }
    );

    if (!res.ok) return undefined;

    const data: VercelPriceData = await res.json();
    const price = typeof data.purchasePrice === 'string'
      ? parseFloat(data.purchasePrice)
      : data.purchasePrice;
    return isNaN(price) ? undefined : price;
  } catch {
    return undefined;
  }
}

/**
 * Fetch prices for multiple domains concurrently, with a concurrency cap.
 */
async function getPricesForDomains(
  domains: string[],
  maxConcurrent = 5
): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  const queue = [...domains];

  const worker = async () => {
    while (queue.length > 0) {
      const domain = queue.shift()!;
      const price = await getDomainPrice(domain);
      if (price !== undefined) prices.set(domain, price);
    }
  };

  const workers = Array.from(
    { length: Math.min(maxConcurrent, domains.length) },
    () => worker()
  );
  await Promise.all(workers);

  return prices;
}

/**
 * GET /api/domains/search?query=akdesigns
 *
 * Two-phase approach to minimize latency:
 *
 * Phase 1 (fast): Check exact query across .ca + other TLDs in one bulk call.
 *   - If exact .ca is available → return immediately, no AI needed.
 *
 * Phase 2 (only if .ca taken): Call Claude Haiku for smart alternatives,
 *   check those as .ca only, plus return other TLDs from phase 1.
 *
 * Response shape:
 *   recommended: [exact .ca match]
 *   suggestions: [alternative .ca domains from AI]
 *   other: [exact match in .com, .net, .org, etc]
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify Pro plan
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('subscription_status, subscription_plan')
      .eq('user_id', user.id)
      .single();

    const isPro = subscription?.subscription_status === 'active' &&
      subscription?.subscription_plan?.toLowerCase().includes('pro');

    if (!isPro) {
      return NextResponse.json(
        { error: 'Pro plan required for custom domains' },
        { status: 403 }
      );
    }

    const query = request.nextUrl.searchParams.get('query');
    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: 'Search query must be at least 2 characters' },
        { status: 400 }
      );
    }

    if (!VERCEL_API_TOKEN) {
      return NextResponse.json(
        { error: 'Domain search is not configured. Contact support.' },
        { status: 503 }
      );
    }

    // Clean the query: strip any TLD the user may have typed (e.g. "akdesigns.com" → "akdesigns")
    let cleanQuery = query.toLowerCase().replace(/[^a-z0-9-.]/g, '').replace(/^-+|-+$/g, '');
    const dotIndex = cleanQuery.indexOf('.');
    if (dotIndex > 0) {
      cleanQuery = cleanQuery.substring(0, dotIndex);
    }
    if (cleanQuery.length < 2) {
      return NextResponse.json(
        { error: 'Invalid domain query' },
        { status: 400 }
      );
    }

    // ── Phase 1: Check exact query across all TLDs ──────────────────────
    const allTlds = ['ca', ...OTHER_TLDS];
    const exactDomains = allTlds.map(tld => `${cleanQuery}.${tld}`);

    const { results: exactResults, rateLimited } = await checkBulkAvailability(exactDomains);

    if (rateLimited) {
      return NextResponse.json(
        { error: 'Domain search is temporarily rate limited. Please try again in a moment.' },
        { status: 429 }
      );
    }

    // Build availability map from phase 1
    const availabilityMap = new Map<string, boolean>();
    for (const r of exactResults) {
      availabilityMap.set(r.domain, r.available);
    }

    const caAvailable = availabilityMap.get(`${cleanQuery}.ca`) === true;

    const buildResult = (domain: string, isAlt: boolean): DomainResult => ({
      domain,
      available: availabilityMap.get(domain) ?? false,
      currency: 'USD',
      isAlternative: isAlt,
    });

    // Build recommended: always show exact .ca (even if taken, so user sees status)
    const recommended: DomainResult[] = [];
    const caDomain = `${cleanQuery}.ca`;
    if (availabilityMap.has(caDomain)) {
      recommended.push(buildResult(caDomain, false));
    }

    // Build other TLDs for exact query — only available ones
    let other: DomainResult[] = [];
    for (const tld of OTHER_TLDS) {
      const domain = `${cleanQuery}.${tld}`;
      if (availabilityMap.get(domain) === true) {
        other.push(buildResult(domain, false));
      }
    }

    // ── Phase 2: If .ca is taken, generate AI alternatives ──────────────
    let suggestions: DomainResult[] = [];
    let alternativeNames: string[] = [];

    if (!caAvailable) {
      // Call Haiku for smart alternatives
      alternativeNames = await generateAlternatives(cleanQuery);

      if (alternativeNames.length > 0) {
        // Check alternatives as .ca + other TLDs to populate both sections
        // Build candidate list: each alternative × .ca, plus each alternative × other TLDs
        const altDomains: string[] = [];
        const altDomainSet = new Set<string>();
        for (const name of alternativeNames) {
          // Always check .ca for smart suggestions
          const caDom = `${name}.ca`;
          if (!altDomainSet.has(caDom)) { altDomainSet.add(caDom); altDomains.push(caDom); }
          // Also check other TLDs so we can populate "explore other extensions" with available options
          for (const tld of OTHER_TLDS) {
            const dom = `${name}.${tld}`;
            if (!altDomainSet.has(dom)) { altDomainSet.add(dom); altDomains.push(dom); }
          }
        }

        // Cap at 50 (Vercel bulk limit)
        const toCheck = altDomains.slice(0, 50);

        const { results: altResults, rateLimited: altRateLimited } =
          await checkBulkAvailability(toCheck);

        if (!altRateLimited) {
          for (const r of altResults) {
            availabilityMap.set(r.domain, r.available);
          }

          // Smart suggestions: only available .ca alternatives
          for (const name of alternativeNames) {
            const domain = `${name}.ca`;
            if (availabilityMap.get(domain) === true) {
              suggestions.push({
                domain,
                available: true,
                currency: 'USD',
                isAlternative: true,
              });
            }
          }

          // Supplement "other" with available alternative domains in non-.ca TLDs
          // (only if the exact query's version of that TLD was taken)
          const otherDomainSet = new Set(other.map(o => o.domain));
          for (const name of alternativeNames) {
            for (const tld of OTHER_TLDS) {
              const domain = `${name}.${tld}`;
              if (availabilityMap.get(domain) === true && !otherDomainSet.has(domain)) {
                otherDomainSet.add(domain);
                other.push({
                  domain,
                  available: true,
                  currency: 'USD',
                  isAlternative: true,
                });
              }
            }
          }
        }
      }
    }

    // Fetch prices for all available domains across all sections
    const allAvailable = [
      ...recommended.filter(r => r.available),
      ...suggestions,
      ...other.filter(r => r.available),
    ].map(r => r.domain);

    const prices = await getPricesForDomains(allAvailable);

    // Attach prices to results
    for (const r of recommended) r.price = prices.get(r.domain);
    for (const r of other) r.price = prices.get(r.domain);
    for (const r of suggestions) r.price = prices.get(r.domain);

    return NextResponse.json({
      recommended,
      suggestions,
      other,
      alternatives: alternativeNames,
    });
  } catch (error) {
    console.error('Error searching domains:', error);
    return NextResponse.json(
      { error: 'Failed to search domains' },
      { status: 500 }
    );
  }
}
