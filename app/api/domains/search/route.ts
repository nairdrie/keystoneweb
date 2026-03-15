import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
const AI_API_KEY = process.env.AI_BUILDER_API_KEY;

const VERCEL_API_BASE = 'https://api.vercel.com';

// TLDs ordered by preference — .ca first to push Canadian identity
const CA_TLDS = ['ca'];
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
  if (!AI_API_KEY) return [query];

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
        system: `You generate domain name alternatives. Given a query, return a JSON array of 6-10 short, brandable domain name variations. Include the original query first, then smart alternatives: abbreviations, hyphenated forms, slight respellings, dropped/added letters, compound splits. Only lowercase alphanumeric and hyphens. No TLDs. No explanations — ONLY the JSON array.`,
        messages: [{ role: 'user', content: query }],
      }),
    });

    if (!res.ok) {
      console.error('Haiku alternatives error:', res.status);
      return [query];
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '';

    // Parse the JSON array from Haiku's response
    const cleaned = text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const alternatives: string[] = JSON.parse(cleaned);

    // Sanitize: only allow valid domain labels
    const valid = alternatives
      .map(a => a.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, ''))
      .filter(a => a.length >= 2 && a.length <= 63);

    // Ensure the original query is first and deduplicate
    const seen = new Set<string>();
    const result: string[] = [];
    for (const name of [query, ...valid]) {
      if (!seen.has(name)) {
        seen.add(name);
        result.push(name);
      }
    }

    return result.slice(0, 10);
  } catch (err) {
    console.error('Failed to generate alternatives:', err);
    return [query];
  }
}

/**
 * Bulk-check domain availability via Vercel's registrar API.
 * POST /v1/registrar/domains/availability — accepts up to 50 domains.
 */
async function checkBulkAvailability(
  domains: string[]
): Promise<{ results: VercelAvailabilityResult[]; rateLimited: boolean }> {
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
 * Fetch prices for multiple domains concurrently, with a concurrency cap
 * to avoid hammering Vercel's API.
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
 * 1. Claude Haiku generates smart name alternatives
 * 2. Cross alternatives × TLDs → up to 50 domain candidates
 * 3. Single bulk availability check via Vercel
 * 4. Fetch prices for available domains
 * 5. Return: recommended (.ca), other TLDs, suggestions (alternatives)
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

    // Clean the query: lowercase, valid domain chars only
    const cleanQuery = query.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '');
    if (cleanQuery.length < 2) {
      return NextResponse.json(
        { error: 'Invalid domain query' },
        { status: 400 }
      );
    }

    // Step 1: Generate smart alternatives via Claude Haiku
    const alternatives = await generateAlternatives(cleanQuery);

    // Step 2: Build domain candidates — alternatives × TLDs
    // The original query gets all TLDs; alternatives get only .ca + .com
    // This keeps us under the 50-domain bulk limit
    const allTlds = [...CA_TLDS, ...OTHER_TLDS];
    const altTlds = [...CA_TLDS, 'com'];

    const domainCandidates: string[] = [];
    const candidateSet = new Set<string>();

    for (let i = 0; i < alternatives.length; i++) {
      const name = alternatives[i];
      const tlds = i === 0 ? allTlds : altTlds; // Original query gets all TLDs

      for (const tld of tlds) {
        const domain = `${name}.${tld}`;
        if (!candidateSet.has(domain)) {
          candidateSet.add(domain);
          domainCandidates.push(domain);
        }
      }
    }

    // Cap at 50 (Vercel bulk limit)
    const domainsToCheck = domainCandidates.slice(0, 50);

    // Step 3: Bulk availability check — single API call
    const { results, rateLimited } = await checkBulkAvailability(domainsToCheck);

    if (rateLimited) {
      return NextResponse.json(
        { error: 'Domain search is temporarily rate limited. Please try again in a moment.' },
        { status: 429 }
      );
    }

    // Build a lookup map
    const availabilityMap = new Map<string, boolean>();
    for (const r of results) {
      availabilityMap.set(r.domain, r.available);
    }

    // Step 4: Fetch prices for available domains (concurrently, capped)
    const availableDomains = results
      .filter(r => r.available)
      .map(r => r.domain);

    const prices = await getPricesForDomains(availableDomains);

    // Step 5: Build response — split into recommended (.ca), other, suggestions
    const buildResult = (domain: string, isAlt: boolean): DomainResult => ({
      domain,
      available: availabilityMap.get(domain) ?? false,
      price: prices.get(domain),
      currency: 'USD',
      isAlternative: isAlt,
    });

    // Recommended: .ca domains for the original query
    const recommended: DomainResult[] = [];
    for (const tld of CA_TLDS) {
      const domain = `${cleanQuery}.${tld}`;
      if (availabilityMap.has(domain)) {
        recommended.push(buildResult(domain, false));
      }
    }

    // Other TLDs: non-.ca domains for the original query
    const other: DomainResult[] = [];
    for (const tld of OTHER_TLDS) {
      const domain = `${cleanQuery}.${tld}`;
      if (availabilityMap.has(domain)) {
        other.push(buildResult(domain, false));
      }
    }

    // Suggestions: alternative names that are available (any TLD)
    const suggestions: DomainResult[] = [];
    const suggestedSet = new Set<string>();
    for (let i = 1; i < alternatives.length; i++) {
      const name = alternatives[i];
      for (const tld of [...CA_TLDS, 'com']) {
        const domain = `${name}.${tld}`;
        if (
          availabilityMap.get(domain) &&
          !suggestedSet.has(domain)
        ) {
          suggestedSet.add(domain);
          suggestions.push(buildResult(domain, true));
        }
      }
    }

    // Sort suggestions: .ca first, then by name
    suggestions.sort((a, b) => {
      const aIsCa = a.domain.endsWith('.ca') ? 0 : 1;
      const bIsCa = b.domain.endsWith('.ca') ? 0 : 1;
      if (aIsCa !== bIsCa) return aIsCa - bIsCa;
      return a.domain.localeCompare(b.domain);
    });

    return NextResponse.json({
      recommended,
      other,
      suggestions,
      alternatives: alternatives.slice(1), // The name variations used (for transparency)
    });
  } catch (error) {
    console.error('Error searching domains:', error);
    return NextResponse.json(
      { error: 'Failed to search domains' },
      { status: 500 }
    );
  }
}
